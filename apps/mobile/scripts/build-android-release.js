/**
 * Release APK build helper (Windows-safe):
 * - Verifies .env Jitsi URL is baked into the bundle
 * - Patches WebView SSL for self-signed Docker Jitsi
 * - Stops Gradle daemons (avoids ninja "Permission denied" on .cxx)
 * - Sets NODE_ENV + monorepo Metro env for Expo tasks
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const mobileRoot = path.join(__dirname, '..');
const androidDir = path.join(mobileRoot, 'android');
const cxxDir = path.join(androidDir, 'app', '.cxx');
const cleanNative = process.argv.includes('--clean-native');

function readEnvValue(key) {
  const envPath = path.join(mobileRoot, '.env');
  if (!fs.existsSync(envPath)) return null;
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`));
  if (!line) return null;
  return line.split('=').slice(1).join('=').trim();
}

const jitsiUrl = readEnvValue('EXPO_PUBLIC_JITSI_SERVER_URL');
if (!jitsiUrl) {
  console.warn('');
  console.warn('[build-android-release] WARNING: EXPO_PUBLIC_JITSI_SERVER_URL missing in apps/mobile/.env');
  console.warn('  Release APK will use https://meet.jit.si — live class will NOT reach your Docker Jitsi.');
  console.warn('  Add e.g. EXPO_PUBLIC_JITSI_SERVER_URL=https://192.168.x.x:8443 then rebuild.');
  console.warn('');
} else {
  console.log('[build-android-release] Jitsi URL in .env:', jitsiUrl);
}

console.log('[build-android-release] Patching WebView SSL for local Jitsi...');
try {
  require('./patch-webview-ssl.js');
} catch (err) {
  console.warn('[build-android-release] WebView SSL patch failed:', err.message);
}

const env = {
  ...process.env,
  NODE_ENV: 'production',
  EXPO_NO_METRO_WORKSPACE_ROOT: '1',
};

console.log('[build-android-release] Stopping Gradle daemons...');
try {
  execSync('gradlew --stop', { cwd: androidDir, stdio: 'inherit', shell: true, env });
} catch {
  // ignore if no daemon running
}

if (cleanNative && fs.existsSync(cxxDir)) {
  console.log('[build-android-release] Removing native build cache (.cxx)...');
  try {
    fs.rmSync(cxxDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  } catch (err) {
    console.warn('[build-android-release] Could not delete .cxx:', err.message);
    console.warn('Close Android Studio / other Gradle builds, then run:');
    console.warn('  npm run build:android:release -- --clean-native');
  }
}

console.log('[build-android-release] Bundling JS for release (--rerun-tasks)...');
execSync('gradlew :app:createBundleReleaseJsAndAssets --rerun-tasks --no-daemon', {
  cwd: androidDir,
  stdio: 'inherit',
  shell: true,
  env,
});

console.log('[build-android-release] assembleRelease (--no-daemon)...');
execSync('gradlew assembleRelease --no-daemon', {
  cwd: androidDir,
  stdio: 'inherit',
  shell: true,
  env,
});

const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
console.log('');
console.log('[build-android-release] Done.');
console.log('  Install:', apkPath);
console.log('');
if (jitsiUrl) {
  console.log('  Live class needs: Docker Jitsi running + phone on same Wi‑Fi as', jitsiUrl);
}
console.log('  If video stays on loader, run once: npm run prebuild:android');
console.log('  Then: npm run build:android:release');
