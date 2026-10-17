// Corner finder for the wayfinding signs + HUD arrow. three.js-free (headless-testable with
// `node scripts/test-wayfinding.mjs`). Everything is derived from the centreline at load time, so a moved
// finish line or a rebuilt track-A.json keeps the signs on the right corners (BRIEF-wayfinding).
//
// Safe corner speed follows PHYSICS.md §4: grip limit 1.6 g (normal fans) on the widest racing-line
// radius that fits the real road width: R = r_inner + w / (1 − cos(θ/2)) (outside-apex-outside).
import type { Vec2 } from '../types.js';

export type TurnDir = 'left' | 'right';
export type Severity = 1 | 2 | 3;

export interface Turn {
  id: number;
  dir: TurnDir;
  deg: number;            // signed heading change, right = +
  s0: number;             // turn-in (curvature starts), metres from the finish line
  sApex: number;          // curvature-weighted middle of the corner
  s1: number;             // corner exit
  apex: Vec2;
  widthM: number;         // usable carriageway width on the entry/exit straights
  arcRadiusM: number;     // centreline arc radius (fillet)
  lineRadiusM: number;    // racing-line radius (what the speed is based on)
  safeKmh: number;        // grip-limit speed at 1.6 g on lineRadiusM
  severity: Severity;     // 1 = easy · 2 = brake · 3 = dangerous (≤ 75 km/h)
}

export const WF = {
  smoothM: 12,          // half window for the curvature used to detect corners
  minCurvDegPerM: 0.4,  // detection threshold (≈ R 143 m)
  minTurnDeg: 25,       // smaller bends are not signed
  mergeGapM: 12,        // same-direction runs closer than this are one corner
  gripG: 1.6,           // PHYSICS §4.2 grip, normal fans
  sev2Kmh: 88,          // safe speed below this → severity 2 (calibrated: 224 junction = 1, town corners = 2–3)
  sev3Kmh: 75,          // … below this → severity 3 ("โค้งอันตราย")
  widthProbeM: 15,      // width measured this far before turn-in / after exit
  carWidthM: 2.0,       // racing line = car centre: 1 m off each edge
  defaultWidthM: 10,
  hudShowM: 200,        // HUD arrow + distance when the turn-in is this close (BRIEF §3)
};

const G = 9.81;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Width at a sample index (metres). Optional — falls back to WF.defaultWidthM. */
export type WidthAt = (i: number) => number;

