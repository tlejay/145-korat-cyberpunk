// Power cables + hanging lanterns (PHYSICS §5.3–5.6) — ready for M3, not wired into the game yet.
// Cable = analytic catenary rest shape + Verlet-integrated displacement (linearised string):
//   d̈ = (H/μ)·∂²d/∂x² − (g/ℓ)·d_side + wind/μ,  H/μ = g·L²/(8·sag)
// Jacobi update (all accelerations from one state) — in-place Gauss-Seidel blows up here.
// Only spans within simRadius of the car are simulated; others ease back to rest and stop.
// Visual only: nothing here pushes back on the car.
import { G } from './config.js';

export interface CableSpan { ax: number; ay: number; az: number; bx: number; by: number; bz: number; sag: number; n?: number }
export interface Lantern { x: number; y: number; z: number; length: number }
export interface WindSource { x: number; y: number; z: number; vx: number; vz: number; airborne: boolean; jumpJet: boolean }

const AIR = 1.2;
const WIRE_ACC = (0.5 * AIR * 1.2 * 0.03) / 0.6; // bundle Ø30 mm, 0.6 kg/m, Cd 1.2 → a = k·u²
const LANTERN_K = (0.5 * AIR * 0.5 * 0.126) / 1.0; // Ø40 cm sphere, Cd 0.5, 1 kg

export const CABLE_TUNING = { simRadius: 120, drawRadius: 300, gustMul: 8, damp: 0.99, maxPoints: 1200, stormWind: 0 };

export class CableSystem {
  /** xyz per point, rest + displacement — feed straight into a LineSegments position attribute. */
  readonly positions: Float32Array;
  /** Index pairs for LineSegments (static). */
  readonly indices: Uint32Array;
  readonly lanternAngles: Float32Array; // per lantern: swing angle along x, along z (rad)
  activePoints = 0;

  private spans: { off: number; n: number; c2: number; dx: number; mx: number; mz: number; ux: number; uz: number; ell: Float32Array }[] = [];
  private rest: Float32Array;
  private d: Float32Array; // displacement y, side per point
  private dp: Float32Array; // previous displacement
  private acc: Float32Array;
  private lanterns: Lantern[];
  private lv: Float32Array; // lantern angular velocity (2 per lantern)
  private t = 0;

  constructor(spans: CableSpan[], lanterns: Lantern[] = []) {
    const total = spans.reduce((s, sp) => s + (sp.n ?? 12) + 1, 0);
    this.positions = new Float32Array(total * 3);
    this.rest = new Float32Array(total * 3);
    this.d = new Float32Array(total * 2);
    this.dp = new Float32Array(total * 2);
    this.acc = new Float32Array(total * 2);
    const idx: number[] = [];
    let off = 0;
    for (const sp of spans) {
      const n = sp.n ?? 12, len = Math.hypot(sp.bx - sp.ax, sp.bz - sp.az) || 1;
      const ell = new Float32Array(n + 1);
      for (let i = 0; i <= n; i++) {
        const u = i / n, sagHere = 4 * sp.sag * u * (1 - u);
        const k = (off + i) * 3;
        this.rest[k] = sp.ax + (sp.bx - sp.ax) * u;
        this.rest[k + 1] = sp.ay + (sp.by - sp.ay) * u - sagHere;
        this.rest[k + 2] = sp.az + (sp.bz - sp.az) * u;
        ell[i] = sagHere + 0.3;
        if (i < n) idx.push(off + i, off + i + 1);
      }
      this.spans.push({ off, n, c2: (G * len * len) / (8 * Math.max(sp.sag, 0.05)), dx: len / n, mx: (sp.ax + sp.bx) / 2, mz: (sp.az + sp.bz) / 2, ux: (sp.bx - sp.ax) / len, uz: (sp.bz - sp.az) / len, ell });
      off += n + 1;
    }
    this.positions.set(this.rest);
    this.indices = Uint32Array.from(idx);
    this.lanterns = lanterns;
    this.lanternAngles = new Float32Array(lanterns.length * 2);
    this.lv = new Float32Array(lanterns.length * 2);
  }

