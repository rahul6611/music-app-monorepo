import { useRouter } from 'expo-router';
import { useAuthStore } from '@music-app/store';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import React from 'react';

export default function Index() {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/(tabs)/library');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [user, isLoading, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#60a5fa" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
