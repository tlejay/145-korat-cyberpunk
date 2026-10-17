// Game engine: renderer, fixed-timestep loop, state machine (GAMEPLAY §5.1) and
// the glue between track / car / audio / input / HUD / leaderboard.
import * as THREE from 'three';
import { decodeGhost, encodeGhost } from '../net/ghost.js';
import type { Ghost } from '../net/ghost-format.js';
import { getTopGhost } from '../net/leaderboard.js';
import { GAS, TRACK_RULES, computeScore } from '../net/score.js';
import { clearQaInput, inputInfo, installKeyboard, lastInput, pollGamepad, resetInput, sample } from '../input/index.js';
import { createTouchControls, type TouchControls } from '../input/touch.js';
import { emit, game, setState } from '../state.js';
import type { AudioEvent, Car, GameAudio, InputState, Track } from '../types.js';
import { showError } from '../ui/error.js';
import { createHud, type Hud } from '../ui/hud.js';
import { showLeaderboard } from '../ui/leaderboard.js';
import { showResults } from '../ui/results.js';
import { showCredits, showMenu, showPause, showSettings, showTutorial } from '../ui/screens.js';
import { buzz, saveSettings, settings } from '../ui/settings.js';
import { VERSION } from '../version.js';
import { applyMenuCover, createVisuals, type Visuals } from '../scene/visuals.js';
import { autopilotInput } from './autopilot.js';
import { GhostCar } from './ghost.js';
import { Metrics } from './metrics.js';
import { loadAudioModule, loadCarModule, loadCheckpointModule, loadFxModule, loadTrackModule, sources, type Checkpoint, type Fx } from './modules.js';
import { angleDiff } from './path.js';
import { getQuality, lowerQuality, onQuality } from './quality.js';
import { GAME, Race, type RaceEvent } from './race.js';
import { flushPending, RunTicket } from './submit.js';

const STEP = 1 / 120;          // physics step (s)
const TOP_KMH = 210;           // for steer ramp scaling
const TRACK_ID = 'A' as const;
const params = new URLSearchParams(location.search);
export const QA = params.get('qa') === '1';
const NET = !QA || params.get('net') === '1'; // QA runs stay offline unless asked (no 404 noise on vite dev)

// Optional extras of the audio pane's KoratAudio (src/audio/index.ts) — used when present.
type AudioX = GameAudio & Partial<{ music(n: 'menu' | 'race' | 'off'): void; setMuted(m: boolean): void; pause(): void; resume(): void; debug(): unknown }>;

type Phase = 'loading' | 'menu' | 'intro' | 'countdown' | 'racing' | 'paused' | 'finished' | 'error';

export const E = {
  ui: null as unknown as HTMLElement,
  renderer: null as unknown as THREE.WebGLRenderer,
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 600),
  track: null as Track | null,
  car: null as Car | null,
  visuals: null as Visuals | null,   // M3 cyberpunk pass (src/scene/visuals.ts) — null = plain render
  fx: null as Fx | null,             // M3 fx pane (src/fx) when present
  checkpoint: null as Checkpoint | null, // M3 alcohol checkpoint (src/checkpoint) when present
  audio: null as AudioX | null,
  race: null as Race | null,
  hud: null as Hud | null,
  controls: null as TouchControls | null,
  metrics: new Metrics(),
  phase: 'loading' as Phase,
  pausedFrom: null as Phase | null,
  laps: TRACK_RULES[TRACK_ID].laps,
  countdownS: 0,
  introS: 0,
  acc: 0,
  autopilot: false,
  fixedMode: false,
  fixedDtMs: 1000 / 60,
  ghostOwn: null as Ghost | null,
  ghostTop: null as Ghost | null,
  ghostCars: [] as GhostCar[],
  ticket: null as RunTicket | null,
  ready: null as unknown as Promise<void>,
  camStats: { occludedFrames: 0, totalFrames: 0 },
  lastFrameTs: 0,
  stuckShown: false,
  zoneToastShown: false,
};

let menuView: ReturnType<typeof showMenu> | null = null;
let resolveReady: () => void = () => {};
E.ready = new Promise<void>((r) => (resolveReady = r));

export function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

// ---------- boot ----------

