// Checkpoint gameplay + physics, three.js-free (headless-tested by scripts/test-checkpoint.mjs).
// Korat's famous alcohol checkpoints (ด่านตรวจ) as a jump-over / smash-through show piece:
// no people, nothing blocks the race — props fly, the car loses a little speed, never stops.
import { Body, collidePair, PROPS, type PropKind } from './bodies.js';

type V2 = { x: number; z: number };

/** A site is anchored to a world point (snapped to the centreline) so moving the start line never moves it. */
export interface SiteDef { id: number; name: string; road: string; at: V2 }

// Tle 20:55: the lap starts south of the Ya Mo plaza; the first checkpoint comes soon after leaving the
// plaza zone (an easy one to learn the jump), the second stays on the Manat straight. Both are straights
// far from the monument / Chumphon gate / temples where the car is fast enough (REPORT-checkpoint §1).
export const SITES: SiteDef[] = [
  { id: 1, name: 'ด่านถนนราชดำเนิน', road: 'ถนนราชดำเนิน', at: { x: -49.5, z: -245 } }, // ~150 m north of the plaza zone, ~285 m before the NW gate
  { id: 2, name: 'ด่านถนนมนัส', road: 'ถนนมนัส', at: { x: 550, z: -151.3 } },           // ~445 m after the Manat corner, ~550 m east of the plaza
];

export const CP = {
  approachM: 170,       // "ด่านข้างหน้า!" toast distance (to the first cone)
  cueAheadS: 0.19,      // underbody passes 1.5 m about 0.19 s after take-off (jumpVy 9.2, g 12)
  cueAirS: 1.34,        // … and is back below 1.5 m after 1.34 s (no hover)
  clearM: 1.5,          // tallest prop is the A-frame + siren 1.43 m
  carHalfL: 2.3, carHalfW: 1.0, carBottom: 0.11, carTop: 1.2, carMass: 2000,
  maxLossPerPass: 0.2,  // BRIEF: −10…20 % speed, never a stop
  resetBehindM: 60,     // props restore once the site is this far behind the car (out of view)
  stepHz: 120,
  jetRadiusM: 2.6,      // ground-reflected thruster wind (PHYSICS §5.3: jump plume ~6 m/s at 2.5 m, amplified near the nozzle)
  clearPoints: 300,     // style suggestion for the integrator (GAMEPLAY §6 scale: clean landing 250, moat 500)
};

export const TEXT = {
  approach: 'ด่านข้างหน้า! กระโดดข้าม',
  clear: 'ข้ามด่าน',
  smash: { cone: 'ฝ่าด่าน! กรวยกระจาย', barricade: 'ฝ่าด่าน! แผงกั้นปลิว', aframe: 'ชนป้ายหยุดตรวจ เสียความเร็ว', many: 'ด่านแตก! คราวหน้ากระโดดนะ' },
  blown: 'ลมไอพ่นพัดกรวยล้ม',
};

export interface CarView {
  x: number; y: number; z: number; heading: number;  // heading 0 = north (−z), clockwise +
  vx: number; vy: number; vz: number;
  airborne: boolean;
  liftN: number;        // downward thruster force (hover / landing burn) — jet wind on cones
  jumpSeq: number;      // increments on every jump take-off
}

export interface CarControl {
  /** Scale horizontal velocity (speed loss on a smash). */
  slow(frac: number): void;
  /** Push the car out of a static obstacle and set its new horizontal velocity. */
  push(dx: number, dz: number, vx: number, vz: number): void;
}

export interface TrackView {
  centerline: V2[];
  heightAt(x: number, z: number): number;
  barriers?: { a: V2; b: V2; h?: number; kind?: string }[];
}

export type CheckpointEventType = 'approach' | 'cue' | 'clear' | 'smash' | 'hit' | 'blown' | 'reset';

export interface PropSlot { kind: PropKind; u: number; v: number; batonHot?: boolean }

