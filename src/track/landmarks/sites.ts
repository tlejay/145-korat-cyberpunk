// Secondary landmarks along track A (research/streetview/REPORT-track-A.md "แลนด์มาร์กใหม่ตามสนาม").
// Footprints are OSM (© OpenStreetMap contributors, ODbL) converted to game metres (x = east, z = −north);
// heights / styling from Street View notes (reference only, nothing copied).
import * as THREE from 'three';
import { toRing, type RawTrack } from '../data.js';
import type { Surface, Vec2 } from '../../types.js';
import {
  P, col, extrudeUY, fbox, frameAt, offsetRing, palm, pcaFrame, prism, prismRing, rectRing, semaWall, shadeTree, thaiRoof,
  type Frame,
} from './kit.js';
import { Site } from './site.js';
import { fountain, moatBanks, waterSurface } from './moat.js';
import { sala, tripleLamp } from './yamo.js';

const r = (pts: number[][]): Vec2[] => pts.map(([x, z]) => ({ x, z }));

// OSM footprints (game coords) — ids for traceability.
export const OSM = {
  // way/549397539 — ซุ้มประตูมุมตะวันตกเฉียงเหนือ (replica city gate on the NW corner), layer=1
  nwGate: r([[-19.5, -524.1], [-19.3, -520.7], [-21.2, -520.6], [-21.2, -519.4], [-24.4, -519.3], [-24.3, -517.9], [-25.4, -517.9], [-25.1, -511.2], [-27.7, -511.1], [-28.0, -518.0], [-39.8, -517.6], [-39.5, -510.4], [-41.5, -510.4], [-41.8, -517.5], [-42.6, -517.5], [-42.6, -519.2], [-45.3, -519.1], [-45.4, -520.0], [-47.4, -519.9], [-47.5, -522.6], [-45.5, -522.6], [-45.5, -524.1], [-42.8, -524.2], [-42.9, -525.8], [-40.4, -525.9], [-40.5, -529.2], [-27.6, -529.6], [-27.5, -526.7], [-25.1, -526.8], [-25.0, -525.3], [-21.8, -525.4], [-21.8, -524.0]]),
  // way/554300530 สนามหญ้าหน้าประตูเมือง (lawn north of the NW gate)
  nwLawn: r([[-61.2, -534.0], [-59.0, -540.7], [-55.1, -546.3], [-50.2, -550.1], [-43.8, -552.9], [-36.7, -553.8], [-30.8, -553.4], [-26.2, -552.6], [-21.6, -550.6], [-18.7, -548.3], [-16.1, -545.8], [-13.5, -541.6], [-11.7, -537.6], [-10.1, -522.8], [-16.6, -521.9], [-16.8, -524.0], [-19.5, -524.1], [-21.8, -524.0], [-21.8, -525.4], [-25.0, -525.3], [-25.1, -526.8], [-27.5, -526.7], [-27.6, -529.6], [-40.5, -529.2], [-40.4, -525.9], [-42.9, -525.8], [-42.8, -524.2], [-45.5, -524.1], [-45.5, -522.6], [-50.3, -522.6], [-50.3, -518.9], [-60.5, -518.4]]),
  // way/558685462 + way/558685463 — white colonial row, SW corner Manat × Phon Saen
  phonSaenW: r([[486.4, -507.2], [522.5, -506.9], [525.8, -503.1], [525.6, -482.4], [486.2, -483.0]]),
  // OSM building next to it on the SE corner (track-A.json, 14.4 m)
  phonSaenE: r([[539.1, -503.5], [542.8, -506.6], [582.3, -506.6], [583.0, -469.0], [567.1, -469.3], [566.9, -489.1], [556.0, -489.1], [556.0, -482.9], [538.8, -482.9]]),
  // way/187397877 สระแก้ว (Sa Kaeo pond with fountain, head of Sanphasit Rd)
  saKaeo: r([[520.3, 448.5], [618.5, 446.9], [619.5, 325.8], [519.6, 331.1]]),
  // way/1228205994 — hall inside Wat Sutthachinda (south of its east gate)
  sutthHall: r([[-57, 497], [-35, 497], [-35, 512], [-57, 512]]),
};
// node/3320493795 "Chom Surang Hotel" (556, 191); Street View A-20: ~11 floors, SW corner Manat × Mahatthai,
// set back ~15 m, ~60 m frontage → slab along Mahatthai Rd.
const CHOMSURANG = frameAt(538, 187, 0);
// Wat Sutthachinda east gate: closes the T at Kamhaeng Songkhram × Ratchadamnoen (Street View A-30/A-31).
const SUTT_GATE = { x: -17, z: 469.5 };
/** Sacred facades a driver looks straight at (wayfinding keeps signs off them and out of their line of sight). */
export const SACRED_FACES: { id: string; x: number; z: number; halfW: number }[] = [
  { id: 'wat-sutthachinda-gate', x: SUTT_GATE.x, z: SUTT_GATE.z, halfW: 3.3 },
];

