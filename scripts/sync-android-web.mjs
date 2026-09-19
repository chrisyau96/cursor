#!/usr/bin/env node
/**
 * Copy the live web app into Capacitor Android assets and stamp versionName
 * from version.json so Play and the Settings footer cannot drift.
 */
import { mkdirSync, cpSync, existsSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'android/app/src/main/assets/public');
const capAssets = join(root, 'android/app/src/main/assets');
if (!existsSync(join(root, 'index.html'))) {
  throw new Error('index.html missing — run this from the Habit & Journal git repo');
}
const ver = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8')).versionName;

function stamp(file) {
  if (!existsSync(file)) return;
  let t = readFileSync(file, 'utf8');
  t = t.replace(/window\.MOMENTUM_APP_VERSION = '[^']+'/, `window.MOMENTUM_APP_VERSION = '${ver}'`);
  t = t.replace(/const APP_VERSION=window\.MOMENTUM_APP_VERSION\|\|'[^']+'/, `const APP_VERSION=window.MOMENTUM_APP_VERSION||'${ver}'`);
  t = t.replace(/Launch\.APP_VERSION = '[^']+'/, `Launch.APP_VERSION = '${ver}'`);
  t = t.replace(/\?v=[0-9]+\.[0-9]+\.[0-9]+/g, `?v=${ver}`);
  t = t.replace(/"appStartPath": "\/\?v=[^"]+"/, `"appStartPath": "/?v=${ver}"`);
  t = t.replace(/habit-journal-[0-9]+\.[0-9]+\.[0-9]+/g, `habit-journal-${ver}`);
  writeFileSync(file, t);
}

mkdirSync(dest, { recursive: true });
mkdirSync(capAssets, { recursive: true });
const files = ['index.html', 'privacy.html', 'sw.js', 'manifest.webmanifest'];
for (const f of files) {
  const src = join(root, f);
  if (existsSync(src)) cpSync(src, join(dest, f));
}
const assetsDest = join(dest, 'assets');
if (existsSync(assetsDest)) rmSync(assetsDest, { recursive: true, force: true });
cpSync(join(root, 'assets'), assetsDest, {
  recursive: true,
  filter: (from) => !from.endsWith('config.local.js'),
});
cpSync(join(root, 'capacitor.config.json'), join(capAssets, 'capacitor.config.json'));
stamp(join(dest, 'index.html'));
stamp(join(dest, 'sw.js'));
stamp(join(dest, 'assets/js/app.js'));
stamp(join(dest, 'assets/js/launch-core.js'));
stamp(join(capAssets, 'capacitor.config.json'));
console.log('android web assets synced as ' + ver);
