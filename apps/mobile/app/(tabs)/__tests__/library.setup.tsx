import React from 'react';

export const lightTheme = {
  background: '#FFFFFF',
  card: '#F3F4F6',
  border: '#E5E7EB',
  text: '#111827',
  textSecondary: '#4B5563',
  primary: '#7C3AED',
  primarySoft: 'rgba(124, 58, 237, 0.1)',
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: require('./library.mocks').mockRouterPush }),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('@music-app/firebase', () => ({
  fetchUserData: jest.fn(),
  getAllRaags: jest.fn(),
  getAllExercises: jest.fn(),
  getAllExerciseCollections: jest.fn(),
  getSharedItemIdsForStudent: jest.fn(),
}));

jest.mock('@music-app/store', () => ({
  useTheme: () => require('./library.setup').lightTheme,
  useAuthStore: () => ({
    user: require('./library.mocks').mockAuthUser,
    isLoading: false,
    setUser: jest.fn(),
    setLoading: jest.fn(),
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: object }) => (
      <View style={style}>{children}</View>
    ),
  };
});
