#!/usr/bin/env node
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { readFileSync } from 'fs';
import vm from 'vm';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(root, '../assets/js/launch-core.js'), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, URL, URLSearchParams };
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox);
const Launch = sandbox.module.exports;

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

assert(Launch.shouldDriveBackup({ driveConnected: true, driveBackupFreq: 'daily' }, '2026-08-31') === true, 'missing last backup should run');
assert(Launch.shouldDriveBackup({ driveConnected: true, driveBackupFreq: 'daily', lastDriveBackupAt: '2026-08-31T01:00:00.000Z' }, '2026-08-31') === false, 'same day should skip');
assert(Launch.shouldDriveBackup({ driveConnected: true, driveBackupFreq: 'daily', lastDriveBackupAt: '2026-08-30' }, '2026-08-31') === true, 'new day should backup');
assert(Launch.shouldDriveBackup({ driveConnected: true, driveBackupFreq: 'weekly', lastDriveBackupAt: '2026-08-30' }, '2026-08-31') === false, 'same week should skip');
assert(Launch.shouldDriveBackup({ driveConnected: true, driveBackupFreq: 'weekly', lastDriveBackupAt: '2026-08-23' }, '2026-08-31') === true, 'new week should backup');
assert(Launch.shouldDriveBackup({ driveConnected: false, driveBackupFreq: 'daily' }, '2026-08-31') === false, 'disconnected should skip');
assert(Launch.shouldDriveBackup({ driveConnected: true, driveBackupFreq: 'off', lastDriveBackupAt: '' }, '2026-08-31') === false, 'off should skip');

assert(Launch.weekStartKey('2026-08-31') === '2026-08-30', 'week starts Sunday');
assert(Launch.duePhrase('2026-08-31', '2026-08-31') === 'Due today', 'due today');
assert(Launch.duePhrase('2026-08-31', '2026-09-01') === 'Due tmr', 'due tmr');
assert(Launch.duePhrase('2026-08-31', '2026-09-02') === 'Due in 3 days', 'inclusive day count');

const slots = Launch.buildReminderSlots([
  { id: 'h1', name: 'Read', reminder: { enabled: true, time: '21:00' } },
  { id: 'h2', name: 'Skip', reminder: { enabled: false, time: '08:00' } },
], {
  todayKey: '2026-08-31',
  remindersEnabled: true,
  days: 3,
  now: new Date(2026, 7, 31, 10, 0, 0),
  habitNeedsReminderOn: (h, dateKey) => h.id === 'h1' && dateKey === '2026-08-31',
  reminderBody: (h) => 'Time for ' + h.name,
});
assert(slots.length === 1, 'one future slot');
assert(slots[0].body === 'Time for Read', 'reminder body');
assert(slots[0].id > 0, 'notification id');

const none = Launch.buildReminderSlots([{ id: 'h1', reminder: { enabled: true, time: '07:00' } }], {
  todayKey: '2026-08-31', remindersEnabled: false, days: 2, now: new Date(2026, 7, 31, 10, 0, 0),
  habitNeedsReminderOn: () => true,
});
assert(none.length === 0, 'disabled reminders schedule nothing');

const state = { records: [{ id: 'r1', habitId: 'h1', date: '2026-08-31', at: 't', note: '' }] };
const applied = Launch.applyPendingActions(state, [
  { type: 'complete', habitId: 'h2', date: '2026-08-31' },
  { type: 'reset', habitId: 'h1', date: '2026-08-31' },
], { uid: () => 'new1', todayKey: '2026-08-31', nowIso: 't2' });
assert(applied.length === 2, 'two pending actions applied');
assert(state.records.every((r) => r.habitId !== 'h1'), 'reset removes today records');
assert(state.records.some((r) => r.habitId === 'h2' && r.note === 'widget'), 'widget complete added');

const cfg = Launch.normalizeWidgetConfig({ mode: 'habits', habitIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], layout: 9 });
assert(cfg.habitIds.length === 6 && cfg.layout === 6, 'widget config capped at 6');
assert(Launch.parseQueryActions('?widgetAction=complete&habitId=abc').habitId === 'abc', 'query action');
assert(Launch.parseAppUrl('momentum://widget/reset?habitId=z').type === 'reset', 'app url action');

const repeating = Launch.buildRepeatingNative([
  { id: 'h1', name: 'Read', reminder: { enabled: true, time: '07:15' }, frequency: { mode: 'daily', days: [1, 3], schedule: { type: 'days' } } },
], { reminderBody: (h) => h.name });
assert(repeating.length === 2, 'one native alarm per weekday');
assert(repeating[0].weekday === 2 && repeating[1].weekday === 4, 'Capacitor weekday is Sunday=1');

const mixedRepeating = Launch.buildRepeatingNative([
  { id: 'daily', name: 'Water', reminder: { enabled: true, time: '08:00' }, frequency: { mode: 'daily', days: [0, 1, 2, 3, 4, 5, 6] } },
  { id: 'flex', name: 'Gym', reminder: { enabled: true, time: '08:00' }, frequency: { mode: 'weekly', schedule: { type: 'any' } } },
  { id: 'month', name: 'Review', reminder: { enabled: true, time: '08:00' }, frequency: { mode: 'monthly', schedule: { type: 'any' } } },
  { id: 'paused', name: 'Off', reminder: { enabled: true, time: '08:00' }, paused: true, frequency: { mode: 'daily' } },
], { reminderBody: (h) => h.name });
assert(mixedRepeating.length === 7, 'only daily habits use repeating weekdays');
assert(mixedRepeating.every((n) => n.extra.habitId === 'daily'), 'flex and monthly stay on one-shot slots');

