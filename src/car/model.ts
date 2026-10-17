// Low-poly player car, built in code from research/car/blueprint.md (proportions re-measured from the
// official tesla.com/roadster images in build003 — docs/research/REPORT-car-ref.md §3).
// Frame: origin on the ground, midway between the axles. Forward = −z, up = +y,
// right = +x (matches Pose: heading 0 = north = −z). Units: metres.
// Draw-call budget (≤ 8): body, wing, tail lights, headlights, plate,
// wheels (instanced), fans (instanced) = 7. The wheel/fan entries returned are plain Object3D proxies;
// animate them and the instanced meshes follow automatically.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createPlateTexture } from './model-plate.js';

/** In-game name (conductor pick 2026-10-17). Never show the real brand on the car. */
export const CAR_NAME = 'ราชสีห์ R1';

/** Key dimensions, exported so physics/camera can stay in sync with the mesh. */
export const CAR_DIMS = {
  length: 4.4,
  width: 2.0,
  height: 1.16,
  wheelbase: 2.82,
  noseZ: -2.27,
  tailZ: 2.13,
  frontAxleZ: -1.41,
  rearAxleZ: 1.41,
  frontHalfTrack: 0.85,
  rearHalfTrack: 0.83,
  frontWheelRadius: 0.345,
  rearWheelRadius: 0.365,
  frontWheelWidth: 0.3,
  rearWheelWidth: 0.38, // visual: a touch wider than 335 mm so the rear tyres read from behind
  groundClearance: 0.11,
} as const;

export interface CarModel {
  root: THREE.Group;
  /** Proxies: rotation.order is 'YXZ' → set rotation.y for steer, rotation.x for roll (spin). */
  wheels: { fl: THREE.Object3D; fr: THREE.Object3D; rl: THREE.Object3D; rr: THREE.Object3D };
  /**
   * All thruster tips: 4 × 'rear' (left → right, blow backward) then 4 × 'side-down'
   * (left → right: outer, inboard, inboard, outer — two per rear corner, blow at the road — jump/launch).
   * userData.kind holds the type. Local +z of each anchor = exhaust direction.
   */
  nozzles: THREE.Object3D[];
  rearNozzles: THREE.Object3D[];
  sideNozzles: THREE.Object3D[];
  /** Red tail bar; scale material.color (base TAIL_GLOW) for brake / boost flashes. */
  tailLights: THREE.Mesh[];
  headLights: THREE.Mesh;
  /** Diffuser suction fans (left → right). Spin with rotation.z. */
  fans: THREE.Object3D[];
  /** Rear wing pivot (leading edge). rotation.x: WING_CRUISE normally, WING_AIRBRAKE under hard braking. */
  wing: THREE.Object3D;
  /**
   * Hidden Aero: deploy 0 = blade folded flush on the deck lid (parked / menu), 1 = raised on its pylons.
   * angle = blade pitch when raised (WING_CRUISE … WING_AIRBRAKE). Moves the pivot + morphs the blade.
   */
  setAero(deploy: number, angle: number): void;
}

// ---------------------------------------------------------------------------
// Palette (vertex colours, linear-ish sRGB picked by eye against the refs)
const C = {
  white: new THREE.Color('#e9e7e2'), // Ano White
  glass: new THREE.Color('#7a5634'), // gold/bronze tinted canopy
  black: new THREE.Color('#121315'),
  carbon: new THREE.Color('#1d1f22'),
  gold: new THREE.Color('#b8925a'),
  fan: new THREE.Color('#2b2d31'),
  tyre: new THREE.Color('#34353a'),
  sidewall: new THREE.Color('#4a4d52'),
  rearGlass: new THREE.Color('#2a2118'), // rear window: darker than the canopy (hero / carousel-2)
  disc: new THREE.Color('#9a9da3'),
  spoke: new THREE.Color('#141518'),
};

// Blueprint X runs nose(0) → tail(4.4); convert to car-local z.
const bz = (x: number) => x - 2.27;

