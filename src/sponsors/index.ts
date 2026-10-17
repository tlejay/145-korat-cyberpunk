// 🏁 Sponsors (BRIEF-sponsors): F1-style start/finish gantry with 5 start lights, perimeter LED boards
// along the main straight + ถนนมนัส, banners on the two 224 footbridges, sponsor art for the 5 rooftop
// billboards (via getSponsorTexture, consumed by src/scene/visuals.ts). Only MADEBYTLE + NDA.
// Nothing is placed on/near the monument, plaza, Chumphon gate, temples or the royal-portrait arch.
//
// Budget: 3 draw calls (LED faces · structure · start lights + LED strips), one 1024×256 canvas atlas.
import * as THREE from 'three';
import { getQuality, onQuality } from '../game/quality.js';
import { sacredFilter } from '../neon/index.js';
import { getTrackExtras } from '../track/index.js';
import type { LandmarksHandle } from '../track/landmarks/index.js';
import type { Sample } from '../track/data.js';
import type { Track, Vec2 } from '../types.js';
import { Geo, frame, uvRect, uvRot, type Col, type Frame } from './geo.js';
import { getAtlas, sponsorFor } from './textures.js';

export { getSponsorTexture } from './textures.js';

// ── start lights API (game loop drives it; see REPORT-sponsors §3) ──
export interface StartLights {
  /** 0..5 red lights on (F1 style, left → right). */
  set(lit: number): void;
  /** all red off + green for 1.5 s ("ไป!"). */
  go(): void;
  off(): void;
  /** Convenience: map the engine countdown (E.countdownS, 4 steps of stepS: 3·2·1·GO) to the lights. */
  countdown(remainingS: number, stepS?: number): void;
  readonly state: { lit: number; green: boolean };
}
let currentLights: StartLights | null = null;
export const getStartLights = () => currentLights;

export interface SponsorStats { boards: number; drawCalls: number; triangles: number; textureBytes: number; placements: { kind: string; x: number; z: number; s?: number; sponsor: string }[] }

const C = {
  metal: [0.13, 0.13, 0.15] as Col,
  dark: [0.05, 0.05, 0.06] as Col,
  lens: [0.07, 0.015, 0.012] as Col,
  red: [2.4, 0.12, 0.06] as Col,
  green: [0.25, 2.3, 0.5] as Col,
  strip: [0.75, 0.5, 1.5] as Col,     // madebytle purple LED edge
  stripNda: [1.6, 0.55, 0.22] as Col, // NDA orange LED edge
};
const FACE: Col = [1.12, 1.12, 1.12]; // LED face brightness (> bloom threshold for the bright pixels only)

const WINDOWS = [
  { name: 'main-straight', s0: 14, s1: 470, perSide: 5 },
  { name: 'pre-finish', s0: 2870, s1: 3296, perSide: 3 },
  { name: 'manat', s0: 1240, s1: 1990, perSide: 5 },
];
const BOARD_LEN = 8, BOARD_Y0 = 0.12, BOARD_Y1 = 1.12, MAX_BOARDS = 25;
const LIGHT_BRIDGE_S = 38; // start-light repeater ahead of the grid (the grid is 10 m past the line)

