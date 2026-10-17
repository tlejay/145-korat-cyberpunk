// Low-poly player car, built in code from research/car/blueprint.md.
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
  height: 1.27,
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
   * All thruster tips: 4 × 'rear' (left → right, blow backward) then 2 × 'side-down'
   * (left, right; beside the rear wheels, blow at the road — jump/launch).
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
  rearPanel: new THREE.Color('#2a2c30'),
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
const S: Station[] = [
  { x: 0.0, top: 0.35, sh: 0.34, flare: 0.24, floor: 0.18, hwT: 0.66, hwB: 0.78, hwTub: 0.7 },
  { x: 0.45, top: 0.56, sh: 0.62, flare: 0.47, floor: 0.13, hwT: 0.62, hwB: 0.95, hwTub: 0.62 },
  { x: 0.7, top: 0.64, sh: 0.8, flare: 0.74, floor: 0.12, hwT: 0.62, hwB: 1.0, hwTub: 0.62 },
  { x: 1.02, top: 0.78, sh: 0.86, flare: 0.74, floor: 0.11, hwT: 0.64, hwB: 1.0, hwTub: 0.62 },
  { x: 1.15, top: 0.92, sh: 0.895, flare: 0.56, floor: 0.11, hwT: 0.7, hwB: 1.0, hwTub: 0.62 },
  { x: 1.27, top: 0.96, sh: 0.9, flare: 0.45, floor: 0.11, hwT: 0.68, hwB: 1.0, hwTub: 0.62 },
  { x: 1.5, top: 1.04, sh: 0.91, flare: 0.3, floor: 0.11, hwT: 0.64, hwB: 0.99, hwTub: 0.9 },
  { x: 2.1, top: 1.24, sh: 0.93, flare: 0.3, floor: 0.11, hwT: 0.57, hwB: 0.98, hwTub: 0.9 },
  { x: 2.75, top: 1.27, sh: 0.95, flare: 0.3, floor: 0.11, hwT: 0.55, hwB: 0.98, hwTub: 0.9 },
  { x: 3.2, top: 1.22, sh: 0.96, flare: 0.3, floor: 0.11, hwT: 0.56, hwB: 0.99, hwTub: 0.9 },
  { x: 3.3, top: 1.21, sh: 0.965, flare: 0.45, floor: 0.11, hwT: 0.57, hwB: 1.0, hwTub: 0.64 },
  { x: 3.55, top: 1.17, sh: 0.97, flare: 0.79, floor: 0.11, hwT: 0.6, hwB: 1.0, hwTub: 0.64 },
  { x: 3.85, top: 1.12, sh: 0.98, flare: 0.79, floor: 0.11, hwT: 0.72, hwB: 1.0, hwTub: 0.64 },
  { x: 4.11, top: 1.07, sh: 0.99, flare: 0.5, floor: 0.25, hwT: 0.86, hwB: 0.98, hwTub: 0.62, hwC: 0.92 },
  { x: 4.4, top: 1.03, sh: 0.99, flare: 0.58, floor: 0.58, hwT: 0.9, hwB: 0.95, hwTub: 0.62, hwC: 0.8 },
];
const GLASS_TOP = [1.15, 3.55] as const; // windshield + roof canopy
const GLASS_SIDE = [1.15, 4.11] as const; // side glass tapers to a point at the rear

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
  // Dark lower rear panel: from the diffuser up to just under the light bar,
  // following the tail taper (hwC at the bottom → hwB at the shoulder).
  const tail = S[S.length - 1];
  const hwAt = (y: number) => (tail.hwC ?? tail.hwB) + ((y - tail.flare) / (tail.sh - tail.flare)) * (tail.hwB - (tail.hwC ?? tail.hwB));
  const y0 = tail.flare, y1 = 0.935, zp = bz(4.4) + 0.004;
  parts.push(flatQuad(
    [-hwAt(y0), y0, zp], [hwAt(y0), y0, zp], [hwAt(y1), y1, zp], [-hwAt(y1), y1, zp], C.rearPanel,
  ));
  parts.push(box(0.4, 0.2, 0.02, C.black, 0, 0.76, bz(4.4) + 0.008)); // plate recess
  // Side-down thrusters beside the rear wheels (Rocket package): bracket + gold can.
  for (const x of SIDE_NOZZLE_X) {
    parts.push(box(0.05, 0.16, 0.05, C.black, x, 0.4, SIDE_NOZZLE_Z));
    const can = new THREE.CylinderGeometry(0.045, 0.055, 0.14, 10, 1, true);
    parts.push(part(can, C.gold, at(x, SIDE_NOZZLE_Y + 0.07, SIDE_NOZZLE_Z)));
    parts.push(part(new THREE.CircleGeometry(0.05, 10), C.black, at(x, SIDE_NOZZLE_Y + 0.01, SIDE_NOZZLE_Z, Math.PI / 2)));
  }
  // Wing pylons (swan neck): post from deck up, then a hook back over the wing.
  for (const x of [-0.45, 0.45]) {
    parts.push(box(0.035, 0.52, 0.06, C.black, x, 1.29, bz(4.02), -0.25));
    parts.push(box(0.035, 0.04, 0.22, C.black, x, 1.58, bz(4.15)));
    parts.push(box(0.035, 0.08, 0.03, C.black, x, 1.55, bz(4.25)));
  }
  // Front splitter + intake band.
  parts.push(box(1.5, 0.03, 0.25, C.black, 0, 0.17, bz(0.1)));
  parts.push(box(1.3, 0.1, 0.02, C.black, 0, 0.24, bz(0.0) - 0.006));
  return { face };
}

