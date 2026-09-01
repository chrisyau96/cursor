#!/usr/bin/env node
/**
 * Copy native widget sources into a Capacitor android/ios project.
 * Run after: npm i && npx cap add android && npx cap add ios
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function copyDir(src, dest) {
  if (!existsSync(src)) return false;
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  return true;
}

let copied = 0;
if (existsSync('android/app/src/main')) {
  copyDir('native-src/android/java', 'android/app/src/main/java/com/dincey/habitjournal');
  copyDir('native-src/android/res', 'android/app/src/main/res');
  const manifestPath = 'android/app/src/main/AndroidManifest.xml';
  const activityFilter = `            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="momentum" android:host="widget" />
            </intent-filter>`;
  if (existsSync(manifestPath)) {
    let xml = readFileSync(manifestPath, 'utf8');
    const snippet = readFileSync('native-src/android/AndroidManifest.snippet.xml', 'utf8');
    if (!xml.includes('MomentumWidgetProvider')) {
      xml = xml.replace('</application>', `${snippet}\n    </application>`);
    }
    if (!xml.includes('android:host="widget"')) {
      xml = xml.replace('</activity>', `${activityFilter}\n        </activity>`);
    }
    writeFileSync(manifestPath, xml);
  }
  copied++;
  console.log('Applied Android widget sources');
} else {
  console.log('Skip Android (run npx cap add android first)');
}

if (existsSync('ios/App/App')) {
  copyDir('native-src/ios', 'ios/App/MomentumWidgets');
  copied++;
  console.log('Copied iOS widget sources to ios/App/MomentumWidgets');
  console.log('Still required in Xcode: File → New → Target → Widget Extension, then add these Swift files and App Group group.com.dincey.habitjournal');
} else {
  console.log('Skip iOS (run npx cap add ios on a Mac)');
}

if (!copied) process.exit(1);