// ---------------------------------------------------------------------------
// Body loft. Each station is a symmetric cross-section:
//   A(tub, floor) → B(tub, flare) → C(body, flare) → D(body, shoulder) → E(top, top)
// AB/BC = wheel wells & sill (black), CD = body side, DE = greenhouse side, E-E' = top.
type Station = {
  x: number; top: number; sh: number; flare: number; floor: number;
  hwT: number; hwB: number; hwTub: number;
  hwC?: number; // lower body edge half-width when the side tucks in (tail taper)
};
// build003: ~9 % lower (roof 1.16 peaking mid-wheelbase, long fastback down to a 0.91 tail edge), shoulder
// crease rising 0.72 → 0.88 towards the tail, taller upright nose (REPORT-car-ref §3.2, official-02-pilot).
const S: Station[] = [
  { x: 0.0, top: 0.45, sh: 0.44, flare: 0.24, floor: 0.18, hwT: 0.66, hwB: 0.78, hwTub: 0.7 },
  { x: 0.45, top: 0.58, sh: 0.66, flare: 0.47, floor: 0.13, hwT: 0.62, hwB: 0.95, hwTub: 0.62 },
  { x: 0.7, top: 0.66, sh: 0.78, flare: 0.74, floor: 0.12, hwT: 0.62, hwB: 1.0, hwTub: 0.62 },
  { x: 1.02, top: 0.76, sh: 0.78, flare: 0.74, floor: 0.11, hwT: 0.64, hwB: 1.0, hwTub: 0.62 },
  { x: 1.15, top: 0.8, sh: 0.72, flare: 0.56, floor: 0.11, hwT: 0.7, hwB: 1.0, hwTub: 0.62 },
  { x: 1.27, top: 0.85, sh: 0.72, flare: 0.45, floor: 0.11, hwT: 0.68, hwB: 1.0, hwTub: 0.62 },
  { x: 1.5, top: 0.95, sh: 0.72, flare: 0.3, floor: 0.11, hwT: 0.64, hwB: 0.99, hwTub: 0.9 },
  { x: 2.1, top: 1.14, sh: 0.76, flare: 0.3, floor: 0.11, hwT: 0.57, hwB: 0.98, hwTub: 0.9 },
  { x: 2.3, top: 1.16, sh: 0.77, flare: 0.3, floor: 0.11, hwT: 0.56, hwB: 0.98, hwTub: 0.9 }, // roof peak
  { x: 2.75, top: 1.15, sh: 0.8, flare: 0.3, floor: 0.11, hwT: 0.55, hwB: 0.98, hwTub: 0.9 },
  { x: 3.2, top: 1.08, sh: 0.83, flare: 0.3, floor: 0.11, hwT: 0.56, hwB: 0.99, hwTub: 0.9 },
  { x: 3.3, top: 1.065, sh: 0.835, flare: 0.45, floor: 0.11, hwT: 0.57, hwB: 1.0, hwTub: 0.64 },
  { x: 3.55, top: 1.03, sh: 0.85, flare: 0.79, floor: 0.11, hwT: 0.6, hwB: 1.0, hwTub: 0.64 },
  { x: 3.85, top: 0.98, sh: 0.86, flare: 0.79, floor: 0.11, hwT: 0.72, hwB: 1.0, hwTub: 0.64 },
  { x: 4.11, top: 0.94, sh: 0.87, flare: 0.5, floor: 0.25, hwT: 0.86, hwB: 0.98, hwTub: 0.62, hwC: 0.92 },
  { x: 4.4, top: 0.91, sh: 0.88, flare: 0.58, floor: 0.58, hwT: 0.9, hwB: 0.95, hwTub: 0.62, hwC: 0.8 },
];
const GLASS_TOP = [1.15, 3.3] as const; // windshield + roof canopy (the rear window is its own trapezoid)
const GLASS_SIDE = [1.15, 3.26] as const; // side glass: long triangle ending at X 3.26
// Rear window (hero / carousel-2): dark trapezoid narrowing towards the tail, ~70 % of the deck lid,
// flanked by faceted white sail panels.
const REAR_GLASS = { x0: 3.3, hw0: 0.45, x1: 3.95, hw1: 0.3 } as const;

