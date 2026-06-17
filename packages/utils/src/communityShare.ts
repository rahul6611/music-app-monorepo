export type CommunityPostType =
  | 'video'
  | 'image'
  | 'audio'
  | 'pdf'
  | 'youtube'
  | 'facebook'
  | 'instagram'
  | 'tiktok';

export interface CommunityPostShareInput {
  id: string;
  type: CommunityPostType | string;
  title?: string;
  fileName?: string;
  url: string;
  notes?: string;
}

export const DEFAULT_MUSIKI_WEB_BASE = 'https://musiki.app';

export function getCommunityPostWebUrl(
  postId: string,
  baseUrl: string = DEFAULT_MUSIKI_WEB_BASE,
): string {
  const base = baseUrl.replace(/\/$/, '');
  return `${base}/community/post/${postId}`;
}

export function getCommunityPostDeepLink(postId: string): string {
  return `musiki://community/post/${postId}`;
}

export function getCommunityPostDisplayTitle(post: CommunityPostShareInput): string {
  const raw = post.title || post.fileName || 'Untitled Post';
  return raw.replace(/\.(mp4|mov|webm|m4v|jpg|jpeg|png|webp|pdf|mp3|wav)$/i, '');
}

export function buildCommunityOgDescription(post: CommunityPostShareInput): string {
  const title = getCommunityPostDisplayTitle(post);
  const note = post.notes?.trim();
  if (note) {
    return `${note} — Watch "${title}" on Musiki.`;
  }
  return `Watch "${title}" on Musiki — tap to play the full video.`;
}

export function buildCommunityShareMessage(
  post: CommunityPostShareInput,
  webUrl?: string,
): string {
  const title = getCommunityPostDisplayTitle(post);
  const url = webUrl ?? getCommunityPostWebUrl(post.id);
  const note = post.notes?.trim();
  const lines = [`Check out "${title}" on Musiki 🎵`, url];
  if (note) {
    lines.splice(1, 0, note);
  }
  return lines.join('\n');
}

export function buildInstagramCaption(post: CommunityPostShareInput, webUrl?: string): string {
  const title = getCommunityPostDisplayTitle(post);
  const url = webUrl ?? getCommunityPostWebUrl(post.id);
  return `${title}\n\nWatch on Musiki:\n${url}`;
}

export function isSocialEmbedPost(type: string): boolean {
  return ['youtube', 'facebook', 'instagram', 'tiktok'].includes(type);
}

export function canShareMediaToInstagram(type: string): boolean {
  return type === 'video' || type === 'image';
}

export function canShareMediaToTikTok(type: string): boolean {
  return type === 'video';
}

export function canShareMediaToYouTube(type: string): boolean {
  return type === 'video';
}

export function canShareLinkOnFacebook(_type: string): boolean {
  return true;
}

export function getShareMediaExtension(type: string, mediaUrl: string): string {
  if (type === 'video' || mediaUrl.includes('.mp4') || mediaUrl.includes('/video/')) {
    return 'mp4';
  }
  if (mediaUrl.includes('.png')) return 'png';
  if (mediaUrl.includes('.webp')) return 'webp';
  return 'jpg';
}
