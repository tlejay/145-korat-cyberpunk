// Ya Mo plaza: Thao Suranari monument (terrace, pedestal, offerings, bronze statue, key light),
// plaza paving + lamps + Thai salas, Chumphon Gate and the white bai-sema city wall beside the moat.
// Footprints: OSM via track-A.json (plaza way/31257513, terrace way/549315244, gate way/549315243).
import * as THREE from 'three';
import { toRing, type RawTrack } from '../data.js';
import type { Vec2 } from '../../types.js';
import {
  P, col, centroid, extrudeUY, fbox, frameAt, globe, pcaFrame, prism, prismRing, semaWall, thaiRoof,
  type Frame, type GeoBuilder, type V3,
} from './kit.js';
import { Site } from './site.js';
import { buildStatueGeometry } from './statue.js';
import type { LandmarkMaterials } from './materials.js';

const C = {
  marble: col(0xd9d6cf), marbleTop: col(0xe6e3dc), granite: col(0x8d8a86), graniteDark: col(0x3c3a3c),
  white: col(0xf1ece0), whiteShade: col(0xd9d2c2), plaster: col(0xece5d3), laterite: col(0x6e3f2c),
  maroon: col(0x6b2526), maroonDark: col(0x4a1718), wood: col(0x5a3322), tile: col(0x9a3f22), tileDark: col(0x7c3019),
  trim: col(0xf4efe4), black: col(0x1c1c22), gold: col(0xd9a63a), dark: col(0x16131a), pole: col(0x202026),
  orangeTile: col(0xc4552a),
};
const G = {
  lamp: col(0xfff1cf), warm: col(0xffc46b), marigold: col(0xff8f1a), marigold2: col(0xffb52e), pink: col(0xff5fa0),
  goldGlow: col(0xffcf5a), window: col(0xffb24d), incense: col(0xff4a1a), sign: col(0xffd25a),
};

// Inset (positive d) a roughly convex ring toward its centroid.
function inset(ring: Vec2[], d: number): Vec2[] {
  const c = centroid(ring);
  return ring.map((p) => { const dx = p.x - c.x, dz = p.z - c.z, l = Math.hypot(dx, dz) || 1; return { x: p.x - (dx / l) * d, z: p.z - (dz / l) * d }; });
}

// Ornate plaza lamp: dark iron post with three globes (research/landmarks/img/gate-01.jpg).
export function tripleLamp(s: Site, x: number, z: number, h = 4.2) {
  prism(s.stone, x, z, 0.16, 0.12, 0, 0.6, 6, C.pole);
  prism(s.stone, x, z, 0.07, 0.06, 0.6, h, 6, C.pole);
  for (const [dx, dz, dy] of [[0, 0, 0.35], [0.55, 0, 0], [-0.55, 0, 0]] as const) {
    s.stone.box(x + dx / 2, h - 0.05, z + dz, Math.abs(dx) + 0.06, 0.05, 0.05, 0, C.pole);
    globe(s.glow, x + dx, h + 0.22 + dy, z + dz, 0.2, G.lamp, 6, 3);
    s.halo(x + dx, h + 0.22 + dy, z + dz, G.warm, 0.55);
  }
}

// Granite pillar with a single globe lamp (terrace balustrade, trackA-37).
function pillarLamp(s: Site, x: number, z: number, y: number) {
  s.stone.box(x, y + 0.7, z, 0.62, 1.4, 0.62, 0, C.granite, C.marbleTop);
  s.stone.box(x, y + 1.45, z, 0.72, 0.1, 0.72, 0, C.granite);
  prism(s.stone, x, z, 0.06, 0.05, y + 1.5, y + 3.2, 6, C.pole);
  globe(s.glow, x, y + 3.4, z, 0.24, G.lamp, 6, 3);
  s.halo(x, y + 3.4, z, G.warm, 0.6);
}

