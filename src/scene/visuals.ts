// M3 cyberpunk pass — the one entry point game-ui calls (src/game/engine.ts):
//   const v = createVisuals({ renderer, scene, camera, track, car });  // after loadTrack + car
//   every frame, instead of renderer.render(scene, camera):  v.render(dt)
//   on resize: v.setSize()
// Owns: bloom/tone mapping/vignette (post.ts), rain (rain.ts), wet road + puddles (wet.ts), moat
// reflections (reflect.ts), neon signs (src/neon), art hookup (art.ts). Quality tiers via onQuality.
import * as THREE from 'three';
import { getQuality, onQuality } from '../game/quality.js';
import { buildNeon, sacredFilter, type LightSrc, type NeonSystem } from '../neon/index.js';
import { getTrackExtras, type TrackExtras } from '../track/index.js';
import type { LandmarksHandle } from '../track/landmarks/index.js';
import type { Car, Quality, Track, Vec2 } from '../types.js';
import { getArt, loadImage } from './art.js';
import type { NightEnv } from './night.js';
import { PostFX } from './post.js';
import { Rain } from './rain.js';
import { MoatReflection, tagGlowLayer } from './reflect.js';
import { buildPuddles, createWetUniforms, LIGHTS_PER_TIER, LightPicker, patchWetSurface, type PuddleSet } from './wet.js';

export interface VisualsStats {
  quality: Quality; post: boolean; hdr: boolean; rainDrops: number; wetLights: number; puddles: number;
  neon: NeonSystem['stats'] | null; reflection: boolean; reflectLightsNearWater: number; lightSources: number;
  msLastFrame: number;
}

export interface Visuals {
  neon: NeonSystem | null;
  puddles: PuddleSet | null;
  rain: Rain;
  post: PostFX;
  render(dt: number): void;
  setSize(): void;
  setRain(on: boolean): void;
  /** Drives the sponsors' start-gantry lights from the engine phase (no-op until sponsors exist). */
  startLights(phase: string, countdownS: number, stepS: number): void;
  /** QA / screenshots: pin the camera (overrides the chase cam until set back to null). */
  debugCamera: { pos: [number, number, number]; look: [number, number, number] } | null;
  stats(): VisualsStats;
  dispose(): void;
}

let current: Visuals | null = null;
export const getVisuals = () => current;

// 🏁 sponsors pane (BRIEF-sponsors): the 5 rooftop billboards show sponsors; perimeter boards / start
// gantry come from buildSponsors(track). Optional until src/sponsors/index.ts exists.
type StartLights = { set(lit: number): void; go(): void; off(): void; countdown(remainingS: number, stepS?: number): void; readonly state: { lit: number; green: boolean } };
type SponsorsMod = {
  buildSponsors?: (track: Track) => THREE.Object3D;
  getStartLights?: () => StartLights | null;
  getSponsorTexture?: (slot: 'billboard' | 'board' | 'gantry', i: number) => THREE.Texture | null;
};
const sponsorMods = import.meta.glob<SponsorsMod>('../sponsors/index.ts', { eager: true });
const sponsors: SponsorsMod = Object.values(sponsorMods)[0] ?? {};

const MAX_DROPS: Record<Quality, number> = { low: 2200, mid: 4500, high: 9000 };

