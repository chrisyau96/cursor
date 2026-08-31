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

console.log('launch-core tests passed');