export async function boot(ui: HTMLElement, canvas: HTMLCanvasElement) {
  E.ui = ui;
  const q = getQuality();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: q.antialias, powerPreference: 'high-performance' });
  E.renderer = renderer;
  renderer.setClearColor(0x07060f);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  applyQuality();
  onQuality(applyQuality);
  addEventListener('resize', resize);
  resize();

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    pause();
    showError(ui, 'webgl_lost');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    ui.querySelector('[data-qa=error-box]')?.remove();
    game.error = null;
    setPhase(E.pausedFrom ? 'paused' : 'menu');
  });

  // Basic night lighting (world pane's scene module can replace/extend this).
  E.scene.background = new THREE.Color(0x07060f);
  E.scene.fog = new THREE.Fog(0x07060f, 60, q.viewDistM);
  const hemi = new THREE.HemisphereLight(0x6a5cff, 0x140a20, 1.1);
  const moon = new THREE.DirectionalLight(0xbfd4ff, 1.2);
  moon.position.set(-200, 300, 100);
  hemi.name = moon.name = 'engine-fallback-light'; // removed when the real track brings its night scene
  E.scene.add(hemi, moon);
  E.scene.add(E.camera);

  installKeyboard((a) => {
    if (a === 'pause') togglePause();
    else if (a === 'respawn') E.race?.respawn('player');
    else toggleMute();
  });
  addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  const portrait = matchMedia('(orientation: portrait) and (max-width: 900px)');
  portrait.addEventListener('change', () => { if (portrait.matches) pause(); });

  setPhase('loading');
  menuView = showMenu(ui, { loading: true, onStart: () => void startFromMenu(), onBoard: () => showLeaderboard(ui), onCredits: () => showCredits(ui), onSettings: openSettings });
  applyMenuCover(ui);

  renderer.setAnimationLoop(frame);
  if (NET) void flushPending();
  await loadWorld();
}

async function loadWorld() {
  try {
    const [track, car, audio] = await Promise.all([loadTrackModule(E.scene), loadCarModule(), loadAudioModule()]);
    E.track = track;
    if (!track.root.parent) E.scene.add(track.root);
    if (sources.track === 'real') E.scene.children.filter((o) => o.name === 'engine-fallback-light').forEach((o) => E.scene.remove(o));
    E.car = car;
    E.scene.add(car.object);
    // M3: night/neon/rain/bloom. A failure here must never block the race — fall back to a plain render.
    try {
      E.visuals?.dispose();
      E.visuals = createVisuals({ renderer: E.renderer, scene: E.scene, camera: E.camera, track, car });
    } catch (err) {
      console.warn('[game] visuals failed, plain render', err);
      E.visuals = null;
    }
    E.fx = await loadFxModule(E.scene, track, car);
    E.checkpoint = await loadCheckpointModule(E.scene, track, car);
    if (E.checkpoint) wireCheckpoint(E.checkpoint);
    E.audio = audio;
    applyVolumes();
    applyShake();
    for (const color of [0x22e6ff, 0xff2fa8]) {
      const g = new GhostCar(color);
      E.ghostCars.push(g);
      E.scene.add(g.object);
    }
    E.ghostOwn = await loadOwnGhost();
    if (NET) void getTopGhost(TRACK_ID).then((r) => { if (r.ok && r.data) { E.ghostTop = r.data.ghost; E.race?.setRefGhost(E.ghostOwn ?? E.ghostTop); } });
    E.race = newRace();
    E.race.reset();
    E.hud = createHud(E.ui);
    E.hud.setPath(E.race.path);
    E.hud.onPause = togglePause;
    E.hud.onRespawn = () => E.race?.respawn('player');
    E.hud.el.classList.add('hidden');
    E.controls = createTouchControls(E.ui);
    E.controls.el.classList.add('off');
    menuView?.ready();
    setPhase('menu');
    resolveReady();
    if (params.get('skip') === '1') void startRace({ skipCountdown: true, laps: Number(params.get('laps')) || undefined });
  } catch (err) {
    console.warn('[game] world load failed', err);
    showError(E.ui, 'mapload', () => {
      E.ui.querySelector('[data-qa=error-box]')?.remove();
      game.error = null;
      setPhase('loading');
      void loadWorld();
    });
    setPhase('error');
  }
}

function newRace(): Race {
  return new Race(E.track!, E.car!, {
    laps: E.laps,
    rule: TRACK_RULES[TRACK_ID],
    refGhost: E.ghostOwn ?? E.ghostTop,
    onEvent,
  });
}