export function findTurns(center: Vec2[], widthAt?: WidthAt): { turns: Turn[]; lengthM: number; cum: number[] } {
  const n = center.length;
  const cum: number[] = [0];
  const head: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = center[i], b = center[(i + 1) % n];
    const dx = b.x - a.x, dz = b.z - a.z;
    head.push(Math.atan2(dx, -dz)); // 0 = north (−z), clockwise +
    cum.push(cum[i] + Math.hypot(dx, dz));
  }
  const L = cum[n];
  const step = L / n;
  // heading change at sample i (between segment i−1 and i), deg
  const dth = head.map((h, i) => (wrap(h - head[(i - 1 + n) % n]) * 180) / Math.PI);
  const half = Math.max(1, Math.round(WF.smoothM / step));
  const curv = dth.map((_, i) => {
    let s = 0;
    for (let k = -half; k <= half; k++) s += dth[(i + k + n) % n];
    return s / ((2 * half + 1) * step); // deg per metre
  });

  // contiguous runs of strong same-sign curvature (loop-aware: start scanning from a calm sample)
  let start = 0;
  for (let i = 0; i < n; i++) if (Math.abs(curv[i]) < WF.minCurvDegPerM * 0.5) { start = i; break; }
  type Run = { i0: number; i1: number; sign: number };
  const runs: Run[] = [];
  let cur: Run | null = null;
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n, c = curv[i];
    const sign = Math.abs(c) >= WF.minCurvDegPerM ? Math.sign(c) : 0;
    if (cur && sign === cur.sign) { cur.i1 = start + k; continue; }
    if (cur) runs.push(cur);
    cur = sign ? { i0: start + k, i1: start + k, sign } : null;
  }
  if (cur) runs.push(cur);
  // merge same-direction runs separated by a short calm gap
  const merged: Run[] = [];
  for (const r of runs) {
    const p = merged[merged.length - 1];
    if (p && p.sign === r.sign && (r.i0 - p.i1) * step <= WF.mergeGapM) p.i1 = r.i1;
    else merged.push({ ...r });
  }

  const sOf = (k: number) => cum[((k % n) + n) % n] + Math.floor(k / n) * L;
  const turns: Turn[] = [];
  for (const r of merged) {
    // grow the run to where curvature has really died out, so the raw heading sum is the full corner
    let i0 = r.i0, i1 = r.i1;
    while (i0 > r.i0 - half * 2 && Math.sign(curv[((i0 - 1) % n + n) % n]) === r.sign && Math.abs(curv[((i0 - 1) % n + n) % n]) > 0.05) i0--;
    while (i1 < r.i1 + half * 2 && Math.sign(curv[(i1 + 1) % n]) === r.sign && Math.abs(curv[(i1 + 1) % n]) > 0.05) i1++;
    let deg = 0, wsum = 0, wpos = 0;
    for (let k = i0; k <= i1; k++) {
      const d = dth[((k % n) + n) % n];
      deg += d;
      if (Math.sign(d) === r.sign) { wsum += Math.abs(d); wpos += Math.abs(d) * k; }
    }
    if (Math.abs(deg) < WF.minTurnDeg) continue;
    const kApex = wsum ? wpos / wsum : (i0 + i1) / 2;
    // turn-in / exit = where 10 % / 90 % of the heading change has happened (tight, matches the fillet)
    let acc = 0, k0 = i0, k1 = i1;
    for (let k = i0; k <= i1; k++) { acc += dth[((k % n) + n) % n]; if (Math.abs(acc) >= Math.abs(deg) * 0.1) { k0 = k; break; } }
    acc = 0;
    for (let k = i0; k <= i1; k++) { acc += dth[((k % n) + n) % n]; if (Math.abs(acc) >= Math.abs(deg) * 0.9) { k1 = k; break; } }
    const theta = (Math.abs(deg) * Math.PI) / 180;
    const arcLen = Math.max(step, (k1 - k0) * step / 0.8);
    const arcR = arcLen / theta;
    const probe = Math.round(WF.widthProbeM / step);
    const w = widthAt
      ? Math.max(4, Math.min(widthAt(((k0 - probe) % n + n) % n), widthAt((k1 + probe) % n)))
      : WF.defaultWidthM;
    const wl = Math.max(2, w - WF.carWidthM);
    const half2 = Math.min(theta, (150 * Math.PI) / 180) / 2;
    const lineR = Math.min(400, Math.max(arcR, Math.max(1, arcR - wl / 2) + wl / (1 - Math.cos(half2))));
    const safeKmh = Math.sqrt(WF.gripG * G * lineR) * 3.6;
    const severity: Severity = safeKmh < WF.sev3Kmh ? 3 : safeKmh < WF.sev2Kmh ? 2 : 1;
    const ia = Math.round(kApex);
    const apex = center[((ia % n) + n) % n];
    turns.push({
      id: 0, dir: deg > 0 ? 'right' : 'left', deg: Math.round(deg),
      s0: sOf(k0) % L, sApex: sOf(ia) % L, s1: sOf(k1) % L, apex: { x: apex.x, z: apex.z },
      widthM: +w.toFixed(1), arcRadiusM: +arcR.toFixed(1), lineRadiusM: +lineR.toFixed(1), safeKmh: Math.round(safeKmh), severity,
    });
  }
  turns.sort((a, b) => a.s0 - b.s0);
  turns.forEach((t, i) => (t.id = i));
  return { turns, lengthM: L, cum };
}

/** Metres from `trackM` forward to `s` on a loop of length L. */
export const ahead = (trackM: number, s: number, L: number) => (((s - trackM) % L) + L) % L;

/**
 * The turn the driver should be thinking about now: the next one whose turn-in is ≤ maxM ahead, or the one
 * we are inside of (until its apex — distM 0). null when the road ahead is straight.
 */
export function upcomingTurn(turns: Turn[], L: number, trackM: number, maxM = WF.hudShowM): { turn: Turn; distM: number } | null {
  let best: { turn: Turn; distM: number } | null = null;
  for (const t of turns) {
    const toApex = ahead(trackM, t.sApex, L);
    const inside = ahead(t.s0, trackM, L) < ahead(t.s0, t.sApex, L);
    const d = inside ? 0 : ahead(trackM, t.s0, L);
    if (d > maxM || toApex > maxM + (t.sApex - t.s0 + L) % L) continue;
    if (!best || d < best.distM) best = { turn: t, distM: d };
  }
  return best;
}
