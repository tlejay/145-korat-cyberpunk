// Third-person chase camera (GAMEPLAY §3 + PHYSICS §3.3): critically damped springs, FOV from speed /
// boost / longitudinal g, shake from events, and a wall raycast so it never sits inside a building.
import * as THREE from 'three';
import { DEG, KMH, TUNING } from './config.js';
import type { CarPhysics } from './physics.js';

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// Critically damped spring toward a moving target (ω = stiffness in rad/s).
function spring(pos: number, vel: number, target: number, omega: number, dt: number): [number, number] {
  const acc = omega * omega * (target - pos) - 2 * omega * vel;
  vel += acc * dt;
  return [pos + vel * dt, vel];
}

export class ChaseCamera {
  /** Settings "ลดการสั่นกล้อง" → 0.3 (game-ui sets it). */
  shakeScale = 1;
  /** Extra vertical FOV for narrow (tablet) screens is added automatically. */
  private p = new THREE.Vector3();
  private v = new THREE.Vector3();
  private look = new THREE.Vector3();
  private yaw = 0;
  private yawVel = 0;
  private boostK = 0;
  private distK = 1; // 0..1 how much of the wanted distance the wall raycast allows (eases back)
  private shake = 0;
  private shakeT = 0;
  private snapNext = true;
  private seen = { boost: 0, launch: 0, land: 0, impact: 0 };
  private tmp = new THREE.Vector3();

  constructor(private phys: CarPhysics) {}

  snap() { this.snapNext = true; }

  private bump(amp: number, dur: number) {
    if (amp * this.shakeScale > this.shake) { this.shake = amp * this.shakeScale; this.shakeT = dur; }
  }