const past = Launch.buildReminderSlots([
  { id: 'h1', name: 'Read', reminder: { enabled: true, time: '07:00' } },
], {
  todayKey: '2026-08-31',
  remindersEnabled: true,
  days: 3,
  now: new Date(2026, 7, 31, 10, 0, 0),
  habitNeedsReminderOn: () => true,
});
assert(past.length === 2, 'past time today is skipped');
assert(past[0].dateKey === '2026-09-01', 'first remaining slot is tomorrow');

const many = Launch.buildReminderSlots(
  Array.from({ length: 20 }, (_, i) => ({ id: 'h' + i, name: 'H' + i, reminder: { enabled: true, time: '21:00' } })),
  {
    todayKey: '2026-08-31',
    remindersEnabled: true,
    days: 21,
    now: new Date(2026, 7, 31, 10, 0, 0),
    habitNeedsReminderOn: () => true,
  },
);
assert(many.length === Launch.NATIVE_SLOT_LIMIT, 'native slot cap');

const nativeNotes = Launch.toNativeNotifications([
  { id: 42, title: 'Momentum', body: 'Time for Read', at: Date.parse('2026-09-01T21:00:00'), habitId: 'h1', dateKey: '2026-09-01' },
]);
assert(nativeNotes.length === 1 && nativeNotes[0].id === 42, 'oneshot maps id');
assert(nativeNotes[0].schedule.allowWhileIdle === true, 'idle alarm');
assert(typeof nativeNotes[0].schedule.at.getTime === 'function', 'schedule.at is a Date');
assert(nativeNotes[0].extra.habitId === 'h1' && nativeNotes[0].extra.date === '2026-09-01', 'extra carries habit and day');

assert(Launch.adsRemoved({ adsRemoved: true }) === true, 'ads removed flag');
assert(Launch.shouldShowAds({ adsRemoved: false }) === true, 'show ads by default');
assert(Launch.shouldShowAds({ adsRemoved: true }) === false, 'hide ads after purchase');
assert(Launch.shouldShowAds({}) === true, 'missing flag still shows ads');
const marked = Launch.markAdsRemoved({ adsRemoved: false }, '2026-09-01T00:00:00.000Z');
assert(marked.adsRemoved === true && marked.adsRemovedAt === '2026-09-01T00:00:00.000Z', 'mark lifetime purchase');
assert(Launch.ADS_PRODUCT_ID === 'remove_ads_lifetime', 'Play product id');
assert(Launch.ADS_PRICE_LABEL === 'HK$38', 'Hong Kong lifetime price');
assert(Launch.purchaseOwnsRemoveAds([{ productIdentifier: 'remove_ads_lifetime', purchaseState: 'PURCHASED' }]) === true, 'owns purchased sku');
assert(Launch.purchaseOwnsRemoveAds([{ productId: 'remove_ads_lifetime', state: 'owned' }]) === true, 'owns alt field names');
assert(Launch.purchaseOwnsRemoveAds([{ sku: 'remove_ads_lifetime' }]) === true, 'owns sku without state');
assert(Launch.purchaseOwnsRemoveAds([{ productIdentifier: 'remove_ads_lifetime', purchaseState: 'cancelled' }]) === false, 'ignore cancelled');
assert(Launch.purchaseOwnsRemoveAds([{ productIdentifier: 'other', purchaseState: 'purchased' }]) === false, 'ignore other sku');
assert(Launch.purchaseOwnsRemoveAds([]) === false, 'empty purchase list');

const multi = { records: [] };
const multiApplied = Launch.applyPendingActions(multi, [
  { type: 'complete', habitId: 'water', date: '2026-08-31' },
  { type: 'complete', habitId: 'water', date: '2026-08-31' },
  { type: 'complete', habitId: 'water', date: '2026-08-31' },
], { uid: () => 'w' + Math.random(), todayKey: '2026-08-31', nowIso: 't' });
assert(multiApplied.length === 3, 'each widget complete is one count');
assert(multi.records.filter((r) => r.habitId === 'water').length === 3, 'multi-count habit can complete from widget more than once');

const resetAfter = Launch.applyPendingActions(multi, [
  { type: 'reset', habitId: 'water', date: '2026-08-31' },
], { uid: () => 'x', todayKey: '2026-08-31' });
assert(resetAfter.length === 1 && multi.records.length === 0, 'widget reset clears that day');

const journal = Launch.applyPendingActions({ records: [] }, [{ type: 'journal' }], { uid: () => 'j', todayKey: '2026-08-31' });
assert(journal[0].type === 'journal', 'journal pending is forwarded');

assert(Launch.normalizeWidgetConfig(null).mode === 'today', 'default widget mode');
assert(Launch.normalizeWidgetConfig({ mode: 'nope' }).mode === 'today', 'unknown widget mode falls back');
assert(Launch.parseAppUrl('momentum://widget/journal').type === 'journal', 'journal widget url');
assert(Launch.parseAppUrl('momentum://widget/open').type === 'open', 'open widget url');
assert(Launch.parseAppUrl('https://example.com/?widgetAction=complete&habitId=h9&date=2026-08-31').date === '2026-08-31', 'web query keeps date');
assert(Launch.parseAppUrl('ftp://nope') === null, 'bad protocol ignored');

const delay = Launch.nextWebTimerDelay([{ at: Date.parse('2026-08-31T22:00:00') }], Date.parse('2026-08-31T10:00:00'));
assert(delay && delay.delay > 0, 'web timer finds next slot');
assert(Launch.nextWebTimerDelay([], Date.now()) === null, 'no slots means no timer');

console.log('launch-core tests passed');