const W = {
  white: col(0xefe9dc), cream: col(0xe4dccb), shade: col(0xc9c0ae), dark: col(0x26242c), glass: col(0x232a38),
  maroon: col(0x6b2526), maroonDark: col(0x4a1718), tile: col(0x9a3f22), trim: col(0xf4efe4), pole: col(0x202026),
  brick: col(0x8a4a32), lawn: col(0x2a4a2a), hedge: col(0x1f3a22), paving: col(0x8f8a80), yellowWall: col(0xd9b04a),
  templeRoof: col(0xb8452a), gold: col(0xd9a63a), shutter: col(0x5b5d66), black: col(0x141418),
};
const GL = { warm: col(0xffc46b), window: col(0xffb24d), cool: col(0xbfe0ff), lamp: col(0xfff1cf), gold: col(0xffcf5a), red: col(0xff2a2a) };

const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ── NW corner replica gate ──
// White crenellated wall (E–W), central gate block with a 3 m passage (N–S), maroon tower + Thai roof,
// golden royal-portrait frame in the garden (no face drawn), sugar palms (nw-corner-gate.png, trackA-00/02).
function buildNwGate(free: (x: number, z: number) => boolean): Site {
  const s = new Site('nw-gate');
  const { f } = pcaFrame(OSM.nwGate); // u ≈ E–W
  // lawn + clipped hedges, paved forecourt
  prismRing(s.stone, OSM.nwLawn, 0, 0.12, W.hedge, W.lawn);
  const H = 4.2;
  for (const sgn of [-1, 1]) {
    const a = P(f, sgn * 6.2, 0, 0), b = P(f, sgn * 14, 0, 0);
    semaWall(s.lit, [{ x: a[0], z: a[2] }, { x: b[0], z: b[2] }], H, 6.4, W.white, W.white, 0, 0.8, 0.5);
  }
  // gate block with passage along v
  for (const sgn of [-1, 1]) fbox(s.lit, f, sgn * 3.7, 0, 0, 5.0, 18.5, 5.0, W.white, W.shade);
  fbox(s.lit, f, 0, 0, 3.4, 2.6, 18.5, 1.6, W.white, W.shade);
  for (const sgn of [-1, 1]) fbox(s.stone, f, 0, sgn * 9.3, 0, 2.6, 0.2, 3.4, W.dark);
  for (let u = -5.6; u <= 5.6; u += 1.4) for (const v of [9.0, -9.0]) {
    extrudeUY(s.lit, f, [[u - 0.4, 5.0], [u + 0.4, 5.0], [u + 0.4, 5.5], [u + 0.28, 5.78], [u, 5.88], [u - 0.28, 5.78], [u - 0.4, 5.5]], v - 0.12, v + 0.12, W.white);
  }
  // tower + three-part roof
  fbox(s.lit, f, 0, 0, 5.0, 7.4, 5.2, 3.2, W.maroon, W.maroonDark);
  for (const u of [-2.4, 0, 2.4]) for (const v of [2.63, -2.63]) fbox(s.glow, f, u, v, 5.9, 0.7, 0.05, 1.3, u === 0 ? GL.window : col(0x2a1410));
  for (const sgn of [-1, 1]) thaiRoof(s.lit, f, sgn * 2.7, 0, 3.6, 7.0, 8.15, 9.9, W.tile, W.trim);
  fbox(s.lit, f, 0, 0, 8.2, 3.8, 4.6, 1.0, W.maroon);
  thaiRoof(s.lit, f, 0, 0, 4.2, 6.4, 9.1, 11.4, W.tile, W.trim);
  // golden royal portrait frame on a white base, in the garden on the east side of the gate (north face)
  {
    const [x, , z] = P(f, 11.5, 12, 0);
    const pf = frameAt(x, z, Math.atan2(f.uz, f.ux));
    fbox(s.lit, pf, 0, 0, 0, 2.6, 1.2, 1.0, W.white, W.shade);
    fbox(s.glow, pf, 0, 0, 1.0, 2.2, 0.25, 3.0, GL.gold);
    fbox(s.stone, pf, 0, -0.14, 1.25, 1.7, 0.05, 2.5, col(0x23315a));
    fbox(s.glow, pf, 0, 0, 4.0, 1.2, 0.25, 0.5, GL.gold);
    s.halo(x, 2.5, z, GL.gold, 0.6);
  }
  // sugar palms in the garden
  for (const [u, v, h] of [[-12, 13, 11], [9, 15, 12.5], [16, 6, 10]] as const) {
    const [x, , z] = P(f, u, v, 0);
    if (free(x, z)) palm(s.stone, x, z, h, u);
  }
  // floodlights
  for (const u of [-10, -4, 4, 10]) for (const v of [10.5, -10.5]) {
    const [x, , z] = P(f, u, v, 0);
    if (!free(x, z)) continue;
    s.glow.box(x, 0.18, z, 0.3, 0.06, 0.2, 0, GL.lamp);
    s.halo(x, 0.4, z, GL.warm, 0.6);
  }
  return s;
}

