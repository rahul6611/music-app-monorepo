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

  const clientId = process.env.FACEBOOK_APP_ID || process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  const clientSecret = process.env.FACEBOOK_APP_SECRET;
  const callbackUrl = `https://${req.headers.host}/api/facebook-callback`;

  if (!clientId || !clientSecret) {
    return res.status(500).send(
      'Server misconfigured: set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in Vercel environment variables.',
    );
  }

  try {
    // 1. Exchange auth code for short-lived access token
    const tokenExchangeUrl = `https://graph.facebook.com/v20.0/oauth/access_token` +
      `?client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
      `&client_secret=${clientSecret}` +
      `&code=${authCode}`;

    const tokenRes = await fetch(tokenExchangeUrl);
    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      return res.status(500).send(`Failed to exchange Facebook code: ${errorText}`);
    }

    const tokenData = await tokenRes.json();
    const shortLivedToken = tokenData.access_token;

    // 2. Exchange short-lived token for long-lived token
    const longLivedUrl = `https://graph.facebook.com/v20.0/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${clientId}` +
      `&client_secret=${clientSecret}` +
      `&fb_exchange_token=${shortLivedToken}`;

    const longLivedRes = await fetch(longLivedUrl);
    if (!longLivedRes.ok) {
      const errorText = await longLivedRes.text();
      return res.status(500).send(`Failed to get long-lived Facebook token: ${errorText}`);
    }

    const longLivedData = await longLivedRes.json();
    const longLivedToken = longLivedData.access_token;

    // 3. Generate a secure random code
    const tempCode = crypto.randomBytes(16).toString('hex');

    // 4. Save long-lived token securely in Firestore
    await saveOAuthExchange(tempCode, {
      token: longLivedToken,
      type: 'facebook',
    });

    // 5. Redirect back to mobile app using the redirect scheme passed in state
    const appRedirectUrl = `${redirectScheme}${redirectScheme.includes('?') ? '&' : '?'}code=${tempCode}&type=facebook`;
    return res.redirect(appRedirectUrl);
  } catch (error: any) {
    console.error('Facebook OAuth Error:', error);
    return res.status(500).send(`OAuth processing error: ${error.message}`);
  }
}
