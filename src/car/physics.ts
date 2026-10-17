// Car dynamics (PHYSICS.md §1–§5). Pure TypeScript, no three.js — runs headless in Node for
// scripts/test-car-physics.mjs. Fixed step (120 Hz from the game loop).
//
// Frames: world x = east, z = south (−north), y = up. heading ψ: 0 = north (−z), clockwise +.
// Body: forward f = (sin ψ, −cos ψ), right r̂ = (cos ψ, sin ψ). Lateral w and yaw rate r are
// right/clockwise-positive (SAE-like, viewed from above), so steering δ > 0 turns right.
//
// Planar: single-track model + Pacejka-lite tyres + friction ellipse, normal loads from the
// load-transfer formula (not the springs — keeps the tyres smooth on phones). Drift: kinematic
// PD on slip angle (GAMEPLAY §2.4) with lateral accel capped by the fan-assisted tyres.
// Vertical: 4 raycast spring-dampers give y / pitch / roll / contact; ballistic when airborne.
import type { InputState, Surface, Track, Vec2 } from '../types.js';
import { DEG, G, KMH, TUNING } from './config.js';
import { WallGrid, distToSeg, pointInPoly, type WallKind, type WallSeg } from './physics-collide.js';

/** Subset of Track the physics needs (lets tests run on a flat fake track). */
export type PhysicsEnv = Pick<Track, 'barriers' | 'heightAt' | 'surfaceAt' | 'zones' | 'moatJump'> & {
  puddleAt?(x: number, z: number): boolean;
};
type BarrierIn = { a: Vec2; b: Vec2; h?: number; kind?: string };

export type LandQuality = 'clean' | 'skew' | 'crash';

/** Everything PHYSICS §8 asks the QA hooks to expose (game-ui maps it into window.__game). */
export interface Telemetry {
  g: { long: number; lat: number; total: number; peak: number };
  slip: { betaDeg: number; frontDeg: number; rearDeg: number; rearSliding: boolean };
  tank: { units: number; lastUseUnits: number; lastUse: 'boost' | 'jump' | 'hover' | 'launch' | null };
  airborne: boolean; airtimeMs: number; apexM: number;
  contact: { wheels: [boolean, boolean, boolean, boolean]; compressionM: [number, number, number, number]; surface: Surface | 'puddle' };
  fans: { level: number; spool: number };
  thrustN: { rear: number; lift: number };
  launch: { armed: boolean; active: boolean };
  boosting: boolean; hovering: boolean; drifting: boolean;
  hydroplaning: boolean;
  attitudeDeg: { pitch: number; roll: number };
  steerDeg: number; wheelSpin: number; wingAngle: number;
  stepMs: number;
  events: { launch: number; jump: number; land: number; splash: number; hardLanding: number; driftStart: number; driftEnd: number; boost: number };
  lastLand: { vyMs: number; attitudeDeg: number; landingBurn: boolean; quality: LandQuality } | null;
}

