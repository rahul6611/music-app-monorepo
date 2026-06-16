import { VercelRequest, VercelResponse } from '@vercel/node';
import { readOAuthTempCode } from './oauthTempCode';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const clientSecret = process.env.FACEBOOK_APP_SECRET;
  if (!clientSecret) {
    return res.status(500).json({
      error: 'Server misconfigured: set FACEBOOK_APP_SECRET in Vercel environment variables.',
    });
  }

  const exchangeData = readOAuthTempCode(tempCode, clientSecret);
  if (!exchangeData?.token) {
    return res.status(404).json({
      error: 'OAuth exchange code not found or expired. Please try connecting Facebook again.',
    });
  }

  return res.status(200).json({
    token: exchangeData.token,
    type: exchangeData.type || 'facebook',
    refreshToken: exchangeData.refreshToken || '',
  });
}
