// Modelling kit on top of GeoBuilder: local frames, profile extrusion, Thai roofs,
// bai-sema merlon walls, prisms, palms. All flat-shaded, vertex-coloured.
import * as THREE from 'three';
import { GeoBuilder, col, type V3 } from '../builder.js';
import type { Vec2 } from '../../types.js';

export { GeoBuilder, col, type V3 };

// Local frame on the ground: u along `ax`, v = left of u (x-z), y up.
export interface Frame { ox: number; oz: number; ux: number; uz: number }
export const frameAt = (ox: number, oz: number, angle: number): Frame => ({ ox, oz, ux: Math.cos(angle), uz: Math.sin(angle) });
export const P = (f: Frame, u: number, v: number, y: number): V3 => [f.ox + f.ux * u - f.uz * v, y, f.oz + f.uz * u + f.ux * v];
export const dirU = (f: Frame): V3 => [f.ux, 0, f.uz];
export const dirV = (f: Frame): V3 => [-f.uz, 0, f.ux];
export const yawOf = (f: Frame) => Math.atan2(-f.uz, f.ux); // GeoBuilder.box yaw whose local x = u

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Triangle whose front face points along `want`.
export function triN(g: GeoBuilder, a: V3, b: V3, c: V3, color: THREE.Color, want: V3) {
  const n = cross(sub(b, a), sub(c, a));
  if (dot(n, want) >= 0) g.tri(a, b, c, color);
  else g.tri(a, c, b, color);
}

// Oriented box in a frame: centre (u, v, y), size (lu, lv, h) from y to y+h.
export function fbox(g: GeoBuilder, f: Frame, u: number, v: number, y: number, lu: number, lv: number, h: number, c: THREE.Color, top?: THREE.Color) {
  const [x, , z] = P(f, u, v, 0);
  g.box(x, y + h / 2, z, lu, h, lv, yawOf(f), c, top);
}

// Extrude a closed CCW profile drawn in the (u, y) plane between v0 and v1.
export function extrudeUY(g: GeoBuilder, f: Frame, prof: [number, number][], v0: number, v1: number, c: THREE.Color, sides = true) {
  const U = dirU(f), V = dirV(f);
  const tris = THREE.ShapeUtils.triangulateShape(prof.map(([u, y]) => new THREE.Vector2(u, y)), []);
  for (const [i, j, k] of tris) {
    const [a, b, d] = [prof[i], prof[j], prof[k]];
    triN(g, P(f, a[0], v1, a[1]), P(f, b[0], v1, b[1]), P(f, d[0], v1, d[1]), c, V);
    triN(g, P(f, a[0], v0, a[1]), P(f, b[0], v0, b[1]), P(f, d[0], v0, d[1]), c, [-V[0], -V[1], -V[2]]);
  }
  if (!sides) return;
  let area = 0;
  for (let i = 0; i < prof.length; i++) { const p = prof[i], q = prof[(i + 1) % prof.length]; area += p[0] * q[1] - q[0] * p[1]; }
  const s = area >= 0 ? 1 : -1;
  for (let i = 0; i < prof.length; i++) {
    const p = prof[i], q = prof[(i + 1) % prof.length];
    const du = q[0] - p[0], dy = q[1] - p[1];
    const nu = s * dy, ny = -s * du; // outward normal in (u, y)
    g.quadN(P(f, p[0], v0, p[1]), P(f, q[0], v0, q[1]), P(f, q[0], v1, q[1]), P(f, p[0], v1, p[1]), c, [U[0] * nu, ny, U[2] * nu]);
  }
}

// Same but the profile is in the (v, y) plane, extruded along u.
export function extrudeVY(g: GeoBuilder, f: Frame, prof: [number, number][], u0: number, u1: number, c: THREE.Color) {
  const rot: Frame = { ox: f.ox, oz: f.oz, ux: -f.uz, uz: f.ux }; // u' = v, v' = -u
  extrudeUY(g, rot, prof, -u1, -u0, c);
}

