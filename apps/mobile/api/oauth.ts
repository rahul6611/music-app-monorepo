import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleFacebookCallback } from './lib/facebook-callback';
import { handleFacebookToken } from './lib/facebook-token';
import { handleFacebookPermissions } from './lib/facebook-permissions';
import { handleGoogleCallback } from './lib/google-callback';
import { handleGoogleToken } from './lib/google-token';
import { handleGoogleRefresh } from './lib/google-refresh';

type OAuthHandler = (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>;

const handlers: Record<string, OAuthHandler> = {
  'facebook-callback': handleFacebookCallback,
  'facebook-token': handleFacebookToken,
  'facebook-permissions': handleFacebookPermissions,
  'google-callback': handleGoogleCallback,
  'google-token': handleGoogleToken,
  'google-refresh': handleGoogleRefresh,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;

  if (!action || !handlers[action]) {
    return res.status(404).json({
      error: 'Unknown OAuth action',
      available: Object.keys(handlers),
    });
  }

  return handlers[action](req, res);
}