export class Site {
  def: SiteDef;
  ox = 0; oz = 0; tx = 0; tz = -1; nx = 1; nz = 0; ground = 0;
  halfW = 6;
  u0 = 0; u1 = 0;        // hazard span along the road (first cone base → last barricade foot)
  bodies: Body[] = [];
  slots: PropSlot[] = [];
  truck = { u: 0, v: 0, halfL: 2.65, halfW: 0.95, h: 1.85, x: 0, z: 0 };
  // per-pass state
  phase: 'far' | 'approach' | 'inside' = 'far';
  hits = 0; kinds = new Set<string>(); loss = 0; speedIn = 0; airAll = true; minClear = 99; pass = 0;
  dirty = false; cue: 'none' | 'slow' | 'early' | 'now' | 'late' = 'none';
  constructor(def: SiteDef) { this.def = def; }

  toWorld(u: number, v: number, out: V2) { out.x = this.ox + this.tx * u + this.nx * v; out.z = this.oz + this.tz * u + this.nz * v; return out; }
  local(x: number, z: number, out: { u: number; v: number }) {
    const dx = x - this.ox, dz = z - this.oz;
    out.u = dx * this.tx + dz * this.tz; out.v = dx * this.nx + dz * this.nz;
    return out;
  }
}

/** Real checkpoint arrangement (refs/sponsors/checkpoint-scene-ref.png) in road-local metres. */
export function layout(halfW: number): { slots: PropSlot[]; truck: { u: number; v: number } } {
  const slots: PropSlot[] = [];
  const edge = halfW - 0.45, neck = 1.7;
  // two cone tapers funnelling into the middle (gaps 1.4 m < car width → you can't thread it)
  for (let k = 0; k < 6; k++) {
    const u = -7 + k * 1.6, v = edge - ((edge - neck) * k) / 5;
    slots.push({ kind: 'cone', u, v: -v, batonHot: k % 2 === 0 }, { kind: 'cone', u, v, batonHot: k % 2 === 1 });
  }
  // two A-frame "หยุดตรวจ" signs in the funnel
  slots.push({ kind: 'aframe', u: -2.6, v: -1.05 }, { kind: 'aframe', u: -2.6, v: 1.05 });
  // three steel barricades "จุดสกัด" closing the neck
  slots.push({ kind: 'barricade', u: 2.2, v: 0 }, { kind: 'barricade', u: 2.65, v: -2.55 }, { kind: 'barricade', u: 2.65, v: 2.55 });
  // police-style pickup parked on the left shoulder beyond the barricades (static, generic, no insignia)
  return { slots, truck: { u: 7.2, v: -(halfW - 1.1) } };
}

type Listener = (type: CheckpointEventType, detail: Record<string, unknown>) => void;

export class CheckpointSim {
  sites: Site[] = [];
  bodies: Body[] = [];
  private emit: Listener;
  private acc = 0;
  private prevCar = { x: 0, z: 0, y: 0, heading: 0, ok: false };
  private lastJumpSeq = -1;
  private jumpWindT = 0;
  private lu = { u: 0, v: 0 };
  private pendingLoss = 0;
  lastMs = 0;
  msHist: number[] = [];
  steps = 0;

