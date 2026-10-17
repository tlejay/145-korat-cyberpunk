import { createHmac } from 'node:crypto';
import type { ErrorCode } from '../../src/net/codes.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export function ok(body: Record<string, unknown>, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ ok: true, ...body }), { status: 200, headers: { ...JSON_HEADERS, ...headers } });
}

const STATUS: Partial<Record<ErrorCode, number>> = {
  RATE_LIMITED: 429,
  TOKEN_INVALID: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_MISMATCH: 401,
  RUN_USED: 409,
  NO_SCORE: 404,
  SERVER_ERROR: 500,
};

export function fail(code: ErrorCode, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ ok: false, code }), {
    status: STATUS[code] ?? 400,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > 4096) return null;
  try {
    const text = await req.text();
    if (text.length > 4096) return null;
    const v: unknown = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v);
}

export function secret(): string {
  const s = process.env.RUN_TOKEN_SECRET;
  if (!s || s.length < 32) throw new Error('RUN_TOKEN_SECRET missing or too short');
  return s;
}

// Hash the client IP so raw addresses are never stored.
export function ipHash(req: Request): string {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  return createHmac('sha256', secret()).update(`ip:${ip}`).digest('base64url').slice(0, 22);
}

export function allowTestTrack(): boolean {
  return process.env.VERCEL_ENV !== 'production';
}

// Wrap a handler so unexpected errors become a code, never a stack trace.
export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await fn(req);
    } catch (err) {
      console.error(err);
      return fail('SERVER_ERROR');
    }
  };
}
