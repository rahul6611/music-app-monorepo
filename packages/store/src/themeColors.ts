import { useThemeStore, getEffectiveTheme } from './themeStore';

export const Colors = {
  light: {
    background: '#FFFFFF',
    card: '#F3F4F6',
    border: '#E5E7EB',
    text: '#111827',
    textSecondary: '#4B5563',
    primary: '#7C3AED',
    primarySoft: 'rgba(124, 58, 237, 0.1)',
    danger: '#EF4444',
    dangerSoft: 'rgba(239, 68, 68, 0.1)',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E5E7EB',
    inputBackground: '#F9FAFB',
    inputText: '#111827',
  },
  dark: {
    background: '#000000',
    card: '#0A0A0A',
    border: '#1A1A1A',
    text: '#FFFFFF',
    textSecondary: '#6B7280',
    primary: '#A855F7',
    primarySoft: 'rgba(168, 85, 247, 0.1)',
    danger: '#EF4444',
    dangerSoft: 'rgba(239, 68, 68, 0.1)',
    tabBar: '#000000',
    tabBarBorder: '#1A1A1A',
    inputBackground: 'rgba(255, 255, 255, 0.08)',
    inputText: '#FFFFFF',
  },
};

export const useTheme = () => {
  const themeMode = useThemeStore((state) => state.themeMode);
  const effectiveTheme = getEffectiveTheme(themeMode);
  return Colors[effectiveTheme];
};