  constructor(track: TrackView, emit: Listener, defs: SiteDef[] = SITES) {
    this.emit = emit;
    const cl = track.centerline;
    const cum: number[] = [0];
    for (let i = 1; i < cl.length; i++) cum.push(cum[i - 1] + Math.hypot(cl[i].x - cl[i - 1].x, cl[i].z - cl[i - 1].z));
    const nearestS = (p: V2) => {
      let best = Infinity, bs = 0;
      for (let i = 0; i < cl.length; i++) { const d = (cl[i].x - p.x) ** 2 + (cl[i].z - p.z) ** 2; if (d < best) { best = d; bs = cum[i]; } }
      return bs;
    };
    const at = (s: number): V2 => {
      let i = 1;
      while (i < cl.length - 1 && cum[i] < s) i++;
      const t = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      return { x: cl[i - 1].x + (cl[i].x - cl[i - 1].x) * t, z: cl[i - 1].z + (cl[i].z - cl[i - 1].z) * t };
    };
    for (const def of defs) {
      const site = new Site(def);
      const s0 = nearestS(def.at);
      const a = at(s0 - 15), b = at(s0 + 15), o = at(s0);
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      site.ox = o.x; site.oz = o.z; site.tx = (b.x - a.x) / l; site.tz = (b.z - a.z) / l;
      site.nx = -site.tz; site.nz = site.tx; // right-hand side of travel (+v)
      site.ground = track.heightAt(o.x, o.z);
      site.halfW = roadHalfWidth(site, track);
      const L = layout(site.halfW);
      site.slots = L.slots;
      const yaw = Math.atan2(-site.tx, -site.tz); // body +z faces the oncoming car
      const p = { x: 0, z: 0 };
      for (const slot of L.slots) {
        const body = new Body(PROPS[slot.kind]);
        site.toWorld(slot.u, slot.v, p);
        body.place(p.x, track.heightAt(p.x, p.z), p.z, yaw + (slot.kind === 'cone' ? slot.u * 0.7 : 0));
        site.bodies.push(body);
        this.bodies.push(body);
      }
      let u0 = Infinity, u1 = -Infinity;
      for (const s of L.slots) {
        const r = s.kind === 'cone' ? 0.2 : s.kind === 'aframe' ? 0.32 : 0.25;
        u0 = Math.min(u0, s.u - r); u1 = Math.max(u1, s.u + r);
      }
      site.u0 = u0; site.u1 = u1;
      site.truck.u = L.truck.u; site.truck.v = L.truck.v;
      site.toWorld(L.truck.u, L.truck.v, p);
      site.truck.x = p.x; site.truck.z = p.z;
      this.sites.push(site);
    }
  }

  reset() {
    for (const s of this.sites) this.resetSite(s);
    this.prevCar.ok = false;
    this.pendingLoss = 0;
  }

  private resetSite(s: Site) {
    for (const b of s.bodies) b.resetHome();
    s.phase = 'far'; s.dirty = false; s.hits = 0; s.loss = 0; s.cue = 'none';
    this.emit('reset', { site: s.def.id });
  }

  /** One frame. Car state is the post-physics pose of this frame. */
  update(dt: number, car: CarView, ctl: CarControl | null) {
    const t0 = now();
    dt = Math.min(dt, 0.1);
    const prev = this.prevCar;
    const teleport = !prev.ok || Math.hypot(car.x - prev.x, car.z - prev.z) > 15;
    if (teleport) { prev.x = car.x; prev.z = car.z; prev.y = car.y; prev.heading = car.heading; prev.ok = true; }

    if (car.jumpSeq !== this.lastJumpSeq) { if (this.lastJumpSeq >= 0) this.jumpWindT = 0.4; this.lastJumpSeq = car.jumpSeq; }
    else this.jumpWindT = Math.max(0, this.jumpWindT - dt);

    // fixed substeps; the car pose is interpolated across them so a 230 km/h car can't tunnel a cone
    let near = false;
    for (const s of this.sites) {
      const d = Math.hypot(car.x - s.ox, car.z - s.oz);
      if (d < 40) near = true;
      this.gameplay(s, car, teleport);
    }
    let active = near;
    if (!active) for (const b of this.bodies) if (b.awake) { active = true; break; }
    if (active) {
      const h = 1 / CP.stepHz;
      this.acc += dt;
      let n = Math.floor(this.acc / h);
      if (n > 12) { n = 12; this.acc = 0; } else this.acc -= n * h;
      for (let i = 1; i <= n; i++) this.step(h, car, ctl, i / n, near);
    } else this.acc = 0;

    if (ctl && this.pendingLoss > 1e-4) {
      const k = this.pendingLoss * Math.min(1, dt / 0.35);
      ctl.slow(1 - k);
      this.pendingLoss -= k;
    }
    if (ctl && near) this.truckCollide(car, ctl);
    prev.x = car.x; prev.z = car.z; prev.y = car.y; prev.heading = car.heading;

    this.lastMs = now() - t0;
    this.msHist.push(this.lastMs);
    if (this.msHist.length > 240) this.msHist.shift();
  }

