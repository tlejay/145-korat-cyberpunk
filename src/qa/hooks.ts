// window.__game skeleton (docs/qa/TEST-HOOKS.md). Loaded only with ?qa=1.
// Values not wired yet return neutral placeholders; gameplay/scene panes replace
// each section as the systems land. Mutating helpers live under qa.*.
import { game, on } from '../state.js';
import { showError } from '../ui/error.js';
import { VERSION } from '../version.js';
import type { GameQA, Vec3 } from './types.js';

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };
const notReady = () => Promise.resolve();

export function installQaHooks(ui: HTMLElement) {
  const api: GameQA = {
    version: VERSION,
    ready: Promise.resolve(),
    state: () => game.state,
    error: () => game.error,
    stats: () => ({
      fps: 0, fpsP5: 0, frameMsP50: 0, frameMsP95: 0, frameMsP99: 0, longFrames: 0,
      drawCalls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0,
      jsHeapMB: null, dpr: Math.min(devicePixelRatio, 2), renderWidth: innerWidth, renderHeight: innerHeight,
      quality: 'medium', uptimeMs: performance.now() - game.startedAt,
    }),
    car: () => ({
      pos: ZERO, yawDeg: 0, velocity: ZERO, speedKmh: 0, wheelsOnGround: 4, slipAngleDeg: 0, drifting: false,
      boost: { active: false, charge: 1, cooldownMs: 0 },
      jump: { active: false, heightM: 0, airtimeMs: 0, cooldownMs: 0 },
      lastCollision: null, stuckMs: 0,
    }),
    camera: () => ({ pos: ZERO, lookAt: ZERO, fovDeg: 60, distanceToCarM: 0, occluded: false, insideMesh: false, occludedFrames: 0, totalFrames: 0 }),
    track: () => ({
      id: 'A', lengthM: 3361, centerline: [], progressM: 0, lap: 0, totalLaps: 1, lapTimeMs: 0, lapTimesMs: [],
      checkpoint: { next: 0, total: 0, missed: 0 }, offTrack: false, distanceFromCenterlineM: 0,
    }),
    world: () => ({
      boundsM: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
      monument: { pos: ZERO, collider: 'static' },
      respawnCount: 0, outOfBoundsCount: 0, roadNames: [],
      toLatLng: () => ({ lat: 0, lng: 0 }),
      fromLatLng: () => ({ x: 0, z: 0 }),
    }),
    input: () => ({ source: 'qa', throttle: 0, brake: 0, steer: 0, jump: false, boost: false, activePointers: 0, lastLatencyMs: 0 }),
    audio: () => ({ contextState: 'none', unlocked: false, muted: false, musicVolume: 1, sfxVolume: 1, engineRate: 0, playing: [] }),
    on: (event, cb) => on(event, cb),
    qa: {
      start: notReady,
      restart: notReady,
      toMenu: notReady,
      pause() {},
      resume() {},
      setInput() {},
      clearInput() {},
      teleport() {},
      setQuality() {},
      fixedStep() {},
      step: notReady,
      forceError: (code) => showError(ui, code),
      autopilot() {},
      dump() {
        console.log(JSON.stringify({ version: VERSION, state: game.state, error: game.error, stats: api.stats() }));
      },
    },
  };
  window.__game = api;
}
