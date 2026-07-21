#!/usr/bin/env node
/**
 * Rigorous button / interaction UAT for Momentum habit tracker.
 * Run: node scripts/uat-buttons.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:8765/index.html';
const results = [];

function hkDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function hkYesterdayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  const dt = new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function demoState() {
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const habitId = uid();
  const giftRuleId = uid();
  const today = hkDateKey();
  return {
    habits: [{
      id: habitId, name: 'Test Habit', emoji: '📖', color: '#4f46e5', target: 1, xpReward: 5,
      frequency: { mode: 'daily', days: [0, 1, 2, 3, 4, 5, 6], schedule: { type: 'days' } },
      reminder: { enabled: false, time: '20:30', message: '' },
      sortOrder: 0, paused: false, archived: false, groupId: null,
    }],
    records: [{ id: uid(), habitId, date: today, at: new Date().toISOString(), note: '' }],
    journals: {}, redemptions: [],
    redemptions_pre: [],
    groups: [],
    settings: {
      startDate: '2026-01-01', userName: 'UAT', colorMode: 'light', styleTheme: 'vivid',
      reminders: true, globalReminderTime: '20:30', defaultReminderMessage: 'Hi {habit}!',
      dataMode: 'real', autoBackup: false, dailyBackup: false, fileConnected: false, backupFileName: '',
      onboardingComplete: true, vacations: [],
      rewards: {
        creditRules: [{ id: uid(), pct: 50, amount: 2 }, { id: uid(), pct: 100, amount: 10 }],
        giftRules: [{ id: giftRuleId, gift: 'Buffet', icon: '🍽️', pct: 80, days: 30 }],
        activeGiftId: giftRuleId,
        penaltyCredit: 5, penaltyXp: 20, penaltyZeroDays: 2,
      },
    },
    _habitId: habitId,
    _giftRuleId: giftRuleId,
  };
}

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log('✓', name);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log('✗', name, '-', e.message);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
page.on('dialog', d => d.accept());

await page.goto(BASE, { waitUntil: 'networkidle' });
const seed = demoState();
await page.evaluate((s) => {
  const { _habitId, _giftRuleId, ...data } = s;
  localStorage.setItem('habitTrackerProductionV7', JSON.stringify(data));
  window.__seed = { habitId: _habitId, giftRuleId: _giftRuleId };
  location.reload();
}, seed);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);

// Grant a gift redemption credit in ledger
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('habitTrackerProductionV7'));
  const gid = s.settings.rewards.giftRules[0].id;
  s.redemptions.push({ id: 'gift-earn-1', date: '2026-07-01', type: 'gift', gift: 'Buffet', giftIcon: '🍽️', giftRuleId: gid, credit: 0, xp: 0, desc: 'Gift unlocked' });
  localStorage.setItem('habitTrackerProductionV7', JSON.stringify(s));
  location.reload();
});
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);

await test('Today habit reset button clears record', async () => {
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('habitTrackerProductionV7')).records.length);
  assert(before > 0, 'need a record');
  const beforeClass = await page.locator('.check-btn').first().getAttribute('class');
  assert(beforeClass?.includes('done'), 'habit should start completed');
  await page.locator('.reset-habit-btn').first().click();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('habitTrackerProductionV7')).records.length);
  const afterClass = await page.locator('.check-btn').first().getAttribute('class');
  assert(after < before, 'record should be removed');
  assert(!afterClass?.includes('done'), 'habit should visually reset to incomplete');
});

await test('Redeem gift works and shows celebration', async () => {
  await page.click('.nav-item[data-view="rewardsView"]');
  await page.waitForTimeout(300);
  await page.locator('#redeemGiftBtn').click();
  await page.waitForTimeout(500);
  const redeemed = await page.evaluate(() => JSON.parse(localStorage.getItem('habitTrackerProductionV7')).redemptions.some(r => r.type === 'redeemGift'));
  const celebrated = await page.evaluate(() => !!document.querySelector('#celebrateLayer .celebrate-banner, #celebrateLayer .confetti'));
  assert(redeemed, 'gift redemption not saved');
  assert(celebrated, 'celebration effect not shown');
});

await test('Settings reminder off persists after save', async () => {
  await page.click('#topSettingsBtn');
  await page.locator('#reminderSwitch').scrollIntoViewIfNeeded();
  const wasOn = await page.evaluate(() => document.querySelector('#reminderSwitch').classList.contains('on'));
  if (wasOn) await page.locator('#reminderSwitch').click();
  await page.waitForTimeout(150);
  await page.locator('#saveSettingsBtn').click();
  await page.waitForTimeout(400);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('habitTrackerProductionV7')).settings.reminders);
  assert(saved === false, 'reminders should be false after save, got ' + saved);
});

await test('Add pause period twice', async () => {
  await page.locator('#addVacationBtn').scrollIntoViewIfNeeded();
  await page.click('#addVacationBtn');
  await page.waitForSelector('#savePauseBtn');
  await page.click('#savePauseBtn');
  await page.waitForTimeout(400);
  await page.click('#addVacationBtn');
  await page.waitForSelector('#savePauseBtn');
  await page.click('#savePauseBtn');
  await page.waitForTimeout(400);
  const count = await page.evaluate(() => (JSON.parse(localStorage.getItem('habitTrackerProductionV7')).settings.vacations || []).length);
  assert(count === 2, 'expected 2 pause periods, got ' + count);
});

await test('Create backup file (mocked picker)', async () => {
  await page.evaluate(() => {
    window.showSaveFilePicker = async () => ({
      name: 'test-backup.json',
      requestPermission: async () => 'granted',
      getFile: async () => new File(['{}'], 'test-backup.json'),
      createWritable: async () => ({ write: async () => {}, close: async () => {} }),
    });
  });
  await page.locator('[data-sync-action="create"]').scrollIntoViewIfNeeded();
  await page.click('[data-sync-action="create"]');
  await page.waitForTimeout(600);
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('habitTrackerProductionV7')).settings);
  assert(settings.fileConnected, 'backup file should be connected');
  assert(settings.autoBackup === true, 'auto backup should remain enabled after create');
});

await test('Weekly Not Specific hides due weekday field', async () => {
  await page.click('.nav-item[data-view="habitsView"]');
  await page.click('#addHabitBtn');
  await page.waitForSelector('#weeklySetupType');
  await page.selectOption('#weeklySetupType', 'any');
  await page.waitForTimeout(100);
  const hasDue = await page.isVisible('#dueWeekday');
  assert(!hasDue, 'due weekday should be hidden for Not Specific');
  await page.evaluate(() => document.querySelector('#modalBackdrop')?.classList.remove('show'));
});

await test('Habit reminder toggle saves on edit', async () => {
  await page.evaluate(() => {
    document.querySelector('#onboardBackdrop')?.classList.remove('show');
    document.querySelector('#modalBackdrop')?.classList.remove('show');
  });
  const habitId = await page.evaluate(() => JSON.parse(localStorage.getItem('habitTrackerProductionV7')).habits[0].id);
  await page.click('.nav-item[data-view="habitsView"]');
  await page.waitForTimeout(300);
  await page.locator(`[data-edit][data-habit-id="${habitId}"]`).click();
  await page.waitForSelector('#habitReminderToggle');
  await page.locator('#habitReminderToggle').click();
  await page.waitForTimeout(150);
  await page.fill('#habitReminderTime', '08:30');
  await page.click('#saveHabitBtn');
  await page.waitForTimeout(400);
  const saved = await page.evaluate((id) => {
    const h = JSON.parse(localStorage.getItem('habitTrackerProductionV7')).habits.find(x => x.id === id);
    return h?.reminder;
  }, habitId);
  assert(saved?.enabled === true, 'reminder should be enabled after toggle');
  assert(saved?.time === '08:30', 'reminder time should persist');
});

await test('Delete habit removes it from list', async () => {
  await page.evaluate(() => document.querySelector('#modalBackdrop')?.classList.remove('show'));
  await page.evaluate(() => { window.confirm = () => true; });
  const targetId = await page.evaluate(() => JSON.parse(localStorage.getItem('habitTrackerProductionV7')).habits.find(h => h.name === 'Test Habit')?.id);
  assert(targetId, 'seed habit missing');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('habitTrackerProductionV7')).habits.length);
  await page.click('.nav-item[data-view="habitsView"]');
  await page.waitForTimeout(300);
  await page.locator(`[data-edit][data-habit-id="${targetId}"]`).click();
  await page.waitForSelector('#deleteHabitBtn');
  await page.click('#deleteHabitBtn');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('habitTrackerProductionV7')).habits.length);
  const stillVisible = await page.locator(`[data-habit-id="${targetId}"]`).count();
  assert(after === before - 1, 'habit should be removed from state');
  assert(stillVisible === 0, 'habit row should disappear from list');
});

await test('Delete group removes it and ungroups habits', async () => {
  await page.waitForTimeout(600);
  const groupSeed = await page.evaluate(() => {
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const gid = uid();
    const s = JSON.parse(localStorage.getItem('habitTrackerProductionV7'));
    s.groups = [{ id: gid, name: 'UAT Group', emoji: '📋', color: '#4f46e5', sortOrder: 0 }];
    s.habits = [
      { id: uid(), name: 'Alpha', emoji: '📖', color: '#4f46e5', target: 1, xpReward: 5, frequency: { mode: 'daily', days: [0,1,2,3,4,5,6] }, reminder: { enabled: false, time: '20:30', message: '' }, sortOrder: 0, paused: false, archived: false, groupId: gid },
      { id: uid(), name: 'Beta', emoji: '🏃', color: '#059669', target: 1, xpReward: 5, frequency: { mode: 'daily', days: [0,1,2,3,4,5,6] }, reminder: { enabled: false, time: '20:30', message: '' }, sortOrder: 1, paused: false, archived: false, groupId: gid },
    ];
    s.settings.onboardingComplete = true;
    localStorage.setItem('habitTrackerProductionV7', JSON.stringify(s));
    return gid;
  });
  assert(groupSeed, 'group seed failed');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const storedGroups = await page.evaluate(() => JSON.parse(localStorage.getItem('habitTrackerProductionV7')).groups.length);
  assert(storedGroups === 1, 'expected one group in storage, got ' + storedGroups);
  await page.click('.nav-item[data-view="habitsView"]');
  await page.waitForTimeout(500);
  let beforeGroups = 0;
  for (let i = 0; i < 12; i++) {
    beforeGroups = await page.locator('#groupManager .group-manage-item').count();
    if (beforeGroups > 0) break;
    await page.waitForTimeout(250);
  }
  assert(beforeGroups === 1, 'expected one group');
  await page.locator('[data-gdel]').first().click();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('habitTrackerProductionV7'));
    return { groups: s.groups.length, ungrouped: s.habits.every(h => !h.groupId) };
  });
  const groupRows = await page.locator('#groupManager .group-manage-item').count();
  assert(after.groups === 0, 'group should be removed from state');
  assert(after.ungrouped, 'habits should be ungrouped');
  assert(groupRows === 0, 'group row should disappear from UI');
});

await test('Habit sort buttons reorder habits', async () => {
  await page.evaluate(() => {
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const s = JSON.parse(localStorage.getItem('habitTrackerProductionV7'));
    s.groups = [];
    s.habits = [
      { id: 'habit-a', name: 'Alpha', emoji: '📖', color: '#4f46e5', target: 1, xpReward: 5, frequency: { mode: 'daily', days: [0,1,2,3,4,5,6] }, reminder: { enabled: false, time: '20:30', message: '' }, sortOrder: 0, paused: false, archived: false, groupId: null },
      { id: 'habit-b', name: 'Beta', emoji: '🏃', color: '#059669', target: 1, xpReward: 5, frequency: { mode: 'daily', days: [0,1,2,3,4,5,6] }, reminder: { enabled: false, time: '20:30', message: '' }, sortOrder: 1, paused: false, archived: false, groupId: null },
    ];
    localStorage.setItem('habitTrackerProductionV7', JSON.stringify(s));
    location.reload();
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.click('.nav-item[data-view="habitsView"]');
  await page.waitForTimeout(300);
  const before = await page.locator('#allHabitList .habit-row .habit-name').first().textContent();
  assert(before === 'Alpha', 'Alpha should be first');
  await page.locator('[data-down][data-habit-id="habit-a"]').click();
  await page.waitForTimeout(400);
  const after = await page.locator('#allHabitList .habit-row .habit-name').first().textContent();
  const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('habitTrackerProductionV7')).habits.map(h => ({ id: h.id, sortOrder: h.sortOrder })));
  assert(after === 'Beta', 'Beta should be first after moving Alpha down');
  const alpha = orders.find(o => o.id === 'habit-a');
  const beta = orders.find(o => o.id === 'habit-b');
  assert(alpha.sortOrder > beta.sortOrder, 'Alpha sortOrder should be greater than Beta');
});

await test('Assigning habit group refreshes Today grouping', async () => {
  const ids = await page.evaluate(() => {
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const gid = uid();
    const habitId = uid();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const s = JSON.parse(localStorage.getItem('habitTrackerProductionV7'));
    s.groups = [{ id: gid, name: 'Morning', emoji: '🌅', color: '#ea580c', sortOrder: 0 }];
    s.habits = [{
      id: habitId, name: 'Grouped Habit', emoji: '📖', color: '#4f46e5', target: 1, xpReward: 5,
      frequency: { mode: 'daily', days: [0, 1, 2, 3, 4, 5, 6], schedule: { type: 'days' } },
      reminder: { enabled: false, time: '20:30', message: '' },
      sortOrder: 0, paused: false, archived: false, groupId: null,
    }];
    s.records = [];
    s.settings.startDate = today;
    s.settings.onboardingComplete = true;
    localStorage.setItem('habitTrackerProductionV7', JSON.stringify(s));
    return { habitId, groupId: gid };
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.click('.nav-item[data-view="homeView"]');
  await page.waitForTimeout(300);
  const beforeGrouped = await page.locator('#todayHabitGroups .group-name').filter({ hasText: 'Morning' }).count();
  assert(beforeGrouped === 0, 'habit should start ungrouped on Today');
  await page.click('.nav-item[data-view="habitsView"]');
  await page.waitForTimeout(300);
  await page.locator(`[data-edit][data-habit-id="${ids.habitId}"]`).click();
  await page.waitForSelector('#habitGroup');
  await page.selectOption('#habitGroup', ids.groupId);
  await page.click('#saveHabitBtn');
  await page.waitForTimeout(500);
  await page.click('.nav-item[data-view="homeView"]');
  await page.waitForTimeout(300);
  const afterGrouped = await page.locator('#todayHabitGroups .group-name').filter({ hasText: 'Morning' }).count();
  assert(afterGrouped === 1, 'Today page should show Morning group after assigning habit');
});

await test('Not Specific habits card starts expanded and toggles', async () => {
  await page.evaluate(() => {
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const s = JSON.parse(localStorage.getItem('habitTrackerProductionV7'));
    s.groups = [];
    s.habits = [{
      id: 'flex-habit', name: 'Flex Habit', emoji: '📖', color: '#4f46e5', target: 1, xpReward: 5,
      frequency: { mode: 'daily', schedule: { type: 'any' }, days: [] },
      reminder: { enabled: false, time: '20:30', message: '' },
      sortOrder: 0, paused: false, archived: false, groupId: null,
    }];
    s.records = [];
    s.settings.startDate = today;
    s.settings.onboardingComplete = true;
    localStorage.setItem('habitTrackerProductionV7', JSON.stringify(s));
    location.reload();
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await page.click('.nav-item[data-view="homeView"]');
  await page.waitForTimeout(300);
  await page.waitForSelector('#flexHabitCard', { state: 'attached' });
  const expanded = await page.evaluate(() => !document.querySelector('#flexHabitCard')?.classList.contains('collapsed'));
  const visibleRows = await page.locator('#flexHabitGroups .habit-row').count();
  assert(expanded, 'Not Specific card should start expanded');
  assert(visibleRows === 1, 'flex habit row should be visible');
  await page.locator('#flexHabitToggle').click();
  await page.waitForTimeout(400);
  const collapsed = await page.evaluate(() => document.querySelector('#flexHabitCard')?.classList.contains('collapsed'));
  assert(collapsed, 'toggle should collapse card');
  await page.locator('#flexHabitToggle').click();
  await page.waitForTimeout(400);
  const expandedAgain = await page.evaluate(() => !document.querySelector('#flexHabitCard')?.classList.contains('collapsed'));
  assert(expandedAgain, 'toggle should expand card again');
});

await test('Not Specific habits show relative due dates', async () => {
  const today = hkDateKey();
  await page.evaluate((today) => {
    const s = JSON.parse(localStorage.getItem('habitTrackerProductionV7'));
    s.groups = [];
    s.habits = [{
      id: 'flex-habit', name: 'Flex Habit', emoji: '📖', color: '#4f46e5', target: 1, xpReward: 5,
      frequency: { mode: 'daily', schedule: { type: 'any' }, days: [] },
      reminder: { enabled: false, time: '20:30', message: '' },
      sortOrder: 0, paused: false, archived: false, groupId: null,
    }];
    s.records = [];
    s.settings.startDate = today;
    s.settings.onboardingComplete = true;
    localStorage.setItem('habitTrackerProductionV7', JSON.stringify(s));
  }, today);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.nav-item[data-view="homeView"]');
  await page.waitForTimeout(600);
  await page.click('.nav-item[data-view="homeView"]');
  await page.waitForTimeout(300);
  const flexDue = (await page.locator('#flexHabitGroups .due-tag').first().textContent()) || '';
  assert(/^Due (today|tmr|in \d+ days)$/.test(flexDue.trim()), `flex card should use relative due text, got "${flexDue.trim()}"`);
  assert(!/[A-Za-z]{3}\s+\d/.test(flexDue), `flex card should not show absolute date, got "${flexDue.trim()}"`);
  await page.click('.nav-item[data-view="habitsView"]');
  await page.waitForTimeout(300);
  const habitMeta = (await page.locator('#allHabitList .habit-meta').first().textContent()) || '';
  assert(habitMeta.includes('Due '), `habits list should include due label, got "${habitMeta}"`);
  assert(!/[A-Za-z]{3}\s+\d/.test(habitMeta), `habits list should not show absolute date, got "${habitMeta}"`);

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  const todayDate = new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const dueKey = (offset) => {
    const due = new Date(todayDate);
    due.setDate(due.getDate() + offset);
    return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
  };
  const labelFor = (dueKeyStr) => {
    const [y, m, d] = dueKeyStr.split('-').map(Number);
    const due = new Date(y, m - 1, d);
    const diff = Math.round((due - todayDate) / 86400000);
    if (diff <= 0) return 'today';
    if (diff === 1) return 'tmr';
    return `in ${diff + 1} days`;
  };
  assert(labelFor(dueKey(0)) === 'today', 'due today should read as today');
  assert(labelFor(dueKey(1)) === 'tmr', 'due tomorrow should read as tmr');
  assert(labelFor(dueKey(2)) === 'in 3 days', 'due in two calendar days should read as in 3 days');
});

await test('Weekly Review section removed from home', async () => {
  await page.click('.nav-item[data-view="homeView"]');
  await page.waitForTimeout(200);
  const exists = await page.locator('#weeklyReviewCard').count();
  assert(exists === 0, 'Weekly Review card should be removed from home');
});

await test('Redeem credit updates balance and celebrates', async () => {
  const today = hkDateKey();
  await page.evaluate((today) => {
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const habitId = uid();
    const s = JSON.parse(localStorage.getItem('habitTrackerProductionV7'));
    s.habits = [{
      id: habitId, name: 'Credit Habit', emoji: '📖', color: '#4f46e5', target: 1, xpReward: 5,
      frequency: { mode: 'daily', days: [0, 1, 2, 3, 4, 5, 6], schedule: { type: 'days' } },
      reminder: { enabled: false, time: '20:30', message: '' },
      sortOrder: 0, paused: false, archived: false, groupId: null,
    }];
    s.records = [{ id: 'rec1', habitId, date: today, at: new Date().toISOString(), note: '' }];
    s.redemptions = [];
    s.settings.startDate = today;
    s.settings.vacations = [];
    s.settings.onboardingComplete = true;
    s.settings.rewards = s.settings.rewards || {};
    s.settings.rewards.creditRules = [{ id: 'c50', pct: 50, amount: 10 }];
    s.settings.rewards.giftRules = s.settings.rewards.giftRules || [];
    s.settings.rewards.penaltyCredit = s.settings.rewards.penaltyCredit ?? 5;
    s.settings.rewards.penaltyXp = s.settings.rewards.penaltyXp ?? 20;
    s.settings.rewards.penaltyZeroDays = s.settings.rewards.penaltyZeroDays ?? 2;
    localStorage.setItem('habitTrackerProductionV7', JSON.stringify(s));
    location.reload();
  }, today);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.click('.nav-item[data-view="rewardsView"]');
  await page.waitForTimeout(300);
  const before = await page.locator('#creditValue').textContent();
  assert(before?.includes('10'), 'should have HK$10 credit, got ' + before);
  await page.fill('#creditSpendText', 'Coffee');
  await page.fill('#creditSpendAmount', '4');
  await page.locator('#spendCreditBtn').click();
  await page.waitForTimeout(600);
  const after = await page.locator('#creditValue').textContent();
  const celebrated = await page.evaluate(() => !!document.querySelector('#celebrateLayer .celebrate-banner, #celebrateLayer .confetti'));
  const redeemed = await page.evaluate(() => JSON.parse(localStorage.getItem('habitTrackerProductionV7')).redemptions.some(r => r.type === 'redeemCredit'));
  assert(redeemed, 'credit redemption should be saved');
  assert(after?.includes('6'), `balance should drop to HK$6, got ${after}`);
  assert(celebrated, 'celebration effect should show for credit redemption');
});

await test('Report range tabs update compare label', async () => {
  await page.click('.nav-item[data-view="reportView"]');
  await page.waitForTimeout(300);
  await page.locator('#reportRangeTabs button[data-days="30"]').click();
  await page.waitForTimeout(300);
  const label = await page.locator('#comparePeriodBox .compare-label').first().textContent();
  assert(label?.includes('30'), 'compare should use 30-day range, got ' + label);
  const hasOldFilters = await page.evaluate(() =>
    !!document.querySelector('#comparePeriodTabs, #habitChartPeriodTabs, #rangeTabs, #calendarHabitFilter, #reportMode')
  );
  assert(!hasOldFilters, 'per-card report filters should be removed');
});

await test('Calendar and week views use 0/50/100 completion colors', async () => {
  const pctClass = (p) => (p >= 100 ? 'perfect' : p >= 50 ? 'partial' : 'zero');
  assert(pctClass(0) === 'zero', '0% should use zero color');
  assert(pctClass(49) === 'zero', '49% should use zero color');
  assert(pctClass(50) === 'partial', '50% should use partial color');
  assert(pctClass(99) === 'partial', '99% should use partial color');
  assert(pctClass(100) === 'perfect', '100% should use perfect color');

  await page.click('.nav-item[data-view="homeView"]');
  await page.waitForTimeout(200);
  const homeLegend = await page.locator('.week-legend').textContent();
  assert(!homeLegend?.includes('80%'), 'home legend should not include 80% tier');
  assert(!homeLegend?.includes('1%'), 'home legend should not include 1% tier');
  assert(homeLegend?.includes('50%'), 'home legend should include 50% tier');
  assert(homeLegend?.includes('100%'), 'home legend should include 100% tier');
  assert(!homeLegend?.includes('50%+'), 'home legend should not use plus sign');

  await page.click('.nav-item[data-view="reportView"]');
  await page.waitForTimeout(300);
  const reportLegend = await page.locator('#monthReport').locator('xpath=..').locator('.legend').textContent();
  assert(!reportLegend?.includes('80%'), 'report legend should not include 80% tier');
  assert(!reportLegend?.includes('1%'), 'report legend should not include 1% tier');
  assert(reportLegend?.includes('50%'), 'report legend should include 50% tier');
});

await test('Credit rule chip matches amount select', async () => {
  await page.evaluate(() => document.querySelector('#modalBackdrop')?.classList.remove('show'));
  await page.click('#topSettingsBtn');
  await page.waitForTimeout(300);
  const chip = await page.locator('#creditRulesBox .gift-rule-chip').first().textContent();
  const amt = await page.locator('#creditRulesBox [data-amount]').first().inputValue();
  assert(chip === 'HK$' + amt, `chip ${chip} != HK$${amt}`);
});

await test('No penalty recorded when credit and EXP are zero', async () => {
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('habitTrackerProductionV7'));
    s.records = [];
    s.redemptions = [];
    s.journals = {};
    s.settings.vacations = [];
    s.settings.startDate = '2026-01-01';
    s.settings.startDate = '2026-07-14';
    s.settings.rewards.penaltyCredit = 10;
    s.settings.rewards.penaltyXp = 50;
    s.settings.rewards.penaltyZeroDays = 1;
    localStorage.setItem('habitTrackerProductionV7', JSON.stringify(s));
    location.reload();
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.click('.nav-item[data-view="rewardsView"]');
  await page.waitForTimeout(300);
  const creditText = await page.locator('#creditValue').textContent();
  const ledgerText = await page.locator('#ledgerList').textContent();
  assert(creditText?.includes('0'), 'credit should remain zero');
  assert(!ledgerText?.includes('consecutive 0%'), 'penalty should not appear when balance is zero');
});

await test('Credit balance updates immediately after completion', async () => {
  await page.evaluate(() => {
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const habitId = uid();
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Hong_Kong',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const s = JSON.parse(localStorage.getItem('habitTrackerProductionV7'));
    s.habits = [{
      id: habitId, name: 'Credit Test', emoji: '📖', color: '#4f46e5', target: 1, xpReward: 5,
      frequency: { mode: 'daily', days: [0, 1, 2, 3, 4, 5, 6], schedule: { type: 'days' } },
      reminder: { enabled: false, time: '20:30', message: '' },
      sortOrder: 0, paused: false, archived: false, groupId: null,
    }];
    s.records = [];
    s.redemptions = [];
    s.journals = {};
    s.settings.vacations = [];
    s.settings.startDate = today;
    s.settings.rewards.creditRules = [{ id: 'c50', pct: 50, amount: 2 }];
    s.settings.rewards.penaltyCredit = 0;
    s.settings.rewards.penaltyXp = 0;
    localStorage.setItem('habitTrackerProductionV7', JSON.stringify(s));
    location.reload();
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.click('.nav-item[data-view="homeView"]');
  await page.waitForTimeout(200);
  const before = await page.locator('#homeCreditValue').textContent();
  await page.locator('.check-btn:not(.done):not(:disabled)').first().click();
  await page.waitForTimeout(400);
  const after = await page.locator('#homeCreditValue').textContent();
  assert(after.includes('2'), `credit should reflect immediately, before=${before} after=${after}`);
});

await test('Erase all data clears habits, records, and UI', async () => {
  await page.click('#topSettingsBtn');
  await page.fill('#confirmDeleteInput', 'Confirm');
  await page.click('#resetAllBtn');
  await page.waitForTimeout(700);
  const stored = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('habitTrackerProductionV7'));
    return { habits: s.habits.length, records: s.records.length };
  });
  assert(stored.habits === 0, 'habits should be cleared');
  assert(stored.records === 0, 'records should be cleared');
  await page.click('.nav-item[data-view="habitsView"]');
  await page.waitForTimeout(300);
  const habitRows = await page.locator('#allHabitList .habit-row').count();
  const activityRows = await page.locator('#recentActivityLog .activity').count();
  assert(habitRows === 0, 'habit list should be empty');
  assert(activityRows === 0, 'recent records should be empty');
  await page.click('.nav-item[data-view="homeView"]');
  await page.waitForTimeout(200);
  const todayRows = await page.locator('#todayHabitGroups .habit-row').count();
  assert(todayRows === 0, 'today habits should be empty after erase');
});

await test('Auto backup sync runs after action', async () => {
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('habitTrackerProductionV7'));
    s.records = [];
    s.redemptions = [];
    s.settings.vacations = [];
    s.habits = [{
      id: 'sync-habit', name: 'Sync Habit', emoji: '📖', color: '#4f46e5', target: 1, xpReward: 5,
      frequency: { mode: 'daily', days: [0, 1, 2, 3, 4, 5, 6], schedule: { type: 'days' } },
      reminder: { enabled: false, time: '20:30', message: '' },
      sortOrder: 0, paused: false, archived: false, groupId: null,
    }];
    window.__backupWrites = 0;
    window.__backupPayloads = [];
    localStorage.setItem('habitTrackerProductionV7', JSON.stringify(s));
    location.reload();
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.showSaveFilePicker = async () => ({
      name: 'autosync.json',
      requestPermission: async () => 'granted',
      queryPermission: async () => 'granted',
      getFile: async () => new File(['{}'], 'autosync.json'),
      createWritable: async () => ({
        write: async (data) => {
          window.__backupWrites = (window.__backupWrites || 0) + 1;
          window.__backupPayloads = window.__backupPayloads || [];
          window.__backupPayloads.push(typeof data === 'string' ? data : '');
        },
        close: async () => {},
      }),
    });
  });
  await page.click('#topSettingsBtn');
  await page.locator('[data-sync-action="create"]').scrollIntoViewIfNeeded();
  await page.click('[data-sync-action="create"]');
  await page.waitForTimeout(600);
  const autoOn = await page.evaluate(() => document.querySelector('#autoBackupSwitch')?.classList.contains('on'));
  if (!autoOn) await page.locator('#autoBackupSwitch').click();
  await page.waitForTimeout(200);
  await page.click('.nav-item[data-view="homeView"]');
  await page.waitForTimeout(200);
  await page.locator('.check-btn:not(.done):not(:disabled)').first().click();
  await page.waitForTimeout(3000);
  const writes = await page.evaluate(() => window.__backupWrites || 0);
  const lastBackup = await page.evaluate(() => JSON.parse(localStorage.getItem('habitTrackerProductionV7')).settings.lastBackupAt);
  const fileBackupTs = await page.evaluate(() => {
    const raw = window.__backupPayloads?.at(-1) || '{}';
    try { return JSON.parse(raw)?.settings?.lastBackupAt || ''; } catch { return ''; }
  });
  assert(writes > 0, 'backup file should be written');
  assert(!!lastBackup, 'lastBackupAt should be set after auto sync');
  assert(!!fileBackupTs, 'backup payload should include lastBackupAt');
  const autoBackupOn = await page.evaluate(() => JSON.parse(localStorage.getItem('habitTrackerProductionV7')).settings.autoBackup);
  assert(autoBackupOn === true, 'auto backup should stay enabled after sync');
});

await test('Credit rules award credits only, not completion EXP', async () => {
  await page.evaluate(() => {
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const habitId = uid();
    localStorage.setItem('habitTrackerProductionV7', JSON.stringify({
      habits: [{
        id: habitId, name: 'XP Check', emoji: '📖', color: '#4f46e5', target: 1, xpReward: 5,
        frequency: { mode: 'daily', days: [0, 1, 2, 3, 4, 5, 6], schedule: { type: 'days' } },
        reminder: { enabled: false, time: '20:30', message: '' },
        sortOrder: 0, paused: false, archived: false, groupId: null,
      }],
      records: [], journals: {}, redemptions: [], groups: [],
      settings: {
        startDate: '2026-01-01', userName: 'UAT', onboardingComplete: true, vacations: [],
        rewards: {
          creditRules: [{ id: uid(), pct: 50, amount: 2 }, { id: uid(), pct: 100, amount: 10 }],
          giftRules: [], penaltyCredit: 5, penaltyXp: 20, penaltyZeroDays: 2,
        },
      },
    }));
    location.reload();
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.click('.nav-item[data-view="homeView"]');
  await page.locator('.check-btn:not(.done):not(:disabled)').first().click();
  await page.waitForTimeout(400);
  const credit = await page.locator('#homeCreditValue').textContent();
  assert(credit?.includes('12'), `100% day should still earn stacked credits, got: ${credit}`);
  await page.click('.nav-item[data-view="rewardsView"]');
  await page.waitForTimeout(300);
  const ledger = await page.locator('#ledgerList').textContent();
  assert(ledger?.includes('50% daily completion'), '50% credit rule should appear in ledger');
  assert(ledger?.includes('100% daily completion'), '100% credit rule should appear in ledger');
  assert(!ledger?.includes('12 EXP'), '50% credit rule must not grant EXP');
  assert(!ledger?.includes('30 EXP'), '100% credit rule must not grant EXP');
});

await test('Today view resets for a new day', async () => {
  const yesterday = hkYesterdayKey();
  const today = hkDateKey();
  await page.evaluate((yesterday) => {
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const habitId = uid();
    localStorage.setItem('habitTrackerProductionV7', JSON.stringify({
      habits: [{
        id: habitId, name: 'Daily Reset', emoji: '📖', color: '#4f46e5', target: 1, xpReward: 5,
        frequency: { mode: 'daily', days: [0, 1, 2, 3, 4, 5, 6], schedule: { type: 'days' } },
        reminder: { enabled: false, time: '20:30', message: '' },
        sortOrder: 0, paused: false, archived: false, groupId: null,
      }],
      records: [{ id: uid(), habitId, date: yesterday, at: new Date().toISOString(), note: '' }],
      journals: {}, redemptions: [], groups: [],
      settings: {
        startDate: '2026-01-01', onboardingComplete: true, vacations: [],
        rewards: {
          creditRules: [{ id: uid(), pct: 50, amount: 2 }, { id: uid(), pct: 100, amount: 10 }],
          giftRules: [], penaltyCredit: 5, penaltyXp: 20, penaltyZeroDays: 2,
        },
      },
    }));
    location.reload();
  }, yesterday);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.click('.nav-item[data-view="homeView"]');
  await page.waitForTimeout(300);
  const meta = await page.locator('#todayHabitGroups .habit-meta span').first().textContent();
  const dataDate = await page.locator('#todayHabitGroups .check-btn').first().getAttribute('data-date');
  const done = await page.locator('#todayHabitGroups .check-btn').first().getAttribute('class');
  assert(meta?.startsWith('0/'), `today should start fresh, got ${meta}`);
  assert(!done?.includes('done'), 'yesterday completion should not mark today done');
  assert(dataDate === today, `records should target today (${today}), got ${dataDate}`);
});

await test('Daily habit EXP awarded after yesterday completion', async () => {
  const yesterday = hkYesterdayKey();
  await page.evaluate((yesterday) => {
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const habitId = uid();
    localStorage.setItem('habitTrackerProductionV7', JSON.stringify({
      habits: [{
        id: habitId, name: 'Daily EXP', emoji: '📖', color: '#4f46e5', target: 1, xpReward: 5,
        frequency: { mode: 'daily', days: [0, 1, 2, 3, 4, 5, 6], schedule: { type: 'days' } },
        reminder: { enabled: false, time: '20:30', message: '' },
        sortOrder: 0, paused: false, archived: false, groupId: null,
      }],
      records: [{ id: uid(), habitId, date: yesterday, at: new Date().toISOString(), note: '' }],
      journals: {}, redemptions: [], groups: [],
      settings: {
        startDate: yesterday, onboardingComplete: true, vacations: [],
        rewards: {
          creditRules: [{ id: uid(), pct: 50, amount: 2 }, { id: uid(), pct: 100, amount: 10 }],
          giftRules: [], penaltyCredit: 5, penaltyXp: 20, penaltyZeroDays: 2,
        },
      },
    }));
    location.reload();
  }, yesterday);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.locator('#todayHabitGroups .check-btn:not(.done):not(:disabled)').first().click();
  await page.waitForTimeout(500);
  const xpPop = await page.evaluate(() => document.querySelector('#expPopLayer .xp-pop')?.textContent || '');
  assert(xpPop.includes('5'), `today completion should show EXP pop, got ${xpPop}`);
  await page.click('#profileQuick');
  await page.waitForTimeout(300);
  const xpText = await page.locator('#levelPageXp').textContent();
  assert(xpText?.includes('10 /'), `two daily completions should total 10 EXP, got ${xpText}`);
});

await test('Reward rule edits show save bar until saved', async () => {
  await page.click('#topSettingsBtn');
  await page.waitForSelector('#creditRulesBox [data-amount]');
  await page.waitForTimeout(200);
  assert(await page.locator('#settingsSaveBar').isHidden(), 'save bar should be hidden initially');
  const amount = page.locator('#creditRulesBox [data-amount]').first();
  await amount.selectOption('5');
  await amount.dispatchEvent('change');
  await page.waitForTimeout(200);
  assert(!(await page.locator('#settingsSaveBar').isHidden()), 'save bar should appear after reward edit');
  await page.click('#saveSettingsBtn');
  await page.waitForTimeout(400);
  assert(await page.locator('#settingsSaveBar').isHidden(), 'save bar should hide after save');
});

await test('Today shows paused banner during pause period', async () => {
  const today = hkDateKey();
  await page.evaluate((t) => {
    const s = JSON.parse(localStorage.getItem('habitTrackerProductionV7'));
    s.settings.vacations = [{ id: 'pause1', from: t, to: t, label: 'Holiday' }];
    s.settings.onboardingComplete = true;
    localStorage.setItem('habitTrackerProductionV7', JSON.stringify(s));
    location.reload();
  }, today);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await page.click('.nav-item[data-view="homeView"]');
  await page.waitForTimeout(300);
  assert(await page.locator('#todayPauseBanner').isVisible(), 'pause banner should be visible');
  const ring = await page.locator('#todayRingText').textContent();
  assert(ring?.includes('⏸'), 'today ring should show pause icon');
});

await test('Week strip updates instantly after today habit reset', async () => {
  const today = hkDateKey();
  await page.evaluate((today) => {
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const h1 = uid();
    const h2 = uid();
    const s = JSON.parse(localStorage.getItem('habitTrackerProductionV7'));
    s.habits = [
      { id: h1, name: 'Habit A', emoji: '📖', color: '#4f46e5', target: 1, xpReward: 5, frequency: { mode: 'daily', days: [0, 1, 2, 3, 4, 5, 6], schedule: { type: 'days' } }, reminder: { enabled: false, time: '20:30', message: '' }, sortOrder: 0, paused: false, archived: false, groupId: null },
      { id: h2, name: 'Habit B', emoji: '🏃', color: '#2563eb', target: 1, xpReward: 5, frequency: { mode: 'daily', days: [0, 1, 2, 3, 4, 5, 6], schedule: { type: 'days' } }, reminder: { enabled: false, time: '20:30', message: '' }, sortOrder: 1, paused: false, archived: false, groupId: null },
    ];
    s.records = [{ id: uid(), habitId: h1, date: today, at: new Date().toISOString(), note: '' }];
    s.settings.startDate = today;
    s.settings.onboardingComplete = true;
    s.settings.vacations = [];
    localStorage.setItem('habitTrackerProductionV7', JSON.stringify(s));
  }, today);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.nav-item[data-view="homeView"]');
  await page.waitForTimeout(600);
  await page.click('.nav-item[data-view="homeView"]');
  await page.waitForTimeout(300);
  const beforeBand = await page.locator('#weekStrip .wcell.today .wnum').getAttribute('class');
  assert(beforeBand?.includes('band-partial'), `today should start at 50% color, got ${beforeBand}`);
  await page.locator('#todayHabitGroups .check-btn:not(.done)').first().click();
  await page.waitForTimeout(400);
  const afterCompleteBand = await page.locator('#weekStrip .wcell.today .wnum').getAttribute('class');
  assert(afterCompleteBand?.includes('band-perfect'), `today should turn 100% color after completion, got ${afterCompleteBand}`);
  await page.locator('#todayHabitGroups .reset-habit-btn').first().click();
  await page.waitForTimeout(400);
  const afterResetBand = await page.locator('#weekStrip .wcell.today .wnum').getAttribute('class');
  assert(afterResetBand?.includes('band-partial'), `today should return to 50% color after reset, got ${afterResetBand}`);
});

await browser.close();

const failed = results.filter(r => !r.ok);
console.log('\n---', results.length - failed.length + '/' + results.length, 'passed ---');
if (failed.length) process.exit(1);