/** Collects flat-coloured triangles; each is flipped to face `hint` (outward). */
class TriBuilder {
  pos: number[] = [];
  col: number[] = [];
  private n = new THREE.Vector3();
  private e1 = new THREE.Vector3();
  private e2 = new THREE.Vector3();

  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color, hint: THREE.Vector3) {
    this.e1.subVectors(b, a);
    this.e2.subVectors(c, a);
    this.n.crossVectors(this.e1, this.e2);
    if (this.n.lengthSq() < 1e-10) return; // degenerate
    const [p, q] = this.n.dot(hint) >= 0 ? [b, c] : [c, b];
    for (const v of [a, p, q]) {
      this.pos.push(v.x, v.y, v.z);
      this.col.push(color.r, color.g, color.b);
    }
  }

  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color: THREE.Color, hint: THREE.Vector3) {
    this.tri(a, b, c, color, hint);
    this.tri(a, c, d, color, hint);
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

/** Section outline, counter-clockwise from bottom-left, as (x, y) pairs. */
function section(s: Station): [number, number][] {
  const half: [number, number][] = [
    [s.hwTub, s.floor],
    [s.hwTub, s.flare],
    [s.hwC ?? s.hwB, s.flare],
    [s.hwB, s.sh],
    [s.hwT, s.top],
  ];
  const left = half.map(([x, y]) => [-x, y] as [number, number]).reverse();
  return [...half, ...left]; // A B C D E | E' D' C' B' A'
}

function segmentColor(seg: number, xMid: number): THREE.Color {
  // seg indexes edges of section(): 0 AB, 1 BC, 2 CD, 3 DE, 4 EE', 5 E'D', 6 D'C', 7 C'B', 8 B'A', 9 A'A (floor)
  switch (seg) {
    case 2: case 6: return C.white;
    case 3: case 5: return xMid > GLASS_SIDE[0] && xMid < GLASS_SIDE[1] ? C.glass : C.white;
    case 4: return xMid > GLASS_TOP[0] && xMid < GLASS_TOP[1] ? C.glass : C.white;
    default: return C.black;
  }
}

function buildBodyShell(tb: TriBuilder) {
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  for (let i = 0; i < S.length - 1; i++) {
    const s0 = S[i], s1 = S[i + 1];
    const p0 = section(s0), p1 = section(s1);
    const z0 = bz(s0.x), z1 = bz(s1.x);
    const xMid = (s0.x + s1.x) / 2;
    for (let k = 0; k < p0.length; k++) {
      const k2 = (k + 1) % p0.length;
      const a = v(p0[k][0], p0[k][1], z0);
      const b = v(p0[k2][0], p0[k2][1], z0);
      const c = v(p1[k2][0], p1[k2][1], z1);
      const d = v(p1[k][0], p1[k][1], z1);
      // Outward = away from the section's vertical centre line.
      const mid = a.clone().add(b).add(c).add(d).multiplyScalar(0.25);
      const cy = ((s0.floor + s0.top) / 2 + (s1.floor + s1.top) / 2) / 2;
      const hint = v(mid.x, mid.y - cy, 0);
      if (k === 9) hint.set(0, -1, 0); // floor
      if (k === 4) hint.set(0, 1, 0); // top
      if (k === 1 || k === 7) hint.set(0, -1, 0); // fender undersides face down
      tb.quad(a, b, c, d, segmentColor(k, xMid), hint);
    }
  }
  // End caps (outline is non-convex where the fenders rise above the hood).
  for (const [s, dir] of [[S[0], -1], [S[S.length - 1], 1]] as const) {
    const pts = section(s).map(([x, y]) => new THREE.Vector2(x, y));
    const tris = THREE.ShapeUtils.triangulateShape(pts, []);
    const z = bz(s.x);
    for (const [i, j, k] of tris) {
      tb.tri(v(pts[i].x, pts[i].y, z), v(pts[j].x, pts[j].y, z), v(pts[k].x, pts[k].y, z), C.white, v(0, 0, dir));
    }
  }
}

/** Deck surface (top y, top half-width) at blueprint X, linear between stations. */
function topAt(x: number): { y: number; hw: number } {
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[i], b = S[i + 1];
    if (x <= b.x) { const t = (x - a.x) / (b.x - a.x); return { y: a.top + (b.top - a.top) * t, hw: a.hwT + (b.hwT - a.hwT) * t }; }
  }
  const e = S[S.length - 1];
  return { y: e.top, hw: e.hwT };
}

