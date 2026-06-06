const DEFAULT_JITSI_SERVER = 'https://meet.jit.si';

export type JitsiVideoQualityPreset = 480 | 720 | 1080;

export type JitsiNetworkStatus = 'good' | 'degraded' | 'poor';

export interface JitsiNetworkStatusPayload {
  status: JitsiNetworkStatus;
  message?: string;
  videoQuality?: number;
}

const QUALITY_PRESET_CONFIG: Record<
  JitsiVideoQualityPreset,
  {
    maxBitrate: number;
    minHeightForQualityLvl: Record<number, number>;
  }
> = {
  480: {
    maxBitrate: 500_000,
    minHeightForQualityLvl: { 180: 0, 360: 200, 480: 500 },
  },
  720: {
    maxBitrate: 1_500_000,
    minHeightForQualityLvl: { 180: 0, 360: 200, 720: 500 },
  },
  1080: {
    maxBitrate: 2_500_000,
    minHeightForQualityLvl: { 180: 0, 360: 200, 720: 500, 1080: 900 },
  },
};

export function getJitsiServerUrl(): string {
  const url = process.env.EXPO_PUBLIC_JITSI_SERVER_URL?.trim();
  if (!url) return DEFAULT_JITSI_SERVER;
  return url.replace(/\/$/, '');
}

