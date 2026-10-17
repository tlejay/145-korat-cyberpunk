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
// 🧭 wayfinding (REPORT-wayfinding §2): roadside turn signs + chevrons. Must run after sponsors (signs dodge
// the sponsor boards) and before the car's first step (it swaps track.barriers for one with sign colliders).
type WayfindingMod = { buildWayfinding?: (track: Track) => THREE.Object3D };
const wayfindingMods = import.meta.glob<WayfindingMod>('../wayfinding/index.ts', { eager: true });
const wayfinding: WayfindingMod = Object.values(wayfindingMods)[0] ?? {};

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
    if (wayfinding.buildWayfinding) {
      try {
        const wg = wayfinding.buildWayfinding(track);
        wg.name ||= 'wayfinding';
        scene.add(wg);
      } catch (err) { console.warn('[visuals] wayfinding failed', err); }
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
  const hiRes = getQuality().tier === 'high';
  if (art.sky && night) {
    // always the -lo sky (1024×512, no mips: ~2 MB GPU) — the full one costs 11 MB for little gain behind rain + fog
    void loadImage(art.sky.lo).then((img) => {
      if (!img) return;
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.generateMipmaps = false;
      t.minFilter = THREE.LinearFilter; // no mips → no seam line where atan() wraps
      t.needsUpdate = true;
      night.setPanorama(t, 1);
    });
  }
  // window modules → painted into the existing facade atlas (0 MB extra GPU)
  if (art.windows.length && real) {
    const fac = track.root.getObjectByName('facade-0') as THREE.Mesh | undefined;
    const fm = fac?.material as THREE.MeshLambertMaterial | undefined;
    if (fm?.map && fm.emissiveMap) {
      const map = fm.map, em = fm.emissiveMap;
      void Promise.all(art.windows.map((w) => loadImage(w.lo))).then((imgs) => paintWindows(map, em, imgs));
    }
  }
  // neon frame sheet → under the Thai text of every neon box / blade sign
  if (art.neonFrames && neon) {
    const nf = art.neonFrames, sa = neon.atlas;
    const lo = !hiRes;
    void loadImage(lo ? nf.lo : nf.full).then((img) => {
      if (!img) return;
      const k = img.width / 1024; // cells_px are in full-res pixels (the -lo sheet is exactly half)
      sa.setFrames(img, nf.cells.map((c) => c.map((v) => v * k)));
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
    void Promise.all(art.billboards.slice(0, 5).map((b) => loadImage(hiRes ? b.full : b.lo))).then((imgs) => { artImgs = imgs; sponsorVer = -1; refreshBillboards(); });
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

// Menu / loading backdrop: the art pane's cover image while the city loads, then it fades out so the
// menu shows the live 3D plaza with Ya Mo (conductor decision M3: cover = loading, live scene = menu).
// Anchored at 80 % across: the car sits in the right half, so screens narrower than 16:9 crop the left side.
// Called by the engine right after the menu is shown (before the world finishes loading).
export function applyMenuCover(ui: HTMLElement) {
  const art = getArt();
  const url = matchMedia('(pointer: coarse)').matches ? (art.coverSmall ?? art.cover) : (art.cover ?? art.coverSmall);
  const menu = ui.querySelector<HTMLElement>('[data-qa=menu]');
  if (!url || !menu) return;
  const cover = document.createElement('div');
  cover.className = 'menu-cover';
  cover.setAttribute('aria-hidden', 'true');
  cover.style.cssText = `position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(ellipse at 50% 60%, rgba(7,6,15,0.1), rgba(7,6,15,0.7)), url("${url}") 80% 50% / cover no-repeat;transition:opacity 1.2s ease;`;
  menu.prepend(cover);
  // fade once the start button is enabled (world + shaders ready)
  const btn = menu.querySelector<HTMLButtonElement>('[data-qa=btn-start]');
  const fade = () => { setTimeout(() => { cover.style.opacity = '0'; setTimeout(() => cover.remove(), 1400); }, 600); };
  if (!btn || !btn.disabled) { fade(); return; }
  const mo = new MutationObserver(() => { if (!btn.disabled) { mo.disconnect(); fade(); } });
  mo.observe(btn, { attributes: true, attributeFilter: ['disabled'] });
}

// Facade atlas (src/track/facade-atlas.ts): SHOP row 0, upper-floor variants A–D (cols 2–5) get the art
// window modules. Emissive = the art at 12 % (it is a night photo) + its bright parts (lit glass) at full.
function paintWindows(map: THREE.Texture, em: THREE.Texture, imgs: (HTMLImageElement | null)[]) {
  const c = map.image as HTMLCanvasElement, e = em.image as HTMLCanvasElement;
  if (!(c instanceof HTMLCanvasElement) || !(e instanceof HTMLCanvasElement)) return;
  const CW = 128, CH = 112, ROW = 0;
  // A/B are by far the most used bays (≈ 70 % of shop fronts) → the lit warm / cool windows go there;
  // C → teal TV glow, D → curtain closed (dark). Index = sorted manifest order 01 warm · 02 cool · 03 dark · 04 teal.
  const pick: Record<number, number> = { 2: 0, 3: 1, 4: 3, 5: 2 };
  const g = c.getContext('2d')!, ge = e.getContext('2d')!;
  const tmp = document.createElement('canvas');
  tmp.width = CW; tmp.height = CH;
  const tg = tmp.getContext('2d', { willReadFrequently: true })!;
  const sx = e.width / c.width;
  for (const [colS, k] of Object.entries(pick)) {
    const img = imgs[k], col = Number(colS);
    if (!img) continue;
    const x = col * CW, y = ROW * CH;
    // albedo: the art is a dark night photo (mean ≈ 0.23) — brighten ×2.2 ('lighter' = additive, works on
    // every browser unlike ctx.filter) so night lighting + building paint tint read like the other facades
    g.drawImage(img, x, y, CW, CH);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.drawImage(img, x, y, CW, CH);
    g.globalAlpha = 0.2;
    g.drawImage(img, x, y, CW, CH);
    g.restore();
    tg.clearRect(0, 0, CW, CH);
    tg.drawImage(img, 0, 0, CW, CH);
    const d = tg.getImageData(0, 0, CW, CH), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const lum = (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255;
      // the art is already a night photo: keep the whole bay faintly visible (0.12) + lit glass at full
      const k2 = 0.12 + 1.2 * Math.max(0, (lum - 0.36) / 0.64);
      p[i] = Math.min(255, p[i] * k2); p[i + 1] = Math.min(255, p[i + 1] * k2); p[i + 2] = Math.min(255, p[i + 2] * k2); p[i + 3] = 255;
    }
    tg.putImageData(d, 0, 0);
    ge.save();
    ge.setTransform(1, 0, 0, 1, 0, 0);
    ge.drawImage(tmp, x * sx, y * sx, CW * sx, CH * sx);
    ge.restore();
  }
  map.needsUpdate = true;
  em.needsUpdate = true;
}
