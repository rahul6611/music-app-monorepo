import { VercelRequest, VercelResponse } from '@vercel/node';

const REQUIRED_PAGE_PERMISSIONS = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
] as const;

async function debugFacebookToken(inputToken: string, appToken: string) {
  const url =
    `https://graph.facebook.com/v20.0/debug_token` +
    `?input_token=${encodeURIComponent(inputToken)}` +
    `&access_token=${encodeURIComponent(appToken)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`debug_token failed: ${await response.text()}`);
  }
  const payload = await response.json();
  return payload.data as {
    is_valid?: boolean;
    scopes?: string[];
    granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
  };
}

export async function handleFacebookPermissions(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token =
    req.method === 'POST'
      ? (req.body as { token?: string } | undefined)?.token
      : (Array.isArray(req.query.token) ? req.query.token[0] : req.query.token);

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing token' });
  }

  const appId = process.env.FACEBOOK_APP_ID || process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    return res.status(500).json({
      error: 'Server misconfigured: set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in Vercel.',
    });
  }

  try {
    const appToken = `${appId}|${appSecret}`;
    const debugData = await debugFacebookToken(token, appToken);

    const permRes = await fetch(
      `https://graph.facebook.com/v20.0/me/permissions?access_token=${encodeURIComponent(token)}`,
    );
    const permPayload = permRes.ok ? await permRes.json() : { data: [] };
    const permissionRows = (permPayload.data || []) as Array<{
      permission: string;
      status: string;
    }>;

    const grantedFromMe = permissionRows
      .filter((row) => row.status === 'granted')
      .map((row) => row.permission);
    const scopes = debugData.scopes || grantedFromMe;

    const missing = REQUIRED_PAGE_PERMISSIONS.filter((permission) => !scopes.includes(permission));

    return res.status(200).json({
      isValid: debugData.is_valid !== false,
      scopes,
      granted: REQUIRED_PAGE_PERMISSIONS.filter((permission) => scopes.includes(permission)),
      missing,
      ready: missing.length === 0,
      granularScopes: debugData.granular_scopes || [],
      permissions: permissionRows,
    });
  } catch (error: any) {
    console.error('Facebook permissions check failed:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to verify Facebook permissions',
    });
  }
}
