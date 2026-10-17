// Rough landmark models with true footprint/proportions (research/landmarks/landmarks.json):
// Thao Suranari monument (sacred focal point — never a collider target, softly lit),
// Ya Mo plaza paving, Chumphon Gate + merlon walls, Terminal 21 on the skyline.
import * as THREE from 'three';
import { GeoBuilder, col, type V3 } from './builder.js';
import { toRing, type RawTrack } from './data.js';
import type { TrackMaterials } from './materials.js';
import type { Vec2 } from '../types.js';

const tri = (ring: Vec2[]) => THREE.ShapeUtils.triangulateShape(ring.map((p) => new THREE.Vector2(p.x, p.z)), []);

function extrude(g: GeoBuilder, ring: Vec2[], y0: number, y1: number, side: THREE.Color, top: THREE.Color, uvScale?: [number, number]) {
  let area = 0;
  for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; area += p.x * q.z - q.x * p.z; }
  const sgn = area >= 0 ? 1 : -1;
  let u = 0;
  for (let k = 0; k < ring.length; k++) {
    const p = ring[k], q = ring[(k + 1) % ring.length], ex = q.x - p.x, ez = q.z - p.z, el = Math.hypot(ex, ez) || 1;
    const uv = uvScale && ([[u * uvScale[0], y0 * uvScale[1]], [(u + el) * uvScale[0], y0 * uvScale[1]], [(u + el) * uvScale[0], y1 * uvScale[1]], [u * uvScale[0], y1 * uvScale[1]]] as [number, number][]);
    g.quadN([p.x, y0, p.z], [q.x, y0, q.z], [q.x, y1, q.z], [p.x, y1, p.z], side, [(sgn * ez) / el, 0, (-sgn * ex) / el], uv);
    u += el;
  }
  for (const t of tri(ring)) {
    const [a, b, c] = t.map((k) => ring[k]);
    g.triUp([a.x, y1, a.z], [b.x, y1, b.z], [c.x, y1, c.z], top);
  }
}

// Long axis (unit, x/z) + centre + extents of a footprint via PCA.
function frame(ring: Vec2[]) {
  const cx = ring.reduce((a, p) => a + p.x, 0) / ring.length, cz = ring.reduce((a, p) => a + p.z, 0) / ring.length;
  let sxx = 0, szz = 0, sxz = 0;
  for (const p of ring) { sxx += (p.x - cx) ** 2; szz += (p.z - cz) ** 2; sxz += (p.x - cx) * (p.z - cz); }
  const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  const ax = { x: Math.cos(ang), z: Math.sin(ang) }, ay = { x: -ax.z, z: ax.x };
  let l0 = Infinity, l1 = -Infinity, w0 = Infinity, w1 = -Infinity;
  for (const p of ring) {
    const u = (p.x - cx) * ax.x + (p.z - cz) * ax.z, v = (p.x - cx) * ay.x + (p.z - cz) * ay.z;
    l0 = Math.min(l0, u); l1 = Math.max(l1, u); w0 = Math.min(w0, v); w1 = Math.max(w1, v);
  }
  return { cx: cx + ax.x * (l0 + l1) / 2 + ay.x * (w0 + w1) / 2, cz: cz + ax.z * (l0 + l1) / 2 + ay.z * (w0 + w1) / 2, ax, ay, len: l1 - l0, wid: w1 - w0 };
}

export interface Landmarks {
  group: THREE.Group;
  monumentLight: THREE.PointLight;
  skyline: THREE.Group;          // far objects re-projected inside the camera far plane each frame
  skylineAnchor: THREE.Vector3;
}

