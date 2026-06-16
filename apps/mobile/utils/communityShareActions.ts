import { Alert, Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import {
  buildCommunityShareMessage,
  buildInstagramCaption,
  CommunityPostShareInput,
  getCommunityPostWebUrl,
  getShareMediaExtension,
} from '@music-app/utils';

export function getWebAppBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_WEB_APP_URL) {
    return process.env.EXPO_PUBLIC_WEB_APP_URL.replace(/\/$/, '');
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/$/, '');
    if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return origin;
    }
  }

  return 'https://musiki.vercel.app';
}

function isMobileWebBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function getPostShareUrls(post: CommunityPostShareInput) {
  const webUrl = getCommunityPostWebUrl(post.id, getWebAppBaseUrl());
  const message = buildCommunityShareMessage(post, webUrl);
  const instagramCaption = buildInstagramCaption(post, webUrl);
  return { webUrl, message, instagramCaption };
}

export async function copyCommunityPostLink(post: CommunityPostShareInput): Promise<string> {
  const { webUrl } = getPostShareUrls(post);
  await Clipboard.setStringAsync(webUrl);
  return webUrl;
}

export async function copyCommunityShareCaption(
  post: CommunityPostShareInput,
  variant: 'default' | 'instagram' = 'default',
): Promise<string> {
  const { message, instagramCaption } = getPostShareUrls(post);
  const text = variant === 'instagram' ? instagramCaption : message;
  await Clipboard.setStringAsync(text);
  return text;
}

export async function shareViaNativeSheet(post: CommunityPostShareInput): Promise<void> {
  const { webUrl, message } = getPostShareUrls(post);

  if (Platform.OS === 'web') {
    await Clipboard.setStringAsync(message);

    // Desktop Windows/macOS Web Share API shows the OS "Share link" popup — avoid on desktop.
    if (isMobileWebBrowser() && typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Musiki', text: message, url: webUrl });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard message.
      }
    }

    window.alert(
      'Share text copied to clipboard.\n\n' +
        'On desktop, use the social icons in the Musiki share sheet:\n' +
        '• Facebook — link share\n' +
        '• FB Pages — post to your Pages\n' +
        '• Instagram — download + caption',
    );
    return;
  }

  await Share.share(
    Platform.OS === 'ios'
      ? { message, url: webUrl }
      : { message, title: 'Musiki' },
  );
}

export async function shareFacebookLink(post: CommunityPostShareInput): Promise<void> {
  const { webUrl } = getPostShareUrls(post);
  const sharerUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(webUrl)}`;

  if (Platform.OS === 'web') {
    try {
      const healthCheck = await fetch(webUrl, { method: 'HEAD' });
      if (!healthCheck.ok) {
        Alert.alert(
          'Share link not live yet',
          `Facebook cannot preview this link because ${webUrl} returned ${healthCheck.status}.\n\n` +
            'Deploy the latest code to Vercel (apps/mobile) and set FIREBASE_SERVICE_ACCOUNT on Vercel. ' +
            'The Facebook App ID does not fix link previews — the URL must exist on your server first.',
        );
      }
    } catch {
      Alert.alert(
        'Share link not reachable',
        `Could not reach ${webUrl}. Deploy to Vercel and set EXPO_PUBLIC_WEB_APP_URL in apps/mobile/.env, then restart Metro.`,
      );
    }

    window.open(sharerUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  const canOpen = await Linking.canOpenURL(sharerUrl);
  if (canOpen) {
    await Linking.openURL(sharerUrl);
    return;
  }

  await shareViaNativeSheet(post);
}

async function downloadMediaForShare(
  post: CommunityPostShareInput,
): Promise<string> {
  const extension = getShareMediaExtension(post.type, post.url);
  const localUri = `${FileSystem.cacheDirectory}musiki-share-${post.id}.${extension}`;
  const existing = await FileSystem.getInfoAsync(localUri);
  if (existing.exists && existing.size && existing.size > 0) {
    return localUri;
  }

  const download = await FileSystem.downloadAsync(post.url, localUri);
  if (!download.uri) {
    throw new Error('Could not download media for sharing.');
  }
  return download.uri;
}

export async function shareMediaToSocialApps(
  post: CommunityPostShareInput,
  captionVariant: 'default' | 'instagram' = 'default',
): Promise<void> {
  const { message, instagramCaption } = getPostShareUrls(post);
  const caption = captionVariant === 'instagram' ? instagramCaption : message;

  if (Platform.OS === 'web') {
    await Clipboard.setStringAsync(caption);
    const opened = window.open(post.url, '_blank', 'noopener,noreferrer');
    const platform = captionVariant === 'instagram' ? 'Instagram' : 'TikTok';
    window.alert(
      `${platform} on web:\n\n` +
        '1. Caption copied to clipboard.\n' +
        `2. Your ${post.type} opened in a new tab — download it.\n` +
        `3. Open ${platform} and upload the file manually.\n` +
        '4. Paste the caption before posting.\n\n' +
        'For one-tap sharing, use the Musiki mobile app on iOS or Android.',
    );
    if (!opened) {
      window.alert(`Could not open media. Download manually from:\n${post.url}`);
    }
    return;
  }

  const localUri = await downloadMediaForShare(post);

  await Share.share({
    message: caption,
    url: localUri,
  });
}

export function showYouTubeUploadInfo(post: CommunityPostShareInput): void {
  const { webUrl } = getPostShareUrls(post);
  Alert.alert(
    'Video required',
    'YouTube sharing is only available for video posts uploaded to Musiki.',
    [
      { text: 'OK', style: 'cancel' },
      {
        text: 'Copy Musiki link',
        onPress: () => {
          Clipboard.setStringAsync(webUrl).then(() => {
            Alert.alert('Copied', 'Musiki post link copied.');
          });
        },
      },
    ],
  );
}