/** Dark trapezoid rear window on the deck lid + white sail facets folded up beside it. */
function buildRearGlass(tb: TriBuilder) {
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const up = v(0, 1, 0);
  const xs = [REAR_GLASS.x0, 3.55, 3.75, REAR_GLASS.x1];
  const hwAt = (x: number) => REAR_GLASS.hw0 + ((x - REAR_GLASS.x0) / (REAR_GLASS.x1 - REAR_GLASS.x0)) * (REAR_GLASS.hw1 - REAR_GLASS.hw0);
  for (let i = 0; i < xs.length - 1; i++) {
    const [xa, xb] = [xs[i], xs[i + 1]], ta = topAt(xa), tbb = topAt(xb), za = bz(xa), zb = bz(xb);
    const ya = ta.y + 0.006, yb = tbb.y + 0.006, ha = hwAt(xa), hb = hwAt(xb);
    tb.quad(v(-ha, ya, za), v(ha, ya, za), v(hb, yb, zb), v(-hb, yb, zb), C.rearGlass, up);
    // sails: a crease halfway out, raised 3.5 cm → two flat-shaded facets per side
    for (const sg of [-1, 1]) {
      const ca = (ha + ta.hw) / 2, cb = (hb + tbb.hw) / 2;
      const ia = v(sg * ha, ya, za), ib = v(sg * hb, yb, zb);
      const ka = v(sg * ca, ya + 0.035, za), kb = v(sg * cb, yb + 0.035, zb);
      const oa = v(sg * ta.hw, ta.y + 0.002, za), ob = v(sg * tbb.hw, tbb.y + 0.002, zb);
      tb.quad(ia, ka, kb, ib, C.white, v(-sg * 0.3, 1, 0));
      tb.quad(ka, oa, ob, kb, C.white, v(sg * 0.6, 1, 0));
    }
  }
}

/** Box/cylinder parts → position+colour, non-indexed, ready for merging. */
function part(geo: THREE.BufferGeometry, color: THREE.Color, m?: THREE.Matrix4): THREE.BufferGeometry {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (m) g.applyMatrix4(m);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const at = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1),
  );
const box = (w: number, h: number, d: number, color: THREE.Color, x: number, y: number, z: number, rx = 0) =>
  part(new THREE.BoxGeometry(w, h, d), color, at(x, y, z, rx));

// Diffuser + nozzle shelf geometry (rear). Returns nozzle tip positions.
const FAN_X = [-0.45, -0.15, 0.15, 0.45];
const FAN_Y = 0.28;
const FAN_R = 0.12;
const NOZZLE_Y = 0.5;
const SIDE_NOZZLE_X = [-0.7, 0.7];
const SIDE_NOZZLE_Y = 0.2; // tip height
const SIDE_NOZZLE_Z = bz(4.27);
// Launch photo (refs/car/rear-upright-and-inverted): 4 jets hit the road — at each rear corner the gold can
// on its bracket plus a second tip ~0.19 m inboard, tucked under the body edge (fix #3).
const SIDE_NOZZLE_IN_DX = 0.19, SIDE_NOZZLE_IN_Y = 0.24, SIDE_NOZZLE_IN_Z = bz(4.18);
const SIDE_NOZZLES: { x: number; y: number; z: number; name: string }[] = [
  { x: SIDE_NOZZLE_X[0], y: SIDE_NOZZLE_Y, z: SIDE_NOZZLE_Z, name: 'l' },
  { x: SIDE_NOZZLE_X[0] + SIDE_NOZZLE_IN_DX, y: SIDE_NOZZLE_IN_Y, z: SIDE_NOZZLE_IN_Z, name: 'l-in' },
  { x: SIDE_NOZZLE_X[1] - SIDE_NOZZLE_IN_DX, y: SIDE_NOZZLE_IN_Y, z: SIDE_NOZZLE_IN_Z, name: 'r-in' },
  { x: SIDE_NOZZLE_X[1], y: SIDE_NOZZLE_Y, z: SIDE_NOZZLE_Z, name: 'r' },
];

/** Single flat quad (position + colour), corners counter-clockwise seen from its front. */
function flatQuad(a: number[], b: number[], c: number[], d: number[], color: THREE.Color): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Array(6).fill([color.r, color.g, color.b]).flat(), 3));
  return g;
}

