// Score formula + plausibility checks, shared by client (result-screen preview)
// and server (authoritative). Spec: docs/dev/GAMEPLAY.md §6 (Tle: time + style ≤ 20%).
// The client sends RAW values only; the server always recomputes the score.
import type { ErrorCode } from './codes.js';
import { VERSION } from '../version.js';

export interface RunResult {
  trackId: string;
  build: string;
  laps: number;
  totalMs: number;
  lapMs: number[];
  splitsMs: number[]; // cumulative time at each checkpoint, all laps (alt group = same value)
  shortcuts: number; // moat jumps landed successfully
  driftMs: number;
  driftChains: number; // counted drift chains ≥ 1 s
  jumps: number;
  cleanLandings: number;
  launches: { perfect: number; total: number };
  boostMs: number;
  refills: number; // air-gate refills
  cleanLaps: number;
  respawns: number;
  maxG: number; // display only, not scored
}

export interface TrackRule {
  lengthM: number;
  laps: number;
  parLapMs: number;
  // TODO(physics): minLapMs and cpMinMs come from scripts/physics-sim.mjs (docs/dev/PHYSICS.md).
  minLapMs: number;
  checkpoints: number;
  cpMinMs: number[]; // min time between consecutive checkpoints; empty = only monotonic check
  altGroup: [number, number] | null; // checkpoints skippable by the moat shortcut [first, last]
  testOnly?: boolean; // accepted only outside production (smoke tests)
}

// Tle picked track A (2026-10-17). B/C are added when they ship.
export const TRACK_RULES: Record<string, TrackRule> = {
  A: { lengthM: 3311, laps: 2, parLapMs: 78_000, minLapMs: 54_400 /* PHYSICS.md §6: 64.0 s unlimited boost × 0.85 */, checkpoints: 34, cpMinMs: [], altGroup: null },
  test: { lengthM: 300, laps: 1, parLapMs: 20_000, minLapMs: 5_000, checkpoints: 3, cpMinMs: [], altGroup: null, testOnly: true },
};

export const DEFAULT_TRACK = 'A';

export function getTrackRule(id: unknown, allowTest: boolean): TrackRule | null {
  if (typeof id !== 'string' || !Object.hasOwn(TRACK_RULES, id)) return null;
  const rule = TRACK_RULES[id];
  return rule.testOnly && !allowTest ? null : rule;
}

// Builds whose results the server accepts. Add the new VERSION on every release;
// drop old ones once their physics/scoring is no longer comparable.
export const ACCEPTED_BUILDS: readonly string[] = [VERSION];

export const SCORE = {
  timeBase: 100_000, // score at exactly par
  driftPerSec: 120,
  driftChain: 150,
  shortcut: 500,
  cleanLanding: 250,
  perfectLaunch: 300,
  cleanLap: 3_000,
  respawnPenalty: 2_000,
  styleCapRatio: 0.2,
};

// Air-tank economy (GAMEPLAY §2.4) with costs from PHYSICS.md §2.4/§3 (boost 20/s, jump 35, moat 50).
export const GAS = {
  capacity: 100,
  regenPerSec: 3,
  driftRegenPerSec: 10,
  cleanLanding: 5,
  refill: 35,
  boostPerSec: 20, // full tank ≈ 5 s of BOOST
  jump: 35, // PHYSICS.md §2.4: ~29 real, game charges 35
  shortcut: 50, // moat crossing at Manat Rd (PHYSICS.md §2.3) — a style move, not a shortcut
  tolerance: 1.1,
};

export interface ScoreBreakdown {
  time: number;
  styleRaw: number;
  style: number;
  respawn: number;
  total: number;
}

export function computeScore(r: RunResult, rule: TrackRule): ScoreBreakdown {
  const parTotal = rule.parLapMs * rule.laps;
  const time = Math.round(SCORE.timeBase * (parTotal / r.totalMs) ** 2); // squared: top-end gains matter more
  const styleRaw =
    Math.round((r.driftMs / 1000) * SCORE.driftPerSec) +
    r.driftChains * SCORE.driftChain +
    r.shortcuts * SCORE.shortcut +
    r.cleanLandings * SCORE.cleanLanding +
    r.launches.perfect * SCORE.perfectLaunch +
    r.cleanLaps * SCORE.cleanLap;
  const style = Math.min(styleRaw, Math.round(time * SCORE.styleCapRatio));
  const respawn = r.respawns ? -r.respawns * SCORE.respawnPenalty : 0;
  return { time, styleRaw, style, respawn, total: Math.max(0, time + style + respawn) };
}

const isInt = (v: unknown, max = 2 ** 31 - 1): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;
const intArray = (v: unknown, maxLen: number): v is number[] => Array.isArray(v) && v.length <= maxLen && v.every((x) => isInt(x));

