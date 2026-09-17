#!/usr/bin/env node
/**
 * Copy the live web app into the Capacitor Android assets folder.
 * Android Studio Generate Signed Bundle runs the same copy from Gradle
 * so a Play AAB cannot ship a new versionName with an old v62 web bundle.
 */
import { mkdirSync, cpSync, existsSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'android/app/src/main/assets/public');
if (!existsSync(join(root, 'index.html'))) {
  throw new Error('index.html missing — run this from the Habit & Journal git repo');
}
mkdirSync(dest, { recursive: true });
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
console.log('android/app/src/main/assets/public synced from repo web files');
