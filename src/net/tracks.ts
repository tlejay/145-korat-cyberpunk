// Server-trusted per-track limits. Lengths from research/osm/REPORT.md.
export interface TrackLimits {
  lengthM: number;
  laps: number;
  // Par time used by the score formula (placeholder until gameplay tuning).
  parMs: number;
  // Fastest physically plausible run: total distance at MAX_AVG_KMH.
  minMs: number;
  maxMs: number;
  // Only accepted outside production (for smoke tests).
  testOnly?: boolean;
}

const MAX_AVG_KMH = 220;
const MAX_RUN_MS = 15 * 60_000;

function limits(lengthM: number, laps: number, parAvgKmh: number, testOnly = false): TrackLimits {
  const dist = lengthM * laps;
  return {
    lengthM,
    laps,
    parMs: Math.round((dist / (parAvgKmh / 3.6)) * 1000),
    minMs: Math.round((dist / (MAX_AVG_KMH / 3.6)) * 1000),
    maxMs: MAX_RUN_MS,
    testOnly,
  };
}

// Tle picked track A (research/osm/track-A.geojson) as the first track on 2026-10-17.
// B (2352 m) and C (2083 m) are not enabled until they ship — add them here then.
export const TRACKS: Record<string, TrackLimits> = {
  A: limits(3361, 1, 110),
  test: limits(1000, 1, 100, true),
};

export const DEFAULT_TRACK = 'A';

export function getTrack(id: unknown, allowTest: boolean): TrackLimits | null {
  if (typeof id !== 'string' || !Object.hasOwn(TRACKS, id)) return null;
  const t = TRACKS[id];
  if (t.testOnly && !allowTest) return null;
  return t;
}
