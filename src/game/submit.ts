// Score submission with an offline retry queue (GAMEPLAY §5.1 "ส่งแต้มไม่สำเร็จ").
import type { Ghost } from '../net/ghost-format.js';
import { finishRun, startRun, type FinishResult, type Result } from '../net/leaderboard.js';
import type { RunResult } from '../net/score.js';

const KEY = 'pendingRun.v1';
const TOKEN_LIFE_MS = 44 * 60_000; // server token lives 45 min

interface Pending { token: string; result: RunResult; savedAt: number }

export class RunTicket {
  private token: Promise<string | null>;
  constructor(track: string) {
    this.token = startRun(track).then((r) => (r.ok ? r.data.token : null)).catch(() => null);
  }
  async finish(result: RunResult, ghost: Ghost | null): Promise<Result<FinishResult>> {
    const token = await this.token;
    if (!token) return { ok: false, code: 'NETWORK' };
    const res = await finishRun(token, result, ghost ?? undefined);
    if (!res.ok && res.code === 'NETWORK') {
      try { localStorage.setItem(KEY, JSON.stringify({ token, result, savedAt: Date.now() } satisfies Pending)); } catch { /* ignore */ }
    }
    return res;
  }
}

// Called on boot: resend a run that failed to upload last time (without ghost).
export async function flushPending() {
  let p: Pending | null = null;
  try { p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Pending | null; } catch { /* ignore */ }
  if (!p) return;
  if (Date.now() - p.savedAt > TOKEN_LIFE_MS) { try { localStorage.removeItem(KEY); } catch { /* ignore */ } return; }
  const res = await finishRun(p.token, p.result);
  if (res.ok || res.code !== 'NETWORK') { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
}
