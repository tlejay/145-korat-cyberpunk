// Uniform grid over 2D wall segments for fast circle-vs-wall queries (stub car + camera).
import type { Vec2 } from '../types.js';

export class SegmentGrid {
  private cells = new Map<number, number[]>();
  constructor(private segs: { a: Vec2; b: Vec2 }[], private cell = 20) {
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

  // Deepest penetration of a circle into any wall: push-out normal + depth, or null.
  resolve(x: number, z: number, r: number): { nx: number; nz: number; depth: number } | null {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    let best: { nx: number; nz: number; depth: number } | null = null;
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
      const c = this.cells.get(key(i, j));
      if (!c) continue;
      for (const idx of c) {
        const { a, b } = this.segs[idx];
        const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
        const px = a.x + dx * t, pz = a.z + dz * t;
        const d = Math.hypot(x - px, z - pz);
        if (d < r && (!best || r - d > best.depth)) {
          const inv = d > 1e-6 ? 1 / d : 0;
          best = { nx: (x - px) * inv || -dz / Math.sqrt(len2), nz: (z - pz) * inv || dx / Math.sqrt(len2), depth: r - d };
        }
      }
    }
    return best;
  }
}

const key = (x: number, z: number) => (x + 4096) * 8192 + (z + 4096);
