// Scripted promo shots for ?demo=1&shot=<name> (promo/SHOTLIST.md lists URL, length and what happens).
// Coordinates: metres, origin = Thao Suranari monument, x = east, z = south; heading 0 = north, clockwise +.
// Every input below is a pure function of the car state and the virtual clock → deterministic.
import type { E as Engine } from '../game/engine.js';
import { startRace, toMenu } from '../game/engine.js';
import { autopilotInput } from '../game/autopilot.js';
import type { LoopPath } from '../game/path.js';
import { GAME } from '../game/race.js';
import type { InputState } from '../types.js';
import { showLeaderboard } from '../ui/leaderboard.js';

type Vec = [number, number, number];
export interface CamPose { pos: Vec; look: Vec; fov?: number }
type Drive = (c: Ctx, t: number) => Partial<InputState> | null;

export interface Ctx {
  E: typeof Engine;
  cam: 'chase' | 'fly';
  wing: 'auto' | 'up' | 'down';
  path(): LoopPath;
  teleport(x: number, z: number, headingRad: number, kmh?: number): void;
  /** Teleport onto the centreline at track metre s (lateral m to the right), facing along the track. */
  place(s: number, kmh?: number, lateral?: number): void;
  /** Simulate without drawing (virtual time still advances, so the shot starts mid-action). */
  preroll(seconds: number, drive?: Drive): void;
  prerollUntil(cond: () => boolean, drive?: Drive, maxS?: number): Promise<void>;
  camPose: CamPose | null;
}

export interface Shot {
  seconds: number;
  /** Default camera when the URL has no cam= (chase = the game's camera, fly = the shot's cinematic one). */
  cam?: 'chase' | 'fly';
  wing?: 'auto' | 'up' | 'down';
  /** Portrait tweaks for the chase camera. */
  chase?: { fovMul?: number; back?: number; up?: number; tilt?: number };
  setup(c: Ctx): Promise<void>;
  drive?: Drive;
  fly?(c: Ctx): CamPose | null;
}

// ---------- helpers ----------

const car = (c: Ctx) => c.E.car!.state;
const race = (c: Ctx) => c.E.race!;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
let shotT = 0; // seconds since the shot started (fly cameras read it)
const tracked = (d: Drive): Drive => (c, t) => { shotT = t; return d(c, t); };

/** Follow the centreline at a target speed (QA autopilot steering, own speed control). */
function follow(c: Ctx, kmh: number, extra: Partial<InputState> = {}): Partial<InputState> {
  const s = car(c), r = race(c);
  const ap = autopilotInput(r.path, s, r.progressM);
  const v = s.speedKmh;
  return { steer: ap.steer, throttle: v < kmh - 2 ? 1 : v < kmh + 2 ? 0.35 : 0, brake: v > kmh + 10 ? 0.4 : 0, ...extra };
}

/** Full-lap driver: QA autopilot + jump over the alcohol checkpoints on the game's own "now" cue. */
let cueNow = false;
function lapDriver(c: Ctx): Partial<InputState> {
  const s = car(c), r = race(c);
  const ap = autopilotInput(r.path, s, r.progressM);
  const jump = cueNow;
  return { ...ap, jump };
}
function listenCue(c: Ctx) {
  c.E.checkpoint?.events.addEventListener('cue', (e) => {
    const d = (e as CustomEvent<{ jump?: string }>).detail;
    cueNow = d?.jump === 'now';
  });
}

/** Camera relative to the car: right/up/forward offsets in the car's frame, looking at a point on the car. */
function carFrame(c: Ctx, right: number, up: number, fwd: number, lookFwd = 0, lookUp = 0.7): CamPose {
  const p = car(c).pose, h = p.heading;
  const fx = Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = Math.sin(h);
  return {
    pos: [p.x + rx * right + fx * fwd, p.y + up, p.z + rz * right + fz * fwd],
    look: [p.x + fx * lookFwd, p.y + lookUp, p.z + fz * lookFwd],
  };
}

/** Smoothly follows a target pose (critically damped, frame-rate fixed at 60). */
function smoother(omega = 4) {
  let pos: Vec | null = null, look: Vec | null = null;
  const k = 1 - Math.exp(-omega / 60);
  return (t: CamPose): CamPose => {
    if (!pos || !look) { pos = [...t.pos]; look = [...t.look]; }
    for (let i = 0; i < 3; i++) { pos[i] += (t.pos[i] - pos[i]) * k; look[i] += (t.look[i] - look[i]) * k; }
    return { pos: [...pos], look: [...look], fov: t.fov };
  };
}

