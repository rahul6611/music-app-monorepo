/**
 * Stub for expo-camera on Windows.
 * Production replacement: react-native-vision-camera or a UWP MediaCapture module.
 */
export function useCameraPermissions() {
  return [null, async () => ({ granted: false })];
}

export function useMicrophonePermissions() {
  return [null, async () => ({ granted: false })];
}

export function CameraView() {
  return null;
}
