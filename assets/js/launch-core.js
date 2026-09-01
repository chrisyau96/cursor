/* Pure helpers for Drive backup, reminders, and home-screen widgets.
   Loaded in the browser and by Node tests. No DOM. */
(function (root) {
  const Launch = {};

  Launch.DRIVE_FILE_NAME = 'momentum-backup.json';
  Launch.DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  Launch.TOKEN_KEY = 'momentumDriveToken';
  Launch.PENDING_KEY = 'momentumWidgetPending';
  Launch.SNAPSHOT_KEY = 'momentumWidgetSnapshot';
  Launch.REMINDER_FIRED_KEY = 'momentumReminderFired';
  Launch.ADS_PRODUCT_ID = 'remove_ads_lifetime';
  Launch.ADS_PRICE_LABEL = 'HK$38';
  Launch.ADMOB_TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
  Launch.ADMOB_TEST_BANNER = 'ca-app-pub-3940256099942544/6300978111';
  Launch.NATIVE_SLOT_LIMIT = 200;
  Launch.WIDGET_MODES = [
    { id: 'today', label: 'Today tasks', hint: 'Outstanding habits with complete / reset' },
    { id: 'habits', label: 'Selected habits', hint: 'Due in X days for 1–6 habits' },
    { id: 'streak', label: 'Current streak', hint: '100% completion streak' },
    { id: 'credits', label: 'Credits', hint: 'Available credit balance' },
    { id: 'gift', label: 'Next gift', hint: 'Gift streak progress' },
    { id: 'journal', label: 'Journal', hint: 'Tap to log today’s journal' },
  ];

  Launch.pad2 = (n) => String(n).padStart(2, '0');
  Launch.dateKeyFromParts = (y, m, d) => `${y}-${Launch.pad2(m)}-${Launch.pad2(d)}`;

  Launch.weekStartKey = function (dateKey) {
    const [y, m, d] = String(dateKey || '').split('-').map(Number);
    if (!y || !m || !d) return '';
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - dt.getDay());
    return Launch.dateKeyFromParts(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  };

  Launch.addDaysKey = function (dateKey, days) {
    const [y, m, d] = String(dateKey || '').split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    return Launch.dateKeyFromParts(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  };

  Launch.parseHm = function (hm) {
    const parts = String(hm || '20:30').split(':');
    const hour = Math.min(23, Math.max(0, Number(parts[0]) || 0));
    const minute = Math.min(59, Math.max(0, Number(parts[1]) || 0));
    return { hour, minute };
  };

  Launch.shouldDriveBackup = function (settings, todayKey) {
    if (!settings || !settings.driveConnected) return false;
    const freq = settings.driveBackupFreq || 'daily';
    if (freq === 'off') return false;
    const last = String(settings.lastDriveBackupAt || '').slice(0, 10);
    if (!last) return true;
    if (freq === 'daily') return last !== todayKey;
    if (freq === 'weekly') return Launch.weekStartKey(last) !== Launch.weekStartKey(todayKey);
    return false;
  };

  Launch.notifId = function (habitId, dateKey) {
    const s = String(habitId || '') + '|' + String(dateKey || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % 2147483646 || 1;
  };

  Launch.firedKey = function (habitId, dateKey, time) {
    return `${habitId}|${dateKey}|${time}`;
  };

  Launch.buildReminderSlots = function (habits, opts) {
    const todayKey = opts.todayKey;
    const days = Math.max(1, Number(opts.days || 21));
    const now = opts.now && typeof opts.now.getTime === 'function' ? opts.now : new Date();
    const needs = typeof opts.habitNeedsReminderOn === 'function' ? opts.habitNeedsReminderOn : () => false;
    const bodyFn = typeof opts.reminderBody === 'function' ? opts.reminderBody : (h) => h.name;
    const slots = [];
    if (!opts.remindersEnabled) return slots;
    (habits || []).forEach((h) => {
      if (!h || !h.reminder?.enabled || h.paused || h.archived) return;
      const t = Launch.parseHm(h.reminder.time);
      for (let i = 0; i < days; i++) {
        const dateKey = Launch.addDaysKey(todayKey, i);
        if (!needs(h, dateKey)) continue;
        const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), t.hour, t.minute, 0, 0);
        at.setDate(at.getDate() + i);
        if (at.getTime() <= now.getTime() + 15000) continue;
        slots.push({
          id: Launch.notifId(h.id, dateKey),
          habitId: h.id,
          dateKey,
          time: `${Launch.pad2(t.hour)}:${Launch.pad2(t.minute)}`,
          at: at.getTime(),
          title: 'Momentum',
          body: bodyFn(h),
          extra: { habitId: h.id, date: dateKey },
        });
      }
    });
    slots.sort((a, b) => a.at - b.at);
    return slots.slice(0, Launch.NATIVE_SLOT_LIMIT);
  };

  Launch.buildRepeatingNative = function (habits, opts) {
    const bodyFn = typeof opts?.reminderBody === 'function' ? opts.reminderBody : (h) => h.name;
    const notes = [];
    (habits || []).forEach((h) => {
      if (!h || !h.reminder?.enabled || h.paused || h.archived) return;
      const f = h.frequency || {};
      if (f.mode !== 'daily') return;
      const t = Launch.parseHm(h.reminder.time);
      let days = [0, 1, 2, 3, 4, 5, 6];
      if (Array.isArray(f.days) && f.days.length && f.schedule?.type !== 'any') {
        days = f.days.map(Number).filter((d) => d >= 0 && d <= 6);
      }
      days.forEach((d) => {
        notes.push({
          id: Launch.notifId(h.id, 'w' + d),
          title: 'Momentum',
          body: bodyFn(h),
          weekday: d + 1,
          hour: t.hour,
          minute: t.minute,
          extra: { habitId: h.id },
        });
      });
    });
    return notes;
  };

  Launch.adsRemoved = function (settings) {
    return !!(settings && settings.adsRemoved);
  };

  Launch.shouldShowAds = function (settings) {
    return !Launch.adsRemoved(settings);
  };

  Launch.markAdsRemoved = function (settings, at) {
    const next = Object.assign({}, settings || {});
    next.adsRemoved = true;
    next.adsRemovedAt = at || new Date().toISOString();
    return next;
  };

  Launch.purchaseOwnsRemoveAds = function (purchases) {
    return (purchases || []).some((p) => {
      if (!p) return false;
      const id = p.productIdentifier || p.productId || p.sku || p.product || '';
      if (id !== Launch.ADS_PRODUCT_ID) return false;
      const state = String(p.purchaseState || p.state || '').toLowerCase();
      if (state && state !== 'purchased' && state !== '1' && state !== 'owned') return false;
      return true;
    });
  };

  Launch.toNativeNotifications = function (slots) {
    return (slots || []).map((s) => ({
      id: s.id,
      title: s.title || 'Momentum',
      body: s.body || '',
      schedule: { at: new Date(s.at), allowWhileIdle: true },
      extra: s.extra || { habitId: s.habitId, date: s.dateKey },
    }));
  };

  Launch.nextWebTimerDelay = function (slots, nowMs) {
    const next = (slots || []).find((s) => s.at > nowMs);
    if (!next) return null;
    return { slot: next, delay: Math.min(next.at - nowMs, 12 * 60 * 60 * 1000) };
  };

  Launch.applyPendingActions = function (state, actions, helpers) {
    const uid = helpers.uid;
    const todayKey = helpers.todayKey;
    const nowIso = helpers.nowIso || new Date().toISOString();
    const applied = [];
    (actions || []).forEach((action) => {
      if (!action || !action.type) return;
      if (action.type === 'complete' && action.habitId) {
        const date = action.date || todayKey;
        state.records = state.records || [];
        state.records.push({ id: uid(), habitId: action.habitId, date, at: action.at || nowIso, note: 'widget' });
        applied.push(action);
      } else if (action.type === 'reset' && action.habitId) {
        const date = action.date || todayKey;
        state.records = (state.records || []).filter((r) => !(r.habitId === action.habitId && r.date === date));
        applied.push(action);
      } else if (action.type === 'journal') {
        applied.push(action);
      }
    });
    return applied;
  };

  Launch.normalizeWidgetConfig = function (raw) {
    const cfg = raw && typeof raw === 'object' ? raw : {};
    const mode = Launch.WIDGET_MODES.some((m) => m.id === cfg.mode) ? cfg.mode : 'today';
    const habitIds = Array.isArray(cfg.habitIds) ? cfg.habitIds.filter(Boolean).slice(0, 6) : [];
    let layout = Number(cfg.layout || habitIds.length || 3);
    if (!Number.isFinite(layout) || layout < 1) layout = 1;
    if (layout > 6) layout = 6;
    return { mode, habitIds, layout };
  };

  Launch.parseQueryActions = function (search) {
    const q = new URLSearchParams(String(search || '').replace(/^\?/, ''));
    const type = q.get('widgetAction');
    if (!type) return null;
    return { type, habitId: q.get('habitId') || '', date: q.get('date') || '', view: q.get('view') || '' };
  };

  Launch.parseAppUrl = function (url) {
    try {
      const u = new URL(String(url || ''));
      if (u.protocol !== 'momentum:' && u.protocol !== 'https:' && u.protocol !== 'http:') return Launch.parseQueryActions(u.search);
      const path = (u.hostname || '') + (u.pathname || '');
      const parts = path.replace(/^\/+/, '').split('/');
      if (parts[0] === 'widget' && parts[1]) {
        return { type: parts[1], habitId: u.searchParams.get('habitId') || '', date: u.searchParams.get('date') || '', view: u.searchParams.get('view') || '' };
      }
      return Launch.parseQueryActions(u.search);
    } catch (e) {
      return null;
    }
  };

  Launch.daysUntil = function (fromKey, toKey) {
    const [fy, fm, fd] = String(fromKey).split('-').map(Number);
    const [ty, tm, td] = String(toKey).split('-').map(Number);
    const a = new Date(fy, fm - 1, fd);
    const b = new Date(ty, tm - 1, td);
    return Math.round((b - a) / 86400000);
  };

  Launch.duePhrase = function (fromKey, dueKey) {
    const diff = Launch.daysUntil(fromKey, dueKey);
    if (diff <= 0) return 'Due today';
    if (diff === 1) return 'Due tmr';
    return `Due in ${diff + 1} days`;
  };

  root.MomentumLaunchCore = Launch;
  if (typeof module !== 'undefined' && module.exports) module.exports = Launch;
})(typeof window !== 'undefined' ? window : globalThis);
