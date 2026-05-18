export type SocialVideoType = 'youtube' | 'facebook' | 'instagram' | 'tiktok';

export interface ParsedSocialVideo {
  type: SocialVideoType;
  url: string;
  id?: string;
  embedUrl: string;
  thumbnailUrl?: string;
}

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\n?#]+)/i,
  /youtube\.com\/.*[?&]v=([^&\n?#]+)/i,
];

const INSTAGRAM_PATTERN = /instagram\.com\/(reel|p|tv)\/([A-Za-z0-9_-]+)/i;
const TIKTOK_PATTERN = /(?:tiktok\.com\/@[^/]+\/video\/|vm\.tiktok\.com\/|vt\.tiktok\.com\/|tiktok\.com\/t\/)([^/?#&]+)/i;
const FACEBOOK_VIDEO_PATTERN = /facebook\.com\/.*(?:videos|reel|share\/r)\/([^/?&#]+)/i;
const FACEBOOK_WATCH_PATTERN = /fb\.watch\/([^/?&#]+)/i;

export const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1] && match[1].length === 11) {
      return match[1];
    }
  }
  return null;
};

export const parseSocialVideo = (
  inputUrl: string,
  expectedType?: SocialVideoType,
): ParsedSocialVideo | null => {
  const url = inputUrl.trim();
  if (!url) return null;

  const ytId = extractYouTubeId(url);
  if (ytId) {
    if (expectedType && expectedType !== 'youtube') return null;
    return {
      type: 'youtube',
      id: ytId,
      url,
      embedUrl: `https://www.youtube.com/embed/${ytId}`,
      thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
    };
  }

  const igMatch = url.match(INSTAGRAM_PATTERN);
  if (igMatch?.[2]) {
    if (expectedType && expectedType !== 'instagram') return null;
    const kind = igMatch[1].toLowerCase();
    const shortcode = igMatch[2];
    return {
      type: 'instagram',
      id: shortcode,
      url,
      embedUrl: `https://www.instagram.com/${kind}/${shortcode}/embed/`,
    };
  }

  const tiktokMatch = url.match(TIKTOK_PATTERN);
  if (tiktokMatch?.[1]) {
    if (expectedType && expectedType !== 'tiktok') return null;
    const videoId = tiktokMatch[1];
    return {
      type: 'tiktok',
      id: videoId,
      url,
      embedUrl: `https://www.tiktok.com/embed/v2/${videoId}`,
    };
  }

  const fbVideoMatch = url.match(FACEBOOK_VIDEO_PATTERN);
  const fbWatchMatch = url.match(FACEBOOK_WATCH_PATTERN);
  if (fbVideoMatch?.[1] || fbWatchMatch?.[1] || /facebook\.com/i.test(url)) {
    if (expectedType && expectedType !== 'facebook') return null;
    return {
      type: 'facebook',
      id: fbVideoMatch?.[1] || fbWatchMatch?.[1],
      url,
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`,
    };
  }

  return null;
};

export const getSocialTypeLabel = (type: SocialVideoType): string => {
  switch (type) {
    case 'youtube':
      return 'YouTube';
    case 'facebook':
      return 'Facebook';
    case 'instagram':
      return 'Instagram';
    case 'tiktok':
      return 'TikTok';
    default:
      return type;
  }
};
