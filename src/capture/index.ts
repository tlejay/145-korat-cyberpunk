// Demo / capture mode for promo footage (docs/content/clips/BRIEF-clips.md):
//   ?demo=1&shot=<name>&hud=0|1&cam=chase|fly&wing=auto|up|down&seed=<n>&fixedDt=1
// Every shot is scripted on a virtual 60 fps clock (clock.ts) → same path, same rain, same frame every run.
// With fixedDt=1 nothing moves until the recorder calls window.__demo.step(n) — see promo/SHOTLIST.md.
// Loaded only with ?demo=1 (own chunk). Never submits runs and never shows ghosts.
import * as THREE from 'three';
import { E, advance, boot, hasWebGL2 } from '../game/engine.js';
import { autopilotInput } from '../game/autopilot.js';
import { setQuality, fromQaName } from '../game/quality.js';
import { clearQaInput, setQaInput } from '../input/index.js';
import { showError } from '../ui/error.js';
import type { InputState } from '../types.js';
import { FRAME_MS, clock, installClock, onBeforeTick, presented, setManual, skipTime, tick } from './clock.js';
import { SHOTS, type Ctx, type CamPose, type Shot } from './shots.js';
import { WING_CRUISE, WING_POSE } from '../car/model.js';

const params = new URLSearchParams(location.search);
const DT = FRAME_MS / 1000;
const STEP = 1 / 120;

export interface DemoApi {
  version: 1;
  shot: string;
  shots: string[];
  frames: number;          // frames in this shot at 60 fps
  fps: 60;
  frame: number;           // frames rendered since the shot started
  done: boolean;
  ready: Promise<void>;
  error: string | null;
  /** fixedDt=1: render exactly n more frames, resolves once they are on screen. */
  step(n?: number): Promise<void>;
  /** Car / race snapshot (for checking a recording). */
  info(): Record<string, unknown>;
}
declare global { interface Window { __demo?: DemoApi } }

export async function startDemo(ui: HTMLElement, canvas: HTMLCanvasElement) {
  const name = params.get('shot') ?? 'menu';
  const shot: Shot | undefined = SHOTS[name];
  const hud = params.get('hud') === '1';
  const manual = params.get('fixedDt') === '1';
  const seed = Number(params.get('seed') ?? 1) || 1;
  installClock(seed);
  document.documentElement.classList.add('demo', hud ? 'demo-hud' : 'demo-clean');
  const uiScale = Number(params.get('uiScale') ?? (innerHeight > innerWidth ? 2 : 1)) || 1;
  document.documentElement.style.setProperty('--demo-ui-scale', String(uiScale));
  injectCss();

  let resolveReady: () => void = () => {};
  const api: DemoApi = {
    version: 1, shot: name, shots: Object.keys(SHOTS), frames: 0, fps: 60, frame: 0, done: false,
    ready: new Promise<void>((r) => (resolveReady = r)), error: null,
    async step(n = 1) {
      for (let i = 0; i < n && !api.done; i++) tick();
      await presented();
    },
    info() {
      const s = E.car?.state, r = E.race;
      return {
        phase: E.phase, t: clock.now, frame: api.frame,
        x: s?.pose.x, y: s?.pose.y, z: s?.pose.z, heading: s?.pose.heading, kmh: s?.speedKmh,
        airborne: s?.airborne, drifting: s?.drifting, driftDeg: s?.driftAngleDeg, gas: s?.gas, surface: s?.onSurface, g: s?.gForce,
        progressM: r?.progressM, lapProgressM: r?.lapProgressM, lapMs: r?.lapTimeMs(), finished: r?.finished, launch: r?.launch.result,
        respawns: r?.respawns, cpClears: r?.stats.checkpointClears, impact: E.car?.lastImpact ? `${E.car.lastImpact.kind}:${Math.round(E.car.lastImpact.impulse)}:${E.car.lastImpact.seq}` : null,
      };
    },
  };
  window.__demo = api;
  if (!shot) { api.error = `unknown shot "${name}"`; resolveReady(); return; }
  if (!hasWebGL2()) { showError(ui, 'webgl'); api.error = 'webgl'; resolveReady(); return; }

  // The engine's own loop only draws; the demo advances the simulation itself (one 1/60 s frame per tick).
  E.fixedMode = true;
  const ctx = makeCtx(shot);
  let shotT = -1; // seconds since the shot started; < 0 = loading / pre-roll
  onBeforeTick(() => {
    if (shotT < 0 || !E.race) return;
    E.ghostOwn = E.ghostTop = null;
    applyInput(shot.drive?.(ctx, shotT) ?? null);
    simFrame();
    shotT += DT;
    api.frame++;
    if (api.frame >= api.frames) { api.done = true; setManual(true); }
  });

  await boot(ui, canvas);
  await E.ready;
  const q = fromQaName(params.get('quality') ?? 'high');
  if (q) setQuality(q, false);
  ui.querySelectorAll('.menu-cover').forEach((n) => n.remove());
  E.ticket = null;
  hookRender(ctx, shot);
  api.frames = Math.round(shot.seconds * 60);
  try {
    await shot.setup(ctx);
  } catch (err) {
    api.error = String(err);
    console.warn('[demo] setup failed', err);
  }
  E.ticket = null; // never submit a demo run to the leaderboard
  E.lastFrameTs = clock.now;
  shotT = 0;
  if (manual) setManual(true);
  resolveReady();
}