// Shape check for untrusted JSON. Returns a typed RunResult or null.
export function parseRun(v: unknown): RunResult | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const launches = r.launches as Record<string, unknown> | undefined;
  const ints = ['laps', 'totalMs', 'shortcuts', 'driftMs', 'driftChains', 'jumps', 'cleanLandings', 'boostMs', 'refills', 'cleanLaps', 'respawns'];
  if (typeof r.trackId !== 'string' || typeof r.build !== 'string' || r.build.length > 40) return null;
  if (!ints.every((k) => isInt(r[k]))) return null;
  if (!intArray(r.lapMs, 20) || !intArray(r.splitsMs, 1000)) return null;
  if (!launches || !isInt(launches.perfect) || !isInt(launches.total)) return null;
  if (typeof r.maxG !== 'number' || !Number.isFinite(r.maxG) || r.maxG < 0 || r.maxG > 50) return null;
  return {
    trackId: r.trackId, build: r.build, laps: r.laps as number, totalMs: r.totalMs as number,
    lapMs: r.lapMs, splitsMs: r.splitsMs, shortcuts: r.shortcuts as number, driftMs: r.driftMs as number,
    driftChains: r.driftChains as number, jumps: r.jumps as number, cleanLandings: r.cleanLandings as number,
    launches: { perfect: launches.perfect, total: launches.total }, boostMs: r.boostMs as number,
    refills: r.refills as number, cleanLaps: r.cleanLaps as number, respawns: r.respawns as number, maxG: r.maxG,
  };
}

function gasBudgetOk(r: RunResult): boolean {
  const used = (r.boostMs / 1000) * GAS.boostPerSec + Math.max(0, r.jumps - r.shortcuts) * GAS.jump + r.shortcuts * GAS.shortcut;
  const available =
    GAS.capacity +
    (r.totalMs / 1000) * GAS.regenPerSec +
    (r.driftMs / 1000) * GAS.driftRegenPerSec +
    r.cleanLandings * GAS.cleanLanding +
    r.refills * GAS.refill;
  return used <= available * GAS.tolerance;
}

const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

// Server-side plausibility (GAMEPLAY §6.2, checks 1–9). Returns an error code or null.
export function validateRun(
  r: RunResult,
  t: { startedAtMs: number; nowMs: number; trackId: string; allowTest: boolean },
): ErrorCode | null {
  const rule = getTrackRule(r.trackId, t.allowTest);
  if (!rule || r.trackId !== t.trackId) return 'BAD_TRACK'; // 1 token bound to track
  if (r.laps !== rule.laps || r.lapMs.length !== rule.laps) return 'BAD_LAPS'; // 2
  if (Math.abs(sum(r.lapMs) - r.totalMs) > 50) return 'BAD_TOTAL'; // 3
  if (r.lapMs.some((ms) => ms < rule.minLapMs)) return 'TOO_FAST'; // 4 physical floor
  const elapsed = t.nowMs - t.startedAtMs; // 5 server wall clock
  if (elapsed < r.totalMs - 500 || elapsed > r.totalMs + 30 * 60_000) return 'BAD_CLOCK';
  if (r.splitsMs.length !== rule.checkpoints * rule.laps) return 'BAD_SPLITS'; // 6 splits vs sim minimum
  for (let i = 0, prev = 0; i < r.splitsMs.length; prev = r.splitsMs[i++]) {
    const cp = i % rule.checkpoints;
    const dt = r.splitsMs[i] - prev;
    const inAlt = rule.altGroup !== null && cp > rule.altGroup[0] && cp <= rule.altGroup[1];
    if (dt < 0 || (!inAlt && dt < (rule.cpMinMs[cp] ?? 0))) return 'BAD_SPLITS'; // alt group may repeat (dt = 0)
  }
  if (r.splitsMs[r.splitsMs.length - 1] > r.totalMs) return 'BAD_SPLITS';
  if (r.shortcuts > rule.laps || r.cleanLaps > rule.laps || r.refills > rule.laps) return 'BAD_STYLE'; // 7
  if (r.cleanLandings > r.jumps || r.shortcuts > r.jumps || r.launches.perfect > r.launches.total || r.launches.total > 1) return 'BAD_STYLE';
  if (r.driftMs > r.totalMs * 0.7 || r.driftChains * 1000 > r.driftMs || r.boostMs > r.totalMs) return 'BAD_STYLE';
  if (!gasBudgetOk(r)) return 'BAD_TANK'; // 8
  if (!ACCEPTED_BUILDS.includes(r.build)) return 'OLD_BUILD'; // 9
  return null;
}
