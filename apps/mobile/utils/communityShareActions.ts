import { Alert, Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import {
  buildCommunityOgDescription,
  buildCommunityShareMessage,
  buildInstagramCaption,
  CommunityPostShareInput,
  getCommunityPostDisplayTitle,
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

function showWebNotice(message: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message);
    return;
  }
  Alert.alert('Musiki', message);
}

export async function copyTextForShareWeb(text: string): Promise<void> {
  return copyTextForShare(text);
}

async function copyTextForShare(text: string): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // Fall through to legacy copy.
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return;
  }

  await Clipboard.setStringAsync(text);
}

export async function downloadMediaOnWeb(post: CommunityPostShareInput): Promise<void> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    throw new Error('Web download is only available in the browser.');
  }

  const extension = getShareMediaExtension(post.type, post.url);
  const filename = post.fileName || `musiki-${post.id}.${extension}`;

  try {
    const response = await fetch(post.url);
    if (!response.ok) {
      throw new Error(`Could not download media (${response.status}).`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
    return;
  } catch {
    const anchor = document.createElement('a');
    anchor.href = post.url;
    anchor.download = filename;
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }
}

export function openPlatformInNewTab(url: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  Linking.openURL(url);
}


async function openExternalUrl(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    openPlatformInNewTab(url);
    return;
  }

  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
    return;
  }

  throw new Error('Could not open Facebook.');
}

async function warnIfShareLinkUnreachable(webUrl: string): Promise<void> {
  if (Platform.OS !== 'web') return;

  try {
    const healthCheck = await fetch(webUrl, { method: 'GET', redirect: 'follow' });
    if (!healthCheck.ok) {
      Alert.alert(
        'Share link not live yet',
        `Facebook cannot preview this link because ${webUrl} returned ${healthCheck.status}.\n\n` +
          'Deploy the latest code to Vercel and publish updated Firebase rules so Musiki can read shared posts.',
      );
    }
  } catch {
    Alert.alert(
      'Share link not reachable',
      `Could not reach ${webUrl}. Deploy to Vercel and set EXPO_PUBLIC_WEB_APP_URL in apps/mobile/.env, then restart Metro.`,
    );
  }
}

export function buildFacebookProfileShareUrl(webUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(webUrl)}`;
}

export function buildFacebookPageShareUrl(postId: string): string {
  const baseUrl = getWebAppBaseUrl();
  return `${baseUrl}/api/facebook-page-composer?postId=${encodeURIComponent(postId)}`;
}

function buildLocalFacebookPageComposerUrl(post: CommunityPostShareInput, webUrl: string): string | null {
  const assetId = process.env.EXPO_PUBLIC_FACEBOOK_PAGE_ASSET_ID;
  const businessId = process.env.EXPO_PUBLIC_FACEBOOK_BUSINESS_ID;
  if (!assetId || !businessId) return null;

  const params = new URLSearchParams({
    asset_id: assetId,
    business_id: businessId,
    link: webUrl,
    url: webUrl,
    link_url: webUrl,
    title: getCommunityPostDisplayTitle(post),
    description: buildCommunityOgDescription(post),
  });

  return `https://business.facebook.com/latest/composer?${params.toString()}`;
}

export function getPostShareUrls(post: CommunityPostShareInput) {
  const webUrl = getCommunityPostWebUrl(post.id, getWebAppBaseUrl());
  const message = buildCommunityShareMessage(post, webUrl);
  const instagramCaption = buildInstagramCaption(post, webUrl);
  return { webUrl, message, instagramCaption };
}

export async function copyCommunityPostLink(post: CommunityPostShareInput): Promise<string> {
  const { webUrl } = getPostShareUrls(post);
  await copyTextForShare(webUrl);
  return webUrl;
}

export async function copyCommunityShareCaption(
  post: CommunityPostShareInput,
  variant: 'default' | 'instagram' = 'default',
): Promise<string> {
  const { message, instagramCaption } = getPostShareUrls(post);
  const text = variant === 'instagram' ? instagramCaption : message;
  await copyTextForShare(text);
  return text;
}

export async function shareViaNativeSheet(post: CommunityPostShareInput): Promise<void> {
  const { webUrl, message } = getPostShareUrls(post);

  if (Platform.OS === 'web') {
    await copyTextForShare(message);

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Musiki', text: message, url: webUrl });
        return;
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
      }
    }

    showWebNotice(
      'Share text copied to clipboard.\n\nPaste it into WhatsApp, email, Messages, or any other app.',
    );
    return;
  }

  await Share.share(
    Platform.OS === 'ios'
      ? { message, url: webUrl }
      : { message, title: 'Musiki' },
  );
}

export async function shareToInstagramWeb(post: CommunityPostShareInput): Promise<void> {
  const { instagramCaption } = getPostShareUrls(post);
  await copyTextForShare(instagramCaption);
  await downloadMediaOnWeb(post);
  openPlatformInNewTab('https://www.instagram.com/');
}

export async function shareToTikTokWeb(post: CommunityPostShareInput): Promise<void> {
  const { message } = getPostShareUrls(post);
  await copyTextForShare(message);
  await downloadMediaOnWeb(post);
  openPlatformInNewTab('https://www.tiktok.com/upload');
}

export async function shareToYouTubeWeb(post: CommunityPostShareInput): Promise<void> {
  const title = getCommunityPostDisplayTitle(post);
  const description = `${post.notes?.trim() ? `${post.notes.trim()}\n\n` : ''}Watch on Musiki:\n${getPostShareUrls(post).webUrl}`;
  await copyTextForShare(`Title: ${title}\n\nDescription:\n${description}`);
  await downloadMediaOnWeb(post);
  openPlatformInNewTab('https://studio.youtube.com/');
}

/** Opens Facebook sharer for personal profile/timeline. */
export async function shareFacebookLinkToProfile(post: CommunityPostShareInput): Promise<void> {
  const { webUrl } = getPostShareUrls(post);
  await warnIfShareLinkUnreachable(webUrl);
  await openExternalUrl(buildFacebookProfileShareUrl(webUrl));
}

/** Opens Meta Business Suite composer with Musiki link + preview metadata. */
export async function shareFacebookLinkToPage(post: CommunityPostShareInput): Promise<void> {
  const { webUrl } = getPostShareUrls(post);
  await warnIfShareLinkUnreachable(webUrl);

  const composerUrl =
    buildLocalFacebookPageComposerUrl(post, webUrl) || buildFacebookPageShareUrl(post.id);

  await openExternalUrl(composerUrl);
}

export async function shareFacebookLink(post: CommunityPostShareInput): Promise<void> {
  await shareFacebookLinkToProfile(post);
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
  if (Platform.OS === 'web') {
    if (captionVariant === 'instagram') {
      await shareToInstagramWeb(post);
      return;
    }
    await shareToTikTokWeb(post);
    return;
  }

  const { message, instagramCaption } = getPostShareUrls(post);
  const caption = captionVariant === 'instagram' ? instagramCaption : message;
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