function buildRearParts(parts: THREE.BufferGeometry[]) {
  const back = bz(4.2); // fan wall
  const face = bz(4.42); // outer lip plane
  const depth = face - back;
  const mid = (back + face) / 2;
  // Box hangs low like the real one (bottom lip ~9 cm off the road).
  parts.push(box(1.24, 0.52, 0.04, C.carbon, 0, 0.33, back)); // back wall
  parts.push(box(0.04, 0.52, depth, C.carbon, -0.6, 0.33, mid)); // side walls
  parts.push(box(0.04, 0.52, depth, C.carbon, 0.6, 0.33, mid));
  parts.push(box(1.24, 0.04, depth, C.carbon, 0, 0.09, mid)); // floor lip
  parts.push(box(1.24, 0.03, depth, C.carbon, 0, 0.43, mid)); // shelf under nozzles
  parts.push(box(1.24, 0.03, depth, C.carbon, 0, 0.585, mid)); // top lip
  for (const x of [-0.3, 0, 0.3]) parts.push(box(0.02, 0.3, depth, C.carbon, x, 0.27, mid)); // strakes
  // Nozzles: gold/titanium rims with a black throat.
  for (const x of FAN_X) {
    const rim = new THREE.CylinderGeometry(0.055, 0.045, 0.14, 10, 1, true);
    parts.push(part(rim, C.gold, at(x, NOZZLE_Y, face - 0.05, Math.PI / 2)));
    const throat = new THREE.CircleGeometry(0.05, 10);
    parts.push(part(throat, C.black, at(x, NOZZLE_Y, face - 0.09)));
  }
  // Lower rear panel in body colour (official hero / gravity: white-silver, plate in the middle; black only
  // from the diffuser down), following the tail taper (hwC at the bottom → hwB at the shoulder).
  const tail = S[S.length - 1];
  const hwAt = (y: number) => (tail.hwC ?? tail.hwB) + ((y - tail.flare) / (tail.sh - tail.flare)) * (tail.hwB - (tail.hwC ?? tail.hwB));
  const y0 = tail.flare, y1 = 0.82, zp = bz(4.4) + 0.004;
  parts.push(flatQuad(
    [-hwAt(y0), y0, zp], [hwAt(y0), y0, zp], [hwAt(y1), y1, zp], [-hwAt(y1), y1, zp], C.white,
  ));
  parts.push(box(1.9, 0.07, 0.012, C.black, 0, 0.865, bz(4.4) + 0.006)); // dark groove the light bar sits in
  parts.push(box(0.4, 0.2, 0.02, C.black, 0, 0.69, bz(4.4) + 0.008)); // plate recess
  parts.push(box(0.04, 0.03, 0.02, C.black, 0, 0.8, bz(4.4) + 0.01)); // rear camera above the plate
  // two black fins hanging at the outer edges of the diffuser (hero)
  for (const x of [-0.62, 0.62]) parts.push(box(0.03, 0.22, 0.25, C.carbon, x, 0.17, mid));
  // Side-down thrusters beside the rear wheels (Rocket package): bracket + gold can.
  for (const x of SIDE_NOZZLE_X) {
    parts.push(box(0.05, 0.16, 0.05, C.black, x, 0.4, SIDE_NOZZLE_Z));
    const can = new THREE.CylinderGeometry(0.045, 0.055, 0.14, 10, 1, true);
    parts.push(part(can, C.gold, at(x, SIDE_NOZZLE_Y + 0.07, SIDE_NOZZLE_Z)));
    parts.push(part(new THREE.CircleGeometry(0.05, 10), C.black, at(x, SIDE_NOZZLE_Y + 0.01, SIDE_NOZZLE_Z, Math.PI / 2)));
  }
  // Inboard pair: short gold tips under the body edge (mostly hidden, as in the photo).
  for (const n of SIDE_NOZZLES.filter((q) => q.name.endsWith('-in'))) {
    parts.push(part(new THREE.CylinderGeometry(0.04, 0.05, 0.1, 10, 1, true), C.gold, at(n.x, n.y + 0.05, n.z)));
    parts.push(part(new THREE.CircleGeometry(0.045, 10), C.black, at(n.x, n.y + 0.01, n.z, Math.PI / 2)));
  }
  // Front splitter + black nose band (0.23–0.42, white light bar on its top edge).
  parts.push(box(1.5, 0.03, 0.25, C.black, 0, 0.17, bz(0.1)));
  parts.push(box(1.3, 0.19, 0.02, C.black, 0, 0.325, bz(0.0) - 0.006));
  return { face };
}

/** Wing angle (rad): trailing edge up so the chase camera sees the blade surface. */
export const WING_CRUISE = -0.28;
export const WING_AIRBRAKE = -1.4;
/**
 * Hidden Aero poses of the wing pivot (leading edge). Raised: blade ~0.12 m above the light bar, its top
 * level with the roof (official-04-world / -06-gravity). Stowed: folded onto the deck lid, pitched with it.
 */
export const WING_POSE = {
  raised: { y: 1.12, z: bz(4.08) },
  stowed: { y: topAt(3.9).y + 0.01, z: bz(3.9), pitch: Math.atan2(topAt(3.9).y - topAt(4.35).y, 0.45) },
} as const;

