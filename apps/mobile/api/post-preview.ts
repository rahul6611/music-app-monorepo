import { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import * as firebaseAdmin from 'firebase-admin';

const admin = firebaseAdmin as any;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCloudinaryThumbnail(mediaUrl: string): string {
  if (!mediaUrl.includes('res.cloudinary.com')) {
    return mediaUrl;
  }

  if (mediaUrl.includes('/video/upload/')) {
    return mediaUrl.replace('/video/upload/', '/video/upload/so_0/').replace(/\.[^/.]+$/, '.jpg');
  }

  return mediaUrl;
}

async function fetchPost(postId: string) {
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
        return doc.data();
      }
      return null;
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
      const data = await res.json();
      return {
        url: data.fields?.url?.stringValue || '',
        type: data.fields?.type?.stringValue || '',
        fileName: data.fields?.fileName?.stringValue || '',
        title: data.fields?.title?.stringValue || '',
      };
    }
  } catch (err) {
    console.error('REST API fallback error:', err);
  }
  return null;
}

function buildFallbackHtml(): string {
  const indexPath = path.join(process.cwd(), 'dist', 'index.html');
  try {
    return fs.readFileSync(indexPath, 'utf8');
  } catch {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Musiki</title>
</head>
<body>
  <p>Open this post in the Musiki app.</p>
</body>
</html>`;
  }
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

  const title = escapeHtml(post?.title || post?.fileName || 'Musiki Community Post');
  const description = escapeHtml(
    post
      ? 'Watch and listen to this performance on Musiki.'
      : 'Open this community post in Musiki.',
  );
  const mediaUrl = post?.url || '';
  const isVideo = post?.type === 'video';
  const imageUrl = escapeHtml(
    isVideo && mediaUrl ? getCloudinaryThumbnail(mediaUrl) : mediaUrl || `https://${host}/favicon.ico`,
  );

  let html = buildFallbackHtml();

  const metaTags = `
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:site_name" content="Musiki" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${escapeHtml(postUrl)}" />
  <meta property="og:type" content="${isVideo ? 'video.other' : 'website'}" />
  ${isVideo && mediaUrl ? `<meta property="og:video" content="${escapeHtml(mediaUrl)}" />
  <meta property="og:video:type" content="video/mp4" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <meta http-equiv="refresh" content="0;url=/?postId=${escapeHtml(postId)}" />
  `;

  html = html.includes('</head>')
    ? html.replace('</head>', `${metaTags}</head>`)
    : `<!DOCTYPE html><html><head>${metaTags}</head><body><p>Redirecting to Musiki…</p></body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res.status(200).send(html);
}
