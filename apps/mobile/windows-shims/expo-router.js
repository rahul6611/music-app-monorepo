/**
 * Stub for expo-router on Windows — file-based routing depends on Expo runtime.
 * Replace with @react-navigation/native for a full Windows port.
 */
import React from 'react';
import { Text, View } from 'react-native';

export function useRouter() {
  return {
    push: () => {},
    replace: () => {},
    back: () => {},
    setParams: () => {},
  };
}

export function useLocalSearchParams() {
  return {};
}

export function usePathname() {
  return '/';
}

export function Link({ children }) {
  return children ?? null;
}

export function Redirect() {
  return null;
}

export function Stack() {
  return null;
}

export function Tabs({ children }) {
  return children ?? null;
}

export function Slot() {
  return null;
}

export default function ExpoRouterStub() {
  return (
    <View>
      <Text>expo-router is not available on Windows</Text>
    </View>
  );
}
