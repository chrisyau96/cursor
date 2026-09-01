/* Browser/native integration: Google Drive backup, scheduled reminders, widgets. */
(function () {
  const Core = window.MomentumLaunchCore;
  if (!Core) return;

  const GIS_SRC = 'https://accounts.google.com/gsi/client';
  let tokenClient = null;
  let webTimer = null;
  let lastSlotSig = '';
  let driveBusy = false;

  function app() { return window.Momentum || null; }
  function state() { return app()?.getState?.() || null; }
  function settings() { return state()?.settings || {}; }
  function isNative() {
    try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
    catch (e) { return false; }
  }
  function cap() { return window.Capacitor?.Plugins || {}; }

  function clientId() {
    const fromSettings = (settings().googleClientId || '').trim();
    const fromConfig = (window.MOMENTUM_CONFIG?.googleClientId || '').trim();
    return fromSettings || fromConfig;
  }

  function readToken() {
    try { return JSON.parse(localStorage.getItem(Core.TOKEN_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function writeToken(tok) {
    if (!tok) localStorage.removeItem(Core.TOKEN_KEY);
    else localStorage.setItem(Core.TOKEN_KEY, JSON.stringify(tok));
  }
  function tokenValid() {
    const t = readToken();
    return !!(t?.accessToken && t.expiresAt && t.expiresAt > Date.now() + 15000);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some((s) => s.src === src)) { resolve(); return; }
      const el = document.createElement('script');
      el.src = src; el.async = true;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error('Could not load Google sign-in'));
      document.head.appendChild(el);
    });
  }

  async function ensureGis() {
    if (window.google?.accounts?.oauth2) return true;
    await loadScript(GIS_SRC);
    return !!(window.google?.accounts?.oauth2);
  }

  function requestToken(prompt) {
    const cid = clientId();
    if (!cid) return Promise.reject(new Error('Add a Google OAuth client ID in Settings first.'));
    return ensureGis().then(() => new Promise((resolve, reject) => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: cid,
        scope: Core.DRIVE_SCOPE,
        callback: (resp) => {
          if (resp?.error) { reject(new Error(resp.error_description || resp.error)); return; }
          writeToken({
            accessToken: resp.access_token,
            expiresAt: Date.now() + Number(resp.expires_in || 3600) * 1000,
          });
          resolve(resp.access_token);
        },
        error_callback: (err) => reject(new Error(err?.message || 'Google sign-in cancelled')),
      });
      tokenClient.requestAccessToken({ prompt: prompt || '' });
    }));
  }

  let socialReadyFor = '';
  async function socialLogin() {
    return cap().SocialLogin || null;
  }

  async function ensureSocialGoogle() {
    const social = await socialLogin();
    if (!social) return null;
    const cid = clientId();
    if (!cid) throw new Error('Add a Google OAuth Web client ID in Settings first.');
    if (socialReadyFor !== cid) {
      await social.initialize({ google: { webClientId: cid, mode: 'online' } });
      socialReadyFor = cid;
    }
    return social;
  }

  function saveNativeToken(tok, email, expiresAt) {
    if (!tok || String(tok).length < 20) return null;
    writeToken({ accessToken: tok, expiresAt: expiresAt || Date.now() + 50 * 60 * 1000, email: email || '' });
    if (email && state()?.settings) state().settings.driveEmail = email;
    return tok;
  }

  async function nativeGoogleToken(interactive) {
    const social = await ensureSocialGoogle();
    if (!social) return null;
    const scopes = ['email', 'profile', 'openid', Core.DRIVE_SCOPE];
    if (!interactive) {
      try {
        const logged = await social.isLoggedIn({ provider: 'google' });
        if (logged?.isLoggedIn) {
          const code = await social.getAuthorizationCode({ provider: 'google' });
          const tok = saveNativeToken(code?.accessToken, '', Date.now() + 50 * 60 * 1000);
          if (tok) return tok;
        }
      } catch (e) { /* fall through to silent Credential Manager */ }
    }
    const res = await social.login({
      provider: 'google',
      options: {
        scopes,
        forceRefreshToken: false,
        filterByAuthorizedAccounts: !interactive,
        autoSelectEnabled: true,
        style: interactive ? 'standard' : 'bottom',
      },
    });
    const result = res?.result || {};
    const tok = result.accessToken?.token || result.accessToken;
    const email = result.profile?.email || '';
    const expires = result.accessToken?.expires ? Date.parse(result.accessToken.expires) : 0;
    return saveNativeToken(tok, email, expires > Date.now() ? expires : Date.now() + 50 * 60 * 1000);
  }

  async function accessToken(interactive) {
    if (tokenValid()) return readToken().accessToken;
    if (isNative() && cap().SocialLogin) {
      const tok = await nativeGoogleToken(!!interactive);
      if (tok) return tok;
      if (!interactive) throw new Error('Google Drive needs Connect once');
    }
    return requestToken(interactive ? 'consent' : '');
  }

  async function driveFetch(url, opts) {
    const token = await accessToken(false);
    const res = await fetch(url, {
      ...opts,
      headers: { ...(opts?.headers || {}), Authorization: 'Bearer ' + token },
    });
    if (res.status === 401) {
      writeToken(null);
      const retryTok = await accessToken(true);
      const retry = await fetch(url, {
        ...opts,
        headers: { ...(opts?.headers || {}), Authorization: 'Bearer ' + retryTok },
      });
      if (!retry.ok) throw new Error('Drive request failed');
      return retry;
    }
    if (!res.ok) throw new Error('Drive request failed (' + res.status + ')');
    return res;
  }

  async function findDriveFile() {
    const s = settings();
    if (s.driveFileId) return s.driveFileId;
    const q = encodeURIComponent("name='" + Core.DRIVE_FILE_NAME + "'");
    const res = await driveFetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)&q=' + q, { method: 'GET' });
    const data = await res.json();
    return data.files?.[0]?.id || '';
  }

  function backupJson() {
    const st = JSON.parse(JSON.stringify(state()));
    if (st.settings) {
      delete st.settings.googleClientId;
    }
    return JSON.stringify(st);
  }

  async function uploadBackup() {
    if (driveBusy) return false;
    driveBusy = true;
    try {
      const body = backupJson();
      let fileId = await findDriveFile();
      if (!fileId) {
        const meta = { name: Core.DRIVE_FILE_NAME, parents: ['appDataFolder'] };
        const boundary = 'momentum' + Date.now();
        const mixed = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
        const res = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
          body: mixed,
        });
        const created = await res.json();
        fileId = created.id;
      } else {
        await driveFetch('https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(fileId) + '?uploadType=media', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
      }
      const st = state();
      st.settings.driveConnected = true;
      st.settings.driveFileId = fileId;
      st.settings.lastDriveBackupAt = new Date().toISOString();
      await app().save(true, { render: 'none' });
      renderDriveUi();
      return true;
    } finally {
      driveBusy = false;
    }
  }

  async function restoreBackup() {
    const fileId = await findDriveFile();
    if (!fileId) throw new Error('No Drive backup found yet.');
    const res = await driveFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media', { method: 'GET' });
    const data = await res.json();
    const keepDrive = {
      driveConnected: true,
      driveEmail: settings().driveEmail,
      driveBackupFreq: settings().driveBackupFreq || 'daily',
      driveFileId: fileId,
      googleClientId: settings().googleClientId,
      googleAndroidClientId: settings().googleAndroidClientId,
      lastDriveBackupAt: new Date().toISOString(),
    };
    app().setState(data);
    app().normalizeState();
    Object.assign(state().settings, keepDrive);
    await app().save(true, { render: 'all' });
    renderDriveUi();
    renderWidgetUi();
  }

  async function connectDrive() {
    const token = await accessToken(true);
    let email = '';
    try {
      const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + token } });
      if (info.ok) email = (await info.json()).email || '';
    } catch (e) { /* appdata scope may omit userinfo; that's ok */ }
    const st = state();
    st.settings.driveConnected = true;
    st.settings.driveEmail = email;
    if (!st.settings.driveBackupFreq) st.settings.driveBackupFreq = 'daily';
    await app().save(true, { render: 'none' });
    await uploadBackup();
    app().toast('Google Drive backup connected');
    renderDriveUi();
  }

  async function disconnectDrive() {
    const t = readToken();
    if (t?.accessToken && window.google?.accounts?.oauth2) {
      try { window.google.accounts.oauth2.revoke(t.accessToken); } catch (e) { /* ignore */ }
    }
    if (isNative() && cap().SocialLogin) {
      try { await cap().SocialLogin.logout({ provider: 'google' }); } catch (e) { /* ignore */ }
    }
    writeToken(null);
    socialReadyFor = '';
    const st = state();
    st.settings.driveConnected = false;
    st.settings.driveEmail = '';
    st.settings.driveFileId = '';
    await app().save(true, { render: 'none' });
    renderDriveUi();
    app().toast('Google Drive disconnected');
  }

  async function maybeAutoDriveBackup() {
    const s = settings();
    if (!Core.shouldDriveBackup(s, app().todayKey())) return;
    try {
      await uploadBackup();
      app().toast('Google Drive backup saved');
    } catch (e) {
      renderDriveUi();
    }
  }

  function formatStamp(iso) {
    if (!iso) return 'never';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function renderDriveUi() {
    const s = settings();
    const status = document.getElementById('driveStatus');
    const freq = document.getElementById('driveBackupFreq');
    const cid = document.getElementById('googleClientIdInput');
    if (cid && document.activeElement !== cid) cid.value = s.googleClientId || '';
    if (freq && document.activeElement !== freq) freq.value = s.driveBackupFreq || 'daily';
    if (status) {
      status.className = 'sync-status-panel' + (s.driveConnected ? ' connected' : '');
      if (s.driveConnected) {
        status.innerHTML = `<strong>Google Drive connected</strong>${s.driveEmail ? ' · ' + escape(s.driveEmail) : ''}<div class="small-note" style="margin-top:6px">Last auto backup: <strong>${formatStamp(s.lastDriveBackupAt)}</strong></div>`;
      } else {
        status.innerHTML = `<strong>Not connected</strong><div class="small-note" style="margin-top:6px">Sign in once. Momentum then backs up on the first open of the day or week — like Money Manager.</div>`;
      }
    }
    document.getElementById('driveConnectBtn')?.classList.toggle('hidden-action', !!s.driveConnected);
    document.getElementById('driveDisconnectBtn')?.classList.toggle('hidden-action', !s.driveConnected);
    document.getElementById('driveBackupNowBtn')?.classList.toggle('hidden-action', !s.driveConnected);
    document.getElementById('driveRestoreBtn')?.classList.toggle('hidden-action', !s.driveConnected);
  }

  function escape(s) { return app()?.escapeHtml ? app().escapeHtml(s) : String(s); }

  function habitNeedsReminderOn(h, dateKey) {
    const a = app();
    const date = a.parseDate(dateKey);
    if (!h.reminder?.enabled || h.paused || h.archived) return false;
    if (a.completionOfHabit(h, date).done) return false;
    if (a.isNotSpecific(h)) {
      const due = a.habitDueDate(h, date);
      const daysBefore = Number(h.reminder.daysBeforeDue ?? 1);
      const remindDate = new Date(a.parseDate(due));
      remindDate.setDate(remindDate.getDate() - daysBefore);
      return a.dateKey(remindDate) === dateKey;
    }
    return a.isScheduledToday(h, date) || a.isFlexibleHabit(h, date);
  }

  function readFired() {
    try { return JSON.parse(localStorage.getItem(Core.REMINDER_FIRED_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function markFired(key) {
    const map = readFired();
    const today = app().todayKey();
    Object.keys(map).forEach((k) => { if (!k.includes(today)) delete map[k]; });
    map[key] = 1;
    localStorage.setItem(Core.REMINDER_FIRED_KEY, JSON.stringify(map));
  }

  async function showLocalNotification(slot) {
    const title = slot.title || 'Momentum';
    const body = slot.body || '';
    try {
      if (isNative() && cap().LocalNotifications) {
        await cap().LocalNotifications.schedule({
          notifications: [{ id: slot.id, title, body, schedule: { at: new Date(slot.at) }, extra: slot.extra }],
        });
        return;
      }
    } catch (e) { /* fall through */ }
    if (navigator.serviceWorker) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg.showNotification) {
          await reg.showNotification(title, { body, icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', data: { url: './?widgetAction=open' } });
          return;
        }
      } catch (e) { /* fall through */ }
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body, icon: 'assets/icon-192.png' }); return; } catch (e) { /* ignore */ }
    }
    app()?.toast(body);
  }

  async function requestNotifPermission() {
    if (isNative() && cap().LocalNotifications) {
      const perm = await cap().LocalNotifications.requestPermissions();
      const granted = perm?.display === 'granted' || perm?.granted === true;
      try {
        const exact = await cap().LocalNotifications.checkExactNotificationSetting?.();
        if (granted && exact && exact.exact_alarm !== 'granted') {
          await cap().LocalNotifications.changeExactNotificationSetting?.();
        }
      } catch (e) { /* inexact alarms still fire */ }
      return granted;
    }
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }

  function currentSlots() {
    const a = app();
    const st = state();
    if (!st) return [];
    return Core.buildReminderSlots(a.activeHabits(), {
      todayKey: a.todayKey(),
      remindersEnabled: !!st.settings.reminders,
      days: 21,
      now: a.hkNow(),
      habitNeedsReminderOn,
      reminderBody: (h) => a.reminderBody(h),
    });
  }

  async function scheduleNative(slots) {
    if (!isNative() || !cap().LocalNotifications) return;
    try {
      const pending = await cap().LocalNotifications.getPending();
      const ids = (pending?.notifications || []).map((n) => ({ id: n.id }));
      if (ids.length) await cap().LocalNotifications.cancel({ notifications: ids });
      const notifications = Core.toNativeNotifications(slots || []);
      if (!notifications.length) return;
      await cap().LocalNotifications.schedule({ notifications });
    } catch (e) { /* keep web fallback */ }
  }

  function armWebTimer(slots) {
    if (webTimer) { clearTimeout(webTimer); webTimer = null; }
    const now = Date.now();
    const next = Core.nextWebTimerDelay(slots, now);
    if (!next) return;
    webTimer = setTimeout(async () => {
      const key = Core.firedKey(next.slot.habitId, next.slot.dateKey, next.slot.time);
      if (!readFired()[key]) {
        markFired(key);
        await showLocalNotification(Object.assign({}, next.slot, { at: Date.now() }));
      }
      await scheduleReminders();
    }, Math.max(1000, next.delay));
  }

  async function scheduleReminders() {
    const a = app();
    if (!a) return;
    const st = state();
    a.setupReminderLoopFallback?.();
    if (!st?.settings?.reminders) {
      if (webTimer) { clearTimeout(webTimer); webTimer = null; }
      if (isNative() && cap().LocalNotifications) {
        try {
          const pending = await cap().LocalNotifications.getPending();
          const ids = (pending?.notifications || []).map((n) => ({ id: n.id }));
          if (ids.length) await cap().LocalNotifications.cancel({ notifications: ids });
        } catch (e) { /* ignore */ }
      }
      renderReminderUi([]);
      return;
    }
    const slots = currentSlots();
    const sig = slots.map((s) => s.id + ':' + s.at).join(',');
    if (sig !== lastSlotSig) {
      lastSlotSig = sig;
      await scheduleNative(slots);
    }
    armWebTimer(slots);
    renderReminderUi(slots);
  }

  function renderReminderUi(slots) {
    const note = document.getElementById('reminderRuntimeNote');
    if (!note) return;
    const s = settings();
    if (!s.reminders) {
      note.textContent = 'Reminders are off.';
      return;
    }
    const n = (slots || currentSlots()).length;
    if (isNative()) {
      note.textContent = 'Device reminders are scheduled on this phone. They still fire if Momentum is closed or swiped away (Android OS alarms — not web push). Grant notification permission when asked.';
    } else {
      note.textContent = n
        ? `${n} reminder${n === 1 ? '' : 's'} queued. In the browser they fire only while Momentum is open. The Play / App Store app fires them when closed.`
        : 'No upcoming habit reminders in the next 21 days.';
    }
  }

  function outstandingToday() {
    const a = app();
    const now = a.hkNow();
    return a.activeHabits().filter((h) => !h.paused).map((h) => {
      const c = a.showsOnHomeToday(h, now) || a.isNotSpecific(h) ? a.todayViewCompletion?.(h, now) || a.completionOfHabit(h, now) : null;
      if (!c) return null;
      if (a.showsOnHomeToday(h, now) || (a.isNotSpecific(h) && !c.done)) {
        return { id: h.id, name: h.name, emoji: h.emoji || '✓', color: h.color, count: c.count, target: c.target, done: !!c.done, date: a.todayKey() };
      }
      return null;
    }).filter(Boolean);
  }

  function selectedHabitsSnapshot(cfg) {
    const a = app();
    const now = a.hkNow();
    const today = a.todayKey();
    const ids = cfg.habitIds.length ? cfg.habitIds : a.activeHabits().filter((h) => !h.paused).slice(0, cfg.layout).map((h) => h.id);
    return ids.slice(0, cfg.layout).map((id) => {
      const h = state().habits.find((x) => x.id === id);
      if (!h) return null;
      const due = a.habitDueDate(h, now);
      const c = a.completionOfHabit(h, now);
      return { id: h.id, name: h.name, emoji: h.emoji || '✓', color: h.color, due, dueLabel: Core.duePhrase(today, due), count: c.count, target: c.target, done: !!c.done };
    }).filter(Boolean);
  }

  function buildSnapshot() {
    const a = app();
    const st = state();
    const cfg = Core.normalizeWidgetConfig(st.settings.widget);
    const gift = a.activeGiftRule();
    const gp = gift ? a.giftProgress(gift) : null;
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      today: a.todayKey(),
      mode: cfg.mode,
      layout: cfg.layout,
      outstanding: outstandingToday(),
      habits: selectedHabitsSnapshot(cfg),
      streak: { current: a.streakAt(a.hkNow(), 100), best: a.longestPerfectStreak() },
      credits: a.creditTotal(),
      gift: gift ? { icon: gift.icon || '🎁', label: gift.gift || 'Gift', current: gp.current, target: gp.target, pct: gp.pct } : null,
      journal: { done: !!(st.journals || {})[a.todayKey()] },
    };
  }

  async function writeWidgetSnapshot() {
    const snap = buildSnapshot();
    localStorage.setItem(Core.SNAPSHOT_KEY, JSON.stringify(snap));
    try {
      if (isNative() && cap().Filesystem) {
        await cap().Filesystem.writeFile({
          path: 'momentum/widget-snapshot.json',
          data: JSON.stringify(snap),
          directory: 'DATA',
          encoding: 'utf8',
          recursive: true,
        });
      }
      await cap().MomentumWidgets?.update?.(snap);
    } catch (e) { /* web-only is fine */ }
    renderWidgetPreview(snap);
    return snap;
  }

  function readPending() {
    try { return JSON.parse(localStorage.getItem(Core.PENDING_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function writePending(list) {
    localStorage.setItem(Core.PENDING_KEY, JSON.stringify(list || []));
  }

  async function applyPendingFromNative() {
    let extra = [];
    try {
      if (isNative() && cap().Filesystem) {
        const file = await cap().Filesystem.readFile({ path: 'momentum/widget-pending.json', directory: 'DATA', encoding: 'utf8' });
        extra = JSON.parse(file.data || '[]');
        await cap().Filesystem.writeFile({ path: 'momentum/widget-pending.json', data: '[]', directory: 'DATA', encoding: 'utf8' });
      }
    } catch (e) { extra = []; }
    const pending = readPending().concat(extra);
    if (!pending.length) return;
    const a = app();
    const applied = Core.applyPendingActions(state(), pending, { uid: a.uid, todayKey: a.todayKey(), nowIso: new Date().toISOString() });
    writePending([]);
    const journal = applied.find((x) => x.type === 'journal');
    if (applied.some((x) => x.type === 'complete' || x.type === 'reset')) await a.save(false, { render: 'homeView' });
    if (journal) a.openJournalEditor(a.todayKey());
  }

  async function handleWidgetAction(action) {
    if (!action) return;
    const a = app();
    if (action.type === 'complete' && action.habitId) {
      await a.addRecord(action.habitId, 'widget', action.date || a.todayKey());
    } else if (action.type === 'reset' && action.habitId) {
      a.resetHabitForDate(action.habitId, action.date || a.todayKey());
    } else if (action.type === 'journal') {
      a.showView('homeView');
      a.openJournalEditor(a.todayKey());
    } else if (action.type === 'open') {
      a.showView(action.view || 'homeView');
    }
    await writeWidgetSnapshot();
  }

  async function ingestNativeWidgetPending(action) {
    await applyPendingFromNative();
    if (!action) return;
    if (action.type === 'complete' || action.type === 'reset') {
      await writeWidgetSnapshot();
      return;
    }
    await handleWidgetAction(action);
  }

  function consumeLaunchQuery() {
    const action = Core.parseQueryActions(location.search);
    if (!action) return;
    const url = new URL(location.href);
    url.searchParams.delete('widgetAction');
    url.searchParams.delete('habitId');
    url.searchParams.delete('date');
    url.searchParams.delete('view');
    history.replaceState({}, '', url.pathname + url.search + url.hash);
    void handleWidgetAction(action);
  }

  function renderWidgetPreview(snap) {
    const box = document.getElementById('widgetPreview');
    if (!box) return;
    const data = snap || buildSnapshot();
    const cfg = Core.normalizeWidgetConfig(settings().widget);
    let html = '';
    if (cfg.mode === 'today') {
      const rows = data.outstanding.slice(0, 6).map((h) => `<div class="widget-row"><span>${h.emoji} ${escape(h.name)}</span><strong>${h.count}/${h.target}</strong></div>`).join('') || '<div class="small-note">No outstanding tasks today</div>';
      html = `<div class="widget-frame"><div class="widget-kicker">Today</div>${rows}</div>`;
    } else if (cfg.mode === 'habits') {
      const rows = data.habits.map((h) => `<div class="widget-row"><span>${h.emoji} ${escape(h.name)}</span><strong>${h.dueLabel}</strong></div>`).join('') || '<div class="small-note">Select 1–6 habits</div>';
      html = `<div class="widget-frame layout-${cfg.layout}">${rows}</div>`;
    } else if (cfg.mode === 'streak') {
      html = `<div class="widget-frame widget-stat"><div class="widget-kicker">Streak</div><div class="widget-big">${data.streak.current}</div><div class="small-note">Best ${data.streak.best}</div></div>`;
    } else if (cfg.mode === 'credits') {
      html = `<div class="widget-frame widget-stat"><div class="widget-kicker">Credits</div><div class="widget-big">HK$${data.credits}</div></div>`;
    } else if (cfg.mode === 'gift') {
      html = data.gift
        ? `<div class="widget-frame widget-stat"><div class="widget-kicker">${data.gift.icon} ${escape(data.gift.label)}</div><div class="widget-big">${data.gift.current}/${data.gift.target}</div></div>`
        : `<div class="widget-frame"><div class="small-note">No gift goal yet</div></div>`;
    } else {
      html = `<div class="widget-frame widget-stat"><div class="widget-kicker">Journal</div><div class="widget-big">${data.journal.done ? '✓' : '✎'}</div><div class="small-note">${data.journal.done ? 'Logged today' : 'Tap to log'}</div></div>`;
    }
    box.innerHTML = html;
  }

  function renderWidgetUi() {
    const st = state();
    if (!st) return;
    const cfg = Core.normalizeWidgetConfig(st.settings.widget);
    document.querySelectorAll('#widgetModeTabs button').forEach((b) => b.classList.toggle('active', b.dataset.widgetMode === cfg.mode));
    const layout = document.getElementById('widgetLayout');
    if (layout) layout.value = String(cfg.layout);
    const list = document.getElementById('widgetHabitPicker');
    if (list) {
      const habits = app().activeHabits().filter((h) => !h.paused);
      list.innerHTML = habits.map((h) => {
        const on = cfg.habitIds.includes(h.id);
        return `<label class="widget-habit ${on ? 'on' : ''}"><input type="checkbox" data-widget-habit="${h.id}" ${on ? 'checked' : ''}> ${h.emoji || ''} ${escape(h.name)}</label>`;
      }).join('') || '<div class="small-note">Add habits first</div>';
      list.style.display = cfg.mode === 'habits' ? 'grid' : 'none';
    }
    const layoutWrap = document.getElementById('widgetLayoutWrap');
    if (layoutWrap) layoutWrap.style.display = cfg.mode === 'habits' ? 'block' : 'none';
    renderWidgetPreview();
  }

  function renderAdsUi() {
    const show = Core.shouldShowAds(settings());
    const banner = document.getElementById('adBanner');
    if (banner) banner.hidden = !show;
    document.body.classList.toggle('has-ads', show);
    const status = document.getElementById('adsStatus');
    if (status) {
      status.className = 'sync-status-panel' + (show ? '' : ' connected');
      status.innerHTML = show
        ? '<strong>Ads are on</strong><div class="small-note" style="margin-top:6px">Free version. One-time HK$38 removes every ad for life.</div>'
        : '<strong>Ads removed</strong><div class="small-note" style="margin-top:6px">Lifetime purchase is on this device.</div>';
    }
    const buy = document.getElementById('removeAdsBtn');
    if (buy) buy.classList.toggle('hidden-action', !show);
  }

  async function grantAdsRemoved() {
    const st = state();
    Object.assign(st.settings, Core.markAdsRemoved(st.settings));
    await app().save(true, { render: 'none' });
    renderAdsUi();
    try { await cap().AdMob?.hideBanner?.(); } catch (e) { /* ignore */ }
  }

  async function listStorePurchases() {
    const plugin = cap().NativePurchases;
    if (!plugin) return [];
    const query = { productType: 'inapp' };
    try {
      if (typeof plugin.restorePurchases === 'function') {
        try { await plugin.restorePurchases(); } catch (e) { /* continue to list */ }
      }
      if (typeof plugin.getPurchases === 'function') {
        const res = await plugin.getPurchases(query);
        return res?.purchases || res || [];
      }
    } catch (e) { return []; }
    return [];
  }

  async function restoreAdsPurchase(silent) {
    const owned = Core.purchaseOwnsRemoveAds(await listStorePurchases());
    if (owned && !Core.adsRemoved(settings())) {
      await grantAdsRemoved();
      if (!silent) app().toast('Purchase restored. Ads removed.');
      return true;
    }
    if (owned) {
      renderAdsUi();
      if (!silent) app().toast('Ads already removed.');
      return true;
    }
    if (!silent) {
      if (!isNative() || !cap().NativePurchases) {
        app().toast('Restore works in the Play Store app after you buy HK$38 remove-ads.');
      } else {
        app().toast('No remove-ads purchase found for this Google account.');
      }
    }
    renderAdsUi();
    return false;
  }

  async function purchaseRemoveAds() {
    if (Core.adsRemoved(settings())) {
      app().toast('Ads are already removed.');
      return;
    }
    const plugin = cap().NativePurchases;
    if (!isNative() || !plugin) {
      app().toast('HK$38 lifetime remove-ads is a Play Store purchase. Install the Android app to buy.');
      return;
    }
    try {
      if (typeof plugin.isBillingSupported === 'function') {
        const billing = await plugin.isBillingSupported();
        if (billing && billing.isBillingSupported === false) {
          app().toast('Google Play Billing is not available on this device.');
          return;
        }
      }
      await plugin.purchaseProduct({
        productIdentifier: Core.ADS_PRODUCT_ID,
        productType: 'inapp',
        quantity: 1,
      });
      await grantAdsRemoved();
      app().toast('Ads removed for life. Thank you!');
    } catch (e) {
      const msg = String(e?.message || e || '');
      if (/cancel/i.test(msg)) app().toast('Purchase cancelled');
      else app().toast(msg || 'Purchase failed');
    }
  }

  async function showAdsIfNeeded() {
    renderAdsUi();
    if (!Core.shouldShowAds(settings())) {
      try { await cap().AdMob?.hideBanner?.(); } catch (e) { /* ignore */ }
      return;
    }
    const admob = cap().AdMob;
    if (!isNative() || !admob) return;
    try {
      const appId = (settings().admobAppId || Core.ADMOB_TEST_APP_ID).trim();
      const bannerId = (settings().admobBannerId || Core.ADMOB_TEST_BANNER).trim();
      if (typeof admob.initialize === 'function') {
        await admob.initialize({ initializeForTesting: /3940256099942544/.test(appId), appIdAndroid: appId });
      }
      await admob.showBanner({
        adId: bannerId,
        adSize: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER',
        margin: 64,
      });
      const banner = document.getElementById('adBanner');
      if (banner) banner.hidden = true;
    } catch (e) { /* house banner stays visible */ }
  }

  async function saveWidgetConfig(patch) {
    const st = state();
    st.settings.widget = Core.normalizeWidgetConfig(Object.assign({}, st.settings.widget, patch));
    await app().save(true, { render: 'none' });
    renderWidgetUi();
    await writeWidgetSnapshot();
  }

  async function onStateSaved() {
    await writeWidgetSnapshot();
    await scheduleReminders();
    renderAdsUi();
  }

  function bindUi() {
    document.getElementById('driveConnectBtn')?.addEventListener('click', () => {
      void connectDrive().catch((e) => app().toast(e.message || 'Could not connect Drive'));
    });
    document.getElementById('driveDisconnectBtn')?.addEventListener('click', () => void disconnectDrive());
    document.getElementById('driveBackupNowBtn')?.addEventListener('click', () => {
      void uploadBackup().then(() => app().toast('Backup saved to Google Drive')).catch((e) => app().toast(e.message || 'Backup failed'));
    });
    document.getElementById('driveRestoreBtn')?.addEventListener('click', () => {
      if (!confirm('Replace data on this device with the latest Google Drive backup?')) return;
      void restoreBackup().then(() => app().toast('Restored from Google Drive')).catch((e) => app().toast(e.message || 'Restore failed'));
    });
    document.getElementById('driveBackupFreq')?.addEventListener('change', async (e) => {
      state().settings.driveBackupFreq = e.target.value;
      await app().save(true, { render: 'none' });
      if (Core.shouldDriveBackup(settings(), app().todayKey())) void maybeAutoDriveBackup();
    });
    document.getElementById('googleClientIdInput')?.addEventListener('change', async (e) => {
      state().settings.googleClientId = e.target.value.trim();
      socialReadyFor = '';
      await app().save(true, { render: 'none' });
    });
    document.getElementById('testReminderBtn')?.addEventListener('click', async () => {
      const ok = await requestNotifPermission();
      await showLocalNotification({ id: 1, title: 'Momentum', body: 'Reminders are working.', at: Date.now() + 1500 });
      if (!ok && !isNative()) app().toast('Allow notifications in the browser or install the store app for lock-screen alerts.');
    });
    document.getElementById('widgetModeTabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-widget-mode]');
      if (!btn) return;
      void saveWidgetConfig({ mode: btn.dataset.widgetMode });
    });
    document.getElementById('widgetLayout')?.addEventListener('change', (e) => {
      void saveWidgetConfig({ layout: Number(e.target.value) });
    });
    document.getElementById('widgetHabitPicker')?.addEventListener('change', (e) => {
      const box = e.target.closest('input[data-widget-habit]');
      if (!box) return;
      const cfg = Core.normalizeWidgetConfig(settings().widget);
      const id = box.getAttribute('data-widget-habit');
      let ids = cfg.habitIds.slice();
      if (box.checked) {
        if (!ids.includes(id) && ids.length < 6) ids.push(id);
      } else ids = ids.filter((x) => x !== id);
      void saveWidgetConfig({ habitIds: ids, layout: Math.max(ids.length, 1) });
    });
    document.getElementById('removeAdsBtn')?.addEventListener('click', () => { void purchaseRemoveAds(); });
    document.getElementById('restoreAdsPurchaseBtn')?.addEventListener('click', () => { void restoreAdsPurchase(); });
    document.getElementById('adBannerCta')?.addEventListener('click', () => { void purchaseRemoveAds(); });
  }

  let booted = false;
  async function bootLaunch() {
    if (booted) return;
    booted = true;
    bindUi();
    renderDriveUi();
    renderWidgetUi();
    renderAdsUi();
    await applyPendingFromNative();
    consumeLaunchQuery();
    await writeWidgetSnapshot();
    if (settings().reminders) await requestNotifPermission();
    await scheduleReminders();
    await restoreAdsPurchase(true);
    await showAdsIfNeeded();
    await maybeAutoDriveBackup();
    try {
      cap().App?.addListener?.('appUrlOpen', (event) => {
        void ingestNativeWidgetPending(Core.parseAppUrl(event.url));
      });
      cap().App?.addListener?.('resume', () => { void applyPendingFromNative(); });
      cap().LocalNotifications?.addListener?.('localNotificationActionPerformed', (event) => {
        const extra = event?.notification?.extra || {};
        if (extra.habitId) void handleWidgetAction({ type: 'open', view: 'homeView' });
      });
    } catch (e) { /* web */ }
  }

  window.MomentumLaunch = {
    onStateSaved,
    scheduleReminders,
    maybeAutoDriveBackup,
    renderDriveUi,
    renderWidgetUi,
    renderAdsUi,
    handleWidgetAction,
    requestNotifPermission,
    isNative,
  };

  document.addEventListener('momentum-ready', () => { void bootLaunch(); });
  if (window.Momentum) void bootLaunch();
})();
