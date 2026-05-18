import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeMode: 'auto',
      setThemeMode: (mode) => set({ themeMode: mode }),
    }),
    {
      name: 'musiki-theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export const getEffectiveTheme = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'auto') {
    return Appearance.getColorScheme() || 'dark';
  }
  return mode;
};