// ── Chino-colonial white row (4 floors, arched verandas) ──
// faces: footprint edge indices whose outside faces a street.
function colonial(s: Site, ring: Vec2[], faces: number[], floors: number, seed: number) {
  const FH = 3.5, H = floors * FH;
  prismRing(s.stone, ring, 0, H, W.cream, W.shade);
  let area = 0;
  for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; area += p.x * q.z - q.x * p.z; }
  const sgn = area >= 0 ? 1 : -1;
  for (const i of faces) {
    const p = ring[i], q = ring[(i + 1) % ring.length], len = Math.hypot(q.x - p.x, q.z - p.z);
    const ux = (q.x - p.x) / len, uz = (q.z - p.z) / len;
    // outward = −inward; inward = sgn·left
    const ox = sgn * uz, oz = -sgn * ux;
    const f: Frame = { ox: (p.x + q.x) / 2, oz: (p.z + q.z) / 2, ux, uz };
    const vOut = -uz * ox + ux * oz > 0 ? 1 : -1; // sign of +v relative to outward
    const out = (d: number) => vOut * d;
    const bays = Math.max(1, Math.round(len / 3.8)), bw = len / bays;
    for (let b = 0; b < bays; b++) {
      const u = -len / 2 + bw * (b + 0.5);
      // ground floor: shop shutters + awning
      fbox(s.stone, f, u, out(0.04), 0.1, bw - 0.6, 0.08, 2.7, b % 3 ? W.shutter : W.dark);
      fbox(s.stone, f, u, out(0.55), 3.05, bw - 0.1, 1.0, 0.08, b % 2 ? col(0x2e6a5a) : col(0x7a2a2a));
      for (let k = 1; k < floors; k++) {
        const y = k * FH;
        const lit = hash(seed + b * 7 + k * 13) < 0.38;
        // arched opening: rectangle + half-round head
        const ow = bw - 1.3, oh = 1.9;
        fbox(lit ? s.glow : s.stone, f, u, out(0.03), y + 0.9, ow, 0.06, oh, lit ? GL.window : W.dark);
        const g = lit ? s.glow : s.stone, c = lit ? GL.window : W.dark;
        for (let t = 0; t < 6; t++) {
          const a0 = (t / 6) * Math.PI, a1 = ((t + 1) / 6) * Math.PI, rr = ow / 2;
          const A = P(f, u, out(0.04), y + 0.9 + oh), B = P(f, u + Math.cos(a0) * rr, out(0.04), y + 0.9 + oh + Math.sin(a0) * rr * 0.8), Cc = P(f, u + Math.cos(a1) * rr, out(0.04), y + 0.9 + oh + Math.sin(a1) * rr * 0.8);
          const n: [number, number, number] = [ox, 0, oz];
          g.quadN(A, B, Cc, Cc, c, n);
        }
        // balcony slab + balustrade
        fbox(s.stone, f, u, out(0.55), y, bw, 1.1, 0.18, W.white);
        fbox(s.stone, f, u, out(1.05), y + 0.18, bw, 0.1, 0.85, W.white);
        fbox(s.stone, f, u, out(1.05), y + 1.0, bw, 0.18, 0.08, W.white);
        // pilasters between bays
        fbox(s.stone, f, -len / 2 + bw * b, out(0.12), y, 0.35, 0.24, FH, W.white);
      }
      // parapet: rounded decorative crest per bay (trackA-12b)
      extrudeUY(s.stone, f, [[u - bw / 2, H], [u + bw / 2, H], [u + bw / 2, H + 0.6], [u + bw * 0.25, H + 0.95], [u, H + 1.05], [u - bw * 0.25, H + 0.95], [u - bw / 2, H + 0.6]], out(-0.1) - 0.1, out(-0.1) + 0.1, W.white);
    }
    fbox(s.stone, f, 0, out(0.1), H - 0.25, len, 0.4, 0.27, W.white); // cornice (top 2 cm above the roof: no z-fight)
  }
}

