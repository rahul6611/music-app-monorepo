import crypto from 'crypto';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function createOAuthTempCode(
  payload: Record<string, string>,
  secret: string,
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const data = JSON.stringify({
    ...payload,
    exp: Date.now() + ttlMs,
  });
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  const envelope = JSON.stringify({ data, signature });
  return Buffer.from(envelope, 'utf8').toString('base64url');
}

export function readOAuthTempCode(
  code: string,
  secret: string,
): Record<string, string> | null {
  try {
    const envelope = JSON.parse(Buffer.from(code, 'base64url').toString('utf8')) as {
      data: string;
      signature: string;
    };

    const expected = crypto.createHmac('sha256', secret).update(envelope.data).digest('hex');
    if (expected !== envelope.signature) {
      return null;
    }

    const payload = JSON.parse(envelope.data) as Record<string, string> & { exp: number };
    if (!payload.exp || payload.exp < Date.now()) {
      return null;
    }

    const { exp: _exp, ...rest } = payload;
    return rest;
  } catch {
    return null;
  }
}
