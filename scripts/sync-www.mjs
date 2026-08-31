#!/usr/bin/env node
import { mkdirSync, cpSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const dest = 'www';
mkdirSync(dest, { recursive: true });
const files = ['index.html', 'privacy.html', 'sw.js', 'manifest.webmanifest', '.nojekyll'];
for (const f of files) {
  if (existsSync(f)) cpSync(f, join(dest, f));
}
cpSync('assets', join(dest, 'assets'), { recursive: true });
writeFileSync(join(dest, '.nomedia'), '');
console.log('www/ synced for Capacitor');