// ---------- state machine ----------

function setPhase(p: Phase) {
  E.phase = p;
  const qaState = p === 'intro' ? 'countdown' : p;
  if (game.state !== qaState) setState(qaState);
  const racingUi = p === 'countdown' || p === 'racing' || p === 'intro';
  E.hud?.el.classList.toggle('hidden', !(racingUi || p === 'paused'));
  E.controls?.el.classList.toggle('off', !(p === 'countdown' || p === 'racing'));
  E.ui.querySelector('[data-qa=menu]')?.classList.toggle('hidden', p !== 'menu' && p !== 'loading');
}

async function startFromMenu() {
  void E.audio?.unlock(); // inside the tap handler (iOS, MOB-10)
  E.audio?.play('uiTap');
  enterFullscreen();
  if (!settings.tutorialSeen) {
    E.ui.querySelector('[data-qa=menu]')?.classList.add('hidden');
    showTutorial(E.ui, () => void startRace({ intro: true }));
    return;
  }
  await startRace({ intro: true });
}

export async function startRace(opts: { skipCountdown?: boolean; intro?: boolean; laps?: number } = {}) {
  await E.ready;
  if (!E.track || !E.car) return;
  clearScreens();
  if (opts.laps && opts.laps > 0) E.laps = Math.min(opts.laps, 9);
  E.race = newRace();
  E.race.reset();
  E.checkpoint?.reset?.();
  E.hud!.setPath(E.race.path);
  E.ticket = NET && E.laps === TRACK_RULES[TRACK_ID].laps ? new RunTicket(TRACK_ID) : null;
  E.acc = 0;
  E.stuckShown = false;
  E.zoneToastShown = false;
  E.metrics.resetLong();
  E.camStats = { occludedFrames: 0, totalFrames: 0 };
  resetInput();
  E.controls?.releaseAll();
  const firstIntro = opts.intro && !sessionStorageGet('introSeen');
  if (opts.skipCountdown) {
    setPhase('racing');
    E.race.go();
    E.hud!.countdown(null);
    return;
  }
  if (firstIntro) {
    sessionStorageSet('introSeen', '1');
    E.introS = 2.5;
    setPhase('intro');
    const skip = () => { E.introS = 0; };
    E.ui.addEventListener('pointerdown', skip, { once: true });
    return;
  }
  beginCountdown();
}

function beginCountdown() {
  E.countdownS = GAME.countdownStepS * 4;
  setPhase('countdown');
  E.hud!.countdown('3');
  E.audio?.play('countdown3');
  countdownShown = '3'; // already announced — stepOnce() must not fire countdown3 again ("Three, Three")
  if (!settings.tutorialSeen || (E.race?.lapTimes.length === 0 && !localStorageGet('launchHintSeen'))) {
    E.hud!.toast('กดค้างสายฟ้า แล้วปล่อยตอน "ไป!" เพื่อออกตัวเร็ว');
    localStorageSet('launchHintSeen', '1');
  }
}

function clearScreens() {
  E.ui.querySelectorAll('.screen:not([data-qa=menu]), .panel').forEach((n) => n.remove());
}

export function pause() {
  if (E.phase !== 'racing' && E.phase !== 'countdown' && E.phase !== 'intro') return;
  E.pausedFrom = E.phase;
  setPhase('paused');
  E.audio?.pause?.();
  resetInput();
  E.controls?.releaseAll();
  showPause(E.ui, {
    onResume: resume,
    onRestart: () => void startRace(),
    onRespawn: () => { resume(); E.race?.respawn('player'); },
    onMute: toggleMute,
    onSettings: openSettings,
    onMenu: toMenu,
  });
}

export function resume() {
  if (E.phase !== 'paused') return;
  E.ui.querySelectorAll('[data-qa=pause], [data-qa=settings]').forEach((n) => n.remove());
  setPhase(E.pausedFrom ?? 'racing');
  E.audio?.resume?.();
  E.pausedFrom = null;
  E.acc = 0;
}

function togglePause() {
  if (E.phase === 'paused') resume();
  else pause();
}

export function toMenu() {
  clearScreens();
  E.pausedFrom = null;
  E.race?.reset();
  E.audio?.resume?.();
  E.audio?.music?.('menu');
  setPhase('menu');
}

function toggleMute() {
  saveSettings({ muted: !settings.muted });
  applyVolumes();
}

