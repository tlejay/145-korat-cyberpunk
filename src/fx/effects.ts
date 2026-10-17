// Car VFX simulation: cold-gas plume (jet.ts physics), tyre smoke / wet spray, splashes, sparks.
// All particles live in two fixed pools (soft + spark) → 2 draw calls, zero per-frame allocation.
import { A_STRIDE, type ParticlePool } from './particles.js';
import { CondensationTable, JET, dilution, eqDiameter, jetK, massFlow } from './jet.js';
import type { WindField } from './wind.js';

export const MODE_JET = 1, MODE_BALLISTIC = 2;

export const FX_TUNING = {
  emitPerKg: 6,        // plume particles per kg of gas (each particle ≈ 170 g of jet gas + its entrained air)
  coneDeg: 7,          // spread of particle axes inside the 12° jet
  mixTauS: 1.2,        // turbulent mixing after the jet has slowed: D grows ×(1 + t/τ)
  rainScav: 0.6,       // 1/s extra fade from raindrops sweeping the fog out (× rain 0..1)
  plumeAlpha: 0.48,
  maxRadius: 2.6,      // m — caps fill-rate cost of huge puffs near the camera
  maxLife: 3.2,
  groundEffectM: 2,    // nozzle-to-road distance where the jet visibly fans out as a ground ring
};

/** One nozzle as seen by the emitter (world space, refreshed each frame). */
export interface NozzleState { x: number; y: number; z: number; dx: number; dy: number; dz: number; acc: number }

export class Effects {
  readonly cond = new CondensationTable();
  qualityMul = 1;
  rain = 0;
  /** QA: total plume mass flow right now (kg/s) and live plume particles. */
  plume = { massFlowKgS: 0, particles: 0, groundEffect: false, rearKgS: 0, liftKgS: 0 };

  constructor(private soft: ParticlePool, private sparks: ParticlePool, private wind: WindField) {
    this.cond.build(JET.rhDry);
  }

  setRain(r: number) { this.rain = r; this.cond.build(r > 0 ? JET.rhRain : JET.rhDry); }

  /**
   * Emit from one nozzle for this frame. thrustN = this nozzle's thrust. Car velocity (cvx..) is added to
   * the gas exit velocity (the jet leaves the moving car), so a plume behind a fast car is left hanging
   * in the air while the car drives away — the trail in the kickflip photo.
   */
  emitJet(nz: NozzleState, thrustN: number, dt: number, cvx: number, cvy: number, cvz: number, groundY: number) {
    const md = massFlow(thrustN);
    if (md <= 0) { nz.acc = 0; return 0; }
    const dEq = eqDiameter(md), K = jetK(dEq), x0 = 6 * dEq;
    // particle life: until the mixture is too diluted to stay condensed
    const xEnd = ((this.cond.visibleUntilD - 1) * dEq) / 0.32;
    const life = Math.min(FX_TUNING.maxLife, Math.max(0.5, (xEnd * xEnd - x0 * x0) / (2 * K)));
    nz.acc += md * FX_TUNING.emitPerKg * this.qualityMul * dt;
    // cap per frame so a 0.4 s jump burst cannot flush the whole pool (excess flow is dropped, not queued)
    const maxN = Math.max(2, Math.round(this.soft.cap * dt * 1.2));
    const n = Math.min(maxN, Math.floor(nz.acc));
    nz.acc = Math.min(1, nz.acc - n);
    const spread = (FX_TUNING.coneDeg * Math.PI) / 180;
    // exhaust axis in world, with the car's velocity added to ve
    for (let k = 0; k < n; k++) {
      let dx = nz.dx * JET.ve + cvx, dy = nz.dy * JET.ve + cvy, dz = nz.dz * JET.ve + cvz;
      const l = Math.hypot(dx, dy, dz);
      dx /= l; dy /= l; dz /= l;
      // random direction inside the cone (two perpendicular jitters)
      const px = -dz, pz = dx, pl = Math.hypot(px, pz) || 1;
      const j1 = (Math.random() * 2 - 1) * spread, j2 = (Math.random() * 2 - 1) * spread;
      dx += (px / pl) * j1; dz += (pz / pl) * j1; dy += j2;
      const l2 = Math.hypot(dx, dy, dz); dx /= l2; dy /= l2; dz /= l2;
      const i = this.soft.spawn(MODE_JET, life * (0.8 + Math.random() * 0.4), 0.94, 0.95, 1.0);
      const age = Math.random() * dt; // spread spawns over the frame (sub-frame emission)
      const a = this.soft.a, b = i * A_STRIDE;
      a[b] = nz.x - cvx * age; a[b + 1] = nz.y - cvy * age; a[b + 2] = nz.z - cvz * age;
      a[b + 3] = dx; a[b + 4] = dy; a[b + 5] = dz;
      a[b + 6] = K; a[b + 7] = x0; a[b + 8] = dEq;
      a[b + 9] = dy < -0.02 ? (a[b + 1] - groundY) / -dy : 1e9; // distance to the road along the axis
      a[b + 10] = groundY;
      a[b + 11] = Math.random() * Math.PI * 2;
      this.soft.t[i] = age;
    }
    return md;
  }

