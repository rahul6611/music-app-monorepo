import React, { useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { JitsiMeeting } from '@jitsi/react-sdk';
import {
  getJitsiDomain,
  JITSI_CONFIG_OVERWRITE,
  JITSI_INTERFACE_OVERWRITE,
} from '../../utils/jitsi';

export interface JitsiMeetingViewProps {
  roomName: string;
  displayName: string;
  userEmail?: string;
  subject?: string;
  onHangup?: () => void;
  onJoined?: () => void;
  onRecordingChange?: (active: boolean) => void;
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
}) => {
  const apiRef = useRef<any>(null);

  const handleApiReady = useCallback(
    (externalApi: any) => {
      apiRef.current = externalApi;
      externalApi.addListener('videoConferenceJoined', () => onJoined?.());
      externalApi.addListener('readyToClose', () => onHangup?.());
      externalApi.addListener('recordingStatusChanged', (payload: { on?: boolean }) => {
        onRecordingChange?.(!!payload?.on);
      });
    },
    [onHangup, onJoined, onRecordingChange]
  );

  return (
    <View style={styles.container}>
      <JitsiMeeting
        domain={getJitsiDomain()}
        roomName={roomName}
        configOverwrite={{
          ...JITSI_CONFIG_OVERWRITE,
          subject,
          defaultLocalDisplayName: displayName,
        }}
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
