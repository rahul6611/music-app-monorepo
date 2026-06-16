import { VercelRequest, VercelResponse } from '@vercel/node';
import * as firebaseAdmin from 'firebase-admin';

const admin = firebaseAdmin as any;

async function retrieveAndClearToken(tempCode: string) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
          databaseURL: `https://${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
        });
      }
      const docRef = admin.firestore().collection('oauth_exchanges').doc(tempCode);
      const doc = await docRef.get();
      if (doc.exists) {
        const data = doc.data();
        await docRef.delete();
        return data;
      }
      return null;
    } catch (err) {
      console.warn('Firebase Admin SDK error, falling back to REST:', err);
    }
  }

  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'testfirebasepbapp';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/oauth_exchanges/${tempCode}`;

  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      await fetch(url, { method: 'DELETE' });
      return {
        token: data.fields?.token?.stringValue || '',
        type: data.fields?.type?.stringValue || '',
        refreshToken: data.fields?.refreshToken?.stringValue || '',
      };
    }
  } catch (err) {
    console.error('REST API token retrieval error:', err);
  }
  return null;
}

export async function handleGoogleToken(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { code } = req.query;
  const tempCode = Array.isArray(code) ? code[0] : code;

  if (!tempCode) {
    return res.status(400).json({ error: 'Missing temporary code' });
  }

  const exchangeData = await retrieveAndClearToken(tempCode);
  if (!exchangeData) {
    return res.status(404).json({ error: 'OAuth exchange code not found or expired' });
  }

  return res.status(200).json(exchangeData);
}
