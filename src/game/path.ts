// Closed centerline helper: projection, progress (track metres), direction lookup.
// Used by race logic, autopilot, lane-align assist, respawn and the minimap.
import type { Vec2 } from '../types.js';

export class LoopPath {
  readonly pts: Vec2[];
  readonly cum: number[]; // cumulative metres at each point
  readonly length: number;

  constructor(points: Vec2[], spacingM = 5) {
    this.pts = resample(points, spacingM);
    this.cum = [0];
    for (let i = 1; i <= this.pts.length; i++) {
      const a = this.pts[i - 1], b = this.pts[i % this.pts.length];
      this.cum.push(this.cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
    this.length = this.cum[this.pts.length];
  }

  // Nearest point on the loop. `hint` = previous segment index (searches ±window around it first).
  project(x: number, z: number, hint = -1, window = 40): { s: number; dist: number; seg: number; side: number } {
    const n = this.pts.length;
    let best = { s: 0, dist: Infinity, seg: 0, side: 0 };
    const scan = (i: number) => {
      const a = this.pts[i], b = this.pts[(i + 1) % n];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
      const px = a.x + dx * t, pz = a.z + dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < best.dist) {
        // side > 0 = right of travel direction (heading clockwise convention)
        const cross = dx * (z - a.z) - dz * (x - a.x);
        best = { s: this.cum[i] + t * Math.sqrt(len2), dist: d, seg: i, side: cross > 0 ? 1 : -1 };
      }
    };
    if (hint >= 0) {
      for (let k = -window; k <= window; k++) scan((hint + k + n) % n);
      if (best.dist < 25) return best;
    }
    for (let i = 0; i < n; i++) scan(i);
    return best;
  }

  // Point + heading (rad, 0 = north/−z, clockwise +) at track metre s.
  at(s: number): { x: number; z: number; heading: number; seg: number } {
    const L = this.length;
    s = ((s % L) + L) % L;
    let lo = 0, hi = this.pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.cum[mid] <= s) lo = mid; else hi = mid - 1;
    }
    const a = this.pts[lo], b = this.pts[(lo + 1) % this.pts.length];
    const segLen = this.cum[lo + 1] - this.cum[lo] || 1;
    const t = (s - this.cum[lo]) / segLen;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: headingOf(b.x - a.x, b.z - a.z), seg: lo };
  }

  // Signed heading change (deg) between s and s+ahead — used for turn arrows.
  turnAhead(s: number, ahead: number, span = 30): number {
    const h0 = this.at(s + ahead - span).heading;
    const h1 = this.at(s + ahead + span).heading;
    return (angleDiff(h1, h0) * 180) / Math.PI;
  }
}

export const headingOf = (dx: number, dz: number) => Math.atan2(dx, -dz);
export const angleDiff = (a: number, b: number) => {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
};

function resample(points: Vec2[], spacing: number): Vec2[] {
  const src = points.slice();
  const f = src[0], l = src[src.length - 1];
  if (Math.hypot(f.x - l.x, f.z - l.z) < 0.5) src.pop(); // closed ring duplicate
  const out: Vec2[] = [{ ...src[0] }];
  let carry = 0;
  for (let i = 0; i < src.length; i++) {
    const a = src[i], b = src[(i + 1) % src.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    let d = spacing - carry;
    while (d < len) {
      const t = d / len;
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      d += spacing;
    }
    carry = len - (d - spacing);
  }
  const last = out[out.length - 1];
  if (Math.hypot(last.x - out[0].x, last.z - out[0].z) < spacing * 0.5) out.pop();
  return out;
}

// Segment p1→p2 crosses segment a→b?
export function crosses(p1: Vec2, p2: Vec2, a: Vec2, b: Vec2): boolean {
  const d = (u: Vec2, v: Vec2, w: Vec2) => (v.x - u.x) * (w.z - u.z) - (v.z - u.z) * (w.x - u.x);
  const d1 = d(a, b, p1), d2 = d(a, b, p2), d3 = d(p1, p2, a), d4 = d(p1, p2, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export function pointInPoly(x: number, z: number, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export const LAT0 = 14.974731, LON0 = 102.098117, KX = 107550, KZ = 110574;
export const fromLatLng = (lat: number, lng: number) => ({ x: (lng - LON0) * KX, z: -(lat - LAT0) * KZ });
export const toLatLng = (x: number, z: number) => ({ lat: LAT0 - z / KZ, lng: LON0 + x / KX });