export function createVisuals(o: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; track: Track; car: Car | null }): Visuals {
  const { renderer, scene, camera, track, car } = o;
  const extras = getTrackExtras();
  const real = !!extras && track.root.name === 'track-A';
  renderer.info.autoReset = false; // several passes per frame → stats() must sum them (QA PERF-04/05)

  const post = new PostFX(renderer);
  const rain = new Rain();
  scene.add(rain.mesh);
  const wetU = createWetUniforms();
  const picker = new LightPicker(wetU);
  let neon: NeonSystem | null = null;
  let puddles: PuddleSet | null = null;
  let reflect: MoatReflection | null = null;
  let lights: LightSrc[] = [];
  let lm: LandmarksHandle | null = null;
  const night = scene.userData.night as NightEnv | undefined;

  if (real && extras) {
    track.root.traverse((ob) => { const h = (ob as THREE.Object3D & { landmarks?: LandmarksHandle }).landmarks; if (h) lm = h; });
    const samples = extras.data.samples;
    const centerDist = (x: number, z: number) => {
      let best = Infinity;
      for (let i = 0; i < samples.length; i += 2) best = Math.min(best, (samples[i].x - x) ** 2 + (samples[i].z - z) ** 2);
      return Math.sqrt(best);
    };
    const lmh = lm as LandmarksHandle | null;
    neon = buildNeon({
      anchors: extras.anchors,
      excluded: sacredFilter({ x: extras.monument.x, z: extras.monument.z }, lmh?.claimed ?? []),
      centerDist,
      quality: getQuality().tier,
    });
    scene.add(neon.group);
    lights = [...neon.lights, ...streetLights(extras), {
      x: extras.monument.x, y: 7, z: extras.monument.z, color: new THREE.Color(1.0, 0.8, 0.5).multiplyScalar(0.9), kind: 'monument',
    }];

    // wet asphalt: patch the shared track surface material (road, kerbs, sidewalks, markings)
    const surf = track.root.getObjectByName('surface-0') as THREE.Mesh | undefined;
    if (surf) patchWetSurface(surf.material as THREE.MeshLambertMaterial, wetU);

    // puddles + car-physics hook (PHYSICS §5.2 hydroplaning)
    const mj = track.moatJump;
    const avoid: Vec2[] = [mj.takeoff, mj.landing, { x: track.startGrid.x, z: track.startGrid.z }];
    puddles = buildPuddles(samples, (i) => samples[i].w, track.surfaceAt, extras.corners, avoid, wetU);
    scene.add(puddles.mesh);
    (track as Track & { puddleAt?: (x: number, z: number) => boolean; puddles?: unknown }).puddleAt = puddles.at;
    (track as Track & { puddles?: unknown }).puddles = puddles.list;

    if (sponsors.buildSponsors) {
      try {
        const sg = sponsors.buildSponsors(track);
        sg.name ||= 'sponsors';
        scene.add(sg);
      } catch (err) { console.warn('[visuals] sponsors failed', err); }
    }

    if (lmh) {
      reflect = new MoatReflection(renderer, post, lmh, extras.data.raw.water.level);
      reflect.setSources(lights, track.surfaceAt);
    }
    tagGlowLayer(scene, lmh);
  }

  // it rains all game — wet tyres ×0.85 (PHYSICS §5.1). QA can still override with setWeather.
  (car as Car & { setRain?: (r: number) => void } | null)?.setRain?.(1);

  // reduce flicker: OS "reduce motion" (a settings toggle can call v.neon.setReduceFlicker)
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  neon?.setReduceFlicker(rm.matches);

  // ── art (async, optional) ──
  const art = getArt();
  if (art.sky && night) {
    void loadImage(art.sky).then((img) => {
      if (!img) return;
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.needsUpdate = true;
      night.setPanorama(t, 0.9);
    });
  }
  // billboards: sponsor textures win; art-pane backgrounds fill any slot sponsors leave empty
  let artImgs: (HTMLImageElement | null)[] = [];
  let sponsorVer = -1;
  const sponsorTex = () => Array.from({ length: 5 }, (_, i) => { try { return sponsors.getSponsorTexture?.('billboard', i) ?? null; } catch { return null; } });
  const refreshBillboards = () => {
    if (!neon) return;
    const tex = sponsorTex();
    const ver = tex.reduce((a, t) => a + (t ? t.version + 1 : 0), 0);
    if (ver === sponsorVer) return;
    sponsorVer = ver;
    const imgs = tex.map((t, i) => (t?.image as CanvasImageSource | undefined) ?? artImgs[i] ?? null);
    neon.billboards.setArt(imgs, tex.map((t) => !!t?.image));
  };
  if (art.billboards.length && neon) {
    void Promise.all(art.billboards.slice(0, 5).map(loadImage)).then((imgs) => { artImgs = imgs; sponsorVer = -1; refreshBillboards(); });
  }
  refreshBillboards();
  let sponsorCheck = 0;

  let tier: Quality = getQuality().tier;
  let rainOn = true;
  const applyQ = () => {
    tier = getQuality().tier;
    post.setQuality(tier);
    rain.setQuality(tier);
    neon?.setQuality(tier);
    puddles?.setQuality(tier);
    reflect?.setQuality(tier);
    setSize();
  };
  const setSize = () => {
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    post.setSize(s.x, s.y);
    reflect?.setSize(s.x, s.y);
  };
  applyQ();
  const offQ = onQuality(applyQ);

  let ms = 0;

  const v: Visuals = {
    neon, puddles, rain, post,
    debugCamera: null,
    render(dt) {
      const t0 = performance.now();
      if (v.debugCamera) {
        camera.position.set(...v.debugCamera.pos);
        camera.lookAt(...v.debugCamera.look);
        camera.updateMatrixWorld();
        night?.update(camera); // keep the sky dome centred on the pinned camera
      }
      renderer.info.reset();
      neon?.update(dt);
      rain.intensity = rainOn ? 1 : 0;
      rain.update(dt, camera);
      wetU.uWetTime.value += dt;
      picker.pick(lights, camera, LIGHTS_PER_TIER[tier]);
      // sponsor canvases may redraw once fonts / logo files load — re-copy into the atlas (1×/s check)
      if (sponsors.getSponsorTexture && (sponsorCheck += dt) > 1) { sponsorCheck = 0; refreshBillboards(); }
      reflect?.update(scene, camera);
      ms = performance.now() - t0;
      post.render(scene, camera);
    },
    setSize,
    setRain(on) { rainOn = on; wetU.uWet.value = on ? 1 : 0.25; },
    startLights(phase, countdownS, stepS) {
      const l = sponsors.getStartLights?.();
      if (!l) return;
      if (phase === 'countdown') l.countdown(countdownS, stepS);
      // the countdown phase ends on the same step as GO → fire green once racing starts
      else if (phase === 'racing') { if (l.state.lit > 0 && !l.state.green) l.go(); }
      else if (phase !== 'paused' && (l.state.lit > 0 || l.state.green)) l.off();
    },
    stats: () => ({
      quality: tier, post: post.enabled, hdr: post.hdr, rainDrops: rainOn ? MAX_DROPS[tier] : 0, wetLights: wetU.uLN.value,
      puddles: puddles?.list.length ?? 0, neon: neon?.stats ?? null, reflection: tier === 'high' && post.enabled && !!reflect,
      reflectLightsNearWater: reflect?.nearWaterCount ?? 0, lightSources: lights.length, msLastFrame: ms,
    }),
    dispose() {
      offQ();
      post.dispose();
      rain.dispose();
      neon?.dispose();
      reflect?.dispose();
      puddles?.mesh.geometry.dispose();
      renderer.info.autoReset = true;
      if (current === v) current = null;
    },
  };
  current = v;
  if (new URLSearchParams(location.search).get('qa') === '1') Object.assign(window, { __visuals: v, __visualsScene: scene });
  return v;
}