// Small Thai sala (open pavilion) — white posts, orange tile two-tier roof.
export function sala(s: Site, f: Frame, lu: number, lv: number, h: number, roof = C.orangeTile, trim = C.trim) {
  const post = 0.22;
  const nu = Math.max(2, Math.round(lu / 3) + 1), nv = 2;
  s.stone.box(f.ox, 0.2, f.oz, lu + 0.6, 0.4, lv + 0.6, Math.atan2(-f.uz, f.ux), C.marble, C.marbleTop);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const u = -lu / 2 + (lu * i) / (nu - 1), v = j ? lv / 2 : -lv / 2;
    fbox(s.stone, f, u, v, 0.4, post, post, h - 0.4, C.white);
  }
  fbox(s.stone, f, 0, 0, h, lu + 0.3, lv + 0.3, 0.25, C.white);
  thaiRoof(s.stone, f, 0, 0, lu + 0.6, lv + 1.6, h + 0.25, h + 0.25 + lv * 0.42, roof, trim, { tiers: 2, chofa: true });
  // warm underside lights
  for (let i = 0; i < nu - 1; i++) {
    const u = -lu / 2 + (lu * (i + 0.5)) / (nu - 1), [x, , z] = P(f, u, 0, 0);
    s.glow.box(x, h - 0.05, z, 0.4, 0.08, 0.4, 0, G.warm);
    s.halo(x, h - 0.2, z, G.warm, 0.35);
  }
}

// Marigold swag (พวงมาลัยดาวเรือง) along a catenary between two points.
function swag(g: GeoBuilder, a: V3, b: V3, sag: number, n = 7) {
  for (let k = 0; k <= n; k++) {
    const t = k / n, y = a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag;
    g.box(a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t, 0.11, 0.11, 0.11, t * 3, k % 3 === 1 ? G.marigold2 : G.marigold);
  }
}

export interface YamoResult { site: Site; statue: THREE.Mesh; monumentLight: THREE.PointLight; gateCenter: THREE.Vector3; claimed: Vec2[][] }