function buildPhonSaen(): Site {
  const s = new Site('phon-saen');
  colonial(s, OSM.phonSaenW, [0, 1, 2], 4, 11); // N edge (Phon Saen Rd) + E edges (Manat Rd)
  colonial(s, OSM.phonSaenE, [0, 1, 8], 4, 23); // W edge (Manat) + N edge (Phon Saen)
  return s;
}

// ── Chomsurang Hotel: 11-storey white slab, balcony bands, vertical fins, black roof sign ──
function buildChomsurang(signRow: (i: number) => { u0: number; u1: number; v0: number; v1: number }): Site {
  const s = new Site('chomsurang');
  const f = CHOMSURANG, LU = 56, LV = 17, FL = 11, FH = 3.2, H = FL * FH + 1.2;
  prismRing(s.stone, rectRing(f, LU, LV), 0, H, W.white, W.shade);
  fbox(s.stone, f, 6, 0, H, 14, 8, 3.2, W.cream, W.shade); // roof machine room
  for (const v of [LV / 2, -LV / 2]) {
    const sg = Math.sign(v);
    for (let k = 1; k <= FL; k++) {
      const y = k * FH - 0.4;
      fbox(s.stone, f, 0, v + sg * 0.45, y, LU + 0.6, 0.9, 0.22, W.white); // balcony band
      fbox(s.stone, f, 0, v + sg * 0.03, y - FH + 1.0, LU - 0.4, 0.06, FH - 1.3, W.glass);
      for (let b = 0; b < 14; b++) {
        if (hash(b * 31 + k * 7 + (sg > 0 ? 3 : 0)) > 0.34) continue;
        const u = -LU / 2 + 2 + b * 4;
        fbox(s.glow, f, u, v + sg * 0.06, y - FH + 1.1, 2.6, 0.04, FH - 1.5, hash(b + k) < 0.75 ? GL.window : GL.cool);
      }
    }
    for (let b = 0; b <= 14; b++) fbox(s.stone, f, -LU / 2 + b * 4, v + sg * 0.5, 0, 0.3, 1.0, H - 0.6, W.white);
  }
  // ground floor lobby glow + canopy
  fbox(s.glow, f, 0, LV / 2 + 0.05, 0.3, 20, 0.05, 2.6, GL.warm);
  fbox(s.stone, f, 0, LV / 2 + 3, 3.2, 14, 6, 0.3, W.white);
  // black rooftop sign with the hotel name (white Thai text, real font) facing north + east
  const row = signRow(0);
  const sign = (u: number, v: number, w: number, h: number, y: number, n: [number, number, number], fr: Frame) => {
    const a = P(fr, u - w / 2, v, y), b = P(fr, u + w / 2, v, y), c = P(fr, u + w / 2, v, y + h), d = P(fr, u - w / 2, v, y + h);
    s.sign.quadN(a, b, c, d, col(0xffffff), n, [[row.u0, row.v0], [row.u1, row.v0], [row.u1, row.v1], [row.u0, row.v1]]);
  };
  fbox(s.stone, f, -12, -LV / 2 + 1.2, H, 22, 0.4, 3.2, W.black);
  sign(-12, -LV / 2 + 0.98, -20, 2.6, H + 0.3, [0, 0, -1], f); // negative width: reads east→west for a viewer facing south
  // pole sign at the Manat corner (Street View A-20)
  {
    const x = 572, z = 176;
    prism(s.stone, x, z, 0.18, 0.16, 0, 7, 6, W.pole);
    s.stone.box(x, 7.8, z, 0.4, 2.2, 5.2, 0, W.black);
    // east face; a viewer on Manat looks west, so the text runs south→north (u = +z, negative width)
    sign(0, -0.22, -4.8, 1.3, 7.3, [1, 0, 0], frameAt(x, z, Math.PI / 2));
  }
  return s;
}