  update(dt: number, cam: THREE.PerspectiveCamera) {
    const T = TUNING, c = this.phys, tel = c.tel;
    dt = Math.min(dt, 0.1);
    const speed = c.speed, kmh = speed * KMH;
    const fx = Math.sin(c.heading), fz = -Math.cos(c.heading);
    const u = c.vx * fx + c.vz * fz;

    // ── events → shake ──
    const ev = tel.events;
    if (ev.boost !== this.seen.boost) { this.seen.boost = ev.boost; this.bump(0.04, 0.15); }
    if (ev.launch !== this.seen.launch) { this.seen.launch = ev.launch; this.bump(0.05, 0.15); }
    if (ev.land !== this.seen.land) {
      this.seen.land = ev.land;
      const vy = -(tel.lastLand?.vyMs ?? 0);
      this.bump(Math.min(0.08, 0.01 * vy), 0.2);
    }
    const imp = c.lastImpact;
    if (imp && imp.seq !== this.seen.impact) {
      this.seen.impact = imp.seq;
      if (imp.kind !== 'monument') this.bump(Math.min(0.12, imp.impulse / 250000), 0.3); // no shake at the Ya Mo plaza edge
    }
    if (tel.launch.active || tel.g.long > 3) this.bump(0.01, 0.05);

    // ── yaw: heading, mixed toward the travel direction while drifting ──
    let yawT = c.heading;
    if (c.drifting && speed > 3) {
      const chi = Math.atan2(c.vx, -c.vz);
      yawT = c.heading + wrap(chi - c.heading) * T.camDriftVelMix;
    }
    if (this.snapNext) { this.yaw = yawT; this.yawVel = 0; }
    const dYaw = wrap(yawT - this.yaw);
    this.yawVel += (T.camYawOmega * T.camYawOmega * dYaw - 2 * T.camYawOmega * this.yawVel) * dt;
    this.yaw = wrap(this.yaw + this.yawVel * dt);

    // ── distance / height ──
    this.boostK += ((tel.boosting ? 1 : 0) - this.boostK) * Math.min(1, dt / (tel.boosting ? 0.2 : 0.6));
    const vFrac = Math.min(1, Math.max(0, u) / (T.vMaxKmh / KMH));
    const gPull = Math.min(T.camPullMax, Math.max(0, tel.g.long) * T.camPullPerG);
    const ground = c.y; // chassis ground reference; the ω 4 vertical spring softens jumps
    let dist = T.camDist + (T.camDistMax - T.camDist) * vFrac + T.camBoostDist * this.boostK + gPull + (c.airborne ? T.camJumpDist : 0);
    const yx = Math.sin(this.yaw), yz = -Math.cos(this.yaw);
    const lookAheadDir = speed > 2 && u > 0 ? Math.atan2(c.vx, -c.vz) : c.heading;
    const lx = c.x + Math.sin(lookAheadDir) * T.camLookAhead, lz = c.z - Math.cos(lookAheadDir) * T.camLookAhead;
    let ly = ground + T.camLookUp;
    if (c.airborne && tel.apexM > 1) ly -= Math.tan(T.camJumpPitchDeg * DEG) * dist; // look down at the landing spot

    // ── wall raycast: pull in instantly, ease back over camReturnS ──
    const wantX = c.x - yx * dist, wantZ = c.z - yz * dist;
    const frac = c.raycastWalls(c.x, c.z, wantX, wantZ, 2.5);
    const allowed = frac < 1 ? Math.max(0, (frac * dist - 0.3) / dist) : 1;
    if (allowed < this.distK) this.distK = allowed;
    else this.distK += (allowed - this.distK) * Math.min(1, dt / T.camReturnS);
    dist *= this.distK;
    let raise = 0;
    if (dist < T.camMinDist) { raise = Math.min(T.camMaxRaise, (T.camMinDist - dist) * 2); dist = T.camMinDist * 0.5 + dist * 0.5; }
    const tx = c.x - yx * dist, tz = c.z - yz * dist, ty = ground + T.camHeight + raise;

    // ── springs (ω 8 horizontal, 4 vertical), snap on reset, clamp per-frame travel ──
    if (this.snapNext) {
      this.p.set(tx, ty, tz); this.v.set(0, 0, 0); this.look.set(lx, ly, lz);
      this.snapNext = false;
    } else {
      const ox = this.p.x, oy = this.p.y, oz = this.p.z;
      [this.p.x, this.v.x] = spring(this.p.x, this.v.x, tx, T.camOmegaXZ, dt);
      [this.p.z, this.v.z] = spring(this.p.z, this.v.z, tz, T.camOmegaXZ, dt);
      [this.p.y, this.v.y] = spring(this.p.y, this.v.y, ty, T.camOmegaY, dt);
      if (frac < 1) { this.p.x = tx; this.p.z = tz; } // blocked → place at the hit point this frame
      const mv = Math.hypot(this.p.x - ox, this.p.y - oy, this.p.z - oz);
      if (mv > T.camMaxStep) { const k = T.camMaxStep / mv; this.p.set(ox + (this.p.x - ox) * k, oy + (this.p.y - oy) * k, oz + (this.p.z - oz) * k); }
      const kl = 1 - Math.exp(-T.camOmegaXZ * dt);
      this.look.x += (lx - this.look.x) * kl; this.look.z += (lz - this.look.z) * kl;
      this.look.y += (ly - this.look.y) * (1 - Math.exp(-T.camOmegaY * dt));
    }

    // ── shake ──
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const t = performance.now() / 1000;
      sx = Math.sin(t * 71) * this.shake; sy = Math.sin(t * 53 + 1.3) * this.shake;
      if (this.shakeT <= 0) this.shake = 0;
    }
    cam.position.set(this.p.x + sx * yz, this.p.y + sy, this.p.z - sx * yx);
    this.tmp.copy(this.look);
    cam.lookAt(this.tmp);

    // ── FOV: speed + boost + longitudinal g (+5° on narrow screens) ──
    const fov = Math.min(
      T.fovCap,
      T.fovBase + (T.fovMax - T.fovBase) * Math.min(1, kmh / T.vMaxKmh) + T.fovBoost * this.boostK +
        Math.min(T.fovPerGMax, Math.max(0, tel.g.long) * T.fovPerG) + (cam.aspect < 1.7 ? 5 : 0),
    );
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt / (fov > cam.fov ? 0.15 : 0.6));
      cam.updateProjectionMatrix();
    }
  }
}