/** Self-hosted Docker / LAN Jitsi (not meet.jit.si) */
export function isPrivateJitsiServer(url: string = getJitsiServerUrl()): boolean {
  try {
    const host = new URL(url).hostname;
    if (host === 'meet.jit.si') return false;
    return (
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('172.') ||
      host === 'localhost' ||
      host === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

/** Direct room URL is more reliable than embed + external_api.js on Android release */
export function preferDirectJitsiUrlOnNative(): boolean {
  return isPrivateJitsiServer();
}

/** Host (+ port) for JitsiMeetExternalAPI / iframe domain prop */
export function getJitsiDomain(): string {
  try {
    const url = new URL(getJitsiServerUrl());
    const defaultPort = url.protocol === 'https:' ? '443' : '80';
    if (url.port && url.port !== defaultPort) {
      return `${url.hostname}:${url.port}`;
    }
    return url.hostname;
  } catch {
    return 'meet.jit.si';
  }
}

/** 480 | 720 | 1080 from EXPO_PUBLIC_JITSI_VIDEO_QUALITY (default 720) */
export function getJitsiVideoQualityPreset(): JitsiVideoQualityPreset {
  const raw = process.env.EXPO_PUBLIC_JITSI_VIDEO_QUALITY?.trim();
  const n = parseInt(raw || '720', 10);
  if (n === 480) return 480;
  if (n === 1080) return 1080;
  return 720;
}

export function buildJitsiConfigOverwrite(options?: {
  subject?: string;
  defaultLocalDisplayName?: string;
}) {
  const preset = getJitsiVideoQualityPreset();
  const quality = QUALITY_PRESET_CONFIG[preset];

  return {
    prejoinPageEnabled: false,
    startWithAudioMuted: false,
    startWithVideoMuted: false,
    disableDeepLinking: true,
    enableWelcomePage: false,
    resolution: preset,
    constraints: {
      video: {
        height: { ideal: preset, max: preset, min: 180 },
      },
    },
    videoQuality: {
      maxBitratesVideo: {
        VP8: quality.maxBitrate,
        VP9: quality.maxBitrate,
        H264: quality.maxBitrate,
      },
      minHeightForQualityLvl: quality.minHeightForQualityLvl,
    },
    disableNoiseSuppression:
      process.env.EXPO_PUBLIC_JITSI_DISABLE_NOISE_SUPPRESSION === 'true',
    ...(options?.subject ? { subject: options.subject } : {}),
    ...(options?.defaultLocalDisplayName
      ? { defaultLocalDisplayName: options.defaultLocalDisplayName }
      : {}),
  };
}

/** @deprecated Use buildJitsiConfigOverwrite() for env-driven quality */
export const JITSI_CONFIG_OVERWRITE = buildJitsiConfigOverwrite();

export const JITSI_INTERFACE_OVERWRITE = {
  SHOW_JITSI_WATERMARK: false,
  SHOW_WATERMARK_FOR_GUESTS: false,
  MOBILE_APP_PROMO: false,
  TOOLBAR_BUTTONS: [
    'microphone',
    'camera',
    'fullscreen',
    'hangup',
    'chat',
    'raisehand',
    'tileview',
    'settings',
  ],
};

/** Map Jitsi video height to app network status */
export function networkStatusFromVideoQuality(
  videoQuality: number,
  targetPreset: JitsiVideoQualityPreset = getJitsiVideoQualityPreset()
): JitsiNetworkStatus {
  if (videoQuality < 180) return 'poor';
  if (videoQuality < 360) return 'degraded';
  if (videoQuality < targetPreset * 0.5) return 'degraded';
  return 'good';
}

export function networkStatusMessage(status: JitsiNetworkStatus, videoQuality?: number): string {
  switch (status) {
    case 'poor':
      return 'Connection problem. Check your Wi‑Fi or try moving closer to your router.';
    case 'degraded':
      return videoQuality
        ? `Slow internet detected. Video reduced to ~${videoQuality}p.`
        : 'Slow internet detected. Video quality was reduced.';
    default:
      return '';
  }
}

/** Hash params appended to direct join URLs (WebView) */
function buildQualityHashParams(): string[] {
  const preset = getJitsiVideoQualityPreset();
  const quality = QUALITY_PRESET_CONFIG[preset];
  return [
    `config.resolution=${preset}`,
    `config.constraints.video.height.ideal=${preset}`,
    `config.constraints.video.height.max=${preset}`,
    `config.videoQuality.maxBitratesVideo.VP8=${quality.maxBitrate}`,
    `config.videoQuality.maxBitratesVideo.VP9=${quality.maxBitrate}`,
    `config.videoQuality.maxBitratesVideo.H264=${quality.maxBitrate}`,
  ];
}

/** Full room join URL — used by Android WebView direct URL mode */
export function buildJoinMeetingUrl(roomName: string, displayName?: string): string {
  const base = getJitsiServerUrl();
  const room = encodeURIComponent(roomName);
  const hash: string[] = [
    'config.prejoinPageEnabled=false',
    'config.disableDeepLinking=true',
    'config.enableWelcomePage=false',
    'config.startWithAudioMuted=false',
    'config.startWithVideoMuted=false',
    ...buildQualityHashParams(),
  ];
  if (displayName) {
    hash.push(`config.defaultLocalDisplayName=${encodeURIComponent(displayName)}`);
  }
  if (process.env.EXPO_PUBLIC_JITSI_DISABLE_NOISE_SUPPRESSION === 'true') {
    hash.push('config.disableNoiseSuppression=true');
  }
  return `${base}/${room}#${hash.join('&')}`;
}

/** Whether a loaded WebView URL is the Jitsi room page (direct URL mode) */
export function urlMatchesJitsiRoom(pageUrl: string, roomName: string): boolean {
  if (!pageUrl || !roomName) return false;
  try {
    const path = new URL(pageUrl).pathname.toLowerCase();
    const room = roomName.toLowerCase();
    const encoded = encodeURIComponent(roomName).toLowerCase();
    return path.includes(`/${room}`) || path.includes(`/${encoded}`);
  } catch {
    return pageUrl.toLowerCase().includes(roomName.toLowerCase());
  }
}

/**
 * Injected into direct-URL WebView so React Native knows when Jitsi actually joined.
 * Jitsi full-page mode does not postMessage by itself.
 */
export function buildJitsiDirectUrlBridgeScript(roomName: string): string {
  const room = JSON.stringify(roomName);
  return `
    (function() {
      var postedJoin = false;
      var roomName = ${room};
      function post(type, extra) {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, extra || {})));
        } catch (e) {}
      }
      function markJoined() {
        if (postedJoin) return;
        postedJoin = true;
        post('joined');
      }
      function checkJoined() {
        try {
          if (typeof APP !== 'undefined' && APP.conference && APP.conference.isJoined && APP.conference.isJoined()) {
            markJoined();
            return true;
          }
        } catch (e) {}
        return false;
      }
      var poll = setInterval(function() {
        if (checkJoined()) clearInterval(poll);
      }, 400);
      setTimeout(function() {
        if (checkJoined()) return;
        var path = (window.location.pathname || '').toLowerCase();
        var room = roomName.toLowerCase();
        if (path.indexOf('/' + room) !== -1 || path.indexOf('/' + encodeURIComponent(roomName).toLowerCase()) !== -1) {
          markJoined();
        }
      }, 2500);
    })();
    true;
  `;
}

export function buildJitsiRoomName(assignmentId: string): string {
  const safe = assignmentId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
  return `MusikiClass${safe}`;
}

export function buildClassSubject(classDate: string, classTime?: string): string {
  const parts = ['Musiki Class', classDate];
  if (classTime) parts.push(classTime);
  return parts.join(' · ');
}

/** Inline script: post network/recording/join events to React Native WebView */
function buildJitsiEmbedBridgeScript(targetPreset: number): string {
  return `
    const TARGET_PRESET = ${targetPreset};
    let lastNetworkStatus = 'good';

    function postNetwork(status, message, videoQuality) {
      if (status === lastNetworkStatus && status !== 'degraded') return;
      lastNetworkStatus = status;
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'network',
        status,
        message: message || '',
        videoQuality: videoQuality || 0,
      }));
    }

    api.addListener('videoQualityChanged', (e) => {
      const h = e.videoQuality || 0;
      let status = 'good';
      if (h < 180) status = 'poor';
      else if (h < 360 || h < TARGET_PRESET * 0.5) status = 'degraded';
      const msg = status === 'good' ? '' : (
        status === 'poor'
          ? 'Connection problem. Check your Wi-Fi or try moving closer to your router.'
          : 'Slow internet detected. Video quality was reduced to ~' + h + 'p.'
      );
      postNetwork(status, msg, h);
    });

    api.addListener('peerConnectionFailure', () => {
      postNetwork('poor', 'Connection problem. Unable to reach the video server.', 0);
    });

    api.addListener('videoConferenceJoined', () => {
      postNetwork('good', '', TARGET_PRESET);
    });
  `;
}

/** Embed HTML with External API — used on native (default) and fallback */
export function buildJitsiEmbedHtml(options: {
  roomName: string;
  displayName: string;
  subject?: string;
}): string {
  const serverUrl = getJitsiServerUrl();
  const domain = getJitsiDomain();
  const preset = getJitsiVideoQualityPreset();
  const config = JSON.stringify(
    buildJitsiConfigOverwrite({
      subject: options.subject,
      defaultLocalDisplayName: options.displayName,
    })
  );
  const interfaceConfig = JSON.stringify(JITSI_INTERFACE_OVERWRITE);
  const userInfo = JSON.stringify({ displayName: options.displayName });
  const bridgeScript = buildJitsiEmbedBridgeScript(preset);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body, #meet { margin: 0; padding: 0; height: 100%; width: 100%; background: #040404; overflow: hidden; }
    #load-err { display: none; color: #fca5a5; padding: 16px; font-family: sans-serif; font-size: 14px; }
  </style>
  <script>
    function postToApp(payload) {
      try { window.ReactNativeWebView?.postMessage(JSON.stringify(payload)); } catch (e) {}
    }
    function reportEmbedError(msg) {
      document.getElementById('load-err').style.display = 'block';
      document.getElementById('load-err').textContent = msg;
      postToApp({ type: 'error', message: msg });
    }
    window.onerror = function() {
      reportEmbedError('Jitsi script failed. Rebuild APK after: npm run prebuild:android');
    };
    setTimeout(function() {
      if (typeof JitsiMeetExternalAPI === 'undefined') {
        reportEmbedError('Cannot load Jitsi from ${serverUrl}. Check Docker, Wi-Fi, and SSL (prebuild + release APK).');
      }
    }, 45000);
  <\/script>
  <script src="${serverUrl}/external_api.js" onerror="reportEmbedError('Failed to load external_api.js from ${serverUrl}')"><\/script>
</head>
<body>
  <div id="load-err"></div>
  <div id="meet"></div>
  <script>
    if (typeof JitsiMeetExternalAPI === 'undefined') {
      reportEmbedError('Jitsi API not ready');
    } else {
    const api = new JitsiMeetExternalAPI(${JSON.stringify(domain)}, {
      roomName: ${JSON.stringify(options.roomName)},
      parentNode: document.getElementById('meet'),
      userInfo: ${userInfo},
      configOverwrite: ${config},
      interfaceConfigOverwrite: ${interfaceConfig},
    });
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'jitsi-ready' }));
    api.addListener('videoConferenceJoined', () => {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'joined' }));
    });
    api.addListener('readyToClose', () => {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'hangup' }));
    });
    api.addListener('recordingStatusChanged', (e) => {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'recording', on: e.on }));
    });
    ${bridgeScript}
    }
  </script>
</body>
</html>`;
}
