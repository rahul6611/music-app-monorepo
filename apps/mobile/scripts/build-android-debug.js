/**
 * Debug APK (expo-dev-client) — loads JS from Metro on your PC.
 * Install app-debug.apk, then run `npm run start` in apps/mobile (same Wi‑Fi).
 */
const { execSync } = require('child_process');
const path = require('path');

const androidDir = path.join(__dirname, '..', 'android');

const env = {
  ...process.env,
  EXPO_NO_METRO_WORKSPACE_ROOT: '1',
};

const mobileRoot = path.join(__dirname, '..');

console.log('[build-android-debug] Ensuring react-native-audio-api prebuilt binaries...');
execSync('node scripts/ensure-audio-api-binaries.js', { cwd: mobileRoot, stdio: 'inherit' });

console.log('[build-android-debug] Stopping Gradle daemons...');
try {
  execSync('gradlew --stop', { cwd: androidDir, stdio: 'inherit', shell: true, env });
} catch {
  // ignore
}

console.log('[build-android-debug] assembleDebug (--no-daemon)...');
execSync('gradlew assembleDebug --no-daemon', {
  cwd: androidDir,
  stdio: 'inherit',
  shell: true,
  env,
});

const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
console.log('');
console.log('[build-android-debug] Done. Install:');
console.log('  ' + apkPath);
console.log('');
console.log('  Then on your PC (apps/mobile):');
console.log('    npm run start');
console.log('');
console.log('  Phone + PC on same Wi‑Fi. Open the app → pick your dev server (or scan QR).');
console.log('  Login screen loads after Metro connects — not from the APK alone.');
