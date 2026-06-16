import { useEffect } from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@music-app/store';

/**
 * Deep link entry: musiki://community/post/{id}
 * Redirects into the Community tab and highlights the target post.
 */
export default function CommunityPostDeepLinkScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    if (!id) {
      router.replace('/(tabs)/community');
      return;
    }

    router.replace({
      pathname: '/(tabs)/community',
      params: { postId: id },
    });
  }, [id, router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.text, { color: theme.textSecondary }]}>Opening post…</Text>
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