/**
 * One curved blade: low centre, tips swept up and out (dihedral ramps 0 → tipDih over the span), short
 * swan-neck pylons under it. Same vertex layout for any (tipDih, pylonH) so it can morph flat for stowing.
 */
function wingGeometry(tipDih: number, pylonH: number, spanK = 1): THREE.BufferGeometry {
  const chord = 0.45, cz = chord / 2, half = 0.98, n = 6, t = 0.03;
  const parts: THREE.BufferGeometry[] = [];
  // centre panel, then n panels per side, each turned a bit further up
  const cw = 0.5;
  parts.push(box(cw, t, chord, C.white, 0, 0, cz), box(cw, 0.045, 0.035, C.white, 0, -0.008, 0.018));
  for (const sg of [-1, 1]) {
    let x = cw / 2, y = 0;
    const w = (half - cw / 2) / n;
    for (let i = 0; i < n; i++) {
      const a = tipDih * ((i + 1) / n) ** 2; // flat middle, tips flick up
      const mx = x + (w / 2) * Math.cos(a), my = y + (w / 2) * Math.sin(a);
      parts.push(part(new THREE.BoxGeometry(w + 0.004, t, chord), C.white, at(sg * mx, my, cz, 0, 0, sg * a)));
      parts.push(part(new THREE.BoxGeometry(w + 0.004, 0.045, 0.035), C.white, at(sg * mx, my - 0.008, 0.018, 0, 0, sg * a)));
      x += w * Math.cos(a); y += w * Math.sin(a);
    }
  }
  // pylons: post down from the blade's underside + a short hook (black)
  for (const x of [-0.45, 0.45]) {
    parts.push(box(0.035, pylonH, 0.06, C.black, x, -pylonH / 2, 0.16));
    parts.push(box(0.035, 0.035, 0.16, C.black, x, -0.02, 0.1));
  }
  const g = mergeGeometries(parts)!;
  if (spanK !== 1) g.scale(spanK, 1, 1);
  return g;
}

function buildWing(material: THREE.Material): { pivot: THREE.Object3D; mesh: THREE.Mesh } {
  const pivot = new THREE.Group();
  pivot.name = 'wing';
  pivot.position.set(0, WING_POSE.raised.y, WING_POSE.raised.z);
  pivot.rotation.x = WING_CRUISE;
  const geo = wingGeometry(0.35, 0.26);
  // morph target 0 = folded flat: no tip sweep, span narrowed to the deck lid, pylons collapsed inside it
  geo.morphAttributes.position = [wingGeometry(0, 0.01, 0.8).getAttribute('position')];
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'wing-blade';
  mesh.morphTargetInfluences = [0];
  pivot.add(mesh);
  return { pivot, mesh };
}

/** Base multiplier of the tail-light material colour (raise for brake / boost). */
export const TAIL_GLOW = 1.6;

/** Red tail bar: thin (~3.5 cm), ~90 % of the width, in a dark groove under the deck edge, wraps the corners. */
function buildTailLights(): THREE.Mesh {
  const z = bz(4.4) + 0.014;
  const red = new THREE.Color(1, 0, 0.01);
  const dim = new THREE.Color(0.45, 0, 0.004);
  const parts = [
    box(1.8, 0.035, 0.024, red, 0, 0.87, z),
    box(1.7, 0.01, 0.02, dim, 0, 0.83, z), // thin second line (official-07-augments)
  ];
  for (const s of [-1, 1]) parts.push(box(0.024, 0.035, 0.14, red, s * 0.9, 0.87, z - 0.07));
  // Pure red (no G/B) so tone mapping + bloom stay red instead of drifting to orange.
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  mat.color.setScalar(TAIL_GLOW);
  const mesh = new THREE.Mesh(mergeGeometries(parts)!, mat);
  mesh.name = 'tail-lights';
  return mesh;
}

/** Front white bar + tiny lamps at the fender corners. */
function buildHeadLights(): THREE.Mesh {
  const parts = [box(1.2, 0.02, 0.02, C.white, 0, 0.43, bz(0.0) - 0.008)]; // top edge of the nose's black band
  for (const s of [-1, 1]) {
    parts.push(part(new THREE.BoxGeometry(0.16, 0.035, 0.02), C.white, at(s * 0.68, 0.56, bz(0.42) - 0.015, -0.5, 0, s * 0.25)));
  }
  const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  mat.color.setScalar(1.2);
  const mesh = new THREE.Mesh(mergeGeometries(parts)!, mat);
  mesh.name = 'headlights';
  return mesh;
}

