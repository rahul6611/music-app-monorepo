import { VercelRequest, VercelResponse } from '@vercel/node';
import {
  buildCommunityOgDescription,
  getCommunityPostDisplayTitle,
} from '@music-app/utils';

type PreviewPost = {
  url: string;
  type: string;
  fileName: string;
  title: string;
  notes: string;
};

async function fetchPost(postId: string): Promise<PreviewPost | null> {
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/media/${postId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.fields) return null;
    return {
      url: data.fields?.url?.stringValue || '',
      type: data.fields?.type?.stringValue || '',
      fileName: data.fields?.fileName?.stringValue || '',
      title: data.fields?.title?.stringValue || '',
      notes: data.fields?.notes?.stringValue || '',
    };
  } catch {
    return null;
  }
}

export function buildFacebookPageComposerUrl(webUrl: string, title?: string, description?: string): string {
  const assetId =
    process.env.EXPO_PUBLIC_FACEBOOK_PAGE_ASSET_ID || process.env.FACEBOOK_PAGE_ASSET_ID;
  const businessId =
    process.env.EXPO_PUBLIC_FACEBOOK_BUSINESS_ID || process.env.FACEBOOK_BUSINESS_ID;

  const params = new URLSearchParams();
  if (assetId) params.set('asset_id', assetId);
  if (businessId) params.set('business_id', businessId);
  params.set('link', webUrl);
  params.set('url', webUrl);
  params.set('link_url', webUrl);
  if (title) params.set('title', title);
  if (description) params.set('description', description);

  return `https://business.facebook.com/latest/composer?${params.toString()}`;
}

export async function handleFacebookPageComposer(req: VercelRequest, res: VercelResponse) {
  const postId = Array.isArray(req.query.postId) ? req.query.postId[0] : req.query.postId;

  if (!postId) {
    return res.status(400).send('Missing postId');
  }

  const host = req.headers.host || 'musiki.vercel.app';
  const webUrl = `https://${host}/community/post/${postId}`;

  const post = await fetchPost(postId);
  const shareInput = post
    ? {
        id: postId,
        type: post.type,
        title: post.title,
        fileName: post.fileName,
        url: post.url,
        notes: post.notes,
      }
    : null;

  const title = shareInput ? getCommunityPostDisplayTitle(shareInput) : 'Musiki Community Post';
  const description = shareInput
    ? buildCommunityOgDescription(shareInput)
    : 'Watch this performance on Musiki.';

  const composerUrl = buildFacebookPageComposerUrl(webUrl, title, description);
  return res.redirect(302, composerUrl);
}