export function buildYamo(raw: RawTrack, m: LandmarkMaterials, signRow: (i: number) => { u0: number; u1: number; v0: number; v1: number },
  free: (x: number, z: number) => boolean): YamoResult {
  const s = new Site('yamo');
  const lm = raw.landmarks;

  // ── plaza paving (marble tiles) ──
  const plaza = toRing(lm.plaza);
  prismRing(s.stone, plaza, 0, 0.06, C.granite, C.marble, [1 / 1.2, 1]);
  // lamps along the plaza edge, ~14 m apart, 1.4 m inside
  {
    const pc = centroid(plaza);
    let acc = 7;
    for (let i = 0; i < plaza.length; i++) {
      const p = plaza[i], q = plaza[(i + 1) % plaza.length], l = Math.hypot(q.x - p.x, q.z - p.z);
      while (acc < l) {
        const t = acc / l, x = p.x + (q.x - p.x) * t, z = p.z + (q.z - p.z) * t;
        const dx = pc.x - x, dz = pc.z - z, dl = Math.hypot(dx, dz) || 1;
        const lx = x + (dx / dl) * 1.4, lz = z + (dz / dl) * 1.4;
        // keep clear of the terrace and the gate
        if (Math.hypot(lx, lz) > 17 && !(lx > 14 && lx < 33 && lz > -26 && lz < 23) && free(lx, lz) && free(lx + 0.6, lz) && free(lx - 0.6, lz)) tripleLamp(s, lx, lz);
        acc += 14;
      }
      acc -= l;
    }
  }

  // ── monument terrace (ฐานไพที): 5 marble steps all round, balustrade with lamp pillars ──
  const terrace = toRing(lm.monument.terrace);
  const STEP = 0.18, N_STEPS = 5;
  for (let k = 0; k < N_STEPS; k++) {
    prismRing(s.stone, inset(terrace, k * 0.42), 0.06, 0.06 + STEP * (k + 1), C.marble, C.marbleTop, [1 / 1.2, 1]);
  }
  const topY = 0.06 + STEP * N_STEPS; // 0.96
  const top = inset(terrace, (N_STEPS - 1) * 0.42);
  // granite parapet + pillars on N, S, E (west = open steps toward the road, she faces west)
  const tc = centroid(top);
  for (let i = 0; i < top.length; i++) {
    const p = top[i], q = top[(i + 1) % top.length];
    const mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2;
    const facingWest = mx - tc.x < -8;
    pillarLamp(s, p.x + (tc.x - p.x) * 0.04, p.z + (tc.z - p.z) * 0.04, topY);
    if (facingWest) continue;
    const len = Math.hypot(q.x - p.x, q.z - p.z);
    const f: Frame = { ox: mx, oz: mz, ux: (q.x - p.x) / len, uz: (q.z - p.z) / len };
    // opening in the middle of each long side
    if (len > 12) for (const sgn of [-1, 1]) fbox(s.stone, f, sgn * (len / 4 + 1.2), 0, topY, len / 2 - 2.6, 0.32, 0.75, C.granite, C.marbleTop);
    else fbox(s.stone, f, 0, 0, topY, len - 0.8, 0.32, 0.75, C.granite, C.marbleTop);
  }

  // ── inner platform, offering table, pedestal ──
  const mx = lm.monument.x, mz = lm.monument.z;
  s.lit.box(mx, topY + 0.15, mz, 7.6, 0.3, 7.6, 0, C.marble, C.marbleTop);
  s.lit.box(mx, topY + 0.38, mz, 5.4, 0.16, 5.4, 0, C.marble, C.marbleTop);
  const pY = topY + 0.46;
  // offering table in front (west): dark granite with gold bowls, flowers, incense
  s.stone.box(mx - 3.3, pY + 0.4 - 0.16, mz, 1.0, 0.8, 3.4, 0, C.graniteDark, C.graniteDark);
  for (let k = 0; k < 7; k++) {
    const z = mz - 1.4 + k * 0.47;
    prism(s.glow, mx - 3.3, z, 0.13, 0.17, pY + 0.64, pY + 0.78, 6, k % 2 ? G.goldGlow : G.marigold);
    if (k % 2 === 0) s.glow.box(mx - 3.3, pY + 0.86, z, 0.16, 0.12, 0.16, k, k % 4 ? G.pink : G.marigold2);
  }
  prism(s.glow, mx - 3.85, mz, 0.22, 0.28, pY - 0.16, pY + 0.3, 8, G.goldGlow); // incense urn
  for (let k = 0; k < 6; k++) s.glow.box(mx - 3.85 + Math.cos(k) * 0.12, pY + 0.55, mz + Math.sin(k) * 0.12, 0.015, 0.5, 0.015, 0, G.incense);
  s.halo(mx - 3.3, pY + 0.9, mz, G.warm, 0.5);

  // white pedestal: two plinth steps, chamfered shaft, moulded capital (plaza-01.jpg)
  const L = s.lit;
  L.box(mx, pY + 0.2, mz, 2.1, 0.4, 2.1, 0, C.white, C.whiteShade);
  L.box(mx, pY + 0.52, mz, 1.7, 0.24, 1.7, 0, C.white, C.whiteShade);
  prism(L, mx, mz, 0.78, 0.72, pY + 0.64, pY + 0.8, 8, C.whiteShade, Math.PI / 8);
  prism(L, mx, mz, 0.62, 0.57, pY + 0.8, pY + 2.3, 8, C.white, Math.PI / 8);
  prism(L, mx, mz, 0.6, 0.78, pY + 2.3, pY + 2.46, 8, C.whiteShade, Math.PI / 8);
  L.box(mx, pY + 2.52, mz, 1.2, 0.12, 1.2, 0, C.white, C.whiteShade);
  const statueY = pY + 2.58;
  // bronze plaque on the west face of the shaft
  s.stone.box(mx - 0.6, pY + 1.45, mz, 0.04, 0.5, 0.62, 0, C.graniteDark);
  // marigold garlands draped round the shaft + coloured cloth band
  const corners: V3[] = [0, 1, 2, 3].map((k) => { const a = Math.PI / 4 + (k * Math.PI) / 2; return [mx + Math.cos(a) * 0.68, pY + 2.0, mz + Math.sin(a) * 0.68]; });
  for (let k = 0; k < 4; k++) swag(s.glow, corners[k], corners[(k + 1) % 4], 0.3, 9);
  // marigold chains looped round the pedestal foot
  for (const [rr, y, n] of [[1.12, pY + 0.47, 28], [0.98, pY + 0.7, 24]] as const) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      s.glow.box(mx + Math.cos(a) * rr, y, mz + Math.sin(a) * rr, 0.13, 0.13, 0.13, a, k % 3 ? G.marigold : G.marigold2);
    }
  }

  // ── statue ──
  const statue = new THREE.Mesh(buildStatueGeometry(), m.bronze);
  statue.name = 'thao-suranari';
  statue.position.set(mx, statueY, mz);
  statue.rotation.y = 0; // modelled facing −x = west (facingDeg 270)
  statue.updateMatrix();
  statue.matrixAutoUpdate = false;
  s.extra.push(statue);

  // warm key light from the front-left, low, so the face and sword catch light
  const monumentLight = new THREE.PointLight(0xffd6a6, 34, 30, 1.5);
  monumentLight.position.set(mx - 6.5, statueY + 1.6, mz + 2.2);
  monumentLight.name = 'monument-key';
  s.extra.push(monumentLight);
  // ground uplight fixtures (visible sources) at the platform corners
  for (const [dx, dz] of [[-2.9, -2.9], [-2.9, 2.9], [2.9, -2.9], [2.9, 2.9]]) {
    s.stone.box(mx + dx, topY + 0.38, mz + dz, 0.35, 0.16, 0.35, 0, C.black);
    s.glow.box(mx + dx, topY + 0.47, mz + dz, 0.25, 0.03, 0.25, 0, G.lamp);
    s.halo(mx + dx, topY + 0.6, mz + dz, G.warm, 0.7);
  }

  // ── Thai salas: long sala south of the terrace + small offering kiosks to the north ──
  sala(s, frameAt(4, 31, 0), 15, 5.5, 3.2);
  for (const [x, z] of [[-9, -22], [-3, -24], [3, -24]] as const) sala(s, frameAt(x, z, 0), 2.6, 2.6, 2.4);

  // ── Chumphon Gate ──
  const gate = buildChumphonGate(s, toRing(lm.gate.ring), signRow);

  // ── white city wall (bai sema) continuing from the gate along the moat's inner bank ──
  const walls = cityWallPaths(raw, gate.frame, gate.len);
  for (const path of walls) semaWall(s.lit, path, 4.6, 2.6, C.plaster, C.white, 0, 0.82, 0.62);

  return { site: s, statue, monumentLight, gateCenter: new THREE.Vector3(gate.frame.ox, 8, gate.frame.oz), claimed: [plaza, toRing(lm.gate.ring)] };
}

