import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { refresh_token } = req.query;
  const refreshToken = Array.isArray(refresh_token) ? refresh_token[0] : refresh_token;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing refresh token' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId || '',
        client_secret: clientSecret || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: `Failed to refresh Google token: ${errorText}` });
    }

    const data = await response.json();
    return res.status(200).json({
      token: data.access_token,
      expiresIn: data.expires_in,
    });
  } catch (error: any) {
    console.error('Google token refresh error:', error);
    return res.status(500).json({ error: `Refresh error: ${error.message}` });
  }
}
