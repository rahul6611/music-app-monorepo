import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@music-app/store';

/** Landing screen for musiki://oauth redirects handled by expo-web-browser. */
export default function OAuthRedirectScreen() {
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    router.replace('/(tabs)/community');
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.text, { color: theme.textSecondary }]}>Completing sign-in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  text: {
    fontSize: 15,
  },
});