function applyShake() {
  (E.car as { setShakeScale?: (k: number) => void } | null)?.setShakeScale?.(settings.reduceShake ? 0.3 : 1);
}

function applyVolumes() {
  E.audio?.setVolumes(settings.music, settings.sfx);
  if (E.audio?.setMuted) E.audio.setMuted(settings.muted);
  else if (settings.muted) E.audio?.setVolumes(0, 0);
}

function openSettings() {
  showSettings(E.ui, { onChange: () => { applyVolumes(); applyShake(); }, onTutorial: () => showTutorial(E.ui, () => {}) });
}

// ---------- events ----------

function onEvent(e: RaceEvent) {
  const hud = E.hud!, audio = E.audio;
  switch (e.type) {
    case 'checkpoint':
      hud.delta(e.deltaMs);
      audio?.play('checkpoint');
      emit('checkpoint', e);
      break;
    case 'lap':
      buzz([30, 60, 30]);
      emit('lap', e);
      if (e.best && E.race!.lapTimes.length > 1) hud.combo('รอบดีสุด');
      break;
    case 'finalLap':
      hud.toast('รอบสุดท้าย');
      audio?.play('finalLap');
      break;
    case 'finish':
      void finishRace();
      break;
    case 'respawn':
      // Launch is free only at "ไป!" — not after every respawn reset (car-physics REPORT §3).
      { const ph = (E.car as { physics?: { freeLaunch: boolean } } | null)?.physics; if (ph) setTimeout(() => { ph.freeLaunch = false; }, 300); }
      emit('respawn', e);
      break;
    case 'jump': audio?.play('jump'); emit('jump', e); break;
    case 'land': {
      audio?.play('land'); buzz(e.shortcut ? 40 : 20);
      const ll = (E.car as { telemetry?: { lastLand: object | null } } | null)?.telemetry?.lastLand;
      emit('land', { ...e, ...(ll ?? {}) });
      break;
    }
    case 'boost': audio?.play('boost'); buzz(15); emit('boost', e); break;
    case 'collision':
      emit('collision', e);
      if (e.kind !== 'monument') { audio?.play('crash'); buzz(Math.round(Math.min(60, 40 + e.impulse / 1000))); }
      break;
    case 'toast': hud.toast(e.text); break;
    case 'combo': hud.combo(e.text); if (e.text.startsWith('ดริฟต์')) audio?.play('drift'); break;
    case 'launch':
      emit('launch', e);
      hud.combo(e.result === 'perfect' ? `ออกตัวสมบูรณ์ ${e.g.toLocaleString('th-TH')}g` : e.result === 'spin' ? 'ล้อฟรี' : e.result === 'late' ? 'ช้าไป' : '');
      if (e.result !== 'none') buzz([20, 40, 20]);
      break;
    case 'refill': hud.combo('เติมลม +35'); break;
  }
}

// Checkpoint events → HUD / audio / haptics (contract in modules.ts).
function wireCheckpoint(cp: Checkpoint) {
  type D = { text?: string; audio?: AudioEvent; impulse?: number };
  const on = (name: string, fn: (d: D) => void) =>
    cp.events.addEventListener(name, (e) => {
      const d = ((e as CustomEvent).detail ?? {}) as D;
      emit('roadblock', { type: name, ...d }); // QA on('roadblock')
      fn(d);
    });
  on('hint', (d) => { if (d.text) E.hud?.toast(d.text); if (d.audio) E.audio?.play(d.audio); });
  on('clear', (d) => { if (d.text) E.hud?.combo(d.text); if (d.audio) E.audio?.play(d.audio); buzz([20, 40, 20]); });
  on('crash', (d) => {
    if (d.text) E.hud?.combo(d.text);
    E.audio?.play(d.audio ?? 'crash');
    buzz(Math.round(Math.min(60, 30 + (d.impulse ?? 0) / 1000)));
  });
}