  /** Air speed the car (and its thrusters) push at a point: near-wake u ≈ 0.35·v·min(1,(1.5/r)²). */
  private gust(px: number, py: number, pz: number, src: WindSource, out: { x: number; y: number; z: number }) {
    const dx = px - src.x, dy = py - (src.y + 1.0), dz = pz - src.z;
    const r = Math.max(0.5, Math.hypot(dx, dy, dz) - 1.2);
    const v = Math.hypot(src.vx, src.vz);
    const k = 0.35 * Math.min(1, (1.5 / r) ** 2);
    out.x = src.vx * k; out.z = src.vz * k; out.y = 0;
    if (src.jumpJet && Math.hypot(dx, dz) < 2.5 && dy > 0) out.y += 6; // jump jets reflected off the road
    if (v < 1 && !src.jumpJet) { out.x = 0; out.z = 0; }
  }

  step(dt: number, src: WindSource) {
    const T = CABLE_TUNING;
    this.t += dt;
    const g = { x: 0, y: 0, z: 0 };
    const storm = T.stormWind * (1 + 0.5 * Math.max(0, Math.sin(this.t * 1.3)) * Math.max(0, Math.sin(this.t * 0.37 + 1)));
    let active = 0;
    for (const s of this.spans) {
      const near = Math.hypot(s.mx - src.x, s.mz - src.z) < T.simRadius && active + s.n + 1 <= T.maxPoints;
      const sx = -s.uz, sz = s.ux; // sideways unit (horizontal, ⟂ to the span)
      if (!near) {
        // ease back to rest over ~1 s, then the span costs nothing
        if (Math.abs(this.d[(s.off + (s.n >> 1)) * 2 + 1]) + Math.abs(this.d[(s.off + (s.n >> 1)) * 2]) < 1e-4) continue;
        for (let i = 0; i <= s.n; i++) {
          const j = (s.off + i) * 2;
          this.d[j] *= 0.95; this.d[j + 1] *= 0.95; this.dp[j] = this.d[j]; this.dp[j + 1] = this.d[j + 1];
          this.write(s.off + i, sx, sz);
        }
        continue;
      }
      active += s.n + 1;
      const inv = 1 / (s.dx * s.dx);
      for (let i = 1; i < s.n; i++) {
        const p = s.off + i, j = p * 2, k = p * 3;
        this.gust(this.rest[k], this.rest[k + 1], this.rest[k + 2], src, g);
        // car-made wind is real-sized air speed, its force ×gustMul (real effect is invisible); storm is real
        const side = g.x * sx + g.z * sz, up = g.y;
        const aUp = WIRE_ACC * up * Math.abs(up) * T.gustMul;
        const aSide = WIRE_ACC * (side * Math.abs(side) * T.gustMul + storm * storm);
        this.acc[j] = s.c2 * (this.d[j - 2] + this.d[j + 2] - 2 * this.d[j]) * inv + aUp;
        this.acc[j + 1] = s.c2 * (this.d[j - 1] + this.d[j + 3] - 2 * this.d[j + 1]) * inv - (G / s.ell[i]) * this.d[j + 1] + aSide;
      }
      for (let i = 1; i < s.n; i++) {
        const j = (s.off + i) * 2;
        for (let c = 0; c < 2; c++) {
          const v = (this.d[j + c] - this.dp[j + c]) * T.damp;
          this.dp[j + c] = this.d[j + c];
          this.d[j + c] += v + this.acc[j + c] * dt * dt;
        }
        this.write(s.off + i, sx, sz);
      }
    }
    this.activePoints = active;
    // lanterns: damped small-angle spherical pendulum, ζ 0.05
    for (let i = 0; i < this.lanterns.length; i++) {
      const l = this.lanterns[i];
      if (Math.hypot(l.x - src.x, l.z - src.z) > T.simRadius) continue;
      this.gust(l.x, l.y, l.z, src, g);
      const w0 = Math.sqrt(G / l.length);
      for (let c = 0; c < 2; c++) {
        const u = (c === 0 ? g.x : g.z) + (c === 1 ? storm * 0.5 : 0);
        const th = this.lanternAngles[i * 2 + c];
        const a = -w0 * w0 * Math.sin(th) - 2 * 0.05 * w0 * this.lv[i * 2 + c] + (LANTERN_K * u * Math.abs(u) * Math.cos(th)) / l.length;
        this.lv[i * 2 + c] += a * dt;
        this.lanternAngles[i * 2 + c] = Math.max(-1.05, Math.min(1.05, th + this.lv[i * 2 + c] * dt)); // cap 60°
      }
    }
  }

  private write(p: number, sx: number, sz: number) {
    const k = p * 3, j = p * 2;
    this.positions[k] = this.rest[k] + sx * this.d[j + 1];
    this.positions[k + 1] = this.rest[k + 1] + this.d[j];
    this.positions[k + 2] = this.rest[k + 2] + sz * this.d[j + 1];
  }
}