export function buildLandmarks(raw: RawTrack, mats: TrackMaterials): Landmarks {
  const group = new THREE.Group();
  group.name = 'landmarks';
  const g = new GeoBuilder();
  const lm = raw.landmarks;

  // Plaza paving (light stone) with globe lamps around its edge.
  const plaza = toRing(lm.plaza);
  const stone = col(0x8c8a84), stoneTop = col(0x9b988f);
  extrude(g, plaza, 0, 0.06, stone, stoneTop);
  const glow = new GeoBuilder();
  for (let k = 0; k < plaza.length; k += 2) {
    const p = plaza[k];
    g.box(p.x, 2, p.z, 0.16, 4, 0.16, 0, col(0x2a2a2a));
    glow.box(p.x, 4.15, p.z, 0.42, 0.42, 0.42, Math.PI / 4, col(0xffe6b0));
  }

  // Monument: terrace (OSM 26×26 m) → pedestal → statue, facing west (toward Bangkok).
  const terrace = toRing(lm.monument.terrace);
  extrude(g, terrace, 0.06, 0.6, col(0xb9b4aa), col(0xcfcac0));
  // steps: the terrace outline grown ~0.8 m all round, half height
  const tcx = terrace.reduce((a, p) => a + p.x, 0) / terrace.length, tcz = terrace.reduce((a, p) => a + p.z, 0) / terrace.length;
  const steps = terrace.map((p) => { const dx = p.x - tcx, dz = p.z - tcz, l = Math.hypot(dx, dz) || 1; return { x: p.x + (dx / l) * 0.9, z: p.z + (dz / l) * 0.9 }; });
  extrude(g, steps, 0.06, 0.32, col(0xa8a399), col(0xb4afa5));
  const white = col(0xf2eee4);
  g.box(0, 0.85, 0, 6.2, 0.5, 6.2, 0, col(0xd9d4c8));
  g.box(0, 2.35, 0, 3.6, 2.5, 3.6, 0, white);           // pedestal (~3 m above the terrace incl. base)
  g.box(0, 3.75, 0, 4.0, 0.3, 4.0, 0, col(0xe6e1d6));    // cornice
  // offerings ring (garlands / marigold) — warm dots at the pedestal foot
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    glow.box(Math.cos(a) * 2.6, 1.15, Math.sin(a) * 2.6, 0.35, 0.18, 0.35, a, col(0xffa21f));
  }
  group.add(new THREE.Mesh(glow.build(), mats.neon));

  // Statue (1.85 m) standing on the pedestal, facing −x. Sword in the right hand (north side), tip down.
  const st = new GeoBuilder();
  const bz = col(0xffffff);
  const base = 3.9;
  const lathe = (r0: number, r1: number, y0: number, y1: number, n = 10) => {
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      const P = (r: number, a: number, y: number): V3 => [Math.cos(a) * r, y, Math.sin(a) * r];
      st.quadN(P(r0, a0, y0), P(r0, a1, y0), P(r1, a1, y1), P(r1, a0, y1), bz, [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)]);
    }
  };
  lathe(0.36, 0.26, base, base + 0.95);           // pha-nung (skirt)
  lathe(0.26, 0.22, base + 0.95, base + 1.5);     // torso + sash
  lathe(0.22, 0.08, base + 1.5, base + 1.6);      // shoulders/neck
  lathe(0.1, 0.12, base + 1.6, base + 1.75);      // head
  lathe(0.12, 0.05, base + 1.75, base + 1.86);    // hair bun
  st.box(-0.05, base + 1.2, -0.3, 0.1, 0.55, 0.1, 0, bz);    // right arm (north)
  st.box(-0.25, base + 0.55, -0.42, 0.04, 1.1, 0.06, 0.25, bz); // sword, tip resting on the base
  st.box(0, base + 1.12, 0.32, 0.1, 0.1, 0.28, 0, bz);       // left hand on hip (south)
  const statue = new THREE.Mesh(st.build(), mats.bronze);
  statue.name = 'thao-suranari';
  statue.rotation.y = 0; // modelled facing −x already
  group.add(statue);

  // Warm key light from the front (west) so she is the brightest point of the scene.
  const monumentLight = new THREE.PointLight(0xffd7a0, 120, 55, 1.6);
  monumentLight.position.set(-9, 7.5, 2);
  group.add(monumentLight);

  // Chumphon Gate: 43 m long (N–S) × 11 m, 3 m opening, ~6 m white wall with merlons,
  // two-tier maroon watch-tower with a red-brown Thai gable roof (total ~13 m).
  const gf = frame(toRing(lm.gate.ring));
  const yaw = Math.atan2(-gf.ax.z, gf.ax.x); // box yaw so its local x = long axis
  const along = (u: number, v: number) => [gf.cx + gf.ax.x * u + gf.ay.x * v, gf.cz + gf.ax.z * u + gf.ay.z * v] as const;
  const plaster = col(0xeae2cf), maroon = col(0x6a1e1e), tile = col(0x7a3420), merlonC = col(0xe2d9c4);
  const L = gf.len, Wd = gf.wid, open = 3.0, core = 13;
  // wall stubs either side of the gate block
  const stubLen = (L - core) / 2;
  for (const sgn of [-1, 1]) {
    const [x, z] = along(sgn * (core / 2 + stubLen / 2), 0);
    g.box(x, 2.6, z, stubLen, 5.2, 3.2, yaw, plaster);
  }
  // gate block with opening + lintel
  for (const sgn of [-1, 1]) {
    const pl = (core - open) / 2;
    const [x, z] = along(sgn * (open / 2 + pl / 2), 0);
    g.box(x, 3, z, pl, 6, Wd, yaw, plaster);
  }
  { const [x, z] = along(0, 0); g.box(x, 4.9, z, open, 2.2, Wd, yaw, plaster); }
  // merlons (ใบเสมา) along both faces of the whole wall
  for (let u = -L / 2 + 0.8; u <= L / 2 - 0.8; u += 1.6) {
    const onCore = Math.abs(u) < core / 2;
    const top = onCore ? 6 : 5.2, half = onCore ? Wd / 2 - 0.25 : 1.35;
    for (const v of [-half, half]) {
      const [x, z] = along(u, v);
      g.box(x, top + 0.55, z, 0.8, 1.1, 0.35, yaw, merlonC);
    }
  }
  // watch-tower: maroon wooden body + layered gable roof
  { const [x, z] = along(0, 0); g.box(x, 7.6, z, 8, 3.2, 6.5, yaw, maroon, col(0x4a1414)); }
  const gable = (y0: number, y1: number, lu: number, lv: number) => {
    const P = (u: number, v: number, y: number): V3 => { const [x, z] = along(u, v); return [x, y, z]; };
    const ridgeA = P(-lu / 2 + 0.6, 0, y1), ridgeB = P(lu / 2 - 0.6, 0, y1);
    const e = [P(-lu / 2, -lv / 2, y0), P(lu / 2, -lv / 2, y0), P(lu / 2, lv / 2, y0), P(-lu / 2, lv / 2, y0)];
    const n1: V3 = [-gf.ay.x, 0.8, -gf.ay.z], n2: V3 = [gf.ay.x, 0.8, gf.ay.z];
    g.quadN(e[0], e[1], ridgeB, ridgeA, tile, n1);
    g.quadN(e[3], e[2], ridgeB, ridgeA, tile, n2);
    g.tri(e[0], ridgeA, e[3], tile); g.tri(e[3], ridgeA, e[0], tile);
    g.tri(e[1], ridgeB, e[2], tile); g.tri(e[2], ridgeB, e[1], tile);
  };
  gable(9.2, 11.2, 10.5, 9);
  gable(10.6, 13.0, 7.5, 6.5);

  const lmMesh = new THREE.Mesh(g.build(), mats.landmark);
  lmMesh.name = 'landmarks';
  group.add(lmMesh);

  // Terminal 21 (~1.2 km NW): mall block + 110 m tower + hotel, drawn without fog as a skyline.
  const skyline = new THREE.Group();
  skyline.name = 'skyline';
  const sk = new GeoBuilder();
  const t21 = toRing(lm.t21.ring);
  const tf2 = frame(t21);
  const dark = col(0x3a3550);
  extrude(sk, t21, 0, 34, dark, col(0x241f33), [1 / 24, 1 / 27]);
  const ty = Math.atan2(-tf2.ax.z, tf2.ax.x);
  const P2 = (u: number, v: number) => [tf2.cx + tf2.ax.x * u + tf2.ay.x * v, tf2.cz + tf2.ax.z * u + tf2.ay.z * v] as const;
  { const [x, z] = P2(-tf2.len * 0.3, 0); sk.box(x, lm.t21.h / 2, z, 22, lm.t21.h, 22, ty, dark); }
  { const [x, z] = P2(tf2.len * 0.25, 0); sk.box(x, 32, z, 60, 64, 24, ty, dark); }
  // tower crown light
  const crown = new GeoBuilder();
  { const [x, z] = P2(-tf2.len * 0.3, 0); crown.box(x, lm.t21.h + 1, z, 23, 2, 23, ty, col(0x22e6ff)); }
  const skMesh = new THREE.Mesh(sk.build(), mats.skyline);
  const crownMesh = new THREE.Mesh(crown.build(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false }));
  // re-centre so the group can be scaled about its anchor
  const anchor = new THREE.Vector3(tf2.cx, 0, tf2.cz);
  for (const m of [skMesh, crownMesh]) { m.geometry.translate(-anchor.x, 0, -anchor.z); m.geometry.computeBoundingSphere(); skyline.add(m); }
  skyline.position.copy(anchor);
  group.add(skyline);

  return { group, monumentLight, skyline, skylineAnchor: anchor };
}
