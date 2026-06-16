import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cacheDirectory,
  getInfoAsync,
  downloadAsync,
  uploadAsync,
  deleteAsync,
  FileSystemUploadType,
} from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { incrementShareAnalytics } from '@music-app/firebase';
import { getWebAppBaseUrl } from './communityShareActions';

const FB_TOKEN_KEY = 'fb_user_access_token';
const FB_PAGES_PREF_KEY = 'fb_pages_selection_pref';
const YT_TOKEN_KEY = 'youtube_access_token';
const YT_REFRESH_TOKEN_KEY = 'youtube_refresh_token';

export const FACEBOOK_PAGE_PERMISSIONS = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
] as const;

export interface FacebookPageAccount {
  id: string;
  name: string;
  access_token: string;
  tasks?: string[];
}

export interface FacebookPagePublishResult {
  pageId: string;
  pageName: string;
  success: boolean;
  error?: string;
}

export async function getSavedFacebookPagePreferences(): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(FB_PAGES_PREF_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveFacebookPagePreferences(pageIds: string[]): Promise<void> {
  await AsyncStorage.setItem(FB_PAGES_PREF_KEY, JSON.stringify(pageIds));
}

export async function clearFacebookPagePreferences(): Promise<void> {
  await AsyncStorage.removeItem(FB_PAGES_PREF_KEY);
}

function parseOAuthReturnCode(resultUrl: string): string {
  const parsed = Linking.parse(resultUrl);
  const rawCode = parsed.queryParams?.code;
  if (typeof rawCode === 'string') {
    return decodeURIComponent(rawCode);
  }
  if (Array.isArray(rawCode) && rawCode[0]) {
    return decodeURIComponent(rawCode[0]);
  }
  return '';
}

export async function getFacebookToken(): Promise<string | null> {
  return AsyncStorage.getItem(FB_TOKEN_KEY);
}

export async function saveFacebookToken(token: string): Promise<void> {
  await AsyncStorage.setItem(FB_TOKEN_KEY, token);
}

export async function clearFacebookToken(): Promise<void> {
  await AsyncStorage.removeItem(FB_TOKEN_KEY);
}

export async function getYouTubeToken(): Promise<string | null> {
  return AsyncStorage.getItem(YT_TOKEN_KEY);
}

export async function getYouTubeRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(YT_REFRESH_TOKEN_KEY);
}

export async function saveYouTubeTokens(token: string, refreshToken?: string): Promise<void> {
  await AsyncStorage.setItem(YT_TOKEN_KEY, token);
  if (refreshToken) {
    await AsyncStorage.setItem(YT_REFRESH_TOKEN_KEY, refreshToken);
  }
}

export async function clearYouTubeTokens(): Promise<void> {
  await AsyncStorage.removeItem(YT_TOKEN_KEY);
  await AsyncStorage.removeItem(YT_REFRESH_TOKEN_KEY);
}

/**
 * Exchanges a temporary code returned from the OAuth flow for user tokens
 */
export async function exchangeTempCode(code: string, type: 'facebook' | 'youtube'): Promise<any> {
  const baseUrl = getWebAppBaseUrl();
  const endpoint = type === 'facebook' ? '/api/facebook-token' : '/api/google-token';
  const normalizedCode = decodeURIComponent(code);
  const response = await fetch(
    `${baseUrl}${endpoint}?code=${encodeURIComponent(normalizedCode)}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to exchange oauth code: ${await response.text()}`);
  }
  return response.json();
}

/**
 * Securely refreshes Google/YouTube access token
 */
