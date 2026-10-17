// Score formula shared by client (preview on the results screen) and server
// (the only score that is stored). PLACEHOLDER: the gameplay pane will replace
// computeScore() per docs/dev/GAMEPLAY.md — keep the signature and keep
// validateRun() strict so every input the formula uses is bounded.
import type { ErrorCode } from './codes.js';
import type { TrackLimits } from './tracks.js';

export interface RunStats {
  lapMs: number; // total race time for the run (all laps)
  driftMs: number; // time spent drifting
  jumps: number; // successful jumps landed
  collisions: number; // wall/building hits
}

export function validateRun(stats: unknown, track: TrackLimits): RunStats | ErrorCode {
  if (!stats || typeof stats !== 'object') return 'BAD_REQUEST';
  const s = stats as Record<string, unknown>;
  const lapMs = s.lapMs, driftMs = s.driftMs ?? 0, jumps = s.jumps ?? 0, collisions = s.collisions ?? 0;
  if (![lapMs, driftMs, jumps, collisions].every((v) => Number.isInteger(v) && (v as number) >= 0)) return 'BAD_REQUEST';
  const run = { lapMs, driftMs, jumps, collisions } as RunStats;
  if (run.lapMs < track.minMs || run.lapMs > track.maxMs) return 'RUN_IMPLAUSIBLE';
  if (run.driftMs > run.lapMs) return 'RUN_IMPLAUSIBLE';
  // At most one jump every 2 s (jump + landing + air-tank cooldown).
  if (run.jumps > Math.floor(run.lapMs / 2000)) return 'RUN_IMPLAUSIBLE';
  if (run.collisions > 10_000) return 'RUN_IMPLAUSIBLE';
  return run;
}

export function computeScore(run: RunStats, track: TrackLimits): number {
  // Time: 10,000 points at par, more when faster.
  const time = (track.parMs / run.lapMs) * 10_000;
  // Style bonuses are capped relative to time so they cannot dominate.
  const drift = Math.min(run.driftMs / 100, time * 0.3);
  const jumps = Math.min(run.jumps * 150, time * 0.1);
  const clean = Math.max(0, 1 - run.collisions * 0.02);
  return Math.max(0, Math.round((time + drift + jumps) * clean));
}
