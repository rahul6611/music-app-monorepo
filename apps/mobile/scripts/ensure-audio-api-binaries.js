/**
 * react-native-audio-api downloads native libs via bash+unzip during Gradle preBuild.
 * On Windows/WSL without unzip, extraction silently fails and CMake can't find libopusfile.a.
 * This script ensures Android prebuilts exist before Gradle runs.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

const TAG = 'v3.1.0';
const BASE_URL = `https://github.com/software-mansion-labs/rn-audio-libs/releases/download/${TAG}`;
const ANDROID_ARCHIVES = [
  {
    name: 'android.zip',
    dest: (root) => path.join(root, 'common', 'cpp', 'audioapi', 'external'),
    check: (root) =>
      path.join(root, 'common', 'cpp', 'audioapi', 'external', 'android', 'arm64-v8a', 'libopusfile.a'),
  },
  {
    name: 'jniLibs.zip',
    dest: (root) => path.join(root, 'android', 'src', 'main'),
    check: (root) => path.join(root, 'android', 'src', 'main', 'jniLibs'),
  },
];

function resolveAudioApiRoot() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'react-native-audio-api'),
    path.join(__dirname, '..', '..', '..', 'node_modules', 'react-native-audio-api'),
  ];
  const found = candidates.find((dir) => fs.existsSync(path.join(dir, 'package.json')));
  if (!found) {
    throw new Error('react-native-audio-api not found in node_modules');
  }
  return found;
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(destPath);
          downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destPath);
          reject(new Error(`Download failed (${res.statusCode}): ${url}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', reject);
  });
}

function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (process.platform === 'win32') {
    const psDest = destDir.replace(/'/g, "''");
    const psZip = zipPath.replace(/'/g, "''");
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${psZip}' -DestinationPath '${psDest}' -Force"`,
      { stdio: 'inherit' },
    );
    return;
  }
  execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' });
}

async function ensureArchive(root, archive) {
  if (fs.existsSync(archive.check(root))) {
    return;
  }

  const tempDir = path.join(root, 'audioapi-binaries-temp');
  fs.mkdirSync(tempDir, { recursive: true });
  const zipPath = path.join(tempDir, archive.name);
  const destDir = archive.dest(root);

  console.log(`[ensure-audio-api-binaries] Downloading ${archive.name}...`);
  await downloadFile(`${BASE_URL}/${archive.name}`, zipPath);
  console.log(`[ensure-audio-api-binaries] Extracting ${archive.name}...`);
  extractZip(zipPath, destDir);
  fs.rmSync(tempDir, { recursive: true, force: true });

  if (!fs.existsSync(archive.check(root))) {
    throw new Error(`[ensure-audio-api-binaries] Expected files missing after extracting ${archive.name}`);
  }
}

async function main() {
  const root = resolveAudioApiRoot();
  for (const archive of ANDROID_ARCHIVES) {
    await ensureArchive(root, archive);
  }
  console.log('[ensure-audio-api-binaries] Android prebuilt binaries ready.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