  private step(h: number, car: CarView, ctl: CarControl | null, f: number, near: boolean) {
    this.steps++;
    const prev = this.prevCar;
    const cx = prev.x + (car.x - prev.x) * f, cz = prev.z + (car.z - prev.z) * f, cy = prev.y + (car.y - prev.y) * f;
    const hd = prev.heading + wrap(car.heading - prev.heading) * f;
    // jet wind (hover / landing burn / take-off blast) on nearby props
    const wind = car.liftN > 0 || this.jumpWindT > 0;
    for (const site of this.sites) {
      const g = site.ground;
      for (const b of site.bodies) {
        if (near) this.carContact(b, site, cx, cy, cz, hd, car, ctl);
        if (wind) this.jetWind(b, site, car, cx, cy, cz, h);
      }
      // props knock each other (only pairs with an awake member)
      const bs = site.bodies;
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) if (bs[i].awake || bs[j].awake) collidePair(bs[i], bs[j]);
      for (const b of bs) {
        if (!b.awake) continue;
        b.integrate(h);
        b.ground(g, h);
        this.keepOnRoad(b, site);
        b.trySleep(h);
      }
    }
  }

  /** Car = oriented box; any prop hull point inside it is pushed out with a mass-correct impulse. */
  private carContact(b: Body, site: Site, cx: number, cy: number, cz: number, hd: number, car: CarView, ctl: CarControl | null) {
    const dx0 = b.px - cx, dz0 = b.pz - cz;
    if (dx0 * dx0 + dz0 * dz0 > 16) return;
    const fx = Math.sin(hd), fz = -Math.cos(hd), rx = -fz, rz = fx; // forward, right
    const hull = b.def.hull, yBot = cy + CP.carBottom, yTop = cy + CP.carTop;
    let best = -1, bnx = 0, bny = 0, bnz = 0, bpen = 0, brx = 0, bry = 0, brz = 0;
    for (let i = 0; i < hull.length; i += 3) {
      b.rot(hull[i], hull[i + 1], hull[i + 2], S1);
      const wx = b.px + S1[0], wy = b.py + S1[1], wz = b.pz + S1[2];
      if (wy < yBot || wy > yTop) continue;
      const lx = (wx - cx) * fx + (wz - cz) * fz, lz = (wx - cx) * rx + (wz - cz) * rz;
      const pf = CP.carHalfL - Math.abs(lx), ps = CP.carHalfW - Math.abs(lz), pt = yTop - wy;
      if (pf <= 0 || ps <= 0) continue;
      let nx: number, ny: number, nz: number, pen: number;
      if (pt < pf && pt < ps && car.vy < 0) { nx = 0; ny = 1; nz = 0; pen = pt; }            // landing on it
      else if (pf < ps) {
        const sg = Math.sign(lx) || 1;
        // sloped nose / tail: props ride up over the hood instead of being pushed along the road
        nx = fx * sg; nz = fz * sg; ny = 0.45; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l; pen = pf;
      } else { const sg = Math.sign(lz) || 1; nx = rx * sg; ny = 0.15; nz = rz * sg; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l; pen = ps; }
      if (pen > best) { best = pen; bnx = nx; bny = ny; bnz = nz; bpen = pen; brx = S1[0]; bry = S1[1]; brz = S1[2]; }
    }
    if (best < 0) return;
    if (!b.awake) b.wake();
    b.px += bnx * bpen; b.py += Math.max(0, bny) * bpen; b.pz += bnz * bpen;
    b.pointVel(brx, bry, brz, S2);
    const vn = (S2[0] - car.vx) * bnx + (S2[1] - car.vy) * bny + (S2[2] - car.vz) * bnz;
    if (vn >= 0) return;
    const e = b.def.restitution * 0.6; // plastic cone / sheet steel crumple against the nose
    const j = (-(1 + e) * vn) / (b.kAlong(bnx, bny, bnz, brx, bry, brz) + 1 / CP.carMass);
    b.applyImpulse(bnx * j, bny * j, bnz * j, brx, bry, brz);
    const kmh = Math.hypot(car.vx, car.vz) * 3.6;
    if (!b.hitThisPass) {
      b.hitThisPass = true;
      // random-ish yaw spin so a row of cones doesn't fly as one block
      b.wy += (Math.abs(b.px * 13.7 + b.pz * 7.3) % 1) * 6 - 3;
      site.hits++; site.kinds.add(b.def.kind); site.dirty = true;
      // Real momentum transfer is tiny (cone 0.1 %, barricade 0.7 % at 120 km/h) — like the ×8 wind on
      // cables (PHYSICS §5.3) the game amplifies it so a smash is felt, capped at 20 % per pass.
      const room = CP.maxLossPerPass - site.loss;
      const frac = Math.max(0, Math.min(room, b.def.carPenalty));
      // bled off over ~0.35 s (a one-frame cut reads as a 5 g spike on the HUD / camera)
      if (frac > 0 && ctl) { this.pendingLoss += frac; site.loss += frac; }
      this.emit('hit', { site: site.def.id, kind: b.def.kind, impulseNs: Math.round(j), speedKmh: Math.round(kmh), physicalDvKmh: +((j / CP.carMass) * 3.6).toFixed(2) });
    }
  }

  private jetWind(b: Body, site: Site, car: CarView, cx: number, cy: number, cz: number, h: number) {
    const dx = b.px - cx, dz = b.pz - cz, r = Math.hypot(dx, dz);
    if (r > CP.jetRadiusM + 1) return;
    const hAbove = Math.max(0.3, cy - site.ground);
    // free jet decays ~1/x from the nozzle; take-off blast (jumpWindT) is short but strong
    const lift = Math.max(car.liftN / 19000, this.jumpWindT > 0 ? 1.4 : 0);
    const u = Math.min(38, (55 / hAbove) * lift) * Math.max(0, 1 - r / (CP.jetRadiusM + 1));
    if (u < 4) return;
    const F = 0.5 * 1.2 * b.def.dragArea * u * u; // N
    if (F < b.def.mass * 2) return;               // below ~0.2 g nothing moves
    if (!b.awake) { b.wake(); if (b.def.kind === 'cone' && !b.hitThisPass) this.blown(site); }
    const ox = r > 1e-3 ? dx / r : 1, oz = r > 1e-3 ? dz / r : 0;
    // pressure centre at ~60 % of the prop height → tips cones over (they're light and tall)
    b.applyImpulse(ox * F * h, 0.2 * F * h, oz * F * h, 0, b.def.height * 0.6 - b.def.comY, 0);
  }

  private blownT = 0;
  private blown(site: Site) {
    const t = now();
    if (t - this.blownT < 1500) return;
    this.blownT = t;
    site.dirty = true;
    this.emit('blown', { site: site.def.id, text: TEXT.blown });
  }

  /** Props stay between the kerb walls (they'd otherwise fly into shop fronts). */
  private keepOnRoad(b: Body, site: Site) {
    const lu = this.lu;
    site.local(b.px, b.pz, lu);
    const lim = site.halfW - 0.25;
    if (Math.abs(lu.v) <= lim) return;
    const sg = Math.sign(lu.v), over = Math.abs(lu.v) - lim;
    b.px -= site.nx * sg * over; b.pz -= site.nz * sg * over;
    const vn = b.vx * site.nx + b.vz * site.nz;
    if (vn * sg > 0) { b.vx -= site.nx * vn * 1.35; b.vz -= site.nz * vn * 1.35; }
  }

  /** Static pickup: three circles along the car (like car-physics walls) vs the truck rectangle. */
  private truckCollide(car: CarView, ctl: CarControl) {
    const fx = Math.sin(car.heading), fz = -Math.cos(car.heading);
    for (const s of this.sites) {
      const T = s.truck;
      if (car.y - s.ground + CP.carBottom > T.h) continue; // flying over it
      if (Math.hypot(car.x - T.x, car.z - T.z) > 8) continue;
      for (const o of [1.25, 0, -1.25]) {
        const px = car.x + fx * o, pz = car.z + fz * o, r = 1.0;
        const lx = (px - T.x) * s.tx + (pz - T.z) * s.tz, lz = (px - T.x) * s.nx + (pz - T.z) * s.nz;
        const qx = Math.max(-T.halfL, Math.min(T.halfL, lx)), qz = Math.max(-T.halfW, Math.min(T.halfW, lz));
        let dx = lx - qx, dz = lz - qz, d = Math.hypot(dx, dz);
        if (d >= r) continue;
        if (d < 1e-6) { // centre inside: exit through the nearest side
          const ex = T.halfL - Math.abs(lx), ez = T.halfW - Math.abs(lz);
          if (ex < ez) { dx = Math.sign(lx) || 1; dz = 0; d = 0; } else { dx = 0; dz = Math.sign(lz) || 1; d = 0; }
        } else { dx /= d; dz /= d; }
        const pen = r - d + 0.02;
        const nx = s.tx * dx + s.nx * dz, nz = s.tz * dx + s.nz * dz;
        const vn = car.vx * nx + car.vz * nz;
        let vx = car.vx, vz = car.vz;
        if (vn < 0) { vx = (car.vx - vn * nx) * 0.85 - vn * 0.2 * nx; vz = (car.vz - vn * nz) * 0.85 - vn * 0.2 * nz; }
        ctl.push(nx * pen, nz * pen, vx, vz);
        car.x += nx * pen; car.z += nz * pen; car.vx = vx; car.vz = vz;
        if (vn < -1) this.emit('hit', { site: s.def.id, kind: 'truck', impulseNs: Math.round(-vn * CP.carMass), speedKmh: Math.round(-vn * 3.6) });
        break;
      }
    }
  }

  /** Approach toast, jump cue, pass bookkeeping (clear / smash) and out-of-view reset. */
  private gameplay(s: Site, car: CarView, teleport: boolean) {
    const lu = this.lu;
    s.local(car.x, car.z, lu);
    const onRoad = Math.abs(lu.v) < s.halfW + 4;
    const fwd = Math.sin(car.heading) * s.tx - Math.cos(car.heading) * s.tz;
    const speed = Math.max(0, car.vx * s.tx + car.vz * s.tz);
    const toFirst = s.u0 - CP.carHalfL - lu.u; // car nose → first cone

    if (teleport && s.phase !== 'far') s.phase = 'far';
    if (s.phase === 'far' && onRoad && fwd > 0.3 && toFirst > 0 && toFirst < CP.approachM) {
      s.phase = 'approach';
      s.hits = 0; s.kinds.clear(); s.loss = 0; s.airAll = true; s.minClear = 99;
      for (const b of s.bodies) b.hitThisPass = false;
      this.emit('approach', { site: s.def.id, name: s.def.name, distM: Math.round(toFirst), text: TEXT.approach });
    }
    if (s.phase === 'approach') {
      // jump-now window for the current speed: underbody must stay > 1.5 m over the whole hazard span
      // take-off at car centre u: high from u + 0.19 v (≤ u0 − ½L) until u + 1.34 v (≥ u1 + ½L)
      const minD = CP.cueAheadS * speed + CP.carHalfL, maxD = CP.cueAirS * speed - (s.u1 - s.u0) - CP.carHalfL;
      const dist = s.u0 - lu.u; // car centre → first hazard
      let cue: Site['cue'] = car.airborne ? 'none' : maxD < minD ? 'slow' : dist > maxD ? 'early' : dist >= minD ? 'now' : 'late';
      if (!onRoad) cue = 'none';
      if (cue !== s.cue) { s.cue = cue; this.emit('cue', { site: s.def.id, jump: cue, speedKmh: Math.round(speed * 3.6), windowM: Math.max(0, Math.round(maxD - minD)) }); }
      if (lu.u > s.u0 - CP.carHalfL) { s.phase = 'inside'; s.speedIn = speed; if (s.cue !== 'none') { s.cue = 'none'; this.emit('cue', { site: s.def.id, jump: 'none' }); } }
      else if (!onRoad || toFirst > CP.approachM + 40) s.phase = 'far';
    }
    if (s.phase === 'inside') {
      if (lu.u <= s.u1 + CP.carHalfL) {
        if (!car.airborne) s.airAll = false;
        s.minClear = Math.min(s.minClear, car.y - s.ground + CP.carBottom);
      } else {
        s.pass++;
        s.phase = 'far';
        if (s.hits === 0 && s.airAll) {
          this.emit('clear', {
            site: s.def.id, name: s.def.name, pass: s.pass, points: CP.clearPoints,
            text: `${TEXT.clear} +${CP.clearPoints}`, minClearanceM: +s.minClear.toFixed(2), voice: 'vo-great-jump',
          });
        } else if (s.hits > 0) {
          const out = Math.hypot(car.vx, car.vz);
          this.emit('smash', {
            site: s.def.id, name: s.def.name, pass: s.pass, items: s.hits, points: 0,
            speedBeforeKmh: Math.round(s.speedIn * 3.6), speedAfterKmh: Math.round(out * 3.6), lossPct: Math.round(s.loss * 100),
            text: s.hits >= 6 ? TEXT.smash.many : s.kinds.has('barricade') ? TEXT.smash.barricade : s.kinds.has('cone') ? TEXT.smash.cone : TEXT.smash.aframe, audio: 'crash',
          });
        }
      }
      if (!onRoad) s.phase = 'far';
    }
    // restore knocked props once the site is behind the car and out of sight (every lap starts clean)
    if (s.dirty && s.phase === 'far') {
      const behind = (s.ox - car.x) * Math.sin(car.heading) + (s.oz - car.z) * -Math.cos(car.heading) < 0;
      if (behind && Math.hypot(car.x - s.ox, car.z - s.oz) > CP.resetBehindM) {
        let moving = false;
        for (const b of s.bodies) if (b.awake && b.vx * b.vx + b.vz * b.vz > 0.5) moving = true;
        if (!moving) this.resetSite(s);
      }
    }
  }

  stats() {
    const sorted = [...this.msHist].sort((a, b) => a - b);
    return {
      ms: this.lastMs, msP95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      awake: this.bodies.filter((b) => b.awake).length, bodies: this.bodies.length,
      sites: this.sites.map((s) => ({ id: s.def.id, name: s.def.name, x: +s.ox.toFixed(1), z: +s.oz.toFixed(1), halfW: +s.halfW.toFixed(2), passes: s.pass, dirty: s.dirty })),
    };
  }
}

const S1 = new Float64Array(3), S2 = new Float64Array(3);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Distance from the site centre to the nearest tall wall on each side (rails/buildings), min of both. */
function roadHalfWidth(s: Site, track: TrackView): number {
  const bars = track.barriers ?? [];
  let l = 6.3, r = 6.3, found = false;
  for (const w of bars) {
    if (w.kind === 'prop') continue;
    // sample the segment's closest point to the site centre
    const dx = w.b.x - w.a.x, dz = w.b.z - w.a.z, len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((s.ox - w.a.x) * dx + (s.oz - w.a.z) * dz) / len2));
    const px = w.a.x + dx * t - s.ox, pz = w.a.z + dz * t - s.oz;
    const u = px * s.tx + pz * s.tz, v = px * s.nx + pz * s.nz;
    if (Math.abs(u) > 3 || Math.abs(v) > 14 || Math.abs(v) < 3) continue;
    if (!found) { l = r = 99; found = true; }
    if (v < 0) l = Math.min(l, -v); else r = Math.min(r, v);
  }
  return Math.max(4.5, Math.min(l, r, 9));
}
