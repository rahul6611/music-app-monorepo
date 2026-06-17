/**
 * Stub for expo-audio on Windows.
 * Production replacement: react-native-audio-api (already in package.json) or
 * react-native-track-player with a Windows implementation.
 */
export const AudioModule = {
  requestRecordingPermissionsAsync: async () => ({ granted: false }),
  getRecordingPermissionsAsync: async () => ({ granted: false }),
};

export const RecordingPresets = {
  HIGH_QUALITY: {},
};

export function useAudioRecorder() {
  return {
    record: async () => {},
    stop: async () => ({ uri: null }),
    isRecording: false,
  };
}

export function useAudioPlayer() {
  return {
    play: () => {},
    pause: () => {},
    seekTo: () => {},
  };
}

export function useAudioPlayerStatus() {
  return { playing: false, currentTime: 0, duration: 0 };
}

export class AudioRecorder {
  async prepareToRecordAsync() {}
  async record() {}
  async stop() {
    return { uri: null };
  }
}
