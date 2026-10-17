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
import { WALL_BUILDING, WALL_MOAT, WALL_NEON, WALL_PLAZA, WALL_PROP, WALL_RAIL, type Sample } from '../track/data.js';
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

const BOARD_LEN = 8, BOARD_Y0 = 0.12, BOARD_Y1 = 1.12, MAX_BOARDS = 25;
const LIGHT_BRIDGE_AHEAD = 20; // start-light repeater this far ahead of the grid (chase cam looks away from the line)

/** Board windows, derived from track features (not raw s) so a rebuilt track-A.json keeps them on the right roads. */
function boardWindows(L: number, corners: { s: number }[], roads: { s0: number; s1: number; name: string }[]) {
  const manat = roads.find((r) => r.name.includes('มนัส'));
  return [
    // ราชดำเนิน before the line: start 190 m after the last corner so Wat Sutthachinda's gate and lotus-baluster
    // wall (research A-30/A-31) stay clear
    { name: 'pre-finish', s0: (corners.at(-1)?.s ?? L - 340) + 190, s1: L - 12, perSide: 3 },
    // ราชดำเนิน after the line, up to the 224 corner (the plaza stretch is removed by the sacred/zone filter)
    { name: 'main-straight', s0: 15, s1: (corners[0]?.s ?? 500) - 40, perSide: 5 },
    // ถนนมนัส after the moat causeway
    ...(manat ? [{ name: 'manat', s0: manat.s0 + 130, s1: manat.s1 - 35, perSide: 5 }] : []),
  ];
}

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
  // zone = plaza + gate hull grown 15 m; +30 m more keeps every logo ≥ 45 m from the plaza edge
  const excluded = (x: number, z: number) => sacred(x, z) || nearZone(x, z, 30);

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

  // collider walls (world): boards are mounted on the track face of rails / moat balustrades / building
  // fronts — never on neon junction barriers, the plaza balustrade or prop colliders
  const WALLS = extras.walls.filter((w) => w.kind !== WALL_PROP);
  const CELL = 8, wallGrid = new Map<string, typeof WALLS>();
  for (const w of WALLS) {
    const x0 = Math.floor(Math.min(w.a.x, w.b.x) / CELL), x1 = Math.floor(Math.max(w.a.x, w.b.x) / CELL);
    const z0 = Math.floor(Math.min(w.a.z, w.b.z) / CELL), z1 = Math.floor(Math.max(w.a.z, w.b.z) / CELL);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const k = `${i},${j}`;
      let l = wallGrid.get(k);
      if (!l) wallGrid.set(k, (l = []));
      l.push(w);
    }
  }
  const nearestWall = (x: number, z: number, maxD: number, pred: (kind: number) => boolean = () => true) => {
    let best: { kind: number; d: number; x: number; z: number } | null = null;
    const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (const w of wallGrid.get(`${i},${j}`) ?? []) {
      if (!pred(w.kind)) continue;
      const dx = w.b.x - w.a.x, dz = w.b.z - w.a.z, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - w.a.x) * dx + (z - w.a.z) * dz) / l2));
      const px = w.a.x + dx * t, pz = w.a.z + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < maxD && (!best || d < best.d)) best = { kind: w.kind, d, x: px, z: pz };
    }
    return best;
  };
  const MOUNT = (k: number) => k === WALL_RAIL || k === WALL_MOAT || k === WALL_BUILDING;
  const AVOID = (k: number) => k === WALL_NEON || k === WALL_PLAZA;

  const led = new Geo(), struct = new Geo(), lights = new Geo();
  const placements: SponsorStats['placements'] = [];
  const row = (id: 'madebytle' | 'nda') => (id === 'madebytle' ? 0 : 1);

  // ── 1. perimeter boards (runs of 3, F1 style) ──
  let boards = 0;
  const LIGHT_BRIDGE_S = (extras.data.raw.startGrid?.s ?? 10) + LIGHT_BRIDGE_AHEAD;
  for (const w of boardWindows(L, extras.corners, extras.roadNames)) {
    for (const side of [1, -1] as const) {
      let placed = 0, run = 0;
      for (let s = w.s0; s + BOARD_LEN <= w.s1 && placed < w.perSide && boards < MAX_BOARDS;) {
        const skip = () => { s += step; run = 0; };
        const pa = at(s), pb = at(s + BOARD_LEN);
        const turn = Math.abs(Math.atan2(pa.tx * pb.tz - pa.tz * pb.tx, pa.tx * pb.tx + pa.tz * pb.tz));
        const ds = [0, BOARD_LEN / 2, BOARD_LEN].map((o) => edge(s + o, side));
        if (turn > 0.1 || !ds.every((d) => d < 22) || Math.max(...ds) - Math.min(...ds) > 0.7 || Math.abs(s - LIGHT_BRIDGE_S) < BOARD_LEN) { skip(); continue; }
        // snap the board ends onto the real collider walls
        const E = (p: typeof pa, d: number) => nearestWall(p.x + p.rx * side * d, p.z + p.rz * side * d, 0.9, MOUNT);
        const ea = E(pa, ds[0]), eb = E(pb, ds[2]), em = E(at(s + BOARD_LEN / 2), ds[1]);
        if (!ea || !eb || !em) { skip(); continue; }
        const A = { x: ea.x, z: ea.z }, B = { x: eb.x, z: eb.z };
        const len = Math.hypot(B.x - A.x, B.z - A.z);
        const mid = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 };
        // chord must follow the wall (no corner cutting) and stay clear of neon barriers / plaza / sacred sites
        let bad = len < BOARD_LEN * 0.8 || Math.hypot(mid.x - em.x, mid.z - em.z) > 0.35;
        for (let q = 0; q <= 4 && !bad; q++) {
          const x = A.x + (B.x - A.x) * q / 4, z = A.z + (B.z - A.z) * q / 4;
          bad = excluded(x, z) || !!nearestWall(x, z, 2.5, AVOID);
        }
        if (bad) { skip(); continue; }
        // face the road: normal from the board line towards the centreline
        const dx = (B.x - A.x) / len, dz = (B.z - A.z) / len;
        let nx = dz, nz = -dx;
        if (nx * (pa.x - mid.x) + nz * (pa.z - mid.z) < 0) { nx = -nx; nz = -nz; }
        const f = frame(mid.x + nx * 0.04, mid.z + nz * 0.04, nx, nz); // 4 cm proud of the collider line, in front of the rail
        const id = sponsorFor(boards);
        struct.box(f, -len / 2, len / 2, 0, BOARD_Y1 + 0.06, -0.14, 0, C.dark);
        led.panel(f, -len / 2 + 0.04, len / 2 - 0.04, BOARD_Y0, BOARD_Y1, 0.008, FACE, uvRect(0, 0, 1, 1), [row(id), boards * 0.137, 1]);
        placements.push({ kind: `board:${w.name}`, x: +mid.x.toFixed(1), z: +mid.z.toFixed(1), s: Math.round(s), sponsor: id });
        boards++; placed++; run++;
        s += BOARD_LEN + 0.15;
        if (run === 3) { run = 0; s += 30; } // gap between runs so they read as separate hoardings
      }
    }
  }

  // ── 2. start / finish gantry at finishLine (ref-6) ──
  const lightRanges: [number, number][][] = [[], [], [], [], []]; // per light: vertex ranges (every bank)
  const addLightBank = (f: Frame, y0: number, v: number) => {
    for (let k = 0; k < 5; k++) {
      const start = lights.vertexCount;
      // spread wide (1.1 m pitch) so the outer lights clear the big HUD countdown digit in the screen centre
      const u = (k - 2) * 1.1;
      for (const y of [y0, y0 + 0.56]) lights.panel(f, u - 0.24, u + 0.24, y, y + 0.48, v, C.lens);
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
      // tall LED panels on both faces of each leg (text runs bottom → top) — not on the leg that stands in
      // the plaza buffer (east leg: 8.7 m from the Ya Mo plaza edge, inside its 15 m no-boost margin)
      const lx = p.x + p.rx * u, lz = p.z + p.rz * u;
      if (nearZone(lx, lz, 0)) continue;
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
    struct.box(fS, -2.85, 2.85, 5.75, b0, -0.3, 0.3, C.dark, true);
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
    struct.box(f, -2.85, 2.85, 5.75, 7.05, -0.3, 0.3, C.dark, true);
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
  if (typeof location !== 'undefined' && /[?&]qa=1/.test(location.search)) (window as unknown as { __sponsors: unknown }).__sponsors = { stats, lights: api, group };
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