// Extruded ring (footprint) from y0 to y1 with optional top cap.
export function prismRing(g: GeoBuilder, ring: Vec2[], y0: number, y1: number, side: THREE.Color, top?: THREE.Color | null, uv?: [number, number]) {
  let area = 0;
  for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; area += p.x * q.z - q.x * p.z; }
  const sgn = area >= 0 ? 1 : -1;
  let acc = 0;
  for (let k = 0; k < ring.length; k++) {
    const p = ring[k], q = ring[(k + 1) % ring.length], ex = q.x - p.x, ez = q.z - p.z, el = Math.hypot(ex, ez) || 1;
    const uvs = uv && ([[acc * uv[0], y0 * uv[1]], [(acc + el) * uv[0], y0 * uv[1]], [(acc + el) * uv[0], y1 * uv[1]], [acc * uv[0], y1 * uv[1]]] as [number, number][]);
    g.quadN([p.x, y0, p.z], [q.x, y0, q.z], [q.x, y1, q.z], [p.x, y1, p.z], side, [(sgn * ez) / el, 0, (-sgn * ex) / el], uvs);
    acc += el;
  }
  if (top === null) return;
  for (const t of THREE.ShapeUtils.triangulateShape(ring.map((p) => new THREE.Vector2(p.x, p.z)), [])) {
    const [a, b, c] = t.map((i) => ring[i]);
    const uvs = uv && ([a, b, c].map((p) => [p.x * uv[0], p.z * uv[0]]) as [number, number][]);
    g.triUp([a.x, y1, a.z], [b.x, y1, b.z], [c.x, y1, c.z], top ?? side, uvs);
  }
}

// n-gon prism (columns, posts, trunks), optional taper.
export function prism(g: GeoBuilder, x: number, z: number, r0: number, r1: number, y0: number, y1: number, n: number, c: THREE.Color, rot = 0, cap = true) {
  for (let k = 0; k < n; k++) {
    const a0 = rot + (k / n) * Math.PI * 2, a1 = rot + ((k + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
    g.quadN([x + Math.cos(a0) * r0, y0, z + Math.sin(a0) * r0], [x + Math.cos(a1) * r0, y0, z + Math.sin(a1) * r0],
      [x + Math.cos(a1) * r1, y1, z + Math.sin(a1) * r1], [x + Math.cos(a0) * r1, y1, z + Math.sin(a0) * r1], c, [Math.cos(am), 0, Math.sin(am)]);
    if (cap && r1 > 0.001) g.triUp([x, y1, z], [x + Math.cos(a0) * r1, y1, z + Math.sin(a0) * r1], [x + Math.cos(a1) * r1, y1, z + Math.sin(a1) * r1], c);
  }
}

// Low dome / globe (lamp globes, stupas): latitude bands.
export function globe(g: GeoBuilder, x: number, y: number, z: number, r: number, c: THREE.Color, n = 6, bands = 3) {
  for (let b = 0; b < bands; b++) {
    const t0 = -Math.PI / 2 + (b / bands) * Math.PI, t1 = -Math.PI / 2 + ((b + 1) / bands) * Math.PI;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      const p = (t: number, a: number): V3 => [x + Math.cos(t) * Math.cos(a) * r, y + Math.sin(t) * r, z + Math.cos(t) * Math.sin(a) * r];
      const tm = (t0 + t1) / 2, am = (a0 + a1) / 2;
      const want: V3 = [Math.cos(tm) * Math.cos(am), Math.sin(tm), Math.cos(tm) * Math.sin(am)];
      if (b === 0) triN(g, p(t0, a0), p(t1, a0), p(t1, a1), c, want);
      else if (b === bands - 1) triN(g, p(t0, a0), p(t0, a1), p(t1, a0), c, want);
      else g.quadN(p(t0, a0), p(t0, a1), p(t1, a1), p(t1, a0), c, want);
    }
  }
}

// Bai sema (ใบเสมา) merlon profile in (u, y), width w, height h — rounded shoulders, soft point.
export function semaProfile(w: number, h: number, u0 = 0, y0 = 0): [number, number][] {
  const hw = w / 2;
  const pts: [number, number][] = [[-hw, 0], [hw, 0], [hw, h * 0.55]];
  for (let k = 1; k <= 4; k++) {
    const a = (k / 5) * Math.PI;
    pts.push([Math.cos(a) * hw * 0.98, h * 0.55 + Math.sin(a) * h * 0.38 + (k === 2 || k === 3 ? h * 0.05 : 0)]);
  }
  pts.push([-hw, h * 0.55]);
  return pts.map(([u, y]) => [u + u0, y + y0]);
}

// Crenellated city wall along a polyline: plastered body (slight batter), cornice, bai-sema merlons on
// both faces. `faces` = which side(s) get merlons (+1 left / −1 right / 0 both).
export function semaWall(g: GeoBuilder, path: Vec2[], h: number, t: number, body: THREE.Color, merlon: THREE.Color, faces: 0 | 1 | -1 = 0, mw = 0.8, gap = 0.55) {
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i], b = path[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.2) continue;
    const f: Frame = { ox: (a.x + b.x) / 2, oz: (a.z + b.z) / 2, ux: (b.x - a.x) / len, uz: (b.z - a.z) / len };
    const L = len + (i + 2 < path.length ? t * 0.5 : 0); // overlap joints
    // battered body: trapezoid section in (v, y)
    extrudeVY(g, f, [[-t / 2 - 0.15, 0], [t / 2 + 0.15, 0], [t / 2, h], [-t / 2, h]], -L / 2, L / 2, body);
    fbox(g, f, 0, 0, h, L, t + 0.18, 0.18, body);
    const n = Math.max(1, Math.floor(len / (mw + gap)));
    const step = len / n;
    for (let k = 0; k < n; k++) {
      const u = -len / 2 + step * (k + 0.5);
      for (const side of faces === 0 ? [1, -1] : [faces]) {
        const v = side * (t / 2 - 0.12);
        extrudeUY(g, f, semaProfile(mw, 1.0, u, h + 0.18), v - 0.12, v + 0.12, merlon);
      }
    }
  }
}