/** Wing angle (rad): trailing edge up so the chase camera sees the blade surface. */
export const WING_CRUISE = -0.28;
export const WING_AIRBRAKE = -1.4;

function buildWing(material: THREE.Material): THREE.Object3D {
  const pivot = new THREE.Group();
  pivot.name = 'wing';
  pivot.position.set(0, 1.52, bz(4.1));
  pivot.rotation.x = WING_CRUISE;
  // Span ~1.96 (near body width): flat centre plane + outboard panels swept up, endplates.
  const chord = 0.42, cz = chord / 2;
  const mid = 1.16, outer = 0.42, dih = 0.26; // dihedral (rad) of the outboard panels
  const parts: THREE.BufferGeometry[] = [
    box(mid, 0.03, chord, C.white, 0, 0, cz),
    box(mid, 0.045, 0.035, C.white, 0, -0.008, 0.018), // thicker leading edge
  ];
  for (const s of [-1, 1]) {
    const ox = s * (mid / 2 + (outer / 2) * Math.cos(dih)), oy = (outer / 2) * Math.sin(dih);
    parts.push(part(new THREE.BoxGeometry(outer, 0.03, chord), C.white, at(ox, oy, cz, 0, 0, s * dih)));
    const ex = s * (mid / 2 + outer * Math.cos(dih)), ey = outer * Math.sin(dih);
    parts.push(box(0.025, 0.2, chord + 0.04, C.white, ex, ey - 0.07, cz)); // endplate
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts)!, material);
  mesh.name = 'wing-blade';
  pivot.add(mesh);
  return pivot;
}

/** Base multiplier of the tail-light material colour (raise for brake / boost). */
export const TAIL_GLOW = 1.6;

/** Red tail bar: thick, full width, tucked right under the deck edge, wraps the corners. */
function buildTailLights(): THREE.Mesh {
  const z = bz(4.4) + 0.014;
  const red = new THREE.Color(1, 0, 0.01);
  const dim = new THREE.Color(0.45, 0, 0.004);
  const parts = [
    box(1.88, 0.05, 0.024, red, 0, 0.99, z),
    box(1.8, 0.012, 0.02, dim, 0, 0.945, z), // thin second line
  ];
  for (const s of [-1, 1]) parts.push(box(0.024, 0.05, 0.16, red, s * 0.94, 0.99, z - 0.08));
  // Pure red (no G/B) so tone mapping + bloom stay red instead of drifting to orange.
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  mat.color.setScalar(TAIL_GLOW);
  const mesh = new THREE.Mesh(mergeGeometries(parts)!, mat);
  mesh.name = 'tail-lights';
  return mesh;
}

/** Front white bar + tiny lamps at the fender corners. */
function buildHeadLights(): THREE.Mesh {
  const parts = [box(1.2, 0.02, 0.02, C.white, 0, 0.3, bz(0.0) - 0.008)];
  for (const s of [-1, 1]) {
    parts.push(part(new THREE.BoxGeometry(0.16, 0.035, 0.02), C.white, at(s * 0.68, 0.5, bz(0.42) - 0.015, -0.5, 0, s * 0.25)));
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
  mesh.position.set(0, 0.76, bz(4.4) + 0.026);
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
  const wing = buildWing(wingMat);
  root.add(wing);

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
  const sideNozzles = SIDE_NOZZLE_X.map((x, i) => {
    const o = new THREE.Object3D();
    o.name = `nozzle-side-down-${i ? 'r' : 'l'}`;
    o.userData.kind = 'side-down';
    o.position.set(x, SIDE_NOZZLE_Y, SIDE_NOZZLE_Z);
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

  return { root, wheels, nozzles, rearNozzles, sideNozzles, tailLights: [tail], headLights, fans, wing };
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
