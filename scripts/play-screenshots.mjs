#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { join } from 'path';

const BASE = process.argv[2] || 'http://127.0.0.1:8765/index.html';
const outDir = join(dirname(fileURLToPath(import.meta.url)), '../store/play/screenshots');
mkdirSync(outDir, { recursive: true });

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
});
await page.goto(BASE, { waitUntil: 'networkidle' });
const today = todayKey();
await page.evaluate((today) => {
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const h1 = 'h-bible', h2 = 'h-move', h3 = 'h-water';
  const giftId = 'gift-buffet';
  const s = {
    habits: [
      { id: h1, name: 'Bible Time', emoji: '📖', color: '#7c3aed', target: 1, xpReward: 5, frequency: { mode: 'daily', days: [0,1,2,3,4,5,6], schedule: { type: 'days' } }, reminder: { enabled: true, time: '07:15', message: '' }, sortOrder: 0, paused: false, archived: false, groupId: null },
      { id: h2, name: 'Morning Movement', emoji: '🏃', color: '#059669', target: 1, xpReward: 5, frequency: { mode: 'daily', days: [1,2,3,4,5], schedule: { type: 'days' } }, reminder: { enabled: false, time: '07:35', message: '' }, sortOrder: 1, paused: false, archived: false, groupId: null },
      { id: h3, name: 'Drink Water', emoji: '💧', color: '#0ea5e9', target: 6, xpReward: 10, frequency: { mode: 'daily', days: [0,1,2,3,4,5,6], schedule: { type: 'days' } }, reminder: { enabled: false, time: '12:00', message: '' }, sortOrder: 2, paused: false, archived: false, groupId: null },
    ],
    records: [
      { id: uid(), habitId: h1, date: today, at: new Date().toISOString(), note: '' },
      { id: uid(), habitId: h3, date: today, at: new Date().toISOString(), note: '' },
      { id: uid(), habitId: h3, date: today, at: new Date().toISOString(), note: '' },
    ],
    journals: { [today]: { mood: '😊', energy: 8, text: 'Started the day with prayer and a walk.', updatedAt: new Date().toISOString() } },
    redemptions: [],
    groups: [{ id: 'g-m', name: 'Morning', emoji: '🌅', color: '#ea580c', sortOrder: 0 }],
    settings: {
      startDate: today, userName: 'Chris', colorMode: 'light', styleTheme: 'vivid',
      reminders: true, globalReminderTime: '20:30', defaultReminderMessage: 'Time for {habit}!',
      dataMode: 'real', autoBackup: false, onboardingComplete: true, vacations: [],
      rewards: {
        creditRules: [{ id: 'c50', pct: 50, amount: 2 }, { id: 'c100', pct: 100, amount: 10 }],
        giftRules: [{ id: giftId, gift: 'Buffet', icon: '🍽️', pct: 80, days: 30 }],
        activeGiftId: giftId, penaltyCredit: 5, penaltyXp: 20, penaltyZeroDays: 2,
      },
    },
  };
  s.habits[0].groupId = 'g-m';
  s.habits[1].groupId = 'g-m';
  localStorage.setItem('habitTrackerProductionV7', JSON.stringify(s));
  location.reload();
}, today);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.click('.nav-item[data-view="homeView"]');
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, '01-home.png'), fullPage: false });
await page.click('.nav-item[data-view="habitsView"]');
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, '02-habits.png'), fullPage: false });
await page.click('.nav-item[data-view="reportView"]');
await page.waitForTimeout(600);
await page.screenshot({ path: join(outDir, '03-report.png'), fullPage: false });
await page.click('.nav-item[data-view="rewardsView"]');
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, '04-rewards.png'), fullPage: false });
await page.click('#topSettingsBtn');
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, '05-settings.png'), fullPage: false });
await browser.close();
console.log('screenshots written to', outDir);