export function buildSponsors(track: Track): THREE.Group {
  const group = new THREE.Group();
  group.name = 'sponsors';
  const extras = getTrackExtras();
  if (!extras || track.root.name !== 'track-A') return group; // stub track: nothing to dress
  const samples = extras.data.samples;
  const L = extras.data.lengthM, n = samples.length, step = L / n;

  let lm: LandmarksHandle | null = null;
  track.root.traverse((o) => { const h = (o as THREE.Object3D & { landmarks?: LandmarksHandle }).landmarks; if (h) lm = h; });
  const lmh = lm as LandmarksHandle | null;
  const sacred = sacredFilter({ x: extras.monument.x, z: extras.monument.z }, lmh?.claimed ?? []);
  const zones = track.zones.noBoostNoJump;
  const nearZone = (x: number, z: number, m: number) => zones.some((poly) => inPoly(x, z, poly) || polyDist(x, z, poly) < m);
  const excluded = (x: number, z: number) => sacred(x, z) || nearZone(x, z, 10);

  const at = (s: number): Sample & { rx: number; rz: number } => {
    const f = (((s % L) + L) % L) / step, i = Math.floor(f) % n, j = (i + 1) % n, t = f - Math.floor(f);
    const a = samples[i], b = samples[j];
    const tx = a.tx + (b.tx - a.tx) * t, tz = a.tz + (b.tz - a.tz) * t, l = Math.hypot(tx, tz) || 1;
    return { ...a, x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, tx: tx / l, tz: tz / l, rx: -tz / l, rz: tx / l };
  };
  const drivable = (x: number, z: number) => { const k = track.surfaceAt(x, z); return k === 'road' || k === 'curb'; };
  /** distance from the centreline to the first non-drivable cell on one side (= where the collider wall is). */
  const edge = (s: number, side: 1 | -1) => {
    const p = at(s);
    for (let d = 0.5; d < 30; d += 0.15) if (!drivable(p.x + p.rx * side * d, p.z + p.rz * side * d)) return d;
    return Infinity;
  };

  const led = new Geo(), struct = new Geo(), lights = new Geo();
  const placements: SponsorStats['placements'] = [];
  const row = (id: 'madebytle' | 'nda') => (id === 'madebytle' ? 0 : 1);

  // ── 1. perimeter boards ──
  let boards = 0;
  for (const w of WINDOWS) {
    for (const side of [1, -1] as const) {
      let placed = 0;
      for (let s = w.s0; s + BOARD_LEN <= w.s1 && placed < w.perSide && boards < MAX_BOARDS;) {
        const ds = [0, BOARD_LEN / 2, BOARD_LEN].map((o) => edge(s + o, side));
        const pa = at(s), pb = at(s + BOARD_LEN);
        const turn = Math.abs(Math.atan2(pa.tx * pb.tz - pa.tz * pb.tx, pa.tx * pb.tx + pa.tz * pb.tz));
        const ok = ds.every((d) => d < 22) && Math.max(...ds) - Math.min(...ds) < 0.7 && turn < 0.1;
        const P = (p: typeof pa, d: number) => ({ x: p.x + p.rx * side * (d + 0.06), z: p.z + p.rz * side * (d + 0.06) });
        const A = P(pa, ds[0]), B = P(pb, ds[2]);
        const mid = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 };
        if (!ok || [A, B, mid].some((q) => excluded(q.x, q.z)) || Math.abs(s - LIGHT_BRIDGE_S) < BOARD_LEN) { s += step; continue; }
        // face the road: normal from the board line towards the centreline
        const len = Math.hypot(B.x - A.x, B.z - A.z), dx = (B.x - A.x) / len, dz = (B.z - A.z) / len;
        let nx = dz, nz = -dx;
        if (nx * (pa.x - mid.x) + nz * (pa.z - mid.z) < 0) { nx = -nx; nz = -nz; }
        const f = frame(mid.x, mid.z, nx, nz);
        const id = sponsorFor(boards);
        struct.box(f, -len / 2, len / 2, 0, BOARD_Y1 + 0.08, -0.16, 0, C.dark);
        led.panel(f, -len / 2 + 0.04, len / 2 - 0.04, BOARD_Y0, BOARD_Y1, 0.012, FACE, uvRect(0, 0, 1, 1), [row(id), boards * 0.137, 1]);
        placements.push({ kind: `board:${w.name}`, x: +mid.x.toFixed(1), z: +mid.z.toFixed(1), s: Math.round(s), sponsor: id });
        boards++; placed++;
        s += BOARD_LEN + 0.25;
      }
    }
  }

  // ── 2. start / finish gantry at finishLine (ref-6) ──
  const lightRanges: [number, number][][] = [[], [], [], [], []]; // per light: vertex ranges (every bank)
  const addLightBank = (f: Frame, y0: number, v: number) => {
    for (let k = 0; k < 5; k++) {
      const start = lights.vertexCount;
      for (const y of [y0, y0 + 0.46]) lights.panel(f, -1.2 + k * 0.6 - 0.19, -1.2 + k * 0.6 + 0.19, y, y + 0.38, v, C.lens);
      lightRanges[k].push([start, lights.vertexCount]);
    }
  };
  {
    const sF = 0, p = at(sF), dL = edge(sF, -1), dR = edge(sF, 1);
    const fS = frame(p.x, p.z, -p.tx, -p.tz); // faces traffic arriving at the line (u = +right of travel)
    const legOff = (side: 1 | -1, d: number) => {
      // stand on the far side of the wall; if the moat is right there, hug the bank
      const q = at(sF), beyond = track.surfaceAt(q.x + q.rx * side * (d + 1.2), q.z + q.rz * side * (d + 1.2));
      return d + (beyond === 'water' ? 0.3 : 0.6);
    };
    const uL = -legOff(-1, dL), uR = legOff(1, dR);
    const top = 9.8, b0 = 7.1, b1 = 9.5;
    for (const u of [uL, uR]) {
      struct.box(fS, u - 0.45, u + 0.45, 0, top, -0.5, 0.5, C.metal);
      // tall LED panels on both faces of each leg (text runs bottom → top)
      for (const [ff, k] of [[fS, 0], [frame(p.x, p.z, p.tx, p.tz), 1]] as const) {
        const uu = ff === fS ? u : -u, id = sponsorFor((u === uL ? 0 : 1) + k);
        led.panel(ff, uu - 0.38, uu + 0.38, 0.5, 0.5 + 0.76 * 8, 0.505, FACE, uvRot(0, 0, 1, 1), [row(id), 0.3 + k * 0.5, 1]);
      }
    }
    struct.box(fS, uL - 0.45, uR + 0.45, b0, b1, -0.55, 0.55, C.metal, true);
    const span = uR - uL + 0.9, bh = b1 - b0 - 0.24, reps = Math.max(1, Math.round((span / bh / 8) * 2) / 2);
    led.panel(fS, uL - 0.4, uR + 0.4, b0 + 0.12, b1 - 0.12, 0.56, FACE, uvRect(0, 0, reps, 1), [0, 0, 0]);       // south face: madebytle
    const fN = frame(p.x, p.z, p.tx, p.tz);
    led.panel(fN, -uR - 0.4, -uL + 0.4, b0 + 0.12, b1 - 0.12, 0.56, FACE, uvRect(0, 0, reps, 1), [1, 0, 0]);    // north face: NDA
    // LED edge strips under the beam (brand colours)
    lights.panel(fS, uL - 0.4, uR + 0.4, b0 - 0.02, b0 + 0.06, 0.57, C.strip);
    lights.panel(fN, -uR - 0.4, -uL + 0.4, b0 - 0.02, b0 + 0.06, 0.57, C.stripNda);
    // light pod hanging under the beam centre, lenses on both faces
    struct.box(fS, -1.65, 1.65, 5.75, b0, -0.3, 0.3, C.dark, true);
    addLightBank(fS, 5.95, 0.31);
    addLightBank(fN, 5.95, 0.31);
    placements.push({ kind: 'gantry', x: +p.x.toFixed(1), z: +p.z.toFixed(1), s: 0, sponsor: 'madebytle|nda' });
  }

  // ── 3. start-light repeater ahead of the grid (the chase camera looks north, away from the line) ──
  {
    const sB = LIGHT_BRIDGE_S, p = at(sB), dL = edge(sB, -1), dR = edge(sB, 1);
    const f = frame(p.x, p.z, -p.tx, -p.tz), uL = -(dL + 0.4), uR = dR + 0.4;
    for (const u of [uL, uR]) struct.box(f, u - 0.15, u + 0.15, 0, 7.3, -0.15, 0.15, C.metal);
    struct.box(f, uL - 0.15, uR + 0.15, 6.8, 7.3, -0.2, 0.2, C.metal, true);
    struct.box(f, -1.65, 1.65, 5.75, 6.8, -0.3, 0.3, C.dark, true);
    lights.panel(f, uL, uR, 6.76, 6.84, 0.21, C.strip);
    addLightBank(f, 5.95, 0.31);
    placements.push({ kind: 'start-lights', x: +p.x.toFixed(1), z: +p.z.toFixed(1), s: sB, sponsor: '-' });
  }

  // ── 4. banners on the two 224 footbridges (streetscape.bridges) ──
  const br = extras.data.raw.streetscape.bridges;
  for (let i = 0, k = 0; i + 4 < br.length; i += 5, k++) {
    const ax = br[i] * 0.1, az = br[i + 1] * 0.1, bx = br[i + 2] * 0.1, bz = br[i + 3] * 0.1;
    // nearest centreline sample to the bridge middle → travel direction
    let best = 0, bd = Infinity;
    for (let j = 0; j < n; j++) { const d = (samples[j].x - (ax + bx) / 2) ** 2 + (samples[j].z - (az + bz) / 2) ** 2; if (d < bd) { bd = d; best = j; } }
    const sp = samples[best];
    const ux = bx - ax, uz = bz - az, ul = Math.hypot(ux, uz);
    const tproj = Math.max(0.15, Math.min(0.85, ((sp.x - ax) * ux + (sp.z - az) * uz) / (ul * ul)));
    const cx = ax + ux * tproj, cz = az + uz * tproj;
    const W = Math.min(12.8, ul - 3), H = W / 8;
    for (const [dir, id] of [[-1, sponsorFor(k)], [1, sponsorFor(k + 1)]] as const) {
      const f = frame(cx, cz, sp.tx * dir, sp.tz * dir);
      struct.box(f, -W / 2 - 0.1, W / 2 + 0.1, 5.5, 5.6 + H + 0.1, 1.1, 1.22, C.dark, true);
      led.panel(f, -W / 2, W / 2, 5.6, 5.6 + H, 1.235, FACE, uvRect(0, 0, 1, 1), [row(id), 0, 0]);
      lights.panel(f, -W / 2 - 0.1, W / 2 + 0.1, 5.42, 5.5, 1.2, id === 'madebytle' ? C.strip : C.stripNda);
    }
    placements.push({ kind: 'bridge', x: +cx.toFixed(1), z: +cz.toFixed(1), sponsor: `${sponsorFor(k)}|${sponsorFor(k + 1)}` });
  }

  // ── meshes ──
  const atlas = getAtlas();
  atlas.wrapS = THREE.RepeatWrapping;
  const uTime = { value: 0 }, uShine = { value: 1 };
  const ledMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, toneMapped: false });
  ledMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.uniforms.uShine = uShine;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aLed;\nuniform float uTime;\nvarying float vDim;\nvarying float vU;\nvarying float vPh;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
  // aLed = (sponsor row, phase, flips): LED boards swap sponsor every 7 s with a short fade (≤ 0.3 Hz)
  float ph = uTime / 7.0 + aLed.y;
  float slot = mod(aLed.x + floor(ph) * aLed.z, 2.0);
  vMapUv.y = vMapUv.y * 0.5 + (slot < 0.5 ? 0.5 : 0.0);
  float fr = fract(ph);
  vDim = aLed.z > 0.5 ? smoothstep(0.0, 0.04, fr) * smoothstep(1.0, 0.985, fr) : 1.0;
  vU = uv.x; vPh = aLed.y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uShine;\nvarying float vDim;\nvarying float vU;\nvarying float vPh;')
      .replace('#include <map_fragment>', `#include <map_fragment>
  // slow highlight sweep across the LED face (one pass per 4 s)
  float sw = fract(vU * 0.5 - uTime * 0.25 + vPh) - 0.5;
  diffuseColor.rgb *= vDim * (1.0 + uShine * 0.28 * exp(-sw * sw * 60.0));`);
  };
  ledMat.customProgramCacheKey = () => 'sponsor-led';
  const ledMesh = new THREE.Mesh(led.build(true), ledMat);
  ledMesh.name = 'sponsor-led';
  ledMesh.onBeforeRender = () => { uTime.value = (performance.now() / 1000) % 8400; };

  const structMesh = new THREE.Mesh(struct.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.45 }));
  structMesh.name = 'sponsor-structure';

  const lightGeo = lights.build();
  const lightMesh = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  lightMesh.name = 'sponsor-start-lights';
  group.add(ledMesh, structMesh, lightMesh);

  // ── start lights state ──
  const colAttr = lightGeo.getAttribute('color') as THREE.BufferAttribute;
  const paint = (k: number, c: Col) => {
    for (const [a, b] of lightRanges[k]) for (let v = a; v < b; v++) colAttr.setXYZ(v, c[0], c[1], c[2]);
  };
  const state = { lit: 0, green: false };
  let greenUntil = 0;
  const apply = () => {
    for (let k = 0; k < 5; k++) paint(k, state.green ? C.green : k < state.lit ? C.red : C.lens);
    colAttr.needsUpdate = true;
  };
  const api: StartLights = {
    set(lit) { const v = Math.max(0, Math.min(5, Math.round(lit))); if (v === state.lit && !state.green) return; state.lit = v; state.green = false; apply(); },
    go() { state.lit = 0; state.green = true; greenUntil = performance.now() + 1500; apply(); },
    off() { if (!state.lit && !state.green) return; state.lit = 0; state.green = false; apply(); },
    countdown(remainingS, stepS = 0.8) {
      if (remainingS <= stepS) { if (!state.green && state.lit) api.go(); return; }
      // lights 1→5 come on over the "3 · 2 · 1" steps, all five lit just before GO
      api.set(Math.min(5, Math.floor(((4 * stepS - remainingS) / (3 * stepS)) * 5) + 1));
    },
    state,
  };
  lightMesh.onBeforeRender = () => { if (state.green && performance.now() > greenUntil) api.off(); };
  currentLights = api;

  const applyQ = () => { uShine.value = getQuality().tier === 'low' ? 0 : 1; };
  applyQ();
  const offQ = onQuality(applyQ);

  const tris = [ledMesh, structMesh, lightMesh].reduce((a, m) => a + (m.geometry.index?.count ?? 0) / 3, 0);
  const stats: SponsorStats = { boards, drawCalls: 3, triangles: tris, textureBytes: Math.round(1024 * 256 * 4 * 4 / 3), placements };
  group.userData.startLights = api;
  if (typeof location !== 'undefined' && /[?&]qa=1/.test(location.search)) (window as unknown as { __sponsors: unknown }).__sponsors = { stats, lights: api };
  group.userData.stats = stats;
  group.userData.dispose = () => {
    offQ();
    if (currentLights === api) currentLights = null;
    for (const m of [ledMesh, structMesh, lightMesh]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
  };
  return group;
}

function inPoly(x: number, z: number, poly: Vec2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
function polyDist(x: number, z: number, poly: Vec2[]) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}