async function finishRace() {
  const race = E.race!;
  setPhase('finished');
  const result = race.result();
  const rule = TRACK_RULES[TRACK_ID];
  const local = computeScore(result, rule);
  const prevBest = E.ghostOwn?.lapMs ?? Infinity;
  const record = race.bestLapMs !== null && race.bestLapMs < prevBest;
  if (record && race.lapGhost) {
    E.ghostOwn = race.lapGhost;
    void saveOwnGhost(race.lapGhost);
  }
  E.audio?.play(record ? 'newRecord' : 'finish'); // one or the other (audio REPORT §8.2)
  const view = showResults(E.ui, result, local, { bestLapRecord: record, longestDriftM: race.lastDrift.metres }, {
    onRetry: () => void startRace(),
    onBoard: () => showLeaderboard(E.ui),
    onMenu: toMenu,
  });
  if (!E.ticket) return view.setServer({ ok: false, code: QA ? 'QA' : 'TUNED' });
  const res = await E.ticket.finish(result, race.lapGhost);
  view.setServer(res);
}

// ---------- loop ----------

function frame(now: number) {
  const dtMs = E.lastFrameTs ? Math.min(250, now - E.lastFrameTs) : 16.7;
  E.lastFrameTs = now;
  E.metrics.frame(dtMs);
  pollGamepad((a) => (a === 'pause' ? togglePause() : E.race?.respawn('player')));
  if (!E.fixedMode) advance(dtMs / 1000);
  render(dtMs / 1000);
  checkLowFps();
}

// Advance simulation by `dt` seconds of wall time in fixed STEP chunks.
export function advance(dt: number) {
  const race = E.race, car = E.car, track = E.track;
  if (!race || !car || !track) return;
  if (E.phase === 'intro') {
    E.introS -= dt;
    if (E.introS <= 0) beginCountdown();
    return;
  }
  if (E.phase !== 'countdown' && E.phase !== 'racing') return;
  E.acc += dt;
  let n = 0;
  while (E.acc >= STEP && n++ < 30) {
    E.acc -= STEP;
    stepOnce();
  }
  if (n >= 30) E.acc = 0;
}

function stepOnce() {
  const race = E.race!, car = E.car!;
  const s = car.state;
  const ap = E.autopilot ? autopilotInput(race.path, s, race.progressM) : null;
  let inp: InputState = sample(STEP, s.speedKmh / TOP_KMH, ap);
  if (E.phase === 'countdown') {
    E.countdownS -= STEP;
    const step = Math.ceil(E.countdownS / GAME.countdownStepS);
    const shown = step >= 4 ? '3' : step === 3 ? '2' : step === 2 ? '1' : null;
    if (shown && shown !== countdownShown) {
      countdownShown = shown;
      E.hud!.countdown(shown);
      E.audio?.play(shown === '3' ? 'countdown3' : shown === '2' ? 'countdown2' : 'countdown1');
    }
    const held = race.countdownInput(inp, Math.max(0, E.countdownS - GAME.countdownStepS));
    car.step(STEP, held, E.track!);
    if (E.countdownS <= GAME.countdownStepS) {
      countdownShown = '';
      E.hud!.countdown('ไป!');
      E.audio?.play('go');
      race.go();
      E.audio?.music?.('race');
      setPhase('racing');
    }
    return;
  }
  inp = assist(race.racingInput(applyAutoThrottle(inp)));
  updateLocks();
  race.step(STEP, inp);
  if (!race.finished) E.audio?.update(s, STEP);
  forwardPhysicsEvents();
}
let countdownShown = '';

// car-physics telemetry.events are counters — fire on() events when they change (PHYSICS §8).
const PHYS_EVENTS = ['splash', 'hardLanding', 'driftStart', 'driftEnd'] as const;
const lastPhysEv: Record<string, number> = {};
let lastHydro = false;
function forwardPhysicsEvents() {
  const tel = (E.car as { telemetry?: { events: Record<string, number>; hydroplaning: boolean; lastLand: unknown } } | null)?.telemetry;
  if (!tel) return;
  for (const k of PHYS_EVENTS) {
    const n = tel.events[k] ?? 0;
    if (lastPhysEv[k] !== undefined && n > lastPhysEv[k]) emit(k, k === 'hardLanding' ? tel.lastLand : { type: k });
    lastPhysEv[k] = n;
  }
  if (tel.hydroplaning && !lastHydro) emit('hydroplane', { type: 'hydroplane' });
  lastHydro = tel.hydroplaning;
}

function applyAutoThrottle(inp: InputState): InputState {
  if (!settings.autoThrottle || inp.brake > 0) return inp;
  return { ...inp, throttle: 1 };
}