  /** Ballistic soft particle (smoke / spray / splash). */
  puff(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size0: number, grow: number, drag: number, grav: number, alpha: number, r: number, g: number, b: number, groundY: number) {
    const i = this.soft.spawn(MODE_BALLISTIC, life, r, g, b);
    const p = this.soft.p, v = this.soft.v, a = this.soft.a, k = i * 3, q = i * A_STRIDE;
    p[k] = x; p[k + 1] = y; p[k + 2] = z; v[k] = vx; v[k + 1] = vy; v[k + 2] = vz;
    a[q] = drag; a[q + 1] = grow; a[q + 2] = grav; a[q + 3] = alpha; a[q + 4] = size0; a[q + 10] = groundY;
  }

  spark(x: number, y: number, z: number, vx: number, vy: number, vz: number, groundY: number) {
    const i = this.sparks.spawn(MODE_BALLISTIC, 0.25 + Math.random() * 0.35, 1.0, 0.86 + Math.random() * 0.1, 0.55 + Math.random() * 0.3);
    const p = this.sparks.p, v = this.sparks.v, k = i * 3;
    p[k] = x; p[k + 1] = y; p[k + 2] = z; v[k] = vx; v[k + 1] = vy; v[k + 2] = vz;
    this.sparks.a[i * A_STRIDE + 10] = groundY;
    this.sparks.size[i] = 0.035;
  }

