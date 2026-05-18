import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@music-app/firebase';
import { useAuthStore } from '@music-app/store';
import { 
  clearNotifications, 
  registerForPushNotificationsAsync,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener 
} from '@music-app/firebase';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import '../global.css';

import { useColorScheme } from 'nativewind';
import { useThemeStore } from '@music-app/store';
import CameraOverlay from '../components/CameraOverlay';
import GlobalUploadProgress from '../components/ui/GlobalUploadProgress';

try {
  (StyleSheet as any).setFlag?.('darkMode', 'class');
} catch (e) {}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const themeMode = useThemeStore((state) => state.themeMode);
  const [appIsReady, setAppIsReady] = useState(false);
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    if (themeMode === 'auto') {
      setColorScheme('system');
    } else {
      setColorScheme(themeMode);
    }
  }, [themeMode, setColorScheme]);

  useEffect(() => {
    async function prepare() {
      try {
        const delayPromise = new Promise(resolve => setTimeout(resolve, 2500));
        
        const authPromise = new Promise((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
            resolve(unsubscribe);
          });
        });

        const [unsubscribe] = await Promise.all([authPromise, delayPromise]);
        
        setAppIsReady(true);
        return () => (unsubscribe as () => void)();
      } catch (e) {
        console.warn(e);
        setAppIsReady(true);
      }
    }

    prepare();
  }, [setUser, setLoading]);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync();
      clearNotifications();

      registerForPushNotificationsAsync().then(token => {
        if (token) {
          console.log('--- EXPO PUSH TOKEN ---');
          console.log(token);
          console.log('-----------------------');
        }
      });

      const notificationListener = addNotificationReceivedListener(notification => {
        console.log('Notification Received (Foreground):', notification);
      });

      const responseListener = addNotificationResponseReceivedListener(response => {
        console.log('Notification Response:', response);
        const url = response.notification.request.content.data?.url;
        if (url) {
          console.log('Deep Linking to:', url);
        }
      });

      return () => {
        notificationListener.remove();
        responseListener.remove();
      };
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <View style={styles.rootContainer}>
        <StatusBar style="light" />
        <View style={Platform.OS === 'web' ? styles.webWrapper : { flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen 
              name="notation/add" 
              options={{ 
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }} 
            />
            <Stack.Screen 
              name="modules/create" 
              options={{ 
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }} 
            />
            <Stack.Screen name="modules/[id]" />
          </Stack>
        </View>
        <CameraOverlay />
        <GlobalUploadProgress />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webWrapper: {
    flex: 1,
    maxWidth: '100%',
    width: '100%',
    backgroundColor: '#000',
  }
});