// ---------- simulation ----------

function applyInput(inp: Partial<InputState> | null) {
  if (inp) setQaInput({ steer: 0, throttle: 0, brake: 0, jump: false, boost: false, ...inp });
  else clearQaInput();
}

const coastInput: InputState = { steer: 0, throttle: 0, brake: 0.45, jump: false, boost: false };
function simFrame() {
  E.ghostOwn = E.ghostTop = null;
  if (E.phase === 'finished' && E.car && E.track && E.race && E.car.state.speedKmh > 0.5) {
    // The race stops stepping the car at the line — let it brake to a stop along the road instead of freezing.
    const s = E.car.state, path = E.race.path;
    coastInput.steer = autopilotInput(path, s, path.project(s.pose.x, s.pose.z).s).steer ?? 0;
    E.car.step(STEP, coastInput, E.track);
    E.car.step(STEP, coastInput, E.track);
  } else advance(DT);
}

function makeCtx(shot: Shot): Ctx {
  const ctx: Ctx = {
    E,
    cam: (params.get('cam') === 'fly' || params.get('cam') === 'chase' ? params.get('cam') : shot.cam ?? 'chase') as 'chase' | 'fly',
    wing: (['auto', 'up', 'down'].includes(params.get('wing') ?? '') ? params.get('wing') : shot.wing ?? 'auto') as 'auto' | 'up' | 'down',
    path: () => E.race!.path,
    teleport(x, z, headingRad, kmh = 0) {
      const car = E.car!, track = E.track!;
      car.reset({ x, y: track.heightAt(x, z), z, heading: headingRad });
      if (kmh) car.qa?.setSpeed?.(kmh);
      E.race?.syncAfterTeleport();
      E.car!.camera.update(0, E.camera);
    },
    place(s, kmh = 0, lateral = 0) {
      const p = E.race!.path.at(s);
      // lateral > 0 = right of travel; heading 0 = north (−z), clockwise +
      const x = p.x + Math.cos(p.heading) * lateral, z = p.z + Math.sin(p.heading) * lateral;
      ctx.teleport(x, z, p.heading, kmh);
    },
    preroll(seconds, drive) {
      const n = Math.round(seconds * 60);
      for (let i = 0; i < n; i++) {
        skipTime(FRAME_MS);
        E.ghostOwn = E.ghostTop = null;
        applyInput(drive?.(ctx, i * DT) ?? null);
        simFrame();
        if (E.car) E.car.camera.update(DT, E.camera);
        if (E.phase === 'racing' || E.phase === 'countdown') E.checkpoint?.update(DT);
      }
      E.lastFrameTs = clock.now;
    },
    async prerollUntil(cond, drive, maxS = 200) {
      let t = 0;
      while (!cond() && t < maxS) { ctx.preroll(1 / 60, (c) => drive?.(c, t) ?? null); t += DT; }
      if (t >= maxS) throw new Error('pre-roll timed out');
    },
    camPose: null,
  };
  return ctx;
}

