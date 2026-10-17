// Uniform grid over 2D wall segments for circle-vs-wall and ray-vs-wall queries.
// Owned by car-physics so src/car stays self-contained (and runs headless in Node).
import type { Vec2 } from '../types.js';

export interface WallSeg { a: Vec2; b: Vec2; h: number; kind: WallKind }
export type WallKind = 'building' | 'wall' | 'monument' | 'prop' | 'barrier';
export interface Hit { nx: number; nz: number; depth: number; seg: WallSeg }

const key = (x: number, z: number) => (x + 4096) * 8192 + (z + 4096);

export class WallGrid {
  private cells = new Map<number, number[]>();
  private hit: Hit = { nx: 0, nz: 0, depth: 0, seg: null as unknown as WallSeg };

  readonly segs: WallSeg[];
  private cell: number;

  // (no TS parameter properties — the file must stay erasable for Node's type stripping)
  constructor(segs: WallSeg[], cell = 16) {
    this.segs = segs;
    this.cell = cell;
    segs.forEach((s, i) => {
      const x0 = Math.floor(Math.min(s.a.x, s.b.x) / cell), x1 = Math.floor(Math.max(s.a.x, s.b.x) / cell);
      const z0 = Math.floor(Math.min(s.a.z, s.b.z) / cell), z1 = Math.floor(Math.max(s.a.z, s.b.z) / cell);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const k = key(x, z);
        let c = this.cells.get(k);
        if (!c) this.cells.set(k, (c = []));
        c.push(i);
      }
    });
  }

  // Deepest penetration of a circle into any wall taller than `minH`. Reuses one Hit object.
  resolve(x: number, z: number, r: number, minH: number): Hit | null {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    let best = -1, bnx = 0, bnz = 0, bseg = 0;
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
      const c = this.cells.get(key(i, j));
      if (!c) continue;
      for (const idx of c) {
        const s = this.segs[idx];
        if (s.h <= minH) continue;
        const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, len2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - s.a.x) * dx + (z - s.a.z) * dz) / len2));
        const px = s.a.x + dx * t, pz = s.a.z + dz * t;
        const d = Math.hypot(x - px, z - pz);
        if (d < r && r - d > best) {
          best = r - d;
          bseg = idx;
          if (d > 1e-6) { bnx = (x - px) / d; bnz = (z - pz) / d; }
          else { const l = Math.sqrt(len2); bnx = -dz / l; bnz = dx / l; }
        }
      }
    }
    if (best < 0) return null;
    this.hit.nx = bnx; this.hit.nz = bnz; this.hit.depth = best; this.hit.seg = this.segs[bseg];
    return this.hit;
  }

  // First hit fraction (0..1) of segment p→q against walls taller than `minH`, or 1 when clear.
  raycast(px: number, pz: number, qx: number, qz: number, minH: number): number {
    const minX = Math.floor(Math.min(px, qx) / this.cell), maxX = Math.floor(Math.max(px, qx) / this.cell);
    const minZ = Math.floor(Math.min(pz, qz) / this.cell), maxZ = Math.floor(Math.max(pz, qz) / this.cell);
    let best = 1;
    const rx = qx - px, rz = qz - pz;
    for (let i = minX; i <= maxX; i++) for (let j = minZ; j <= maxZ; j++) {
      const c = this.cells.get(key(i, j));
      if (!c) continue;
      for (const idx of c) {
        const s = this.segs[idx];
        if (s.h <= minH) continue;
        const sx = s.b.x - s.a.x, sz = s.b.z - s.a.z;
        const den = rx * sz - rz * sx;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((s.a.x - px) * sz - (s.a.z - pz) * sx) / den;
        const u = ((s.a.x - px) * rz - (s.a.z - pz) * rx) / den;
        if (t >= 0 && t < best && u >= 0 && u <= 1) best = t;
      }
    }
    return best;
  }
}

export function pointInPoly(x: number, z: number, poly: Vec2[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
}

// Distance from point to segment a→b.
export function distToSeg(x: number, z: number, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}