async function raceFromGrid(c: Ctx, skipCountdown: boolean) {
  await startRace({ skipCountdown, laps: 1 });
  c.E.ticket = null;
}

/** Launch hold: BOOST held through the countdown, released inside the 0.15 s window before GO. */
const launchInput = (c: Ctx): Partial<InputState> => {
  const E = c.E;
  if (E.phase === 'countdown') return { boost: E.countdownS - GAME.countdownStepS > 0.08 };
  return follow(c, 200);
};

// ---------- shots ----------

export const SHOTS: Record<string, Shot> = {
  // Lights on the start gantry, 3-2-1-GO, perfect launch.
  countdown: {
    seconds: 5, cam: 'fly', wing: 'up',
    async setup(c) { listenCue(c); await raceFromGrid(c, false); },
    drive: tracked(launchInput),
    fly(c) {
      // low in front of the car, looking back at it with the gantry behind; dolly back as it launches
      const s = car(c), base = c.E.track!.startGrid;
      const z = base.z - 9 - Math.max(0, shotT - 3.6) * 2;
      return { pos: [base.x + 2.2, 1.1, z], look: [s.pose.x, 1.6, s.pose.z + 4], fov: 62 };
    },
  },

  // 4.6 g launch: from "1" to ~150 km/h, plume from the rear nozzles.
  'launch-boost': {
    seconds: 6, cam: 'chase',
    chase: { fovMul: 1.25, back: 1.5, up: 0.4, tilt: 0.8 },
    async setup(c) {
      listenCue(c);
      await raceFromGrid(c, false);
      c.preroll(1.9, launchInput);
    },
    drive: tracked(launchInput),
    fly: (() => { const sm = smoother(3); return (c: Ctx) => sm({ ...carFrame(c, -3.2, 0.7, -5.5, 6, 0.6), fov: 62 }); })(),
  },

  // Drift right at the big junction at the head of Ratchadamnoen (93°, onto road 224).
  drift: {
    seconds: 6, cam: 'chase',
    async setup(c) { await raceFromGrid(c, true); c.place(600, DRIFT_KMH); c.preroll(0.5, (cc) => follow(cc, DRIFT_KMH)); driftT = -1; },
    drive: tracked((c, t) => {
      const r = race(c), s = car(c);
      const toCorner = 714.9 - r.progressM;
      if (driftT < 0 && toCorner > DRIFT_AT) return follow(c, DRIFT_KMH);
      if (driftT < 0) driftT = t;
      // steer towards the exit heading of the junction, ease off near it (release > 0.2 s ends the drift)
      const exitH = r.path.at(714.9 + 45).heading;
      let err = exitH - s.pose.heading;
      err = Math.atan2(Math.sin(err), Math.cos(err));
      if (t - driftT < 0.15) return { steer: 1, brake: 1, throttle: 0.5 }; // brake tap + full lock = drift entry
      if (s.drifting && err > DRIFT_HOLD) return { steer: Math.max(0.55, Math.min(1, 0.3 + err * 1.5)), throttle: 0.9 };
      return follow(c, 150);
    }),
    fly: (() => { const sm = smoother(2.5); return (c: Ctx) => sm({ ...carFrame(c, 5, 3.2, 7, 0, 0.5), fov: 64 }); })(),
  },

  // Show jump over the north-east moat corner (road 224 → Manat), hover with the downward jets.
  'great-jump': {
    seconds: 6, cam: 'chase',
    chase: { fovMul: 1.3, back: 2.5, up: 1.2, tilt: 1.2 },
    async setup(c) {
      const T = { x: 495, z: -577.4 }, L = { x: 529.5, z: -528 };
      const ul = Math.hypot(L.x - T.x, L.z - T.z), u = { x: (L.x - T.x) / ul, z: (L.z - T.z) / ul };
      const h = Math.atan2(u.x, -u.z);
      await raceFromGrid(c, true);
      c.teleport(T.x - u.x * JUMP_RUN, T.z - u.z * JUMP_RUN, h, JUMP_KMH);
      (c.E.car as { physics?: { gas: number } }).physics!.gas = 100;
      jumpLine = { T, u };
      jumpT = -1;
    },
    drive: tracked((c, t) => {
      const s = car(c), { T, u } = jumpLine!;
      const along = (s.pose.x - T.x) * u.x + (s.pose.z - T.z) * u.z;
      const aimX = T.x + u.x * (along + 14), aimZ = T.z + u.z * (along + 14);
      let err = Math.atan2(aimX - s.pose.x, -(aimZ - s.pose.z)) - s.pose.heading;
      err = Math.atan2(Math.sin(err), Math.cos(err));
      const steer = Math.max(-1, Math.min(1, err * 2.3));
      if (jumpT < 0 && along > JUMP_AT) jumpT = t;
      if (jumpT < 0) return { steer, throttle: s.speedKmh < JUMP_KMH ? 1 : 0.35 };
      const a = t - jumpT;
      if (a < 0.5 || s.airborne) return { steer, throttle: 0.2, jump: a < 0.05 || (a > 0.6 && a < 0.6 + JUMP_HOVER) };
      // landed on Manat → steer for the middle of the road a little way ahead
      const r = race(c), tgt = r.path.at(r.progressM + 18);
      let e2 = Math.atan2(tgt.x - s.pose.x, -(tgt.z - s.pose.z)) - s.pose.heading;
      e2 = Math.atan2(Math.sin(e2), Math.cos(e2));
      return { steer: Math.max(-1, Math.min(1, e2 * 2.5)), throttle: s.speedKmh < 100 ? 0.6 : 0 };
    }),
    fly: (() => {
      // locked off on the Manat causeway side of the moat, panning with the car as it flies across
      const sm = smoother(5);
      return (c: Ctx) => { const p = car(c).pose; return sm({ pos: [536, 2.4, -571], look: [p.x, p.y + 1, p.z], fov: 58 }); };
    })(),
  },

  // Neon shophouses on Manat in the rain, cables and lanterns swinging as the car passes.
  'neon-street': {
    seconds: 7, cam: 'chase',
    async setup(c) { await raceFromGrid(c, true); c.place(1500, 140); c.preroll(1, (cc) => follow(cc, 140)); },
    drive: tracked((c) => follow(c, 140)),
    fly: (() => { const sm = smoother(3); return (c: Ctx) => sm({ ...carFrame(c, -3, 1.2, 9, 0, 0.8), fov: 66 }); })(),
  },

  // Chumphon Gate behind the monument: locked-off camera across the road, the car crosses in front at a calm
  // 50 km/h (no stunts by the plaza) and the camera turns gently with it.
  'pratu-chumphon': {
    seconds: 6, cam: 'fly',
    async setup(c) { await raceFromGrid(c, true); c.place(74, 50); c.preroll(0.3, (cc) => follow(cc, 50)); },
    drive: tracked((c) => follow(c, 50)),
    fly: (() => {
      const sm = smoother(2);
      return (c: Ctx) => {
        const p = car(c).pose;
        return sm({ pos: [-33, 2.8, 22], look: [lerp(10, p.x, 0.3), lerp(7, 1, 0.3), lerp(-2, p.z, 0.3)], fov: 60 });
      };
    })(),
  },

  // Passing the Ya Mo plaza on Ratchadamnoen (no jump / boost zone).
  'yamo-plaza': {
    seconds: 7, cam: 'chase',
    async setup(c) { await raceFromGrid(c, true); c.place(15, 95); c.preroll(0.5, (cc) => follow(cc, 95)); },
    drive: tracked((c) => follow(c, 95)),
    fly: (() => { const sm = smoother(2); return (c: Ctx) => sm({ ...carFrame(c, -3.5, 3, -9, 8, 1), fov: 66 }); })(),
  },

  // Jump over the "หยุดตรวจ" checkpoint on Ratchadamnoen on the game's own cue.
  'checkpoint-jump': {
    seconds: 5, cam: 'chase',
    async setup(c) { listenCue(c); await raceFromGrid(c, true); c.place(255, 150); c.preroll(0.3, (cc) => follow(cc, 150)); },
    drive: tracked((c) => follow(c, 150, { jump: cueNow })),
    fly: (c) => { const p = car(c).pose; return { pos: [-41, 2.2, -262], look: [p.x, 1.5, p.z], fov: 55 }; },
  },

  // Same checkpoint, no jump: cones and the A-frame fly (light batons keep glowing).
  'checkpoint-crash': {
    seconds: 5, cam: 'chase',
    async setup(c) { await raceFromGrid(c, true); c.place(270, 120); c.preroll(0.3, (cc) => follow(cc, 120)); },
    drive: tracked((c) => follow(c, 120)),
    fly: (c) => { const p = car(c).pose; return { pos: [-42, 2.2, -262], look: [p.x, 1.5, p.z], fov: 55 }; },
  },

  // Finish gantry + LED boards: car runs the last straight of Ratchadamnoen under MADEBYTLE.
  'sponsor-signs': {
    seconds: 6, cam: 'chase',
    async setup(c) { await raceFromGrid(c, true); c.place(3200, 120); c.preroll(0.5, (cc) => follow(cc, 120)); },
    drive: tracked((c) => follow(c, 120)),
    fly: (() => {
      const sm = smoother(3);
      return (c: Ctx) => {
        const g = c.E.track!.startGrid, p = car(c).pose;
        // beyond the gantry looking back down Ratchadamnoen; the car comes through it towards camera
        return sm({ pos: [g.x + 3.5, 2, g.z - 48], look: [lerp(g.x, p.x, 0.3), 3, lerp(g.z + 15, p.z, 0.3)], fov: 52 });
      };
    })(),
  },

  // Last seconds of a real one-lap run (autopilot), across the line, results screen (HUD version).
  finish: {
    seconds: 8, cam: 'chase',
    async setup(c) {
      listenCue(c);
      await raceFromGrid(c, true);
      await c.prerollUntil(() => race(c).lapProgressM >= race(c).path.length - 140, lapDriver);
    },
    drive: tracked((c) => (c.E.phase === 'racing' ? lapDriver(c) : null)),
    fly(c) {
      const g = c.E.track!.startGrid, p = car(c).pose;
      return { pos: [g.x + 5, 1.6, g.z - 30], look: [p.x, 1.2, p.z], fov: 58 };
    },
  },

  // Results screen of that run: "สถิติใหม่ของคุณ" (first finish on this device), slow orbit round the car.
  'new-record': {
    seconds: 6, cam: 'fly', wing: 'up',
    async setup(c) {
      listenCue(c);
      await raceFromGrid(c, true);
      await c.prerollUntil(() => c.E.phase === 'finished', lapDriver);
      c.preroll(2.5);
    },
    fly(c) {
      const p = car(c).pose, a = p.heading + Math.PI * 0.75 + shotT * 0.12;
      return { pos: [p.x + Math.sin(a) * 6.5, 1.3, p.z - Math.cos(a) * 6.5], look: [p.x, 0.7, p.z], fov: 50 };
    },
  },

  // Online leaderboard over the menu's plaza camera.
  leaderboard: {
    seconds: 6, cam: 'fly',
    async setup(c) { toMenu(); c.E.ui.querySelector('[data-qa=menu]')?.classList.add('hidden'); showLeaderboard(c.E.ui); c.preroll(1.5); },
    fly: () => menuOrbit(),
  },

  // Main menu over the plaza.
  menu: {
    seconds: 8, cam: 'fly',
    async setup(c) { toMenu(); c.preroll(0.2); },
    fly: () => menuOrbit(),
  },

  // Rear three-quarter hero of the car: red light bar, MADEBYTLE plate, raised wing.
  'rear-hero': {
    seconds: 6, cam: 'fly', wing: 'up',
    async setup(c) { await raceFromGrid(c, true); c.place(1560, 0); c.preroll(0.1); },
    fly(c) {
      const k = ease(shotT / 6), p = car(c).pose;
      const a = p.heading + Math.PI + lerp(-0.75, 0.55, k);
      const r = lerp(8, 6.5, k);
      return { pos: [p.x + Math.sin(a) * r, lerp(0.8, 1.3, k), p.z - Math.cos(a) * r], look: [p.x, 0.65, p.z], fov: 48 };
    },
  },

  // Key art (docs/dev/hotfix/BRIEF-cover-from-r1.md): R1 cruising in the rain, rigid low rear three-quarter
  // camera turned so the whole car sits right of centre. cover = menu/loading backdrop (car in the right half,
  // clear of the title + buttons), og-cover = share image, 1200×630 viewport (car centre-right, Wat
  // Sutthachinda's gate in the distance). Every number can be overridden from the URL (coverS=…, see keyArt).
  cover: keyArtShot({ s: 1720, yaw: 11 }),
  'og-cover': keyArtShot({ s: 2900, yaw: 6 }),

  // Flythrough: slow crane past the monument and Chumphon Gate at night in the rain (no car in frame).
  fly: {
    seconds: 14, cam: 'fly',
    async setup(c) { await raceFromGrid(c, true); c.place(1800, 0); c.preroll(0.1); },
    fly() {
      const k = ease(shotT / 14);
      const a = Math.PI + lerp(0.55, -0.45, k); // south-west → north-west, statue faces west
      const r = lerp(52, 30, k);
      return { pos: [Math.cos(a) * r, lerp(6, 15, k), Math.sin(a) * r], look: [8, lerp(7, 9, k), 0], fov: 60 };
    },
  },

  // One full uncut lap with the HUD: countdown, launch, autopilot line, checkpoint jumps, finish, results.
  'full-lap': {
    seconds: 114, cam: 'chase',
    async setup(c) { listenCue(c); await raceFromGrid(c, false); },
    drive: tracked((c) => (c.E.phase === 'countdown' ? launchInput(c) : c.E.phase === 'racing' ? lapDriver(c) : null)),
  },
};