// Thai gable roof with the ridge along u. Eaves at y0 (overhang included in lu/lv), ridge at y1.
// White bargeboards (ปั้นลม) on both gable ends curving up into chofa horns.
export function thaiRoof(g: GeoBuilder, f: Frame, u: number, v: number, lu: number, lv: number, y0: number, y1: number,
  tile: THREE.Color, trim: THREE.Color, opts: { chofa?: boolean; tiers?: number; tympanum?: THREE.Color } = {}) {
  const tiers = opts.tiers ?? 1;
  const hu = lu / 2, hv = lv / 2;
  // main gable: two slopes + two gable triangles
  const r0 = P(f, u - hu, v, y1), r1 = P(f, u + hu, v, y1);
  const e = [P(f, u - hu, v - hv, y0), P(f, u + hu, v - hv, y0), P(f, u + hu, v + hv, y0), P(f, u - hu, v + hv, y0)];
  const V = dirV(f), U = dirU(f);
  const slope = (y1 - y0) / hv;
  g.quadN(e[0], e[1], r1, r0, tile, [-V[0], 1 / slope, -V[2]]);
  g.quadN(e[3], e[2], r1, r0, tile, [V[0], 1 / slope, V[2]]);
  const tym = opts.tympanum ?? trim;
  triN(g, e[0], e[3], r0, tym, [-U[0], 0, -U[2]]);
  triN(g, e[1], e[2], r1, tym, [U[0], 0, U[2]]);
  // lower skirt tiers (หลังคาซ้อนชั้น): wider, lower, shallower
  for (let k = 1; k < tiers; k++) {
    const dy = (y1 - y0) * 0.45 * k, grow = 0.9 * k;
    const yy0 = y0 - dy, yy1 = y0 - dy + (y1 - y0) * 0.35;
    const lv2 = hv + grow, lu2 = hu + grow * 0.6;
    const a = [P(f, u - lu2, v - lv2, yy0), P(f, u + lu2, v - lv2, yy0), P(f, u + lu2, v + lv2, yy0), P(f, u - lu2, v + lv2, yy0)];
    const b = [P(f, u - lu2, v - hv * 0.7, yy1), P(f, u + lu2, v - hv * 0.7, yy1), P(f, u + lu2, v + hv * 0.7, yy1), P(f, u - lu2, v + hv * 0.7, yy1)];
    g.quadN(a[0], a[1], b[1], b[0], tile, [-V[0], 1, -V[2]]);
    g.quadN(a[3], a[2], b[2], b[3], tile, [V[0], 1, V[2]]);
  }
  // bargeboards: thin white strips along both gable rakes, plus chofa horn and hang hong tips
  for (const end of [-1, 1]) {
    const uu = u + end * (hu + 0.05);
    const out: V3 = [U[0] * end, 0, U[2] * end];
    for (const side of [-1, 1]) {
      const pA = P(f, uu, v + side * hv, y0), pB = P(f, uu, v, y1);
      const pA2 = P(f, uu, v + side * hv, y0 + 0.28), pB2 = P(f, uu, v, y1 + 0.28);
      g.quadN(pA, pB, pB2, pA2, trim, out);
      // hang hong (curled tip) at the eave
      const t0 = P(f, uu, v + side * (hv + 0.05), y0 - 0.05), t1 = P(f, uu, v + side * (hv + 0.35), y0 + 0.45), t2 = P(f, uu, v + side * hv, y0 + 0.3);
      triN(g, t0, t1, t2, trim, out);
      triN(g, t0, t2, t1, trim, [-out[0], 0, -out[2]]);
    }
    if (opts.chofa !== false) {
      // chofa: slender upturned horn above the ridge end
      const base = P(f, uu, v, y1 + 0.2), tip = P(f, uu + end * 0.35, v, y1 + 1.25), mid = P(f, uu - end * 0.05, v, y1 + 0.9);
      const w = 0.09;
      const bl: V3 = [base[0] - V[0] * w, base[1], base[2] - V[2] * w], br: V3 = [base[0] + V[0] * w, base[1], base[2] + V[2] * w];
      triN(g, bl, br, mid, trim, out); triN(g, bl, mid, br, trim, [-out[0], 0, -out[2]]);
      triN(g, mid, tip, P(f, uu + end * 0.05, v, y1 + 0.75), trim, V);
      triN(g, mid, P(f, uu + end * 0.05, v, y1 + 0.75), tip, trim, [-V[0], 0, -V[2]]);
    }
  }
  // ridge cap
  fbox(g, f, u, v, y1 - 0.05, lu, 0.22, 0.18, trim);
}

