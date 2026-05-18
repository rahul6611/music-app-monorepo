import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const CHANNEL_ID = 'practice-reminders';
const CATEGORY_ID = 'practice-actions';

if (Platform.OS !== 'web') {
  Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    {
      buttonTitle: 'Practice Now 🥁',
      identifier: 'practice-now',
      options: { opensAppToForeground: true },
    },
    {
      buttonTitle: 'View Profile',
      identifier: 'view-profile',
      options: { opensAppToForeground: true },
    },
    {
      buttonTitle: 'Snooze 15m',
      identifier: 'snooze',
      options: { opensAppToForeground: false },
    },
  ]);
}

// Setup Android Channel
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Practice Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#ffffff',
  });
}

export const requestNotificationPermissions = async () => {
  if (Platform.OS === 'web') return false;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
};

export const schedulePracticeReminder = async (
  hour: number, 
  minute: number, 
  title: string = "Time to Practice! 🎵",
  body: string = "Keep your streak alive. Open Musiki to practice your taals."
) => {
  if (Platform.OS === 'web') return null;
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;

  // Clear existing reminders to avoid duplicates
  await cancelAllScheduledNotifications();

  // Robust remote image handling for iOS
  let localImgUri = 'https://res.cloudinary.com/dtdotmher/image/upload/v1776145182/ucdzlbgkw7cqxcvdlenp.jpg';
  
  if (Platform.OS === 'ios') {
    try {
      const { uri } = await FileSystem.downloadAsync(
        localImgUri,
        FileSystem.cacheDirectory + 'practice-reminder.jpg'
      );
      localImgUri = uri;
    } catch (e) {
      console.error('Failed to download image for notification:', e);
    }
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "🚨 Last chance!",
      body: "Practice by midnight to keep your streak alive! 🥁",
      subtitle: "Musiki Learning", 
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      sticky: false,
      data: { url: '/(tabs)/' },
      categoryIdentifier: CATEGORY_ID,
      color: '#ef4444', 
      badge: 1,
      interruptionLevel: 'timeSensitive',
      // Android
      largeIcon: 'https://res.cloudinary.com/dtdotmher/image/upload/v1776145182/ucdzlbgkw7cqxcvdlenp.jpg',
      vibrate: [0, 250, 250, 250],
      // iOS
      attachments: [
        {
          identifier: 'practice-reminder-img',
          url: localImgUri,
          type: 'image/jpeg',
        }
      ],
    },
    trigger: {
      type: 'calendar', 
      hour,
      minute,
      repeats: true,
      channelId: CHANNEL_ID,
    } as any,
  });

  return id;
};

export const triggerInstantNotification = async () => {
  if (Platform.OS === 'web') return;
  
  const imgRemoteUrl = 'https://res.cloudinary.com/dtdotmher/image/upload/v1776145182/ucdzlbgkw7cqxcvdlenp.jpg';
  let localImgUri = imgRemoteUrl;

  if (Platform.OS === 'ios') {
    try {
      const { uri } = await FileSystem.downloadAsync(
        imgRemoteUrl,
        FileSystem.cacheDirectory + 'instant-reminder.jpg'
      );
      localImgUri = uri;
    } catch (e) {
      console.error('Failed to download image for instant notification:', e);
    }
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🚨 Last chance!",
      body: "Practice by midnight to keep your streak alive! 🥁",
      subtitle: "Musiki Practice Reminder",
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      sticky: true,
      categoryIdentifier: CATEGORY_ID,
      color: '#ef4444',
      badge: 1,
      interruptionLevel: 'timeSensitive',
      largeIcon: imgRemoteUrl, 
      vibrate: [0, 250, 250, 250],
      attachments: [
        {
          identifier: 'instant-reminder-img',
          url: localImgUri,
          type: 'image/jpeg',
        }
      ],
      data: { url: '/(tabs)/' },
    },
    trigger: null,
  });
};

export const cancelAllScheduledNotifications = async () => {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
};

export const clearNotifications = async () => {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'ios') {
    await Notifications.setBadgeCountAsync(0);
  }
  await Notifications.dismissAllNotificationsAsync();
};

/**
 * Register for push notifications and return the Expo Push Token.
 */
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'web') return null;

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return null;
    }
    
    // Get the Expo Push Token
    // We use the projectId from app.json
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    
    if (!projectId) {
      console.error('Project ID not found in app.config.js or app.json');
      return null;
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      })).data;
      console.log('Push Token:', token);
    } catch (e) {
      console.error('Error getting push token:', e);
    }
  } else {
    console.warn('Must use physical device for Push Notifications');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}

/**
 * Handler for notifications received while the app is in the foreground.
 */
export function addNotificationReceivedListener(callback: (notification: Notifications.Notification) => void) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Handler for when a user interacts with a notification (taps it).
 */
export function addNotificationResponseReceivedListener(callback: (response: Notifications.NotificationResponse) => void) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
