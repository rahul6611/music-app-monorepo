import { VercelRequest, VercelResponse } from '@vercel/node';
import { createOAuthTempCode } from './oauthTempCode';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(500).send(`OAuth error: ${error}`);
  }

  const authCode = Array.isArray(code) ? code[0] : code;
  const redirectScheme = Array.isArray(state) ? state[0] : state;

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

    const tempCode = createOAuthTempCode(
      {
        token: longLivedToken,
        type: 'facebook',
      },
      clientSecret,
    );

    const appRedirectUrl = `${redirectScheme}${redirectScheme.includes('?') ? '&' : '?'}code=${encodeURIComponent(tempCode)}&type=facebook`;
    return res.redirect(appRedirectUrl);
  } catch (error: any) {
    console.error('Facebook OAuth Error:', error);
    return res.status(500).send(`OAuth processing error: ${error.message}`);
  }
}