// ── Sa Kaeo pond + fountain + palms; temple wall and roof across the water (trackA-23) ──
function buildSaKaeo(free: (x: number, z: number) => boolean): Site {
  const s = new Site('sa-kaeo');
  const ring = OSM.saKaeo;
  waterSurface(s.water, ring, 0.05);
  moatBanks(s.stone, ring, [], 0.05 - 0.9, 0.45);
  fountain(s, 569, 388, 0.05, 6.5, 8, 2.2);
  // palms along the road side
  for (let x = 526; x <= 614; x += 11) {
    const z = 327.5 + (x - 520) * -0.05;
    if (free(x, z)) palm(s.stone, x, z, 9 + hash(x) * 4, x);
  }
  // temple on the far (south) bank: yellow wall + Thai hall roofs (red/gold)
  for (let x = 522; x < 618; x += 12) s.stone.box(x + 6, 1.1, 456, 12, 2.2, 0.5, 0, W.yellowWall, W.white);
  const hf = frameAt(570, 474, 0);
  fbox(s.stone, hf, 0, 0, 0, 24, 11, 5, W.white, W.shade);
  thaiRoof(s.stone, hf, 0, 0, 26, 15, 5, 11, W.templeRoof, W.gold, { tiers: 2 });
  s.halo(569, 6.6, 388, GL.cool, 0.6);
  return s;
}

