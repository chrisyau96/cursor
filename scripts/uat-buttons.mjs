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
  const connected = await page.evaluate(() => JSON.parse(localStorage.getItem('habitTrackerProductionV7')).settings.fileConnected);
  assert(connected, 'backup file should be connected');
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
  page.on('dialog', d => d.accept());
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
  await page.locator('#autoBackupSwitch').click();
  await page.waitForTimeout(200);
  await page.click('.nav-item[data-view="homeView"]');
  await page.waitForTimeout(200);
  await page.locator('.check-btn:not(.done):not(:disabled)').first().click();
  await page.waitForTimeout(5500);
  const writes = await page.evaluate(() => window.__backupWrites || 0);
  const lastBackup = await page.evaluate(() => JSON.parse(localStorage.getItem('habitTrackerProductionV7')).settings.lastBackupAt);
  assert(writes > 0, 'backup file should be written');
  assert(!!lastBackup, 'lastBackupAt should be set after auto sync');
});

await browser.close();

const failed = results.filter(r => !r.ok);
console.log('\n---', results.length - failed.length + '/' + results.length, 'passed ---');
if (failed.length) process.exit(1);
