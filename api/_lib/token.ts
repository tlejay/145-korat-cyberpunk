// Stateless signed run token: base64url(JSON payload) + "." + HMAC-SHA256.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { secret } from './http.js';

export interface RunToken {
  v: 1;
  t: string; // track id
  d: string; // device id
  s: number; // server start time (ms)
  n: string; // nonce (becomes scores.run_id)
  q?: 1; // issued while ?qa=1 — results are never stored
}

// Longest race (2 laps) + 30 min slack for a retry after a network failure.
export const TOKEN_TTL_MS = 45 * 60_000;

function sign(body: string): string {
  return createHmac('sha256', secret()).update(body).digest('base64url');
}

export function issueToken(track: string, device: string, qa: boolean): { token: string; payload: RunToken } {
  const payload: RunToken = { v: 1, t: track, d: device, s: Date.now(), n: randomUUID(), ...(qa ? { q: 1 as const } : {}) };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { token: `${body}.${sign(body)}`, payload };
}

export function verifyToken(token: unknown): RunToken | 'TOKEN_INVALID' | 'TOKEN_EXPIRED' {
  if (typeof token !== 'string' || token.length > 512) return 'TOKEN_INVALID';
  const [body, mac, extra] = token.split('.');
  if (!body || !mac || extra !== undefined) return 'TOKEN_INVALID';
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return 'TOKEN_INVALID';
  let p: RunToken;
  try {
    p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as RunToken;
  } catch {
    return 'TOKEN_INVALID';
  }
  if (p.v !== 1 || typeof p.s !== 'number') return 'TOKEN_INVALID';
  if (Date.now() - p.s > TOKEN_TTL_MS) return 'TOKEN_EXPIRED';
  return p;
}