// ── Wat Sutthachinda east gate + white lotus-panel wall + red-roofed hall (trackA-30/31) ──
function buildSutthachinda(free: (x: number, z: number) => boolean): Site {
  const s = new Site('sutthachinda');
  const { x, z } = SUTT_GATE;
  const f = frameAt(x, z, Math.PI / 2); // u = +z (south), v = −x … gate faces east (−v)
  // pillars + arch
  for (const sgn of [-1, 1]) {
    fbox(s.lit, f, sgn * 2.6, 0, 0, 1.3, 1.3, 4.6, W.white, W.shade);
    fbox(s.lit, f, sgn * 2.6, 0, 4.6, 1.5, 1.5, 0.3, W.white);
  }
  extrudeUY(s.lit, f, [[-3.3, 4.2], [3.3, 4.2], [3.3, 5.3], [-3.3, 5.3]], -0.7, 0.7, W.white);
  for (let k = 0; k < 7; k++) {
    const a0 = (k / 7) * Math.PI, a1 = ((k + 1) / 7) * Math.PI, R = 1.95;
    extrudeUY(s.lit, f, [[Math.cos(a0) * R, 2.6 + Math.sin(a0) * R * 0.8], [Math.cos(a1) * R, 2.6 + Math.sin(a1) * R * 0.8], [Math.cos(a1) * R, 4.25], [Math.cos(a0) * R, 4.25]].map(([u, y]) => [u, y] as [number, number]), -0.65, 0.65, W.white);
  }
  // golden crown spire (ยอดมงกุฎ): stacked tapering tiers
  let y = 5.3;
  for (let k = 0; k < 6; k++) {
    const w = 2.6 - k * 0.38, h = 0.55;
    fbox(s.lit, f, 0, 0, y, w, w * 0.6, h, W.gold, W.gold);
    y += h;
  }
  prism(s.lit, x, z, 0.35, 0.02, y, y + 2.0, 6, W.gold, 0, false);
  s.halo(x - 0.8, 6.5, z, GL.gold, 0.7);
  for (const sgn of [-1, 1]) s.halo(x - 1.2, 0.4, z + sgn * 2.6, GL.warm, 0.6);
  // wall with white balustrade + lotus tile panels, both sides of the gate (N–S)
  for (const [z0, z1] of [[z - 34, z - 3.4], [z + 3.4, z + 30]] as const) {
    const n = Math.round((z1 - z0) / 3);
    for (let k = 0; k < n; k++) {
      const zz = z0 + ((z1 - z0) * (k + 0.5)) / n, len = (z1 - z0) / n;
      s.stone.box(x + 0.4, 0.45, zz, 0.4, 0.9, len, 0, W.white);
      s.stone.box(x + 0.62, 0.45, zz, 0.04, 0.5, len - 0.6, 0, col(0x3f7d6a));
      s.stone.box(x + 0.4, 1.3, zz, 0.3, 0.8, len - 0.4, 0, W.white);
      prism(s.stone, x + 0.4, z0 + ((z1 - z0) * k) / n, 0.22, 0.2, 0, 1.9, 4, W.white, Math.PI / 4);
    }
  }
  // hall (OSM way/1228205994) with a two-tier red roof and gold trim
  const { f: hf, len, wid } = pcaFrame(OSM.sutthHall);
  fbox(s.stone, hf, 0, 0, 0, len, wid, 4.2, W.white, W.shade);
  thaiRoof(s.stone, hf, 0, 0, len + 1.6, wid + 2.4, 4.2, 9.6, W.templeRoof, W.gold, { tiers: 2 });
  // a sala inside the gate + sugar palms along the moat end
  sala(s, frameAt(x - 12, z - 14, Math.PI / 2), 6, 4, 2.8, W.templeRoof, W.gold);
  for (const [px, pz] of [[18, 452], [26, 455], [34, 452], [10, 448]] as const) if (free(px, pz)) palm(s.stone, px, pz, 10 + hash(px) * 3, px);
  return s;
}

