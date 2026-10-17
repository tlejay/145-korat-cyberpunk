// Leaderboard API client. All paths are relative to the Vite base
// (/koratrocketcar/) so it works on madebytle.com and on *.vercel.app.
import { ERROR_CODES, type ErrorCode } from './codes.js';
import { deviceId } from './device.js';
import type { RunStats } from './score.js';
import { VERSION } from '../version.js';

export type Result<T> = { ok: true; data: T } | { ok: false; code: ErrorCode };

export interface FinishResult {
  score: number;
  rank: number;
  qualifies: boolean;
  personalBest: boolean;
  named: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  name: string | null;
  score: number;
  lapMs: number;
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

export function startRun(track: string) {
  return post<{ token: string; startedAt: number }>('/run/start', { track, deviceId: deviceId() });
}

export function finishRun(token: string, track: string, stats: RunStats) {
  return post<FinishResult>('/run/finish', { token, track, deviceId: deviceId(), build: VERSION, stats });
}

export function setName(name: string) {
  return post<{ name: string }>('/score/name', { deviceId: deviceId(), name });
}

export function getLeaderboard(track: string, limit = 50) {
  const q = new URLSearchParams({ track, limit: String(limit) });
  return call<{ track: string; entries: LeaderboardEntry[] }>(`/leaderboard?${q}`);
}