for (const sh of Object.values(SHOTS)) {
  const setup = sh.setup;
  sh.setup = async (c) => { shotT = 0; await setup(c); shotT = 0; };
  if (!sh.drive) sh.drive = (_c, t) => { shotT = t; return null; };
}
let jumpLine: { T: { x: number; z: number }; u: { x: number; z: number } } | null = null;
let jumpT = -1;
const Q = new URLSearchParams(location.search);
const JUMP_RUN = Number(Q.get('jumpRun') ?? 20), JUMP_KMH = Number(Q.get('jumpKmh') ?? 100), JUMP_HOVER = Number(Q.get('jumpHover') ?? 0.64), JUMP_AT = Number(Q.get('jumpAt') ?? -10);
const cq = (k: string, d: number) => Number(Q.get(k) ?? d);
function keyArt(d: { s: number; yaw: number }) {
  // 25 km/h keeps the wet-road wheel spray from puffing up over the tail
  return {
    s: cq('coverS', d.s), kmh: cq('coverKmh', 25), lat: cq('coverLat', 0),
    right: cq('coverRight', -3.4), up: cq('coverUp', 0.55), fwd: cq('coverFwd', -5.6),
    lookFwd: cq('coverLookFwd', 0), lookUp: cq('coverLookUp', 0.6), fov: cq('coverFov', 48),
    yaw: cq('coverYaw', d.yaw), pitch: cq('coverPitch', 3),
    // optional fixed world camera: coverPos=x,y,z&coverLook=x,y,z (overrides the car-relative one)
    pos: cv('coverPos'), look: cv('coverLook'),
  };
}
// URL params are read lazily: SHOTS is built before the constants below exist.
function keyArtShot(d: { s: number; yaw: number }): Shot {
  let kk: ReturnType<typeof keyArt> | null = null;
  const K = () => (kk ??= keyArt(d));
  return {
    seconds: 4, cam: 'fly', wing: 'up',
    async setup(c) { const k = K(); await raceFromGrid(c, true); c.place(k.s, k.kmh, k.lat); c.preroll(1, (cc) => follow(cc, k.kmh)); },
    drive: tracked((c) => follow(c, K().kmh)),
    fly: (c) => { const k = K(); return k.pos && k.look
      ? { pos: k.pos, look: k.look, fov: k.fov }
      : { ...aim(carFrame(c, k.right, k.up, k.fwd, k.lookFwd, k.lookUp), k.yaw, k.pitch), fov: k.fov }; },
  };
}
/** Turn the view yaw° left (car slides right in frame) and pitch° up, keeping the camera where it is. */
function aim(p: CamPose, yawDeg: number, pitchDeg: number): CamPose {
  const dx = p.look[0] - p.pos[0], dy = p.look[1] - p.pos[1], dz = p.look[2] - p.pos[2];
  const a = (yawDeg * Math.PI) / 180, h = Math.hypot(dx, dz);
  const rx = dx * Math.cos(a) + dz * Math.sin(a), rz = -dx * Math.sin(a) + dz * Math.cos(a);
  const el = Math.atan2(dy, h) + (pitchDeg * Math.PI) / 180;
  return { ...p, look: [p.pos[0] + rx, p.pos[1] + Math.tan(el) * h, p.pos[2] + rz] };
}
function cv(k: string): Vec | null {
  const v = Q.get(k)?.split(',').map(Number);
  return v && v.length === 3 && v.every(Number.isFinite) ? (v as Vec) : null;
}
let driftT = -1;
const DRIFT_AT = Number(new URLSearchParams(location.search).get('driftAt') ?? 45);
const DRIFT_KMH = Number(new URLSearchParams(location.search).get('driftKmh') ?? 100);
const DRIFT_HOLD = Number(new URLSearchParams(location.search).get('driftHold') ?? 0.3);

function menuOrbit(): CamPose {
  // Same sweep as the game's menu camera (engine introCamera), on the virtual clock, widened for 9:16.
  const t = 0.5 + 0.5 * Math.sin(performance.now() / 9000);
  const a = Math.PI + (t - 0.5) * 0.9;
  return { pos: [Math.cos(a) * 34, 8 - t * 2.5, Math.sin(a) * 34], look: [0, 10, 0], fov: 72 };
}