// Steering assist layer 3 — align with the road when not steering (GAMEPLAY §1.3).
function assist(inp: InputState): InputState {
  const race = E.race!, s = E.car!.state;
  const k = settings.assist === 'off' ? 0 : settings.assist === 'high' ? 0.9 : 0.5;
  if (!k || Math.abs(inp.steer) > 0.02 || s.drifting || s.airborne || s.speedKmh < 20 || E.autopilot) return inp;
  const err = angleDiff(race.path.at(race.progressM + 8).heading, s.pose.heading);
  if (Math.abs(err) > (15 * Math.PI) / 180) return inp;
  return { ...inp, steer: Math.max(-0.35, Math.min(0.35, err * k * 1.5)) };
}

// Jump/BOOST locks: plaza zone (GAMEPLAY §2.5) or not enough gas (§2.4).
function updateLocks() {
  const race = E.race!, s = E.car!.state;
  const zone = race.inZone();
  const jumpCost = GAS.jump / GAS.capacity;
  const lockJump = zone || (s.gas < jumpCost && !s.airborne);
  const lockBoost = zone || s.gas < 0.02;
  inputInfo.locked.jump = lockJump;
  inputInfo.locked.boost = lockBoost && !race.launch.armed;
  E.controls?.setLocked('jump', lockJump);
  E.controls?.setLocked('boost', lockBoost);
  if (zone && !E.zoneToastShown && (lastInput().jump || lastInput().boost || race.lapTimes.length === 0)) {
    E.zoneToastShown = true;
    race.toast('เขตลานย่าโม งดกระโดดและเร่งพิเศษ');
  }
  // Moat shortcut hint (§3.1): within 150 m before take-off.
  const mj = E.track!.moatJump;
  const d = Math.hypot(s.pose.x - mj.takeoff.x, s.pose.z - mj.takeoff.z);
  if (d < GAME.shortcutHintM) {
    race.toast('ท่าโชว์: กระโดดข้ามคูเมือง กดค้างให้ลอย', true); // PHYSICS §2.3 — a show move, not a shortcut
    const okSpeed = s.speedKmh >= 90 && s.speedKmh <= 115; // clean-landing window with hover (PHYSICS §2.2)
    E.controls?.setJumpHint(s.gas >= GAS.shortcut / GAS.capacity && okSpeed ? 'ok' : 'short');
  } else E.controls?.setJumpHint('none');
}

function render(dt: number) {
  const car = E.car, race = E.race, cam = E.camera;
  if (car && race) {
    if (E.phase === 'intro' || (E.phase === 'menu' && !E.fixedMode)) introCamera(E.phase === 'intro' ? 1 - E.introS / 2.5 : performance.now() / 20000);
    else car.camera.update(dt, cam);
    E.track?.update?.(dt, cam);
    const lapT = race.lapTimeMs();
    const ghosts = [E.ghostOwn, E.ghostTop];
    E.ghostCars.forEach((g, i) => {
      g.ghost = E.phase === 'racing' ? ghosts[i] : null;
      g.update(lapT, cam);
    });
    if (E.hud && E.phase !== 'menu') updateHud();
    if (E.phase === 'racing') {
      const stuck = race.stuckMs > GAME.stuckPromptMs;
      if (stuck !== E.stuckShown) { E.stuckShown = stuck; E.hud?.showRespawnPrompt(stuck); }
    }
    E.camStats.totalFrames++;
    E.fx?.update(dt, cam);
    if (E.phase === 'racing' || E.phase === 'countdown') E.checkpoint?.update(dt);
  }
  if (E.visuals) E.visuals.render(dt);
  else E.renderer.render(E.scene, cam);
}

