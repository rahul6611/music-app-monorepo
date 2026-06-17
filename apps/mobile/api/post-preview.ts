import { VercelRequest, VercelResponse } from '@vercel/node';
import * as firebaseAdmin from 'firebase-admin';
import {
  buildCommunityOgDescription,
  getCloudinaryOgImageUrl,
  getCloudinaryVideoUrl,
  getCommunityPostDisplayTitle,
} from '@music-app/utils';

const admin = firebaseAdmin as any;

type PreviewPost = {
  url: string;
  type: string;
  fileName: string;
  title: string;
  notes: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseFirestoreDocument(data: any): PreviewPost | null {
  if (!data?.fields) return null;
  return {
    url: data.fields?.url?.stringValue || '',
    type: data.fields?.type?.stringValue || '',
    fileName: data.fields?.fileName?.stringValue || '',
    title: data.fields?.title?.stringValue || '',
    notes: data.fields?.notes?.stringValue || '',
  };
}

async function fetchPost(postId: string): Promise<PreviewPost | null> {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
          databaseURL: `https://${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
        });
      }
      const doc = await admin.firestore().collection('media').doc(postId).get();
      if (doc.exists) {
        const data = doc.data();
        return {
          url: data?.url || '',
          type: data?.type || '',
          fileName: data?.fileName || '',
          title: data?.title || '',
          notes: data?.notes || '',
        };
      }
    } catch (err) {
      console.warn('Firebase Admin SDK error, falling back to REST API:', err);
    }
  }

  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return null;
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/media/${postId}`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      return parseFirestoreDocument(await res.json());
    }
  } catch (err) {
    console.error('REST API fallback error:', err);
  }
  return null;
}

function buildPreviewHtml({
  postId,
  post,
  postUrl,
  host,
}: {
  postId: string;
  post: PreviewPost | null;
  postUrl: string;
  host: string;
}): string {
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

  const title = escapeHtml(
    shareInput ? getCommunityPostDisplayTitle(shareInput) : 'Musiki Community Post',
  );
  const description = escapeHtml(
    shareInput
      ? buildCommunityOgDescription(shareInput)
      : 'Open this community post in Musiki.',
  );

  const mediaUrl = post?.url || '';
  const isVideo = post?.type === 'video';
  const isImage = post?.type === 'image';
  const imageUrl = escapeHtml(
    mediaUrl
      ? getCloudinaryOgImageUrl(mediaUrl, isVideo)
      : `https://${host}/favicon.ico`,
  );
  const videoUrl = isVideo && mediaUrl ? escapeHtml(getCloudinaryVideoUrl(mediaUrl)) : '';
  const appUrl = `/community?postId=${encodeURIComponent(postId)}`;

  const mediaBlock = isVideo && videoUrl
    ? `<video controls playsinline poster="${imageUrl}" src="${videoUrl}" style="width:100%;max-width:720px;border-radius:16px;background:#000"></video>`
    : isImage && mediaUrl
      ? `<img src="${escapeHtml(mediaUrl)}" alt="${title}" style="width:100%;max-width:720px;border-radius:16px" />`
      : `<img src="${imageUrl}" alt="${title}" style="width:100%;max-width:720px;border-radius:16px" />`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} · Musiki</title>
  <meta name="description" content="${description}" />
  <meta property="og:site_name" content="Musiki" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${escapeHtml(postUrl)}" />
  <meta property="og:type" content="${isVideo ? 'video.other' : 'website'}" />
  ${videoUrl ? `<meta property="og:video" content="${videoUrl}" />
  <meta property="og:video:secure_url" content="${videoUrl}" />
  <meta property="og:video:type" content="video/mp4" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #0f172a; color: #f8fafc; }
    main { max-width: 760px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { font-size: 28px; margin: 0 0 12px; }
    p { color: #cbd5e1; line-height: 1.6; }
    .cta { display: inline-block; margin-top: 20px; padding: 12px 18px; border-radius: 12px; background: #7c3aed; color: #fff; text-decoration: none; font-weight: 700; }
    .media { margin: 24px 0; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${description}</p>
    <div class="media">${mediaBlock}</div>
    <p>Shared from Musiki Community.</p>
    <a class="cta" href="${appUrl}">Open in Musiki</a>
  </main>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const postId = Array.isArray(id) ? id[0] : id;

  if (!postId) {
    return res.status(400).send('Missing post ID');
  }

  const post = await fetchPost(postId);
  const host = req.headers.host || 'musiki.vercel.app';
  const postUrl = `https://${host}/community/post/${postId}`;
  const html = buildPreviewHtml({ postId, post, postUrl, host });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return res.status(200).send(html);
}
