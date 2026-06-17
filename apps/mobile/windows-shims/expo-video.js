/**
 * Stub for expo-video on Windows.
 * Production replacement: react-native-video (with Windows support) or WebView embed.
 */
import React from 'react';
import { View } from 'react-native';

export function useVideoPlayer() {
  return {
    play: () => {},
    pause: () => {},
    seekTo: () => {},
    replace: () => {},
  };
}

export function VideoView() {
  return <View />;
}