const HAIRPIN = 80;
function updateHud() {
  const race = E.race!, s = E.car!.state;
  const lead = Math.max(40, (s.speedKmh / 3.6) * GAME.turnLeadS);
  let turn: { deg: number; inM: number } | null = null;
  for (let d = 10; d <= lead; d += 10) {
    const deg = race.path.turnAhead(race.progressM, d, 15);
    if (Math.abs(deg) > 35) { turn = { deg: Math.abs(deg) > HAIRPIN ? Math.sign(deg) * 135 : deg, inM: d }; break; }
  }
  const ghostDots: { x: number; z: number }[] = [];
  for (const g of E.ghostCars) if (g.object.visible) ghostDots.push({ x: g.object.position.x, z: g.object.position.z });
  E.hud!.update({
    speedKmh: s.speedKmh, g: s.gForce, gas: s.gas, jumpCost: GAS.jump / GAS.capacity, moatCost: GAS.shortcut / GAS.capacity,
    lap: Math.min(race.lap, E.laps), laps: E.laps,
    lapMs: E.phase === 'racing' || E.phase === 'paused' || E.phase === 'finished' ? race.lapTimeMs() : 0,
    bestMs: race.bestLapMs ?? E.ghostOwn?.lapMs ?? null,
    turn,
    drift: race.driftChainMs > 300 ? { angle: s.driftAngleDeg, metres: race.driftChainM } : null,
    car: { x: s.pose.x, z: s.pose.z, heading: s.pose.heading },
    ghosts: ghostDots,
  });
  E.hud!.fade(race.fade);
}

// Menu / first-session intro: sweep around the plaza, monument framed from the west (GAMEPLAY §4).
function introCamera(t: number) {
  const a = Math.PI + (t - 0.5) * 1.2; // centred on west
  const cam = E.camera;
  cam.position.set(Math.cos(a) * 70, 22 - t * 8, Math.sin(a) * 70);
  cam.lookAt(0, 6, 0);
  if (cam.fov !== 55) { cam.fov = 55; cam.updateProjectionMatrix(); }
}

let lowSince = 0;
function checkLowFps() {
  if (E.phase !== 'racing' || QA) return;
  if (E.metrics.recentFps(5) < 20) {
    if (!lowSince) lowSince = performance.now();
    if (performance.now() - lowSince > 1000 && !game.error) showLowFps();
  } else lowSince = 0;
}

export function showLowFps() {
  pause();
  showError(E.ui, 'lowfps', () => {
    lowerQuality();
    E.ui.querySelector('[data-qa=error-box]')?.remove();
    game.error = null;
    setState('paused');
  });
  const b = E.ui.querySelector('[data-qa=error-box] [data-qa=btn-retry]');
  if (b) b.lastChild!.textContent = 'ลดคุณภาพกราฟิก';
}

function applyQuality() {
  const q = getQuality();
  E.renderer?.setPixelRatio(Math.min(devicePixelRatio, q.maxDpr));
  E.camera.far = q.viewDistM + 50;
  E.camera.updateProjectionMatrix();
  if (E.scene.fog instanceof THREE.Fog) E.scene.fog.far = q.viewDistM;
  E.ui?.querySelector('[data-qa=hud-map]')?.classList.toggle('hidden', !q.minimap);
  resize();
}

function resize() {
  if (!E.renderer) return;
  const w = innerWidth, h = innerHeight;
  E.renderer.setSize(w, h, false);
  E.camera.aspect = w / h;
  E.camera.updateProjectionMatrix();
  E.visuals?.setSize();
}

function enterFullscreen() {
  if (!matchMedia('(pointer: coarse)').matches) return;
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  try {
    const p = el.requestFullscreen?.();
    if (p) p.then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {})).catch(() => {});
  } catch { /* iOS: not supported, fine */ }
}

// ---------- ghosts (own best lap, localStorage `ghost.A.v1`) ----------

async function loadOwnGhost(): Promise<Ghost | null> {
  try {
    const raw = JSON.parse(localStorage.getItem('ghost.A.v1') ?? 'null') as { build: string; data: string } | null;
    if (!raw || raw.build !== VERSION) return null;
    return await decodeGhost(raw.data);
  } catch {
    return null;
  }
}

async function saveOwnGhost(g: Ghost) {
  const data = await encodeGhost(g);
  if (!data) return;
  try { localStorage.setItem('ghost.A.v1', JSON.stringify({ build: VERSION, data })); } catch { /* ignore */ }
}

// ---------- QA-only helpers ----------

export function qaStep(frames: number) {
  // Camera/HUD follow every frame; the GPU draw happens once at the end (keeps long QA runs fast).
  for (let i = 0; i < frames; i++) {
    advance(E.fixedDtMs / 1000);
    E.car?.camera.update(E.fixedDtMs / 1000, E.camera);
  }
  render(E.fixedDtMs / 1000);
}

export function qaClearInput() { clearQaInput(); }
export { sources };

function sessionStorageGet(k: string) { try { return sessionStorage.getItem(k); } catch { return null; } }
function sessionStorageSet(k: string, v: string) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } }
function localStorageGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