export async function refreshGoogleToken(): Promise<string> {
  const refreshToken = await getYouTubeRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  const baseUrl = getWebAppBaseUrl();
  const response = await fetch(`${baseUrl}/api/google-refresh?refresh_token=${refreshToken}`);
  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${await response.text()}`);
  }
  const data = await response.json();
  await saveYouTubeTokens(data.token);
  return data.token;
}

/**
 * Initiates Facebook Login flow using WebBrowser
 */
export async function loginWithFacebook(options?: { force?: boolean }): Promise<string> {
  const fbAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  const fbConfigId = process.env.EXPO_PUBLIC_FACEBOOK_CONFIG_ID;

  if (!fbAppId) {
    throw new Error(
      'Missing EXPO_PUBLIC_FACEBOOK_APP_ID in apps/mobile/.env. Add your Meta App ID and restart Metro (npx expo start -c).',
    );
  }

  if (!fbConfigId) {
    throw new Error(
      'Missing EXPO_PUBLIC_FACEBOOK_CONFIG_ID.\n\n' +
        'Facebook Login for Business requires a Configuration ID.\n' +
        'Meta Developer → Facebook Login for Business → Configurations → add:\n' +
        '• pages_show_list\n• pages_manage_posts\n• pages_read_engagement',
    );
  }

  if (options?.force) {
    await clearFacebookToken();
  }

  const redirectUrl = Linking.createURL('oauth');
  const baseUrl = getWebAppBaseUrl();
  const callbackUrl = `${baseUrl}/api/facebook-callback`;

  let authUrl = `https://www.facebook.com/v20.0/dialog/oauth` +
    `?client_id=${fbAppId}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&state=${encodeURIComponent(redirectUrl)}` +
    `&config_id=${encodeURIComponent(fbConfigId)}` +
    `&response_type=code`;

  if (options?.force) {
    authUrl += '&auth_type=reauthorize';
  }

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

  if (result.type === 'success' && result.url) {
    const code = parseOAuthReturnCode(result.url);
    if (code) {
      const data = await exchangeTempCode(code, 'facebook');
      if (data.token) {
        await saveFacebookToken(data.token);
        return data.token;
      }
    }
  }
  throw new Error('Facebook authentication failed or cancelled');
}

/**
 * Fetches Facebook Pages managed by the user (uses page access tokens from /me/accounts).
 */
export async function fetchFacebookPages(token: string): Promise<FacebookPageAccount[]> {
  const fields = encodeURIComponent('id,name,access_token,tasks');
  const response = await fetch(
    `https://graph.facebook.com/v20.0/me/accounts?fields=${fields}&limit=100&access_token=${encodeURIComponent(token)}`,
  );
  if (!response.ok) {
    if (response.status === 401) {
      await clearFacebookToken();
      throw new Error('Facebook session expired. Please log in again.');
    }
    throw new Error(`Failed to fetch pages: ${await response.text()}`);
  }
  const data = await response.json();
  return (data.data || []) as FacebookPageAccount[];
}

function parseFacebookApiError(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || raw;
  } catch {
    return raw;
  }
}

async function publishToSingleFacebookPage({
  page,
  caption,
  publishType,
  post,
  webUrl,
}: {
  page: FacebookPageAccount;
  caption: string;
  publishType: 'link' | 'media';
  post: any;
  webUrl: string;
}): Promise<void> {
  const isVideo = post.type === 'video';
  const isImage = post.type === 'image';

  let url = `https://graph.facebook.com/v20.0/${page.id}/feed`;
  const bodyParams: Record<string, string> = {
    access_token: page.access_token,
  };

  if (publishType === 'media' && (isVideo || isImage)) {
    if (isVideo) {
      url = `https://graph.facebook.com/v20.0/${page.id}/videos`;
      bodyParams.description = caption;
      bodyParams.file_url = post.url;
    } else {
      url = `https://graph.facebook.com/v20.0/${page.id}/photos`;
      bodyParams.caption = caption;
      bodyParams.url = post.url;
    }
  } else {
    bodyParams.message = caption;
    bodyParams.link = webUrl;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyParams),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(parseFacebookApiError(err));
  }
}

/**
 * Publishes to multiple Facebook Pages and returns per-page results (bulk publish).
 */
export async function publishToFacebookPages({
  pages,
  caption,
  publishType,
  post,
  onProgress,
}: {
  pages: FacebookPageAccount[];
  caption: string;
  publishType: 'link' | 'media';
  post: any;
  onProgress?: (result: FacebookPagePublishResult, index: number, total: number) => void;
}): Promise<FacebookPagePublishResult[]> {
  const webUrl = `${getWebAppBaseUrl()}/community/post/${post.id}`;
  const results: FacebookPagePublishResult[] = [];

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    try {
      await publishToSingleFacebookPage({
        page,
        caption,
        publishType,
        post,
        webUrl,
      });
      const result: FacebookPagePublishResult = {
        pageId: page.id,
        pageName: page.name,
        success: true,
      };
      results.push(result);
      onProgress?.(result, index, pages.length);
    } catch (error: any) {
      const result: FacebookPagePublishResult = {
        pageId: page.id,
        pageName: page.name,
        success: false,
        error: error?.message || 'Unknown error',
      };
      results.push(result);
      onProgress?.(result, index, pages.length);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  if (successCount > 0) {
    await incrementShareAnalytics(post.id, 'facebook');
  }

  return results;
}

export function isFacebookPermissionError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('pages_read_engagement') ||
    lower.includes('pages_manage_posts') ||
    lower.includes('permission') ||
    lower.includes('(#200)') ||
    lower.includes('(#283)')
  );
}