// Sugar palm (ต้นตาล): slim trunk + star of drooping fronds.
export function palm(g: GeoBuilder, x: number, z: number, h: number, seed: number) {
  const trunk = col(0x4a3d30), leaf = col(0x2f5a2a), leaf2 = col(0x3d6e33);
  prism(g, x, z, 0.22, 0.17, 0, h, 5, trunk, seed, false);
  const n = 9;
  for (let k = 0; k < n; k++) {
    const a = seed + (k / n) * Math.PI * 2, l = 2.6 + ((k * 37) % 5) * 0.15;
    const dx = Math.cos(a), dz = Math.sin(a);
    const top: V3 = [x, h + 0.2, z], mid: V3 = [x + dx * l * 0.55, h + 0.75, z + dz * l * 0.55], tip: V3 = [x + dx * l, h - 0.5, z + dz * l];
    const w = 0.55, px = -dz * w, pz = dx * w;
    const c = k % 2 ? leaf : leaf2;
    const m1: V3 = [mid[0] + px, mid[1], mid[2] + pz], m2: V3 = [mid[0] - px, mid[1], mid[2] - pz];
    triN(g, top, m1, m2, c, [0, 1, 0]); triN(g, top, m2, m1, c, [0, -1, 0]);
    triN(g, m1, tip, m2, c, [0, 1, 0]); triN(g, m1, m2, tip, c, [0, -1, 0]);
  }
}

// Round-crowned shade tree (rain tree / จามจุรี) — octahedral crown, very cheap.
export function shadeTree(g: GeoBuilder, x: number, z: number, h: number, r: number, seed: number) {
  prism(g, x, z, 0.3, 0.22, 0, h * 0.55, 5, col(0x3d332a), seed, false);
  const c1 = col(0x24402a), c2 = col(0x2d5232);
  const cy = h * 0.72, ry = r * 0.55;
  const ring: V3[] = [];
  for (let k = 0; k < 6; k++) { const a = seed + (k / 6) * Math.PI * 2; ring.push([x + Math.cos(a) * r, cy, z + Math.sin(a) * r]); }
  const top: V3 = [x, cy + ry, z], bot: V3 = [x, cy - ry * 0.6, z];
  for (let k = 0; k < 6; k++) {
    const a = ring[k], b = ring[(k + 1) % 6], am = seed + ((k + 0.5) / 6) * Math.PI * 2;
    triN(g, a, b, top, k % 2 ? c1 : c2, [Math.cos(am), 0.6, Math.sin(am)]);
    triN(g, a, b, bot, c1, [Math.cos(am), -0.6, Math.sin(am)]);
  }
}

// Point-in-polygon + polygon helpers.
export function pip(x: number, z: number, ring: Vec2[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
export const ringArea = (r: Vec2[]) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p.x * q.z - q.x * p.z; } return a / 2; };
export const centroid = (r: Vec2[]) => ({ x: r.reduce((a, p) => a + p.x, 0) / r.length, z: r.reduce((a, p) => a + p.z, 0) / r.length });

// Long axis frame of a footprint (PCA) + extents.
export function pcaFrame(ring: Vec2[]) {
  const c = centroid(ring);
  let sxx = 0, szz = 0, sxz = 0;
  for (const p of ring) { sxx += (p.x - c.x) ** 2; szz += (p.z - c.z) ** 2; sxz += (p.x - c.x) * (p.z - c.z); }
  const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  const ux = Math.cos(ang), uz = Math.sin(ang);
  let l0 = Infinity, l1 = -Infinity, w0 = Infinity, w1 = -Infinity;
  for (const p of ring) {
    const u = (p.x - c.x) * ux + (p.z - c.z) * uz, v = -(p.x - c.x) * uz + (p.z - c.z) * ux;
    l0 = Math.min(l0, u); l1 = Math.max(l1, u); w0 = Math.min(w0, v); w1 = Math.max(w1, v);
  }
  const f: Frame = { ox: c.x + ux * (l0 + l1) / 2 - uz * (w0 + w1) / 2, oz: c.z + uz * (l0 + l1) / 2 + ux * (w0 + w1) / 2, ux, uz };
  return { f, len: l1 - l0, wid: w1 - w0 };
}

// Rectangle footprint in a frame.
export const rectRing = (f: Frame, lu: number, lv: number): Vec2[] =>
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const p = P(f, (a * lu) / 2, (b * lv) / 2, 0); return { x: p[0], z: p[2] }; });