/** Thai plate 34 × 15 cm on the rear face, lit by the scene like real paint. */
function buildPlate(): THREE.Mesh {
  const g = new THREE.PlaneGeometry(0.34, 0.15);
  const mat = new THREE.MeshStandardMaterial({ map: createPlateTexture(), roughness: 0.5, metalness: 0 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.set(0, 0.69, bz(4.4) + 0.026);
  mesh.name = 'plate';
  return mesh;
}

// ---------------------------------------------------------------------------
// Wheels: one unit geometry (radius 1, width 1, axle along x), 6 thin spokes over
// an aero disc on both faces so left/right share it without negative scale.
function wheelGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const tyre = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true);
  parts.push(part(tyre, C.tyre, at(0, 0, 0, 0, 0, Math.PI / 2)));
  for (const side of [-1, 1]) {
    // Grey sidewall ring so the tyre separates from a dark road.
    const wall = new THREE.RingGeometry(0.76, 1, 18, 1);
    parts.push(part(wall, C.sidewall, at(side * 0.5, 0, 0, 0, side * Math.PI / 2)));
    const disc = new THREE.CircleGeometry(0.76, 18);
    parts.push(part(disc, C.disc, at(side * 0.505, 0, 0, 0, side * Math.PI / 2)));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spoke = new THREE.BoxGeometry(0.03, 0.62, 0.07);
      const m = new THREE.Matrix4()
        .makeRotationX(a)
        .multiply(new THREE.Matrix4().makeTranslation(side * 0.52, 0.38, 0));
      parts.push(part(spoke, C.spoke, m));
    }
    const hub = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8);
    parts.push(part(hub, C.spoke, at(side * 0.52, 0, 0, 0, 0, Math.PI / 2)));
  }
  const g = mergeGeometries(parts)!;
  g.computeVertexNormals();
  return g;
}

function fanGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const hub = new THREE.CylinderGeometry(0.035, 0.05, 0.06, 8);
  parts.push(part(hub, C.black, at(0, 0, 0, Math.PI / 2)));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const blade = new THREE.BoxGeometry(0.05, FAN_R * 0.9, 0.01);
    const m = new THREE.Matrix4()
      .makeRotationZ(a)
      .multiply(at(0.0, FAN_R * 0.5, 0, 0, 0.5, 0));
    parts.push(part(blade, C.fan, m));
  }
  const ring = new THREE.CylinderGeometry(FAN_R, FAN_R, 0.04, 14, 1, true);
  parts.push(part(ring, C.carbon, at(0, 0, -0.01, Math.PI / 2)));
  const g = mergeGeometries(parts)!;
  g.computeVertexNormals();
  return g;
}

/**
 * One InstancedMesh driven by Object3D proxies. Synced inside updateMatrixWorld,
 * which the renderer runs before uploading buffers → no one-frame lag.
 */
