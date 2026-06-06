import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Text,
  PermissionsAndroid,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewErrorEvent, WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import {
  buildJoinMeetingUrl,
  buildJitsiEmbedHtml,
  buildJitsiDirectUrlBridgeScript,
  getJitsiServerUrl,
  isPrivateJitsiServer,
  preferDirectJitsiUrlOnNative,
  urlMatchesJitsiRoom,
} from '../../utils/jitsi';
import type { JitsiMeetingViewProps } from './JitsiMeetingView.web';

const EMBED_TIMEOUT_MS = 45000;
const DIRECT_TIMEOUT_MS = 90000;

async function requestAndroidAvPermissions(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
  } catch {
    // WebView may still prompt
  }
}

const JitsiMeetingView: React.FC<JitsiMeetingViewProps> = ({
  roomName,
  displayName,
  subject,
  onHangup,
  onJoined,
  onRecordingChange,
  onNetworkStatusChange,
  onError,
}) => {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [permissionsReady, setPermissionsReady] = useState(Platform.OS !== 'android');
  const [webLoading, setWebLoading] = useState(true);
  const joinedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [useDirectUrl, setUseDirectUrl] = useState(preferDirectJitsiUrlOnNative());

  const meetingUri = useMemo(
    () => buildJoinMeetingUrl(roomName, displayName),
    [roomName, displayName]
  );

  const embedHtml = useMemo(
    () =>
      buildJitsiEmbedHtml({
        roomName,
        displayName,
        subject,
      }),
    [roomName, displayName, subject]
  );

  const directUrlBridgeScript = useMemo(
    () => (useDirectUrl ? buildJitsiDirectUrlBridgeScript(roomName) : undefined),
    [useDirectUrl, roomName]
  );

  const clearLoadTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const markJoined = useCallback(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;
    clearLoadTimeout();
    setWebLoading(false);
    setLoadError(null);
    onJoined?.();
  }, [clearLoadTimeout, onJoined]);

  const reportError = useCallback(
    (message: string) => {
      if (joinedRef.current) return;
      clearLoadTimeout();
      setWebLoading(false);
      setLoadError(message);
      onError?.(message);
    },
    [clearLoadTimeout, onError]
  );

  const startLoadTimeout = useCallback(() => {
    clearLoadTimeout();
    const ms = useDirectUrl ? DIRECT_TIMEOUT_MS : EMBED_TIMEOUT_MS;
    timeoutRef.current = setTimeout(() => {
      if (joinedRef.current) return;
      const server = getJitsiServerUrl();
      const hint = isPrivateJitsiServer(server)
        ? `\n\nServer ${server} — if you already see the call controls below, tap Dismiss.`
        : `\n\nServer: ${server}`;
      reportError(`Still connecting after ${ms / 1000}s.${hint}`);
    }, ms);
  }, [clearLoadTimeout, reportError, useDirectUrl]);

  useEffect(() => {
    requestAndroidAvPermissions().finally(() => setPermissionsReady(true));
    return clearLoadTimeout;
  }, [clearLoadTimeout]);

  useEffect(() => {
    if (permissionsReady && !joinedRef.current) {
      startLoadTimeout();
    }
  }, [permissionsReady, useDirectUrl, startLoadTimeout]);

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'joined') markJoined();
        if (msg.type === 'hangup') onHangup?.();
        if (msg.type === 'recording') onRecordingChange?.(!!msg.on);
        if (msg.type === 'error' && msg.message && !joinedRef.current) {
          reportError(String(msg.message));
        }
        if (msg.type === 'network' && msg.status) {
          onNetworkStatusChange?.({
            status: msg.status,
            message: msg.message || '',
            videoQuality: msg.videoQuality,
          });
        }
      } catch {
        // ignore
      }
    },
    [markJoined, onHangup, onRecordingChange, onNetworkStatusChange, reportError]
  );

  const handleWebError = useCallback(
    (e: WebViewErrorEvent) => {
      const desc = e.nativeEvent.description || 'WebView failed to load Jitsi';
      reportError(
        `${desc}\n\n• Docker running?\n• Same Wi-Fi as PC?\n• Server: ${getJitsiServerUrl()}`
      );
    },
    [reportError]
  );

  const handleHttpError = useCallback(
    (e: WebViewHttpErrorEvent) => {
      if (e.nativeEvent.statusCode >= 400) {
        reportError(`HTTP ${e.nativeEvent.statusCode} — is Jitsi running at ${getJitsiServerUrl()}?`);
      }
    },
    [reportError]
  );

  const webSource = useDirectUrl
    ? { uri: meetingUri }
    : { html: embedHtml, baseUrl: getJitsiServerUrl() };

  if (!permissionsReady) {
    return (
      <View style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#97B6FF" />
          <Text style={styles.loadingHint}>Requesting camera & microphone…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loadError ? (
        <View style={styles.errorBox} pointerEvents="box-none">
          <View style={styles.errorInner}>
            <Text style={styles.errorTitle}>Connection notice</Text>
            <Text style={styles.errorText}>{loadError}</Text>
            <View style={styles.errorActions}>
              <Text style={styles.retryLink} onPress={() => setLoadError(null)}>
                Dismiss
              </Text>
              <Text
                style={styles.retryLink}
                onPress={() => {
                  joinedRef.current = false;
                  setLoadError(null);
                  setWebLoading(true);
                  setUseDirectUrl((v) => !v);
                }}
              >
                Retry {useDirectUrl ? '(embed)' : '(direct URL)'}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {webLoading && !loadError ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" color="#97B6FF" />
          <Text style={styles.loadingHint}>
            {useDirectUrl ? 'Opening meeting…' : 'Loading Jitsi…'}
          </Text>
        </View>
      ) : null}

      <WebView
        key={useDirectUrl ? 'uri' : 'embed'}
        source={webSource}
        style={styles.webview}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        injectedJavaScript={directUrlBridgeScript}
        onLoadStart={() => {
          if (!joinedRef.current) setWebLoading(true);
        }}
        onLoadEnd={(e) => {
          const url = e.nativeEvent.url;
          if (useDirectUrl && urlMatchesJitsiRoom(url, roomName)) {
            markJoined();
          } else if (useDirectUrl) {
            setWebLoading(false);
          }
        }}
        onMessage={handleMessage}
        onError={handleWebError}
        onHttpError={handleHttpError}
        onNavigationStateChange={(nav) => {
          if (!useDirectUrl) return;
          if (urlMatchesJitsiRoom(nav.url, roomName)) {
            markJoined();
          }
        }}
        originWhitelist={['*']}
        mediaCapturePermissionGrantType="grant"
        {...(Platform.OS === 'android'
          ? {
              mixedContentMode: 'always' as const,
            }
          : {})}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 300,
    backgroundColor: '#040404',
  },
  webview: {
    flex: 1,
    backgroundColor: '#040404',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#040404',
    zIndex: 10,
    gap: 12,
  },
  loadingHint: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  errorBox: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 20,
  },
  errorInner: {
    backgroundColor: 'rgba(80,0,0,0.92)',
    padding: 12,
    borderRadius: 8,
  },
  errorTitle: { color: '#fff', fontWeight: '700', marginBottom: 6 },
  errorText: { color: '#ffcccc', fontSize: 12 },
  errorActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  retryLink: { color: '#97B6FF', fontWeight: '600', fontSize: 13 },
});

export default JitsiMeetingView;