// Chumphon Gate (ประตูชุมพล) from the OSM footprint (43 × 11 m, long axis N–S).
// West face (+v) toward the plaza: white wall, bai-sema merlons, exposed laterite around the 3 m opening,
// steps + railing (pedestrians only), yellow name plaque. On top: maroon wooden watch-tower with a three-part
// Thai roof (higher centre), clay tiles, white bargeboards + chofa (gate-02.jpg, trackA-37). Total ~13 m.
function buildChumphonGate(s: Site, ring: Vec2[], signRow: (i: number) => { u0: number; u1: number; v0: number; v1: number }) {
  const { f: f0, len } = pcaFrame(ring);
  // make +v (dirV = (−uz, ux)) point west, toward the monument
  const f: Frame = -f0.uz > 0 ? { ...f0, ux: -f0.ux, uz: -f0.uz } : f0;
  const L = len, D = 11, half = D / 2;
  const core = 16, open = 3.0, passH = 3.8;
  const g = s.lit;

  // wall arms (battered, 5 m) with merlons both faces
  const armLen = (L - core) / 2;
  for (const sgn of [-1, 1]) {
    const uc = sgn * (core / 2 + armLen / 2);
    const a = P(f, uc - (sgn * armLen) / 2, 0, 0), b = P(f, uc + (sgn * armLen) / 2, 0, 0);
    semaWall(g, [{ x: a[0], z: a[2] }, { x: b[0], z: b[2] }], 5.0, D - 0.9, C.plaster, C.white, 0, 0.85, 0.5);
  }
  // gate block piers + lintel (real opening, passage lined with dark wood)
  const pier = (core - open) / 2;
  for (const sgn of [-1, 1]) {
    fbox(g, f, sgn * (open / 2 + pier / 2), 0, 0, pier, D, 5.5, C.plaster, C.whiteShade);
    fbox(s.stone, f, sgn * (open / 2 + 0.05), 0, 0, 0.1, D - 0.2, passH, C.wood); // passage side lining
  }
  fbox(g, f, 0, 0, passH, open, D, 5.5 - passH, C.plaster, C.whiteShade);
  fbox(s.stone, f, 0, 0, passH - 0.1, open, D - 0.2, 0.1, C.wood);
  // exposed laterite around the opening on the west face + wooden frame
  for (const sgn of [-1, 1]) fbox(s.stone, f, sgn * (open / 2 + 1.35), half + 0.03, 0, 2.5, 0.1, 4.4, C.laterite);
  for (const sgn of [-1, 1]) fbox(s.stone, f, sgn * (open / 2 + 0.15), half + 0.08, 0, 0.3, 0.1, passH + 0.15, C.wood);
  fbox(s.stone, f, 0, half + 0.08, passH, open + 0.6, 0.1, 0.3, C.wood);
  // name plaque "ประตูชุมพล"
  {
    const r = signRow(1), y0 = passH + 0.45, y1 = y0 + 0.62, w = 2.4;
    const a = P(f, -w / 2, half + 0.16, y0), b = P(f, w / 2, half + 0.16, y0), c = P(f, w / 2, half + 0.16, y1), d = P(f, -w / 2, half + 0.16, y1);
    // faces +v (west); +u runs north→south = left→right for someone in the plaza looking at the gate
    s.sign.quadN(a, b, c, d, col(0xffffff), [-f.uz, 0, f.ux], [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]]);
    fbox(s.stone, f, 0, half + 0.1, y0 - 0.06, w + 0.15, 0.08, 0.74, C.gold);
  }
  // steps up to the passage + railing (no vehicle can pass)
  for (let k = 0; k < 3; k++) fbox(s.stone, f, 0, half + 1.2 - k * 0.4, 0, open + 1.0, 0.4, 0.15 * (k + 1), C.granite, C.marbleTop);
  for (const sgn of [-1, 1]) {
    fbox(s.stone, f, sgn * 0.6, half + 1.0, 0.45, 0.05, 1.6, 0.05, C.pole);
    fbox(s.stone, f, sgn * 0.6, half + 1.0, 1.35, 0.06, 1.6, 0.06, C.pole);
  }
  for (const sgn of [-1, 1]) for (let k = 0; k < 6; k++) fbox(s.stone, f, sgn * (open / 2 + 0.8 + k * 1.1), half + 2.4, 0, 0.05, 0.05, 1.1, C.pole);
  for (const sgn of [-1, 1]) fbox(s.stone, f, sgn * (open / 2 + 3.5), half + 2.4, 1.05, 5.6, 0.05, 0.06, C.pole);
  // merlons along the gate block top (both faces) + east central white tower block with square crenels
  for (let u = -core / 2 + 0.6; u <= core / 2 - 0.6; u += 1.35) for (const v of [half - 0.25, -half + 0.25]) {
    extrudeUY(g, f, [[u - 0.42, 5.5], [u + 0.42, 5.5], [u + 0.42, 6.05], [u + 0.3, 6.35], [u, 6.45], [u - 0.3, 6.35], [u - 0.42, 6.05]], v - 0.12, v + 0.12, C.white);
  }
  fbox(g, f, 0, -half + 1.4, 5.5, 6.4, 2.8, 2.8, C.plaster, C.whiteShade);
  for (let u = -2.8; u <= 2.8; u += 1.4) fbox(g, f, u, -half + 0.2, 8.3, 0.75, 0.4, 0.6, C.white);
  for (let k = -1; k <= 1; k++) fbox(s.stone, f, k * 1.6, -half - 0.02, 7.1, 0.55, 0.06, 0.55, C.dark);
  // white base band under the tower
  fbox(g, f, 0, 0.6, 5.5, 11.0, 7.4, 0.85, C.white);

  // watch-tower: maroon plank body, dark windows (some warmly lit), white fascia
  const T0 = 6.35, T1 = 9.4, tu = 10.4, tv = 6.6, tvc = 0.6;
  fbox(g, f, 0, tvc, T0, tu, tv, T1 - T0, C.maroon, C.maroonDark);
  for (let u = -tu / 2 + 0.35; u < tu / 2; u += 0.62) for (const v of [tvc + tv / 2 + 0.02, tvc - tv / 2 - 0.02]) fbox(g, f, u, v, T0, 0.06, 0.05, T1 - T0, C.maroonDark);
  for (const [u, w, h] of [[-3.6, 0.9, 1.5], [-1.6, 0.7, 1.0], [1.6, 0.7, 1.0], [3.6, 0.9, 1.5]] as const) {
    for (const v of [tvc + tv / 2 + 0.05, tvc - tv / 2 - 0.05]) {
      fbox(s.stone, f, u, v, T0 + 0.9, w + 0.16, 0.06, h + 0.16, C.wood);
      fbox(s.glow, f, u, v + Math.sign(v - tvc) * 0.02, T0 + 0.98, w, 0.05, h, Math.abs(u) > 3 ? G.window : col(0x2a1410));
    }
  }
  // centre clerestory under the high roof
  fbox(g, f, 0, tvc, T1, 5.2, tv - 0.6, 1.2, C.maroon, C.maroonDark);
  // three-part roof: lower wings, higher centre; ridges along the wall (u)
  for (const sgn of [-1, 1]) thaiRoof(g, f, sgn * 3.75, tvc, 4.9, tv + 2.2, T1 - 0.05, T1 + 1.9, C.tile, C.trim, { tympanum: C.trim });
  thaiRoof(g, f, 0, tvc, 5.9, tv + 1.6, T1 + 1.15, T1 + 3.55, C.tile, C.trim, { tympanum: C.trim });
  // eave-line string lights (gate-02.jpg) — tiny warm dots
  for (let u = -tu / 2 - 1; u <= tu / 2 + 1; u += 0.9) for (const v of [tvc + (tv + 2.2) / 2, tvc - (tv + 2.2) / 2]) {
    const p = P(f, u, v, T1 - 0.15);
    s.glow.box(p[0], p[1], p[2], 0.07, 0.07, 0.07, 0, G.lamp);
  }
  // warm floodlights at the foot of the west face (fixtures + halos)
  for (const u of [-16, -9, -4, 4, 9, 16]) {
    const p = P(f, u, half + 1.2, 0.15);
    s.stone.box(p[0], 0.15, p[2], 0.45, 0.3, 0.35, 0, C.black);
    s.glow.box(p[0], 0.31, p[2], 0.3, 0.03, 0.2, 0, G.lamp);
    s.halo(p[0], 0.5, p[2], G.warm, 0.8);
  }
  return { frame: f, len: L };
}