function instancedFromProxies(
  root: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  proxies: THREE.Object3D[],
  localScale: THREE.Vector3[],
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, proxies.length);
  mesh.frustumCulled = false; // instances move; the car is always on screen anyway
  const rootInv = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  const scale = localScale.map((s) => new THREE.Matrix4().makeScale(s.x, s.y, s.z));
  const base = mesh.updateMatrixWorld.bind(mesh);
  mesh.updateMatrixWorld = (force?: boolean) => {
    base(force);
    rootInv.copy(root.matrixWorld).invert();
    for (let i = 0; i < proxies.length; i++) {
      proxies[i].updateWorldMatrix(true, false);
      m.multiplyMatrices(rootInv, proxies[i].matrixWorld).multiply(scale[i]);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return mesh;
}

// ---------------------------------------------------------------------------
export function buildCarModel(): CarModel {
  const root = new THREE.Group();
  root.name = 'player-car';

  const bodyMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.45, metalness: 0.15, flatShading: true,
  });

  // Body: loft + all fixed trim merged → 1 draw call.
  const tb = new TriBuilder();
  buildBodyShell(tb);
  buildRearGlass(tb);
  const parts: THREE.BufferGeometry[] = [tb.geometry()];
  for (const p of parts) p.deleteAttribute('normal');
  const { face } = buildRearParts(parts);
  const bodyGeo = mergeGeometries(parts)!;
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.name = 'body';
  root.add(body);

  // Silver-bronze; low metalness so the blade still reads at night without an env map.
  const wingMat = new THREE.MeshStandardMaterial({
    color: '#d4bea4', vertexColors: true, roughness: 0.38, metalness: 0.15,
    // Faint self-glow: the chase cam sees the blade's underside, which street lights rarely hit.
    emissive: '#4a3826', flatShading: true,
  });
  // Wing parts are white in vertex colour so the material colour reads as copper.
  const { pivot: wing, mesh: wingMesh } = buildWing(wingMat);
  root.add(wing);
  const R = WING_POSE.raised, St = WING_POSE.stowed;
  const setAero = (deploy: number, angle: number) => {
    const k = Math.max(0, Math.min(1, deploy)), e = k * k * (3 - 2 * k); // smoothstep: lift, then sweep
    wing.position.set(0, St.y + (R.y - St.y) * e, St.z + (R.z - St.z) * e);
    wing.rotation.x = St.pitch + (angle - St.pitch) * e;
    wingMesh.morphTargetInfluences![0] = 1 - Math.min(1, e * 1.4);
  };

  const tail = buildTailLights();
  const headLights = buildHeadLights();
  root.add(tail, headLights);
  root.add(buildPlate());

  // Nozzle anchors for VFX (local +z = exhaust direction).
  const rearNozzles = FAN_X.map((x, i) => {
    const o = new THREE.Object3D();
    o.name = `nozzle-rear-${i}`;
    o.userData.kind = 'rear';
    o.position.set(x, NOZZLE_Y, face);
    root.add(o);
    return o;
  });
  const sideNozzles = SIDE_NOZZLES.map((n) => {
    const o = new THREE.Object3D();
    o.name = `nozzle-side-down-${n.name}`;
    o.userData.kind = 'side-down';
    o.position.set(n.x, n.y, n.z);
    o.rotation.x = Math.PI / 2; // local +z → −y (down)
    root.add(o);
    return o;
  });
  const nozzles = [...rearNozzles, ...sideNozzles];

  // Wheels.
  const D = CAR_DIMS;
  const mkWheel = (name: string, x: number, z: number, r: number) => {
    const o = new THREE.Object3D();
    o.name = name;
    o.rotation.order = 'YXZ';
    o.position.set(x, r, z);
    root.add(o);
    return o;
  };
  const wheels = {
    fl: mkWheel('wheel-fl', -D.frontHalfTrack, D.frontAxleZ, D.frontWheelRadius),
    fr: mkWheel('wheel-fr', D.frontHalfTrack, D.frontAxleZ, D.frontWheelRadius),
    rl: mkWheel('wheel-rl', -D.rearHalfTrack, D.rearAxleZ, D.rearWheelRadius),
    rr: mkWheel('wheel-rr', D.rearHalfTrack, D.rearAxleZ, D.rearWheelRadius),
  };
  const fw = new THREE.Vector3(D.frontWheelWidth, D.frontWheelRadius, D.frontWheelRadius);
  const rw = new THREE.Vector3(D.rearWheelWidth, D.rearWheelRadius, D.rearWheelRadius);
  const wheelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2, flatShading: true });
  const wheelMesh = instancedFromProxies(
    root, wheelGeometry(), wheelMat,
    [wheels.fl, wheels.fr, wheels.rl, wheels.rr], [fw, fw, rw, rw],
  );
  wheelMesh.name = 'wheels';

  // Fans sit just in front of the diffuser back wall.
  const fans = FAN_X.map((x, i) => {
    const o = new THREE.Object3D();
    o.name = `fan-${i}`;
    o.position.set(x, FAN_Y, bz(4.2) + 0.04);
    root.add(o);
    return o;
  });
  const one = new THREE.Vector3(1, 1, 1);
  const fanMesh = instancedFromProxies(root, fanGeometry(), wheelMat, fans, fans.map(() => one));
  fanMesh.name = 'fans';

  // Instanced meshes must come after their proxies in the child list.
  root.add(wheelMesh, fanMesh);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
    }
  });

  return { root, wheels, nozzles, rearNozzles, sideNozzles, tailLights: [tail], headLights, fans, wing, setAero };
}

/** Triangle + draw-call count for QA/budget checks. */
export function carModelStats(model: CarModel) {
  let triangles = 0;
  let drawCalls = 0;
  model.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry;
    const tris = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    const inst = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1;
    triangles += tris * inst;
    drawCalls += 1;
  });
  return { triangles, drawCalls };
}
