const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function readJitsiHostFromEnv(projectRoot) {
  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath)) return null;
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('EXPO_PUBLIC_JITSI_SERVER_URL='));
  if (!line) return null;
  const raw = line.split('=').slice(1).join('=').trim();
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

function patchWebViewSslForLocalJitsi(projectRoot) {
  const clientPath = path.join(
    projectRoot,
    'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebViewClient.java'
  );
  const altClientPath = path.join(
    projectRoot,
    '../../node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebViewClient.java'
  );
  const target = fs.existsSync(clientPath) ? clientPath : altClientPath;
  if (!fs.existsSync(target)) {
    console.warn('[withAndroidJitsiNetworkSecurity] RNCWebViewClient.java not found — skip SSL patch');
    return;
  }

  let content = fs.readFileSync(target, 'utf8');
  if (content.includes('MUSIKI_LOCAL_JITSI_SSL')) {
    return;
  }

  const marker = '        // Cancel request after obtaining top-level URL.';
  const markerIdx = content.indexOf(marker);
  if (markerIdx === -1) {
    console.warn('[withAndroidJitsiNetworkSecurity] Could not patch RNCWebViewClient — marker not found');
    return;
  }

  const cancelIdx = content.indexOf('        handler.cancel();', markerIdx);
  if (cancelIdx === -1 || content.includes('MUSIKI_LOCAL_JITSI_SSL')) {
    if (content.includes('MUSIKI_LOCAL_JITSI_SSL')) return;
    console.warn('[withAndroidJitsiNetworkSecurity] handler.cancel() not found');
    return;
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

  fs.writeFileSync(target, content, 'utf8');
  console.log('[withAndroidJitsiNetworkSecurity] Patched WebView SSL for local Jitsi');
}

function copyJitsiCertIfPresent(projectRoot, androidResRawDir) {
  const certSources = [
    path.join(projectRoot, '../infra/jitsi/jitsi-meet-cfg/web/keys/cert.crt'),
    path.join(projectRoot, '../../infra/jitsi/jitsi-meet-cfg/web/keys/cert.crt'),
  ];
  const src = certSources.find((p) => fs.existsSync(p));
  if (!src) return false;
  fs.mkdirSync(androidResRawDir, { recursive: true });
  fs.copyFileSync(src, path.join(androidResRawDir, 'jitsi_meet_ca.crt'));
  return true;
}

function buildNetworkSecurityXml(jitsiHost, hasCert) {
  const domainBlock = jitsiHost
    ? `
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">${jitsiHost}</domain>
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />${hasCert ? '\n      <certificates src="@raw/jitsi_meet_ca" />' : ''}
    </trust-anchors>
  </domain-config>`
    : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </base-config>${domainBlock}
  <debug-overrides>
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </debug-overrides>
</network-security-config>
`;
}

/**
 * Fixes Android SSL for self-signed Docker Jitsi (192.168.x.x:8443).
 * REQUIRED: npx expo prebuild --platform android --clean
 *           then ./gradlew assembleRelease
 */
function withAndroidJitsiNetworkSecurity(config) {
  config = withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    app.$['android:usesCleartextTraffic'] = 'false';
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const xmlDir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      const rawDir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/raw');
      fs.mkdirSync(xmlDir, { recursive: true });

      const jitsiHost = readJitsiHostFromEnv(projectRoot);
      const hasCert = copyJitsiCertIfPresent(projectRoot, rawDir);

      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        buildNetworkSecurityXml(jitsiHost, hasCert)
      );

      return cfg;
    },
  ]);

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const script = path.join(cfg.modRequest.projectRoot, 'scripts/patch-webview-ssl.js');
      if (fs.existsSync(script)) {
        require(script);
      }
      return cfg;
    },
  ]);

  return config;
}

module.exports = withAndroidJitsiNetworkSecurity;
