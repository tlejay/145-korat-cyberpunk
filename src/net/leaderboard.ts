// Leaderboard API client. All paths are relative to the Vite base
// (/koratrocketcar/) so it works on madebytle.com and on *.vercel.app.
import { ERROR_CODES, type ErrorCode } from './codes.js';
import { deviceId } from './device.js';
import type { Ghost } from './ghost-format.js';
import { decodeGhost, encodeGhost } from './ghost.js';
import type { RunResult, ScoreBreakdown } from './score.js';

export type Result<T> = { ok: true; data: T } | { ok: false; code: ErrorCode };

export interface FinishResult {
  score: number;
  breakdown: ScoreBreakdown;
  rank: number;
  qualifies: boolean;
  personalBest: boolean;
  named: boolean;
  ghostSaved: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  name: string | null;
  score: number;
  totalMs: number; // whole race
  lapMs: number; // best lap
  at: string;
}

const API = `${import.meta.env.BASE_URL}api`;

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    });
  } catch {
    return { ok: false, code: 'NETWORK' };
  }
  let json: { ok?: boolean; code?: string } & Record<string, unknown>;
  try {
    json = await res.json();
  } catch {
    return { ok: false, code: 'SERVER_ERROR' };
  }
  if (json.ok) return { ok: true, data: json as T };
  const code = ERROR_CODES.includes(json.code as ErrorCode) ? (json.code as ErrorCode) : 'SERVER_ERROR';
  return { ok: false, code };
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: 'POST', body: JSON.stringify(body) });

// Call when the player taps "เริ่มแข่ง" (before the countdown). Runs started
// under ?qa=1 get a token the server will refuse to score (GAMEPLAY §6.3).
export function startRun(track: string) {
  const qa = new URLSearchParams(location.search).get('qa') === '1';
  return post<{ token: string; startedAt: number }>('/run/start', { track, deviceId: deviceId(), qa });
}

// `ghost` = the best lap of this run (GAMEPLAY §5.3); omitted if the browser cannot compress.
export async function finishRun(token: string, result: RunResult, ghost?: Ghost) {
  const encoded = ghost ? await encodeGhost(ghost) : null;
  return post<FinishResult>('/run/finish', { token, deviceId: deviceId(), result, ghost: encoded });
}

export interface TopGhost {
  name: string | null;
  score: number;
  lapMs: number;
  build: string;
  ghost: Ghost;
}

// Online #1 ghost for the track; ok with data null when nobody has uploaded one yet.
export async function getTopGhost(track: string): Promise<Result<TopGhost | null>> {
  const res = await call<{ ghost: null | { name: string | null; score: number; lapMs: number; build: string; data: string } }>(
    `/ghost/top?${new URLSearchParams({ track })}`,
  );
  if (!res.ok) return res;
  const g = res.data.ghost;
  if (!g) return { ok: true, data: null };
  const ghost = await decodeGhost(g.data);
  return ghost ? { ok: true, data: { name: g.name, score: g.score, lapMs: g.lapMs, build: g.build, ghost } } : { ok: true, data: null };
}

export function setName(name: string) {
  return post<{ name: string }>('/score/name', { deviceId: deviceId(), name });
}

export function getLeaderboard(track: string, limit = 50) {
  const q = new URLSearchParams({ track, limit: String(limit) });
  return call<{ track: string; entries: LeaderboardEntry[] }>(`/leaderboard?${q}`);
}
