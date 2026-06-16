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
const YT_TOKEN_KEY = 'youtube_access_token';
const YT_REFRESH_TOKEN_KEY = 'youtube_refresh_token';

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
  const response = await fetch(`${baseUrl}${endpoint}?code=${code}`);
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
export async function loginWithFacebook(): Promise<string> {
  const fbAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  if (!fbAppId) {
    throw new Error(
      'Missing EXPO_PUBLIC_FACEBOOK_APP_ID in apps/mobile/.env. Add your Meta App ID and restart Metro (npx expo start -c).',
    );
  }

  const redirectUrl = Linking.createURL('oauth');
  const baseUrl = getWebAppBaseUrl();
  const callbackUrl = `${baseUrl}/api/facebook-callback`;

  const authUrl = `https://www.facebook.com/v20.0/dialog/oauth` +
    `?client_id=${fbAppId}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&state=${encodeURIComponent(redirectUrl)}` +
    `&scope=pages_manage_posts,pages_read_engagement,pages_show_list` +
    `&response_type=code`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

  if (result.type === 'success' && result.url) {
    const parsed = Linking.parse(result.url);
    const code = parsed.queryParams?.code as string;
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
 * Fetches Facebook Pages managed by the user
 */
export async function fetchFacebookPages(token: string): Promise<any[]> {
  const response = await fetch(`https://graph.facebook.com/v20.0/me/accounts?access_token=${token}`);
  if (!response.ok) {
    if (response.status === 401) {
      await clearFacebookToken();
      throw new Error('Facebook session expired. Please log in again.');
    }
    throw new Error(`Failed to fetch pages: ${await response.text()}`);
  }
  const data = await response.json();
  return data.data || [];
}

/**
 * Publishes a post to multiple selected Facebook Pages
 */
export async function publishToFacebookPages({
  pages,
  caption,
  publishType,
  post,
}: {
  pages: Array<{ id: string; access_token: string; name: string }>;
  caption: string;
  publishType: 'link' | 'media';
  post: any;
}): Promise<void> {
  const webUrl = `${getWebAppBaseUrl()}/community/post/${post.id}`;
  
  const promises = pages.map(async (page) => {
    let url = `https://graph.facebook.com/v20.0/${page.id}/feed`;
    let bodyParams: Record<string, string> = {
      access_token: page.access_token,
    };

    const isVideo = post.type === 'video';
    const isImage = post.type === 'image';

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
      // Default: Link Share
      bodyParams.message = caption;
      bodyParams.link = webUrl;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyParams),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to post to page "${page.name}": ${err}`);
    }
  });

  await Promise.all(promises);
  
  // Track Share Analytics in Firestore
  await incrementShareAnalytics(post.id, 'facebook');
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
    const parsed = Linking.parse(result.url);
    const code = parsed.queryParams?.code as string;
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
