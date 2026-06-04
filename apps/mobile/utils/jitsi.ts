const DEFAULT_JITSI_SERVER = 'https://meet.jit.si';

export function getJitsiServerUrl(): string {
  const url = process.env.EXPO_PUBLIC_JITSI_SERVER_URL?.trim();
  if (!url) return DEFAULT_JITSI_SERVER;
  return url.replace(/\/$/, '');
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

/** Full room join URL — used by Android WebView and copy-link */
export function buildJoinMeetingUrl(roomName: string, displayName?: string): string {
  const base = getJitsiServerUrl();
  const room = encodeURIComponent(roomName);
  const hash: string[] = [
    'config.prejoinPageEnabled=false',
    'config.disableDeepLinking=true',
    'config.enableWelcomePage=false',
    'config.startWithAudioMuted=false',
    'config.startWithVideoMuted=false',
  ];
  if (displayName) {
    hash.push(`config.defaultLocalDisplayName=${encodeURIComponent(displayName)}`);
  }
  return `${base}/${room}#${hash.join('&')}`;
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

export const JITSI_CONFIG_OVERWRITE = {
  prejoinPageEnabled: false,
  startWithAudioMuted: false,
  startWithVideoMuted: false,
  disableDeepLinking: true,
  enableWelcomePage: false,
  resolution: 720,
  constraints: {
    video: {
      height: { ideal: 720, max: 720, min: 180 },
    },
  },
};

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

/** Fallback embed when direct URL is blocked (rare) */
export function buildJitsiEmbedHtml(options: {
  roomName: string;
  displayName: string;
  subject?: string;
}): string {
  const serverUrl = getJitsiServerUrl();
  const domain = getJitsiDomain();
  const config = JSON.stringify({
    ...JITSI_CONFIG_OVERWRITE,
    subject: options.subject,
    defaultLocalDisplayName: options.displayName,
  });
  const interfaceConfig = JSON.stringify(JITSI_INTERFACE_OVERWRITE);
  const userInfo = JSON.stringify({ displayName: options.displayName });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body, #meet { margin: 0; padding: 0; height: 100%; width: 100%; background: #040404; overflow: hidden; }
  </style>
  <script src="${serverUrl}/external_api.js"><\/script>
</head>
<body>
  <div id="meet"></div>
  <script>
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
  </script>
</body>
</html>`;
}
