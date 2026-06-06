import React, { useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { JitsiMeeting } from '@jitsi/react-sdk';
import {
  getJitsiDomain,
  getJitsiVideoQualityPreset,
  buildJitsiConfigOverwrite,
  JITSI_INTERFACE_OVERWRITE,
  networkStatusFromVideoQuality,
  networkStatusMessage,
  type JitsiNetworkStatusPayload,
} from '../../utils/jitsi';

export interface JitsiMeetingViewProps {
  roomName: string;
  displayName: string;
  userEmail?: string;
  subject?: string;
  onHangup?: () => void;
  onJoined?: () => void;
  onRecordingChange?: (active: boolean) => void;
  onNetworkStatusChange?: (payload: JitsiNetworkStatusPayload) => void;
  onError?: (message: string) => void;
}

const JitsiMeetingView: React.FC<JitsiMeetingViewProps> = ({
  roomName,
  displayName,
  userEmail = '',
  subject,
  onHangup,
  onJoined,
  onRecordingChange,
  onNetworkStatusChange,
}) => {
  const apiRef = useRef<any>(null);
  const lastNetworkStatus = useRef<string>('good');
  const targetPreset = getJitsiVideoQualityPreset();

  const emitNetwork = useCallback(
    (status: JitsiNetworkStatusPayload['status'], videoQuality?: number) => {
      if (status === lastNetworkStatus.current && status !== 'degraded') return;
      lastNetworkStatus.current = status;
      onNetworkStatusChange?.({
        status,
        message: networkStatusMessage(status, videoQuality),
        videoQuality,
      });
    },
    [onNetworkStatusChange]
  );

  const handleApiReady = useCallback(
    (externalApi: any) => {
      apiRef.current = externalApi;
      externalApi.addListener('videoConferenceJoined', () => {
        onJoined?.();
        emitNetwork('good', targetPreset);
      });
      externalApi.addListener('readyToClose', () => onHangup?.());
      externalApi.addListener('recordingStatusChanged', (payload: { on?: boolean }) => {
        onRecordingChange?.(!!payload?.on);
      });
      externalApi.addListener('videoQualityChanged', (payload: { videoQuality?: number }) => {
        const h = payload?.videoQuality ?? 0;
        emitNetwork(networkStatusFromVideoQuality(h, targetPreset), h);
      });
      externalApi.addListener('peerConnectionFailure', () => {
        emitNetwork('poor', 0);
      });
    },
    [onHangup, onJoined, onRecordingChange, emitNetwork, targetPreset]
  );

  return (
    <View style={styles.container}>
      <JitsiMeeting
        domain={getJitsiDomain()}
        roomName={roomName}
        configOverwrite={buildJitsiConfigOverwrite({
          subject,
          defaultLocalDisplayName: displayName,
        })}
        interfaceConfigOverwrite={JITSI_INTERFACE_OVERWRITE}
        userInfo={{ displayName, email: userEmail }}
        onApiReady={handleApiReady}
        getIFrameRef={(iframeRef) => {
          if (iframeRef) {
            iframeRef.style.height = '100%';
            iframeRef.style.width = '100%';
            iframeRef.style.border = 'none';
            iframeRef.allow = 'camera; microphone; fullscreen; display-capture';
          }
        }}
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
});

export default JitsiMeetingView;