/**
 * Initiates YouTube/Google login
 */
export async function loginWithYouTube(): Promise<string> {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '283246978577-17tud74h1qk34mh14hu8ni29rfj9idbe.apps.googleusercontent.com';
  const redirectUrl = Linking.createURL('oauth');
  const baseUrl = getWebAppBaseUrl();
  const callbackUrl = `${baseUrl}/api/google-callback`;

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('https://www.googleapis.com/auth/youtube.upload')}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${encodeURIComponent(redirectUrl)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

  if (result.type === 'success' && result.url) {
    const code = parseOAuthReturnCode(result.url);
    if (code) {
      const data = await exchangeTempCode(code, 'youtube');
      if (data.token) {
        await saveYouTubeTokens(data.token, data.refreshToken);
        return data.token;
      }
    }
  }
  throw new Error('Google/YouTube authentication failed or cancelled');
}

/**
 * Uploads a video to YouTube using Resumable Upload
 */
export async function uploadVideoToYouTube({
  accessToken,
  title,
  description,
  privacy,
  post,
  onProgress,
}: {
  accessToken: string;
  title: string;
  description: string;
  privacy: 'public' | 'unlisted' | 'private';
  post: any;
  onProgress: (percent: number) => void;
}): Promise<void> {
  let activeToken = accessToken;

  // Helper to run authorization check and fetch initial session
  const initializeSession = async (token: string): Promise<string> => {
    const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/*',
      },
      body: JSON.stringify({
        snippet: {
          title: title,
          description: description,
          categoryId: '10', // Music
        },
        status: {
          privacyStatus: privacy,
        }
      })
    });

    if (initRes.status === 401) {
      // Try refresh and re-run once
      activeToken = await refreshGoogleToken();
      return initializeSession(activeToken);
    }

    if (!initRes.ok) {
      throw new Error(`YouTube initialization failed: ${await initRes.text()}`);
    }

    const sessionUrl = initRes.headers.get('Location');
    if (!sessionUrl) {
      throw new Error('YouTube did not return an upload session URL in Location header');
    }
    return sessionUrl;
  };

  const sessionUrl = await initializeSession(activeToken);

  // Download video file to local cache if it is a remote url
  let localUri = post.url;
  let isDownloaded = false;

  if (post.url.startsWith('http')) {
    const extension = post.url.split('.').pop() || 'mp4';
    localUri = `${cacheDirectory}musiki-upload-${post.id}.${extension}`;
    const fileCheck = await getInfoAsync(localUri);
    if (!fileCheck.exists || !fileCheck.size) {
      onProgress(0); // indicates download starting
      const downloadResult = await downloadAsync(post.url, localUri);
      if (!downloadResult.uri) {
        throw new Error('Could not download remote video for upload');
      }
      localUri = downloadResult.uri;
    }
    isDownloaded = true;
  }

  try {
    // Perform binary content PUT request
    const uploadResult = await uploadAsync(sessionUrl, localUri, {
      headers: {
        'Authorization': `Bearer ${activeToken}`,
      },
      httpMethod: 'PUT',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
    });

    if (uploadResult.status !== 200 && uploadResult.status !== 201) {
      throw new Error(`YouTube upload failed: ${uploadResult.body}`);
    }

    // Increment Share Metrics
    await incrementShareAnalytics(post.id, 'youtube');
  } finally {
    // Clean up cached video download to save storage space
    if (isDownloaded) {
      try {
        await deleteAsync(localUri, { idempotent: true });
      } catch (e) {
        console.warn('Could not clean up temporary upload file:', e);
      }
    }
  }
}