// Sodium street lamps, the cast-iron causeway lamps and the (green) traffic signals as light sources.
function streetLights(ex: TrackExtras): LightSrc[] {
  const ss = ex.data.raw.streetscape, out: LightSrc[] = [], M = 0.1;
  const sodium = new THREE.Color(1.0, 0.52, 0.18).multiplyScalar(0.9);
  const cast = new THREE.Color(1.0, 0.7, 0.4).multiplyScalar(0.6);
  for (let i = 0; i + 3 < ss.lamps.length; i += 4) {
    const x = ss.lamps[i] * M, z = ss.lamps[i + 1] * M, ang = ss.lamps[i + 2] / 1000, type = ss.lamps[i + 3];
    const fx = Math.sin(ang), fz = Math.cos(ang);
    if (type === 3) { out.push({ x, y: 4.0, z, color: cast, kind: 'lamp' }); continue; }
    for (const d of type === 2 ? [1, -1] : [1]) out.push({ x: x + fx * 2.3 * d, y: 8.3, z: z + fz * 2.3 * d, color: sodium, kind: 'lamp' });
  }
  const green = new THREE.Color(0.1, 1.0, 0.45).multiplyScalar(0.5);
  for (let i = 0; i + 4 < ss.signals.length; i += 5) {
    const x = ss.signals[i] * M, z = ss.signals[i + 1] * M, ang = ss.signals[i + 2] / 1000, arm = ss.signals[i + 3] * M, kind = ss.signals[i + 4];
    const rx = Math.cos(ang), rz = -Math.sin(ang);
    out.push(kind === 1 ? { x: x + rx * arm, y: 5.6, z: z + rz * arm, color: green, kind: 'signal' } : { x, y: 3.2, z, color: green, kind: 'signal' });
  }
  return out;
}

// Menu / loading backdrop from the art pane's cover image (keeps the existing dark gradient on top).
// Called by the engine right after the menu is shown (before the world finishes loading).
export function applyMenuCover(ui: HTMLElement) {
  const url = getArt().cover;
  if (url) applyCover(ui, url);
}
function applyCover(ui: HTMLElement, url: string) {
  const set = () => {
    const el = ui.querySelector<HTMLElement>('[data-qa=menu]');
    if (!el) return false;
    el.style.backgroundImage = `radial-gradient(ellipse at 50% 60%, rgba(7, 6, 15, 0.15), rgba(7, 6, 15, 0.8)), url("${url}")`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    return true;
  };
  if (!set()) requestAnimationFrame(() => set());
}