  step(dt: number) {
    const s = this.soft, a = s.a, P = s.p, O = s.o, W = this.wind;
    const storm = W.stormNow(), sdx = W.dirX * storm, sdz = W.dirZ * storm;
    const scav = FX_TUNING.rainScav * this.rain;
    let jets = 0;
    for (let i = 0; i < s.cap; i++) {
      if (!s.alive[i]) continue;
      const t = (s.t[i] += dt);
      if (t >= s.life[i]) { s.alive[i] = 0; continue; }
      const k = i * 3, q = i * A_STRIDE;
      if (s.mode[i] === MODE_JET) {
        jets++;
        const K = a[q + 6], x0 = a[q + 7], dEq = a[q + 8], sh = a[q + 9], gy = a[q + 10];
        const x = Math.sqrt(x0 * x0 + 2 * K * t), sAlong = x - x0;
        const u = K / x; // local jet speed (m/s)
        if (sAlong < sh) {
          P[k] = a[q] + a[q + 3] * sAlong; P[k + 1] = a[q + 1] + a[q + 4] * sAlong; P[k + 2] = a[q + 2] + a[q + 5] * sAlong;
        } else {
          // impinging jet → radial wall jet hugging the road (ground effect ring)
          const rem = sAlong - sh;
          let hx = a[q + 3], hz = a[q + 5];
          const hl = Math.hypot(hx, hz);
          const az = a[q + 11];
          hx = (hl > 0.3 ? hx / hl : 0) + Math.cos(az) * (hl > 0.3 ? 0.6 : 1);
          hz = (hl > 0.3 ? hz / hl : 0) + Math.sin(az) * (hl > 0.3 ? 0.6 : 1);
          const n = Math.hypot(hx, hz) || 1, rr = Math.sqrt(rem) * 1.6; // wall jets decay faster (r ∝ √s)
          P[k] = a[q] + a[q + 3] * sh + (hx / n) * rr;
          P[k + 1] = gy + 0.15 + Math.min(1.2, 0.12 * rem);
          P[k + 2] = a[q + 2] + a[q + 5] * sh + (hz / n) * rr;
        }
        // once the jet has slowed, the cloud drifts with the storm, the car's wake, and sinks (cold = dense)
        const slow = 3 / (u + 3);
        W.field(P[k] + O[k], P[k + 1] + O[k + 1], P[k + 2] + O[k + 2], tmp);
        O[k] += (sdx + tmp.x * 0.5) * slow * dt;
        O[k + 1] += (-0.25 * Math.exp(-t) + tmp.y * 0.3) * slow * dt;
        O[k + 2] += (sdz + tmp.z * 0.5) * slow * dt;
        const D = dilution(x, dEq) * (1 + t / FX_TUNING.mixTauS);
        const r = Math.min(FX_TUNING.maxRadius, 0.5 * dEq + 0.21 * Math.min(sAlong, sh + Math.sqrt(Math.max(0, sAlong - sh))) + 0.35 * t);
        s.size[i] = r;
        if (P[k + 1] + O[k + 1] < gy + 0.35 * r) O[k + 1] = gy + 0.35 * r - P[k + 1];
        const fadeIn = Math.min(1, t * 20);
        s.alpha[i] = this.cond.at(D) * FX_TUNING.plumeAlpha * fadeIn * Math.exp(-scav * t) * Math.min(1, (s.life[i] - t) * 3);
      } else {
        const drag = a[q], grow = a[q + 1], grav = a[q + 2], al = a[q + 3], gy = a[q + 10];
        const V = s.v, f = Math.exp(-drag * dt);
        V[k] = V[k] * f + sdx * (1 - f) * 0.5; V[k + 1] = V[k + 1] * f - grav * dt; V[k + 2] = V[k + 2] * f + sdz * (1 - f) * 0.5;
        P[k] += V[k] * dt; P[k + 1] += V[k + 1] * dt; P[k + 2] += V[k + 2] * dt;
        if (P[k + 1] < gy + 0.05) { P[k + 1] = gy + 0.05; V[k + 1] = Math.abs(V[k + 1]) * 0.1; }
        s.size[i] = Math.min(FX_TUNING.maxRadius, a[q + 4] + grow * t);
        const u = t / s.life[i];
        s.alpha[i] = al * Math.min(1, t * 12) * (1 - u) * (1 - u) * Math.exp(-scav * 0.5 * t);
      }
    }
    this.plume.particles = jets;
    // sparks: ballistic + bounce, brightness fades
    const sp = this.sparks, SP = sp.p, SV = sp.v;
    for (let i = 0; i < sp.cap; i++) {
      if (!sp.alive[i]) continue;
      const t = (sp.t[i] += dt);
      if (t >= sp.life[i]) { sp.alive[i] = 0; continue; }
      const k = i * 3;
      SV[k + 1] -= 9.81 * dt;
      SP[k] += SV[k] * dt; SP[k + 1] += SV[k + 1] * dt; SP[k + 2] += SV[k + 2] * dt;
      const gy = sp.a[i * A_STRIDE + 10];
      if (SP[k + 1] < gy) { SP[k + 1] = gy; SV[k + 1] *= -0.35; SV[k] *= 0.6; SV[k + 2] *= 0.6; }
      sp.alpha[i] = 1 - t / sp.life[i];
    }
  }
}

const tmp = { x: 0, y: 0, z: 0 };