// ---------- camera + wing, applied right before each draw ----------

function hookRender(ctx: Ctx, shot: Shot) {
  const v = E.visuals;
  const cam = E.camera;
  const look = new THREE.Vector3(), fwd = new THREE.Vector3();
  const portrait = () => cam.aspect < 1;
  const draw = (dt: number, orig: (dt: number) => void) => {
    applyWing(ctx);
    const fov0 = cam.fov;
    const pose: CamPose | null = ctx.cam === 'fly' ? shot.fly?.(ctx) ?? null : null;
    if (pose) {
      cam.fov = pose.fov ?? 60;
      if (v) v.debugCamera = { pos: pose.pos, look: pose.look };
      else { cam.position.set(...pose.pos); cam.lookAt(...pose.look); }
    } else if (portrait()) {
      // Chase cam in 9:16: same camera, wider vertical FOV and a little further back/up so the car keeps its
      // landscape size on screen and the road ahead stays in frame.
      const k = shot.chase ?? {};
      cam.getWorldDirection(fwd);
      look.copy(cam.position).addScaledVector(fwd, 10);
      const st = E.car?.state, kmh = st?.speedKmh ?? 0;
      let back = k.back ?? -(1 + 4.5 * Math.min(1, kmh / 200));
      // never push in closer than 5 m (wall raycast / jumps can already have pulled the camera in)
      const d = st ? Math.hypot(cam.position.x - st.pose.x, cam.position.z - st.pose.z) : 99;
      if (back < 0) back = -Math.min(-back, Math.max(0, d - 6.5));
      const up = k.up ?? 0.2;
      const pos: [number, number, number] = [cam.position.x - fwd.x * back, cam.position.y + up, cam.position.z - fwd.z * back];
      cam.fov = Math.min(95, fov0 * (k.fovMul ?? 1.1));
      if (v) v.debugCamera = { pos, look: [look.x, look.y - (k.tilt ?? -0.4), look.z] };
    }
    cam.updateProjectionMatrix();
    orig(dt);
    if (v) v.debugCamera = null;
    cam.fov = fov0;
    cam.updateProjectionMatrix();
  };
  if (v) {
    const orig = v.render.bind(v);
    v.render = (dt) => draw(dt, orig);
  }
}

function applyWing(ctx: Ctx) {
  if (ctx.wing === 'auto' || !E.car) return;
  const wing = E.car.object.getObjectByName('wing');
  const blade = E.car.object.getObjectByName('wing-blade') as THREE.Mesh | undefined;
  if (!wing) return;
  const R = WING_POSE.raised, St = WING_POSE.stowed;
  const e = ctx.wing === 'up' ? 1 : 0;
  wing.position.set(0, St.y + (R.y - St.y) * e, St.z + (R.z - St.z) * e);
  wing.rotation.x = St.pitch + (WING_CRUISE - St.pitch) * e;
  if (blade?.morphTargetInfluences) blade.morphTargetInfluences[0] = 1 - Math.min(1, e * 1.4);
}

function injectCss() {
  const s = document.createElement('style');
  s.textContent = `
    .demo .rotate-hint, .demo .menu-cover { display: none !important; }
    .demo-clean #ui { display: none !important; }
    .demo-hud #ui { zoom: var(--demo-ui-scale); }
    .demo-hud .controls { display: none !important; }
    .demo [data-qa=res-rank] { visibility: hidden; }
    @media (orientation: portrait) { .demo-hud .res-grid { grid-template-columns: 1fr; } .demo-hud [data-qa=res-rank] { display: none; } }
    .demo, .demo body { cursor: none; }
  `;
  document.head.append(s);
}
