import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import * as firebaseAdmin from 'firebase-admin';

const admin = firebaseAdmin as any;

async function saveOAuthExchange(tempCode: string, tokenData: any) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
          databaseURL: `https://${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`
        });
      }
      await admin.firestore().collection('oauth_exchanges').doc(tempCode).set({
        ...tokenData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    } catch (err) {
      console.warn('Firebase Admin SDK error, falling back to REST:', err);
    }
  }

  // Fallback REST
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'testfirebasepbapp';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/oauth_exchanges/${tempCode}`;
  
  const fields: any = {};
  for (const key of Object.keys(tokenData)) {
    fields[key] = { stringValue: tokenData[key] };
  }
  fields.createdAt = { stringValue: new Date().toISOString() };

  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(500).send(`OAuth error: ${error}`);
  }

  const authCode = Array.isArray(code) ? code[0] : code;
  const redirectScheme = Array.isArray(state) ? state[0] : state; // e.g. "exp://localhost:8081" or "musiki://"

  if (!authCode) {
    return res.status(400).send('Missing authorization code');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl = `https://${req.headers.host}/api/google-callback`;

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: authCode,
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).send(`Failed to exchange Google code: ${errorText}`);
    }

    const data = await response.json();
    const accessToken = data.access_token;
    const refreshToken = data.refresh_token || '';

    const tempCode = crypto.randomBytes(16).toString('hex');

    await saveOAuthExchange(tempCode, {
      token: accessToken,
      refreshToken: refreshToken,
      type: 'youtube',
    });

    const appRedirectUrl = `${redirectScheme}${redirectScheme.includes('?') ? '&' : '?'}code=${tempCode}&type=youtube`;
    return res.redirect(appRedirectUrl);
  } catch (error: any) {
    console.error('Google OAuth Error:', error);
    return res.status(500).send(`OAuth processing error: ${error.message}`);
  }
}
