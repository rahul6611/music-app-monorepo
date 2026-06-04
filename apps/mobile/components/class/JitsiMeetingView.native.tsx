import React, { useMemo, useCallback, useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewErrorEvent, WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import {
  buildJoinMeetingUrl,
  buildJitsiEmbedHtml,
  getJitsiServerUrl,
} from '../../utils/jitsi';
import type { JitsiMeetingViewProps } from './JitsiMeetingView.web';

const JitsiMeetingView: React.FC<JitsiMeetingViewProps> = ({
  roomName,
  displayName,
  subject,
  onHangup,
  onJoined,
  onRecordingChange,
  onError,
}) => {
  const [loadError, setLoadError] = useState<string | null>(null);
  const joinedRef = useRef(false);

  const meetingUri = useMemo(
    () => buildJoinMeetingUrl(roomName, displayName),
    [roomName, displayName]
  );

  const fallbackHtml = useMemo(
    () =>
      buildJitsiEmbedHtml({
        roomName,
        displayName,
        subject,
      }),
    [roomName, displayName, subject]
  );

  const [useFallbackEmbed, setUseFallbackEmbed] = useState(false);

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'joined' && !joinedRef.current) {
          joinedRef.current = true;
          onJoined?.();
        }
        if (msg.type === 'hangup') onHangup?.();
        if (msg.type === 'recording') onRecordingChange?.(!!msg.on);
      } catch {
        // ignore
      }
    },
    [onHangup, onJoined, onRecordingChange]
  );

  const reportError = useCallback(
    (message: string) => {
      setLoadError(message);
      onError?.(message);
    },
    [onError]
  );

  const handleWebError = useCallback(
    (e: WebViewErrorEvent) => {
      const desc = e.nativeEvent.description || 'WebView failed to load Jitsi';
      reportError(
        `${desc}\n\n• Docker running?\n• Same Wi-Fi as PC?\n• Server: ${getJitsiServerUrl()}\n\nRebuild APK after: npx expo prebuild --platform android --clean`
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

  const webSource = useFallbackEmbed
    ? { html: fallbackHtml, baseUrl: getJitsiServerUrl() }
    : { uri: meetingUri };

  return (
    <View style={styles.container}>
      {loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Cannot connect to video server</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <Text
            style={styles.retryLink}
            onPress={() => {
              setLoadError(null);
              setUseFallbackEmbed((v) => !v);
            }}
          >
            Tap to retry {useFallbackEmbed ? '(direct URL)' : '(embed mode)'}
          </Text>
        </View>
      ) : null}

      <WebView
        key={useFallbackEmbed ? 'embed' : 'uri'}
        source={webSource}
        style={styles.webview}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        startInLoadingState
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#97B6FF" />
          </View>
        )}
        onMessage={handleMessage}
        onError={handleWebError}
        onHttpError={handleHttpError}
        onNavigationStateChange={(nav) => {
          if (!joinedRef.current && /\/${roomName}/i.test(nav.url)) {
            joinedRef.current = true;
            onJoined?.();
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
  },
  errorBox: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 20,
    backgroundColor: 'rgba(80,0,0,0.92)',
    padding: 12,
    borderRadius: 8,
  },
  errorTitle: { color: '#fff', fontWeight: '700', marginBottom: 6 },
  errorText: { color: '#ffcccc', fontSize: 12 },
  retryLink: { color: '#97B6FF', marginTop: 8, fontWeight: '600' },
});

export default JitsiMeetingView;