// Inner-bank city wall polylines: north from the gate (~30 m) and south from the gate along the
// east bank of the west moat as far as the moat ring that touches the plaza (Street View chumphon-03/05).
function cityWallPaths(raw: RawTrack, f: Frame, len: number): Vec2[][] {
  const out: Vec2[][] = [];
  const endN = P(f, -len / 2, 0, 0), endS = P(f, len / 2, 0, 0);
  const [north, south] = endN[2] < endS[2] ? [endN, endS] : [endS, endN];
  out.push([{ x: north[0] - 0.4, z: north[2] + 1.5 }, { x: north[0] - 1.6, z: north[2] - 32 }]);
  // east edge of the west moat ring that starts just south of the plaza
  const rings = raw.water.rings.map(toRing);
  const target = rings.find((r) => { const c = centroid(r); return c.x > -40 && c.x < 40 && c.z > 40 && c.z < 200; });
  if (!target) return out;
  const zs = target.map((p) => p.z), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const path: Vec2[] = [{ x: south[0], z: south[2] - 1.5 }];
  for (let z = z0 + 2; z <= Math.min(z1 - 2, south[2] + 75); z += 8) {
    let xm = -Infinity;
    for (let i = 0; i < target.length; i++) {
      const a = target[i], b = target[(i + 1) % target.length];
      if ((a.z <= z) !== (b.z <= z)) xm = Math.max(xm, a.x + ((z - a.z) / (b.z - a.z)) * (b.x - a.x));
    }
    if (xm > -Infinity) path.push({ x: xm + 4.5, z });
  }
  if (path.length > 2) out.push(path);
  return out;
}