// Wheel layout [forward, right] relative to the CG reference (blueprint axles ±1.41 m).
const WHEELS: [number, number][] = [[1.41, -0.85], [1.41, 0.85], [-1.41, -0.83], [-1.41, 0.83]];

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class CarPhysics {
  // planar
  x = 0; z = 0; heading = 0; vx = 0; vz = 0; r = 0;
  // vertical
  y = 0; vy = 0; pitch = 0; pitchRate = 0; roll = 0; rollRate = 0;
  readonly comp: [number, number, number, number] = [0, 0, 0, 0];
  readonly contact: [boolean, boolean, boolean, boolean] = [true, true, true, true];
  // systems
  gas = TUNING.tankStart;
  fan = TUNING.fanStreet;
  drifting = false;
  driftExitT = 0;
  driftReleaseT = 0;
  driftT = 0;
  airborne = false;
  airT = 0;
  apex = 0;
  hoverT = 0;
  jumpLatch = false;
  jumpedThisAir = false;
  landingBurn = false;
  cooldown = 0;
  regenWait = 0;
  boostOn = false;
  boostHeldT = 0;
  launchArmT = 0;
  launchT = 0;
  freeLaunch = true;
  reverseHoldT = 0;
  surface: Surface = 'road';
  wheelSpin = 0;
  steerAngle = 0;
  wing = -0.09;
  impactSeq = 0;
  lastImpact: { impulse: number; kind: WallKind; seq: number } | null = null;
  readonly tel: Telemetry;

  private grid: WallGrid | null = null;
  private gridFor: unknown = null;
  private prevU = 0;
  private prevW = 0;
  private gLong = 0;
  private gLat = 0;
  private fxTyre = 0; // last step rear+front longitudinal tyre force (load transfer)
  private betaPrev = 0;

  constructor() {
    this.tel = {
      g: { long: 0, lat: 0, total: 0, peak: 0 },
      slip: { betaDeg: 0, frontDeg: 0, rearDeg: 0, rearSliding: false },
      tank: { units: this.gas, lastUseUnits: 0, lastUse: null },
      airborne: false, airtimeMs: 0, apexM: 0,
      contact: { wheels: this.contact, compressionM: this.comp, surface: 'road' },
      fans: { level: 0, spool: 0 },
      thrustN: { rear: 0, lift: 0 },
      launch: { armed: false, active: false },
      boosting: false, hovering: false, drifting: false, hydroplaning: false,
      attitudeDeg: { pitch: 0, roll: 0 },
      steerDeg: 0, wheelSpin: 0, wingAngle: -0.09, stepMs: 0,
      events: { launch: 0, jump: 0, land: 0, splash: 0, hardLanding: 0, driftStart: 0, driftEnd: 0, boost: 0 },
      lastLand: null,
    };
    this.reset(0, 0, 0, 0);
  }

  reset(x: number, y: number, z: number, heading: number) {
    const T = TUNING;
    this.x = x; this.y = y; this.z = z; this.heading = heading;
    this.vx = this.vz = this.vy = this.r = 0;
    this.pitch = this.pitchRate = this.roll = this.rollRate = 0;
    const sag = (T.massKg * T.gravity) / (4 * T.springK);
    this.comp.fill(sag);
    this.contact.fill(true);
    this.drifting = false; this.driftExitT = 0; this.driftReleaseT = 0;
    this.airborne = false; this.airT = 0; this.hoverT = 0; this.jumpedThisAir = false; this.landingBurn = false;
    this.cooldown = 0; this.launchArmT = 0; this.launchT = 0; this.freeLaunch = true;
    this.boostOn = false; this.boostHeldT = 0; this.reverseHoldT = 0;
    this.fan = T.fanStreet; this.prevU = 0; this.prevW = 0; this.gLong = this.gLat = 0; this.fxTyre = 0;
    this.tel.g.peak = 0;
  }

  get speed() { return Math.hypot(this.vx, this.vz); }
  get forwardSpeed() { return this.vx * Math.sin(this.heading) - this.vz * Math.cos(this.heading); }

  addGas(units: number) { this.gas = clamp(this.gas + units, 0, 100); }

  /** QA: set horizontal velocity without a fake g spike on the next step (body-frame u/w follow it). */
  setPlanarVelocity(vx: number, vz: number) {
    this.vx = vx; this.vz = vz;
    const fx = Math.sin(this.heading), fz = -Math.cos(this.heading), rx = Math.cos(this.heading), rz = Math.sin(this.heading);
    this.prevU = vx * fx + vz * fz;
    this.prevW = vx * rx + vz * rz;
  }

  private ensureGrid(env: PhysicsEnv) {
    if (this.gridFor === env.barriers) return;
    const T = TUNING, mj = env.moatJump;
    const segs: WallSeg[] = (env.barriers as BarrierIn[]).map((b) => {
      const mx = (b.a.x + b.b.x) / 2, mz = (b.a.z + b.b.z) / 2;
      // Walls without a height are tall, except along the moat-jump corridor (railing / low barriers).
      const nearMoat = mj && distToSeg(mx, mz, mj.takeoff, mj.landing) < T.moatCorridorM;
      const h = b.h ?? (nearMoat ? T.lowWallH : Infinity);
      const kind = (['building', 'wall', 'monument', 'prop', 'barrier'] as const).find((k) => k === b.kind) ?? 'barrier';
      return { a: b.a, b: b.b, h, kind };
    });
    this.grid = new WallGrid(segs);
    this.gridFor = env.barriers;
  }

  step(dt: number, inp: InputState, env: PhysicsEnv) {
    const t0 = now();
    const T = TUNING, tel = this.tel, ev = tel.events;
    this.ensureGrid(env);
    const m = T.massKg, L = T.wheelbaseM, a = L * T.rearShare, b = L - a, h = T.cgHeightM, Iz = m * T.yawInertiaK ** 2;
    const W = m * G;

    let fx = Math.sin(this.heading), fz = -Math.cos(this.heading);
    let rx = Math.cos(this.heading), rz = Math.sin(this.heading);
    let u = this.vx * fx + this.vz * fz, w = this.vx * rx + this.vz * rz;
    const speed = Math.hypot(u, w), kmh = speed * KMH;
    const ground = env.heightAt(this.x, this.z);
    this.surface = env.surfaceAt(this.x, this.z);
    const inZone = env.zones.noBoostNoJump.some((p) => pointInPoly(this.x, this.z, p));
    const frontOn = this.contact[0] || this.contact[1], rearOn = this.contact[2] || this.contact[3];
    const grounded = !this.airborne && (frontOn || rearOn);
    const puddle = !!env.puddleAt?.(this.x, this.z);
    const hydro = grounded && puddle && kmh > T.hydroplaneKmh;
    let muSurf = T.muTyre * (1 - T.rain * (1 - T.wetMul));
    if (this.surface === 'curb') muSurf *= T.curbMul;
    if (puddle) muSurf *= hydro ? T.hydroGrip : 0.75;

    // ── launch control: hold BOOST (or brake + throttle) at a standstill, release to fire ──
    const armInput = (inp.boost && inp.throttle < 0.5) || (inp.brake > 0.5 && inp.throttle > 0.5);
    if (this.launchT <= 0 && grounded && kmh < T.launchMaxKmh && armInput && !inZone) this.launchArmT += dt;
    else if (this.launchArmT > 0) {
      const cost = this.freeLaunch ? 0 : T.launchCost;
      if (this.launchArmT >= T.launchArmS && !armInput && this.gas >= cost * 0.25) {
        const frac = Math.min(1, this.gas / Math.max(cost, 1e-6));
        this.launchT = T.launchS * (cost ? frac : 1);
        this.useGas(Math.min(cost, this.gas), 'launch');
        this.freeLaunch = false;
        ev.launch++;
      }
      if (!armInput || kmh >= T.launchMaxKmh) this.launchArmT = 0;
    }
    const launching = this.launchT > 0;
    if (launching) this.launchT -= dt;
    const armed = this.launchArmT > 0;

    // ── boost ──
    const wantBoost = inp.boost && !armed && !inZone && kmh > T.launchMaxKmh;
    if (wantBoost && !this.boostOn && this.gas >= 10) { this.boostOn = true; this.boostHeldT = 0; ev.boost++; }
    if (this.boostOn) {
      this.boostHeldT += dt;
      if ((!wantBoost && this.boostHeldT >= T.boostMinS) || this.gas <= 0 || inZone) this.boostOn = false;
    }
    if (this.boostOn) this.useGas(T.boostDrain * dt, 'boost');

    // ── fans: full when braking / drifting / launching / hard accel below 100, street otherwise ──
    const fanWant = kmh < T.fanMaxKmh && (inp.brake > 0.1 || this.drifting || armed || launching || (inp.throttle > 0.5 && kmh < 100)) ? T.fanFull : T.fanStreet;
    const fanStep = ((T.fanFull - T.fanStreet) * dt) / T.fanSpoolS;
    this.fan += clamp(fanWant - this.fan, -fanStep, fanStep);
    const D = this.fan * W;

    // ── steering angle (GAMEPLAY §1.3 layer 2) ──
    const dMax = (kmh < 120 ? T.steerMaxDeg + (T.steerAt120Deg - T.steerMaxDeg) * (kmh / 120) : T.steerAt120Deg + (T.steerAt240Deg - T.steerAt120Deg) * Math.min(1, (kmh - 120) / 120)) * DEG;
    const delta = inp.steer * (this.drifting ? T.steerMaxDeg * DEG : dMax);
    this.steerAngle = delta;

    // ── longitudinal demand ──
    const vLim = (this.boostOn ? T.vBoostMaxKmh : T.vMaxKmh) / KMH;
    let aDrive = 0, thrust = 0, brakeF = 0;
    const reversing = u < 0.5 && inp.brake > 0.1 && inp.throttle < 0.1;
    this.reverseHoldT = reversing ? this.reverseHoldT + dt : 0;
    if (inp.throttle > 0 && u >= -0.5) {
      aDrive = u <= vLim ? inp.throttle * T.accelA0 * (1 - Math.pow(Math.max(u, 0) / vLim, T.accelExp)) : 0;
      if (u <= vLim) aDrive += inp.throttle * T.dragK * u * u; // the curve is net of drag
    }
    if (this.reverseHoldT > T.reverseHoldS && u > -T.reverseMaxKmh / KMH) aDrive = -T.reverseAccel;
    if (inp.brake > 0 && u > 0.5) brakeF = inp.brake * (kmh < T.fanMaxKmh ? T.brakeFanG : T.brakeG) * G * m;
    if (this.boostOn) thrust = T.boostG * G * m * Math.sqrt(Math.max(0, 1 - u / (T.vBoostMaxKmh / KMH))) * (grounded ? 1 : 0.5);
    let driveF = m * aDrive;
    if (launching) {
      // total 4.64 g: tyres give what they can, rear thrusters supply the rest (PHYSICS §3.1)
      const target = m * T.launchG * G;
      if (driveF + thrust < target) thrust = target - driveF;
    }
    const drag = m * T.dragK * u * Math.abs(u);
    const coast = inp.throttle < 0.05 && inp.brake < 0.05 && !this.boostOn && Math.abs(u) > 0.2 ? Math.sign(u) * T.coastG * G * m : 0;

    // ── normal loads (formula, PHYSICS §1.3) ──
    const dFz = (this.fxTyre * h - thrust * (T.thrustHeightM - h)) / L;
    const fzF = Math.max(0, W * (1 - T.rearShare) + T.fanFrontShare * D - dFz) * (frontOn ? 1 : 0);
    const fzR = Math.max(0, W * T.rearShare + (1 - T.fanFrontShare) * D + dFz) * (rearOn ? 1 : 0);

    let axB = 0, ayB = 0, rDot = 0; // body-frame accelerations + yaw accel
    let alphaF = 0, alphaR = 0, rearSliding = false, integrated = false;
    const lowLo = T.lowSpeedBlendMs[0], lowHi = T.lowSpeedBlendMs[1];
    const dyn = clamp((u - lowLo) / (lowHi - lowLo), 0, 1);

    if (grounded) {
      // drift entry / exit
      if (!this.drifting && this.driftExitT <= 0 && kmh >= T.driftMinKmh && Math.abs(inp.steer) >= T.driftSteerMin && inp.brake > 0 && u > 0) {
        this.drifting = true; this.driftReleaseT = 0; this.driftT = 0; ev.driftStart++;
      }
      const chi = Math.atan2(this.vx, -this.vz);
      const beta = speed > 1 ? wrap(this.heading - chi) : 0; // + = nose right of the velocity
      if (this.drifting) {
        this.driftReleaseT = Math.abs(inp.steer) < 0.15 ? this.driftReleaseT + dt : 0;
        this.driftT += dt;
        const counter = Math.abs(beta) > 3 * DEG && Math.sign(inp.steer) !== Math.sign(beta) && Math.abs(inp.steer) > 0.15;
        if (this.driftReleaseT >= T.driftExitReleaseS || kmh < T.driftExitKmh || (counter && this.driftT > 0.3 && Math.abs(beta) < T.driftExitDeg * DEG)) this.exitDrift();
      }
      if (this.drifting) {
        // kinematic drift: velocity rotates under capped lateral accel, heading tracks β target by PD
        const cap = muSurf * (1 + T.fanFull) * G * (0.5 + 0.5 * T.driftRearGrip) * (this.fan / T.fanFull);
        const counter = Math.abs(beta) > 3 * DEG && Math.sign(inp.steer) !== Math.sign(beta) && Math.abs(inp.steer) > 0.15;
        const side = counter ? Math.sign(beta) : Math.sign(inp.steer || beta);
        const betaT = counter ? beta * 0.4 : side * Math.min(T.driftMaxDeg, T.driftBaseDeg + T.driftSteerDeg * Math.abs(inp.steer)) * DEG;
        const aLat = cap * (counter ? 0.35 : 0.35 + 0.65 * Math.abs(inp.steer));
        const vxN = this.vx / Math.max(speed, 1e-6), vzN = this.vz / Math.max(speed, 1e-6);
        const nx = -vzN * side, nz = vxN * side; // perpendicular to velocity, toward the turn (right = +)
        let dv = inp.throttle > 0.3 ? -T.driftDecelG * G * Math.min(1, Math.abs(beta) / (T.driftMaxDeg * DEG)) : -0.6 * G;
        dv -= inp.brake * 0.4 * G + T.dragK * speed * speed;
        if (this.boostOn) dv += (thrust / m) * Math.cos(beta);
        const sp2 = Math.max(0, speed + dv * dt);
        this.vx += nx * aLat * dt; this.vz += nz * aLat * dt;
        const s1 = Math.hypot(this.vx, this.vz) || 1;
        this.vx *= sp2 / s1; this.vz *= sp2 / s1;
        const chiDot = (aLat * side) / Math.max(speed, 1);
        const betaDot = (beta - this.betaPrev) / dt;
        let yawAcc = T.driftKp * (betaT - beta) - T.driftKd * betaDot;
        if (Math.abs(beta) > T.antiSpinDeg * DEG) { yawAcc -= Math.sign(beta) * 4; this.exitDrift(); }
        this.r += (yawAcc + (chiDot - this.r) * 4) * dt;
        alphaR = beta; alphaF = beta - delta; rearSliding = true;
        axB = dv; ayB = aLat * side;
        this.fxTyre = m * dv;
        integrated = true;
      } else if (dyn <= 0 || u < 0) {
        // low speed / reverse: kinematic bicycle
        const along = u + ((driveF + thrust - brakeF * Math.sign(u) - drag - coast) / m) * dt;
        const uNew = brakeF > 0 && u > 0 && along < 0 ? 0 : along;
        this.r = (uNew * Math.tan(delta)) / L;
        this.vx = fx * uNew + rx * w * 0.5; this.vz = fz * uNew + rz * w * 0.5;
        axB = (uNew - u) / dt; this.fxTyre = m * axB;
        integrated = true;
      } else {
        // tyre model
        const B = T.pacejkaB, C = T.pacejkaC;
        alphaF = Math.atan2(w + a * this.r, u) - delta;
        alphaR = Math.atan2(w - b * this.r, u);
        const rearMul = this.driftExitT > 0 ? T.driftRearGrip + (1 - T.driftRearGrip) * (1 - this.driftExitT / 0.25) : 1;
        // longitudinal tyre forces: drive on the rear (traction-limited), brakes split front/rear
        const fxRmax = muSurf * fzR * rearMul;
        // traction control: while steering, drive may use at most tcShare of the rear grip circle
        const tc = Math.abs(inp.steer) > 0.2 ? T.tcShare : 1;
        let fxR = clamp(driveF, -fxRmax * tc, fxRmax * tc) - brakeF * (1 - T.brakeFrontShare);
        const fxF = -brakeF * T.brakeFrontShare;
        fxR = clamp(fxR, -fxRmax, fxRmax);
        const fyRmax = Math.sqrt(Math.max(0, fxRmax * fxRmax - fxR * fxR));
        const fyFmax = Math.sqrt(Math.max(0, (muSurf * fzF) ** 2 - Math.min(fxF * fxF, (muSurf * fzF) ** 2)));
        const fyF = -fyFmax * Math.sin(C * Math.atan(B * alphaF));
        const fyR = -fyRmax * Math.sin(C * Math.atan(B * alphaR));
        rearSliding = Math.abs(alphaR) > 0.15;
        const cd = Math.cos(delta), sd = Math.sin(delta);
        const fxBody = fxR + fxF * cd - fyF * sd + thrust - drag - coast;
        const fyBody = fyR + fyF * cd + fxF * sd;
        axB = fxBody / m; ayB = fyBody / m;
        rDot = (a * (fyF * cd + fxF * sd) - b * fyR) / Iz;
        // stability control (no drift requested): rear torque vectoring holds |β| under escBetaDeg,
        // so quick steering at speed never spins the car (FEEL-08) — drifting needs the brake tap.
        if (this.driftExitT <= 0) {
          const ex = Math.abs(beta) - T.escBetaDeg * DEG;
          const betaDot = (beta - this.betaPrev) / dt;
          if (ex > 0 || Math.abs(betaDot) > 1) {
            const mz = -Iz * (T.escKp * Math.sign(beta) * Math.max(ex, 0) + T.escKd * betaDot);
            const lim = T.yawAssistMaxNm;
            rDot += clamp(mz, -lim, lim) / Iz;
          }
        }
        this.fxTyre = fxR + fxF;
        if (this.driftExitT > 0) {
          // leaving a drift: β decays exponentially (τ = driftExitTau, GAMEPLAY §2.4) — r_target = χ̇ − β/τ
          const rT = ayB / Math.max(u, 1) - beta / T.driftExitTau;
          this.r += (rT - this.r) * Math.min(1, dt * 10);
          rDot = 0;
        }
        // blend toward the kinematic model at walking pace (Pacejka jitters near zero speed)
        if (dyn < 1) {
          const rKin = (u * Math.tan(delta)) / L;
          this.r += (rKin - this.r) * (1 - dyn);
          ayB *= dyn;
        }
      }
      this.betaPrev = beta;
    } else {
      // airborne: thruster yaw + half-strength boost, no tyre forces
      if (this.drifting) this.exitDrift();
      this.r += ((inp.steer * T.airSteerRate) - this.r) * Math.min(1, dt * 4);
      axB = (thrust - drag) / m;
      this.fxTyre = 0;
    }
    if (this.driftExitT > 0) this.driftExitT -= dt;

    // ── integrate planar ──
    if (!integrated) {
      this.vx += (fx * axB + rx * ayB) * dt;
      this.vz += (fz * axB + rz * ayB) * dt;
      const uAfter = this.vx * fx + this.vz * fz;
      if (grounded && brakeF > 0 && u > 0 && uAfter < 0) { this.vx -= fx * uAfter; this.vz -= fz * uAfter; } // brakes stop, never reverse
    }
    this.r += rDot * dt;
    this.heading = wrap(this.heading + this.r * dt);
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // ── walls ──
    this.collide(env);

    // ── jump / hover / landing burn / suspension ──
    this.vertical(dt, inp, env, ground, inZone);

    // ── air tank regen ──
    this.regenWait -= dt;
    fx = Math.sin(this.heading); fz = -Math.cos(this.heading); rx = Math.cos(this.heading); rz = Math.sin(this.heading);
    u = this.vx * fx + this.vz * fz; w = this.vx * rx + this.vz * rz;
    const betaNow = Math.hypot(u, w) > 1 ? Math.atan2(w, Math.max(u, 0.01)) : 0;
    const driftCounts = this.drifting && Math.abs(betaNow) >= T.driftCountDeg * DEG && kmh >= T.driftMinKmh;
    if (driftCounts) this.gas = Math.min(100, this.gas + T.driftRegen * dt);
    else if (this.regenWait <= 0) this.gas = Math.min(100, this.gas + T.regen * dt);

    // ── water ──
    const surfNow = env.surfaceAt(this.x, this.z);
    if (surfNow === 'water' && this.surface !== 'water' && !this.airborne) ev.splash++;
    this.surface = surfNow;

    // ── telemetry ──
    const k = Math.min(1, dt / 0.05);
    const aLong = (u - this.prevU) / dt - this.r * w; // body-frame accel incl. frame rotation
    const aLat = (w - this.prevW) / dt + this.r * u;
    this.prevU = u; this.prevW = w;
    this.gLong += (aLong / G - this.gLong) * k;
    this.gLat += (aLat / G - this.gLat) * k;
    if (this.airborne) { this.gLong *= 1 - k; this.gLat *= 1 - k; }
    const gt = Math.hypot(this.gLong, this.gLat);
    tel.g.long = this.gLong; tel.g.lat = this.gLat; tel.g.total = gt; tel.g.peak = Math.max(tel.g.peak, gt);
    tel.slip.betaDeg = -betaNow / DEG; // heading − travel direction: + = nose right of travel
    tel.slip.frontDeg = alphaF / DEG; tel.slip.rearDeg = alphaR / DEG; tel.slip.rearSliding = rearSliding;
    tel.tank.units = this.gas;
    tel.airborne = this.airborne; tel.airtimeMs = this.airT * 1000; tel.apexM = this.apex;
    tel.contact.surface = puddle ? 'puddle' : this.surface;
    tel.fans.level = (this.fan - T.fanStreet) / (T.fanFull - T.fanStreet); tel.fans.spool = clamp(this.launchArmT / T.launchArmS, 0, 1);
    tel.thrustN.rear = thrust;
    tel.launch.armed = armed && this.launchArmT >= T.launchArmS; tel.launch.active = launching;
    tel.boosting = this.boostOn; tel.drifting = this.drifting; tel.hydroplaning = hydro;
    tel.attitudeDeg.pitch = this.pitch / DEG; tel.attitudeDeg.roll = this.roll / DEG;
    this.wheelSpin += (u / 0.36) * dt;
    const wingT = inp.brake > 0.7 && kmh > 80 ? -1.4 : this.boostOn ? -0.02 : -0.09;
    this.wing += (wingT - this.wing) * Math.min(1, dt * 6);
    tel.steerDeg = delta / DEG; tel.wheelSpin = this.wheelSpin; tel.wingAngle = this.wing;
    tel.stepMs = now() - t0;
  }

  private exitDrift() {
    if (!this.drifting) return;
    this.drifting = false;
    this.driftExitT = 0.25;
    this.tel.events.driftEnd++;
  }

  private useGas(units: number, kind: Telemetry['tank']['lastUse']) {
    if (units <= 0) return;
    this.gas = Math.max(0, this.gas - units);
    this.regenWait = TUNING.regenDelayS;
    this.tel.tank.lastUse = kind;
    this.tel.tank.lastUseUnits = units;
  }

  // Wall contact: three circles along the body; depenetrate then GAMEPLAY §2.5 impulse rules.
  private collide(env: PhysicsEnv) {
    const T = TUNING, grid = this.grid!;
    const fx = Math.sin(this.heading), fz = -Math.cos(this.heading);
    const bottom = this.y - env.heightAt(this.x, this.z) + 0.11;
    let best = null as null | { nx: number; nz: number; depth: number; kind: WallKind };
    for (const o of [T.collideOffsetM, 0, -T.collideOffsetM]) {
      const hit = grid.resolve(this.x + fx * o, this.z + fz * o, T.collideRadiusM, bottom);
      if (hit && (!best || hit.depth > best.depth)) best = { nx: hit.nx, nz: hit.nz, depth: hit.depth, kind: hit.seg.kind };
    }
    if (!best) return;
    this.x += best.nx * (best.depth + 0.02);
    this.z += best.nz * (best.depth + 0.02);
    const vn = this.vx * best.nx + this.vz * best.nz;
    if (vn >= 0) return;
    const sp = Math.hypot(this.vx, this.vz);
    const ang = Math.asin(Math.min(1, -vn / Math.max(sp, 1e-6))) / DEG;
    const tx = this.vx - vn * best.nx, tz = this.vz - vn * best.nz; // tangential part
    const mono = best.kind === 'monument';
    const e = mono ? 0.1 : T.wallRestitution;
    const head = clamp((ang - T.glancingDeg) / (T.headOnDeg - T.glancingDeg), 0, 1);
    const keepT = T.glancingKeep + (T.headOnKeep - T.glancingKeep) * head;
    let nvx = tx * keepT - vn * e * best.nx, nvz = tz * keepT - vn * e * best.nz;
    const ns = Math.hypot(nvx, nvz);
    if (ns > sp) { nvx *= sp / ns; nvz *= sp / ns; } // never faster after a hit (FEEL-14)
    this.vx = nvx; this.vz = nvz;
    // head-on: swing the nose toward the wall direction so the player can drive on
    if (head > 0 && Math.hypot(tx, tz) > 0.5) {
      const want = Math.atan2(tx, -tz);
      this.r += wrap(want - this.heading) * head * 1.6;
    } else this.r *= 0.7;
    if (this.drifting) this.exitDrift();
    const impulse = TUNING.massKg * -vn * (1 + e);
    if (-vn > 1) {
      this.impactSeq++;
      this.lastImpact = { impulse, kind: best.kind, seq: this.impactSeq };
    }
  }

  // Jump, hover, landing burn, attitude, spring-dampers.
  private vertical(dt: number, inp: InputState, env: PhysicsEnv, ground0: number, inZone: boolean) {
    const T = TUNING, ev = this.tel.events, m = T.massKg;
    const onCount = this.contact.reduce((n, c) => n + (c ? 1 : 0), 0);
    if (this.cooldown > 0) this.cooldown -= dt;

    // jump: rising edge, ≥ 2 wheels down, gas, cooldown, outside the plaza zone and not landing in it
    const press = inp.jump && !this.jumpLatch;
    this.jumpLatch = inp.jump;
    if (press && !this.airborne && onCount >= 2 && this.gas >= T.jumpCost && this.cooldown <= 0 && !inZone && !this.landsInZone(env)) {
      this.vy = T.jumpVy;
      this.airborne = true; this.airT = 0; this.apex = 0; this.hoverT = 0;
      this.jumpedThisAir = true; this.landingBurn = false;
      this.useGas(T.jumpCost, 'jump');
      this.contact.fill(false);
      ev.jump++;
    }

    const fx = Math.sin(this.heading), fz = -Math.cos(this.heading), rx = Math.cos(this.heading), rz = Math.sin(this.heading);
    const groundAt = (i: number) => env.heightAt(this.x + fx * WHEELS[i][0] + rx * WHEELS[i][1], this.z + fz * WHEELS[i][0] + rz * WHEELS[i][1]);

    if (this.airborne) {
      this.airT += dt;
      let g = T.gravity;
      let lift = 0;
      this.tel.hovering = false;
      if (inp.jump && this.vy <= 0 && this.jumpedThisAir && this.hoverT < T.hoverMaxS && this.gas > 0 && !inZone) {
        g = T.hoverGravity; this.hoverT += dt; this.useGas(T.hoverDrain * dt, 'hover');
        this.tel.hovering = true; lift = m * (T.gravity - T.hoverGravity);
      }
      if (inZone) g = 30; // drop out of the plaza zone (GAMEPLAY §2.7)
      // landing burn: from −jumpVy to −landingVy over the last landingBurnH (only after a jump)
      const hAbove = this.y - ground0;
      if (this.jumpedThisAir && (this.landingBurn || this.vy < -4) && this.vy < -T.landingVy && hAbove < T.landingBurnH && hAbove > 0) {
        const need = (this.vy * this.vy - T.landingVy * T.landingVy) / (2 * Math.max(hAbove, 0.05));
        g -= need; this.landingBurn = true; lift = m * need;
      }
      this.tel.thrustN.lift = lift;
      this.vy -= g * dt;
      this.y += this.vy * dt;
      this.apex = Math.max(this.apex, this.y - ground0);
      // attitude control toward level (thrusters)
      const lvl = T.airLevelRate;
      this.pitchRate = clamp(-this.pitch * 4, -lvl, lvl); this.rollRate = clamp(-this.roll * 4, -lvl, lvl);
      this.pitch += this.pitchRate * dt; this.roll += this.rollRate * dt;
      // touchdown when any wheel reaches the ground
      let touch = false;
      for (let i = 0; i < 4; i++) if (this.y + WHEELS[i][0] * this.pitch + WHEELS[i][1] * this.roll <= groundAt(i)) touch = true;
      if (touch && this.vy <= 0) this.land(env);
      else return;
    }
    this.tel.thrustN.lift = 0;

    // spring-dampers (grounded)
    const k = T.springK, cq = 2 * Math.sqrt(k * (m / 4));
    const sag = (m * T.gravity) / (4 * k);
    let fSum = 0, mPitch = 0, mRoll = 0, on = 0;
    for (let i = 0; i < 4; i++) {
      const [lf, lr] = WHEELS[i];
      const x = groundAt(i) + sag - (this.y + lf * this.pitch + lr * this.roll);
      const xd = -(this.vy + lf * this.pitchRate + lr * this.rollRate);
      this.comp[i] = x;
      this.contact[i] = x > 0;
      if (x <= 0) continue;
      on++;
      let f = k * x + cq * (xd > 0 ? T.damperBump : T.damperRebound) * xd;
      if (x > T.springBumpM) f += 10 * k * (x - T.springBumpM);
      f = Math.max(0, f);
      fSum += f; mPitch += f * lf; mRoll += f * lr;
    }
    // inertial moments: tyre force acts at the ground (h below CG), thrust near CG height (PHYSICS §3.1)
    mPitch += this.fxTyre * T.cgHeightM - this.tel.thrustN.rear * (T.thrustHeightM - T.cgHeightM);
    mRoll += m * this.gLat * G * T.cgHeightM;
    this.vy += (fSum / m - T.gravity) * dt;
    this.y += this.vy * dt;
    this.pitchRate += (mPitch / T.pitchInertia) * dt;
    this.rollRate += (mRoll / T.rollInertia) * dt;
    this.pitch += this.pitchRate * dt;
    this.roll += this.rollRate * dt;
    // hard floor: chassis can't sink below bump-stop travel
    const floor = ground0 + sag - T.springBumpM - 0.04;
    if (this.y < floor) { this.y = floor; if (this.vy < 0) this.vy = 0; }
    if (on === 0 && this.y > ground0 + sag + 0.05) {
      // drove off an edge → ballistic, no landing burn
      this.airborne = true; this.airT = 0; this.apex = 0; this.jumpedThisAir = false;
    }
  }

  private land(env: PhysicsEnv) {
    const T = TUNING, ev = this.tel.events;
    const vyIn = this.vy;
    const att = Math.max(Math.abs(this.pitch), Math.abs(this.roll)) / DEG;
    const chi = Math.atan2(this.vx, -this.vz);
    const yawOff = Math.abs(wrap(this.heading - chi)) / DEG;
    let q: LandQuality = 'clean';
    if (att > T.landingCrashDeg || yawOff > 60) {
      q = 'crash';
      this.vx *= 0.4; this.vz *= 0.4;
      this.r += (Math.random() - 0.5) * 1.0;
    } else if (att > T.landingSkewDeg) {
      q = 'skew';
      this.vx *= 0.8; this.vz *= 0.8;
    } else if (yawOff > 30 && this.speed > T.driftMinKmh / KMH) {
      this.drifting = true; ev.driftStart++; // nose pre-rotated in the air → land straight into a drift
    } else if (yawOff > 30) {
      this.vx *= 0.8; this.vz *= 0.8;
    }
    if (vyIn < -T.landingVy - 1.5) ev.hardLanding++;
    this.airborne = false;
    this.cooldown = T.jumpCooldownS;
    this.tel.lastLand = { vyMs: vyIn, attitudeDeg: att, landingBurn: this.landingBurn, quality: q };
    this.jumpedThisAir = false;
    this.landingBurn = false;
    ev.land++;
    // keep vertical velocity: the springs absorb it next step (bump stop clamps extremes)
    const ground = env.heightAt(this.x, this.z);
    const sag = (T.massKg * T.gravity) / (4 * T.springK);
    if (this.y < ground + sag - T.springBumpM) this.y = ground + sag - T.springBumpM;
  }

  // Predicted landing point crosses the plaza no-jump zone → refuse the jump (GAMEPLAY §2.7).
  private landsInZone(env: PhysicsEnv) {
    const T = TUNING, tAir = T.zoneLookaheadS + T.hoverMaxS * (this.gas > T.jumpCost + 10 ? 1 : 0);
    for (let i = 1; i <= 6; i++) {
      const t = (tAir * i) / 6;
      const px = this.x + this.vx * t, pz = this.z + this.vz * t;
      if (env.zones.noBoostNoJump.some((p) => pointInPoly(px, pz, p))) return true;
    }
    return false;
  }

  /** Raycast helper for the camera (walls taller than minH). */
  raycastWalls(px: number, pz: number, qx: number, qz: number, minH: number) {
    return this.grid ? this.grid.raycast(px, pz, qx, qz, minH) : 1;
  }
}
