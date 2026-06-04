/**
 * Patches react-native-webview to allow self-signed Jitsi on LAN.
 * Called automatically by withAndroidJitsiNetworkSecurity at prebuild.
 */
const fs = require('fs');
const path = require('path');

const roots = [
  path.join(__dirname, '../..'),
  path.join(__dirname, '../../..'),
];

for (const root of roots) {
  const clientPath = path.join(
    root,
    'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebViewClient.java'
  );
  if (!fs.existsSync(clientPath)) continue;

  let content = fs.readFileSync(clientPath, 'utf8');
  if (content.includes('MUSIKI_LOCAL_JITSI_SSL')) {
    console.log('[patch-webview-ssl] Already patched:', clientPath);
    continue;
  }

  const marker = '        // Cancel request after obtaining top-level URL.';
  const markerIdx = content.indexOf(marker);
  if (markerIdx === -1) {
    console.warn('[patch-webview-ssl] Marker not found in', clientPath);
    continue;
  }

  const cancelIdx = content.indexOf('        handler.cancel();', markerIdx);
  if (cancelIdx === -1) {
    console.warn('[patch-webview-ssl] handler.cancel() not found');
    continue;
  }

  const insert = `        // MUSIKI_LOCAL_JITSI_SSL — trust self-signed Jitsi on private LAN
        if (failingUrl != null && isMusikiLocalJitsiUrl(failingUrl)) {
            handler.proceed();
            return;
        }

        handler.cancel();`;

  content =
    content.slice(0, cancelIdx) +
    insert +
    content.slice(cancelIdx + '        handler.cancel();'.length);

  const helper = `
    /** Musiki: allow Docker Jitsi self-signed HTTPS on LAN */
    private boolean isMusikiLocalJitsiUrl(String url) {
        return url.contains("192.168.")
            || url.contains("10.0.")
            || url.contains("172.16.")
            || url.contains("172.17.")
            || url.contains("localhost")
            || url.contains("127.0.0.1");
    }
`;

  content = content.replace(
    '    public void setProgressChangedFilter(RNCWebView.ProgressChangedFilter filter) {',
    helper + '\n    public void setProgressChangedFilter(RNCWebView.ProgressChangedFilter filter) {'
  );

  fs.writeFileSync(clientPath, content, 'utf8');
  console.log('[patch-webview-ssl] Patched:', clientPath);
}