// ── Terminal 21 on the skyline (~1.2 km NW): mall + 110 m tower + hotel, no fog, re-projected ──
function buildT21(raw: RawTrack) {
  const sk = new Site('t21');
  const ring = toRing(raw.landmarks.t21.ring);
  const { f, len } = pcaFrame(ring);
  const dark = col(0x34304a), dark2 = col(0x221e30);
  prismRing(sk.stone, ring, 0, 34, dark, dark2);
  const tower = P(f, -len * 0.3, 0, 0);
  const tf = frameAt(tower[0], tower[2], Math.atan2(f.uz, f.ux));
  const h = raw.landmarks.t21.h;
  fbox(sk.stone, tf, 0, 0, 0, 24, 20, h - 14, dark, dark2);
  fbox(sk.stone, tf, 0, 0, h - 14, 18, 15, 8, dark, dark2);
  fbox(sk.stone, tf, 0, 0, h - 6, 26, 26, 3, dark, dark2); // control-tower style cab
  prism(sk.stone, tower[0], tower[2], 0.8, 0.3, h - 3, h + 12, 6, dark);
  const hotel = P(f, len * 0.25, 0, 0);
  fbox(sk.stone, frameAt(hotel[0], hotel[2], Math.atan2(f.uz, f.ux)), 0, 0, 0, 58, 22, 64, dark, dark2);
  // light bands
  const g = sk.glow;
  const bandRing = offsetRing(ring, 0.3); // proud of the mall walls (coplanar bands z-fought at skyline distance)
  for (let y = 6; y < 34; y += 7) prismRing(g, bandRing, y, y + 0.8, col(0x2bd6ff), null);
  fbox(g, tf, 0, 0, h - 5.5, 26.6, 26.6, 1.4, col(0x22e6ff));
  for (let y = 12; y < h - 16; y += 9) fbox(g, tf, 0, 0, y, 24.4, 20.4, 0.6, col(0xffb46b));
  fbox(g, tf, 0, 0, h + 11.5, 1.2, 1.2, 1.2, GL.red);
  return { site: sk, anchor: new THREE.Vector3(f.ox, 0, f.oz), aviation: P(tf, 0, 0, h + 12) };
}

export interface SecondaryResult {
  sites: Site[];
  skyline: ReturnType<typeof buildT21>;
  claimed: { id: string; ring: Vec2[] }[];
  waterLights: { pos: THREE.Vector3; color: THREE.Color }[];
}

export function buildSecondary(raw: RawTrack, surfaceAt: ((x: number, z: number) => Surface) | null,
  signRow: (i: number) => { u0: number; u1: number; v0: number; v1: number }): SecondaryResult {
  const free = (x: number, z: number) => !surfaceAt || surfaceAt(x, z) === 'blocked';
  const nw = buildNwGate(free);
  const ps = buildPhonSaen();
  const cs = buildChomsurang(signRow);
  const sk = buildSaKaeo(free);
  const sut = buildSutthachinda(free);
  // a few rain trees on the NW lawn side + lamps along the pond road edge
  for (const [x, z] of [[-55, -540], [-14, -548]] as const) if (free(x, z)) shadeTree(nw.stone, x, z, 9, 4.5, x);
  for (const x of [530, 560, 590]) if (free(x, 334)) tripleLamp(sk, x, 334, 3.8);
  const t21 = buildT21(raw);
  return {
    sites: [nw, ps, cs, sk, sut],
    skyline: t21,
    claimed: [
      { id: 'nw-gate', ring: OSM.nwGate }, { id: 'nw-gate-lawn', ring: OSM.nwLawn },
      { id: 'phon-saen-w', ring: OSM.phonSaenW }, { id: 'phon-saen-e', ring: OSM.phonSaenE },
      { id: 'chomsurang', ring: rectRing(CHOMSURANG, 56, 17) },
      // the synthetic M1 box for the hotel (track-A.json, 38.2 m, straddles Mahatthai Rd) — drop it
      { id: 'chomsurang-m1-synthetic', ring: r([[560.4, 121.6], [566.8, 181.3], [543.0, 183.8], [536.5, 124.2]]) },
      // forecourt between the hotel and Manat Rd (Street View: 15 m setback, fence, palms) — keep clear of shophouses
      { id: 'chomsurang-forecourt', ring: r([[566, 160], [583, 160], [583, 200], [566, 200]]) },
      { id: 'sa-kaeo', ring: OSM.saKaeo }, { id: 'sutthachinda-hall', ring: OSM.sutthHall },
    ],
    waterLights: [
      { pos: new THREE.Vector3(-34, 7, -520), color: new THREE.Color(0xffc46b).multiplyScalar(0.7) },
      { pos: new THREE.Vector3(569, 6, 388), color: new THREE.Color(0xbfe9ff).multiplyScalar(0.8) },
      { pos: new THREE.Vector3(SUTT_GATE.x, 6, SUTT_GATE.z), color: new THREE.Color(0xffcf5a).multiplyScalar(0.7) },
    ],
  };
}

