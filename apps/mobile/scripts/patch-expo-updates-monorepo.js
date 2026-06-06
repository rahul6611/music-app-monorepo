/**
 * Monorepo fix: expo-updates passes an entry path relative to the workspace root
 * (e.g. apps/mobile/index.js) while projectRoot is apps/mobile, so Metro looks for
 * apps/mobile/apps/mobile/index.js and release builds fail.
 */
const fs = require('fs');
const path = require('path');

const MARKER = '// [musiki-monorepo-entry-fix]';

function findExpoUpdatesPluginKt() {
  const roots = [
    path.join(__dirname, '..'),
    path.join(__dirname, '../../..'),
  ];
  for (const root of roots) {
    const candidate = path.join(
      root,
      'node_modules/expo-updates/expo-updates-gradle-plugin/src/main/kotlin/expo/modules/updates/ExpoUpdatesPlugin.kt'
    );
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function patch() {
  const filePath = findExpoUpdatesPluginKt();
  if (!filePath) {
    console.warn('[patch-expo-updates-monorepo] expo-updates gradle plugin not found, skipping');
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(MARKER)) {
    return;
  }

  const needle = '          add(entryFile.get())';
  if (!content.includes(needle)) {
    console.warn('[patch-expo-updates-monorepo] ExpoUpdatesPlugin.kt format changed, skipping');
    return;
  }

  const replacement = `          ${MARKER}
          val rootPath = projectRoot.get()
          val entryPath = entryFile.get()
          val relativeEntry = java.nio.file.Paths.get(entryPath).let { ep ->
            if (ep.isAbsolute) {
              java.nio.file.Paths.get(rootPath).relativize(ep).toString().replace('\\\\', '/')
            } else {
              entryPath
            }
          }
          add(relativeEntry)`;

  content = content.replace(needle, replacement);

  const envNeedle = '        if (Os.isFamily(Os.FAMILY_WINDOWS)) {';
  const envInsert = `        it.environment("EXPO_NO_METRO_WORKSPACE_ROOT", "1")
        if (!debuggableVariant.get()) {
          it.environment("NODE_ENV", "production")
        }
        `;
  if (!content.includes('EXPO_NO_METRO_WORKSPACE_ROOT')) {
    content = content.replace(envNeedle, envInsert + envNeedle);
  }

  fs.writeFileSync(filePath, content);
  console.log('[patch-expo-updates-monorepo] Patched', filePath);
}

patch();
