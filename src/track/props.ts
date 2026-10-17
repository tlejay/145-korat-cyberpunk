// Street furniture (M2) from track-A.json `streetscape`: street lamps, concrete utility poles
// (crossarms, transformers, cable coils), traffic signals, street-name plates, trees, footbridges
// over the 224, side-street stubs with parked cars, crosswalks. Merged into the per-chunk
// builders (no extra draw calls) except three global meshes: static cables, light pools, plates.
import * as THREE from 'three';
import { GeoBuilder, col, type V3 } from './builder.js';
import type { RawStreetscape, Sample } from './data.js';
import { signUV } from './facade-atlas.js';
import { h01 } from './buildings.js';
import type { Vec2 } from '../types.js';

const M = 0.1;
export interface ChunkTargets { surf: GeoBuilder; neon: GeoBuilder; detail: GeoBuilder }

const C = {
  concrete: col(0x8c8a84), metal: col(0x5c6068), dark: col(0x26262c), iron: col(0x1c1c22), transformer: col(0x7a7e86),
  lampWarm: col(0xffe4b8), lampCast: col(0xfff0c8), sigGreen: col(0x30ff7a), sigRed: col(0x3a0806), sigAmber: col(0x3a2606),
  trunk: col(0x4a3828), palmTrunk: col(0x7a6a52), leaf: col(0x1f4a28), leaf2: col(0x2a5a2c), palmLeaf: col(0x2c5a30), hedge: col(0x2a4a2a),
  orange: col(0xd0682a), roofWhite: col(0xd8d8d8), asphalt: col(0x26262e), walk: col(0x46444e), white: col(0xd6d6d6), yellow: col(0xe2b52a),
  glassCar: col(0x1a2230), wheel: col(0x111114), signPost: col(0x9aa0a8),
};
const CAR_PAINT = [0xe8e8e8, 0xb8bcc2, 0x18181c, 0xa8262a, 0x6a6e76, 0x2a4a8a, 0xd8d0c0, 0x3a5a3a].map(col);

// local frame of an object that faces `ang` (three.js rotation.y): fwd = (sin, cos), right = (cos, −sin)
const frameAt = (x: number, z: number, ang: number) => {
  const fx = Math.sin(ang), fz = Math.cos(ang), rx = Math.cos(ang), rz = -Math.sin(ang);
  return (u: number, y: number, v: number): V3 => [x + rx * u + fx * v, y, z + rz * u + fz * v];
};

export function buildProps(
  ss: RawStreetscape, samples: Sample[], lengthM: number,
  target: (x: number, z: number) => ChunkTargets, inPad: (x: number, z: number) => boolean,
  claimed: (x: number, z: number) => boolean = () => false,
) {
  const pools = new GeoBuilder(); // additive light spill
  const plates = new GeoBuilder();
  const pool = (x: number, z: number, r: number, c: THREE.Color) =>
    pools.quad([x - r, 0.06, z - r], [x - r, 0.06, z + r], [x + r, 0.06, z + r], [x + r, 0.06, z - r], c, [[0, 0], [0, 1], [1, 1], [1, 0]], [0, 1, 0]);

  // ── lamps ──
  for (let i = 0; i + 3 < ss.lamps.length; i += 4) {
    const x = ss.lamps[i] * M, z = ss.lamps[i + 1] * M, ang = ss.lamps[i + 2] / 1000, type = ss.lamps[i + 3];
    const { surf, neon } = target(x, z), P = frameAt(x, z, ang);
    if (type === 3) { // cast-iron ornamental lamp on the Manat causeway
      surf.prism(x, z, 0, 0.5, 0.22, 0.16, 6, C.iron);
      surf.prism(x, z, 0.5, 3.6, 0.09, 0.06, 6, C.iron);
      surf.box(x, 3.65, z, 0.9, 0.06, 0.06, ang, C.iron);
      for (const u of [-0.45, 0.45]) { const p = P(u, 0, 0); neon.blob(p[0], 3.45, p[2], 0.2, 0.24, 0.2, C.lampCast); }
      neon.blob(x, 4.0, z, 0.22, 0.26, 0.22, C.lampCast);
      pool(x, z, 4.5, col(0x3a3020));
      continue;
    }
    surf.prism(x, z, 0, 8.6, 0.13, 0.08, 6, C.metal);
    const arms = type === 2 ? [1, -1] : [1];
    for (const d of arms) {
      const tip = P(0, 8.5, 2.3 * d), mid = P(0, 8.6, 1.1 * d);
      surf.box((mid[0] + x) / 2, 8.55, (mid[2] + z) / 2, 0.08, 0.08, 1.15, ang, C.metal);
      surf.box((mid[0] + tip[0]) / 2, 8.5, (mid[2] + tip[2]) / 2, 0.08, 0.08, 1.2, ang, C.metal);
      surf.box(tip[0], 8.42, tip[2], 0.32, 0.12, 0.7, ang, C.dark);
      neon.box(tip[0], 8.34, tip[2], 0.26, 0.04, 0.6, ang, C.lampWarm);
      const g = P(0, 0, 3.4 * d);
      pool(g[0], g[2], 7.5, col(0x4a3c28));
    }
  }

  // ── utility poles (concrete, crossarms, transformers, coils) ──
  for (let i = 0; i + 3 < ss.poles.length; i += 4) {
    const x = ss.poles[i] * M, z = ss.poles[i + 1] * M, ang = ss.poles[i + 2] / 1000, flags = ss.poles[i + 3];
    const { surf, detail } = target(x, z), P = frameAt(x, z, ang);
    surf.prism(x, z, 0, 9.2, 0.17, 0.1, 4, C.concrete);
    // crossarms run across the road direction (local z = away from the road)
    surf.box(x, 8.2, z, 0.1, 0.1, 1.8, ang, C.metal);
    surf.box(x, 6.9, z, 0.08, 0.08, 0.9, ang, C.metal);
    for (const v of [-0.7, -0.25, 0.25, 0.7]) { const p = P(0, 0, v); surf.prism(p[0], p[2], 8.25, 8.45, 0.04, 0.03, 4, C.white); }
    if (flags & 1) { // pole-mounted transformer pair on a platform
      surf.box(x, 5.4, z, 1.6, 0.08, 0.7, ang, C.metal);
      for (const u of [-0.45, 0.45]) { const p = P(u, 0, 0.35); detail.prism(p[0], p[2], 5.45, 6.45, 0.28, 0.28, 6, C.transformer, true); }
    }
    if (flags & 2) { // tangled cable coil (A-27 "สายไฟพันเป็นขด")
      const p = P(0, 0, -0.35);
      detail.blob(p[0], 6.2, p[2], 0.55, 0.35, 0.55, C.iron, h01(i) * 6);
      detail.blob(p[0], 5.6, p[2], 0.4, 0.3, 0.4, C.dark, h01(i + 1) * 6);
    }
  }

  // ── traffic signals (mast arm over the road / far-side post); racing = green ──
  for (let i = 0; i + 4 < ss.signals.length; i += 5) {
    const x = ss.signals[i] * M, z = ss.signals[i + 1] * M, ang = ss.signals[i + 2] / 1000, arm = ss.signals[i + 3] * M, kind = ss.signals[i + 4];
    const { surf, neon } = target(x, z), P = frameAt(x, z, ang);
    const H = kind === 1 ? 6.2 : 3.6;
    surf.prism(x, z, 0, H, 0.14, 0.11, 6, C.metal);
    const head = (p: V3, y: number) => {
      surf.box(p[0], y, p[2], 0.42, 1.25, 0.32, ang, C.dark);
      const f = frameAt(p[0], p[2], ang);
      const lamp = (yy: number, c: THREE.Color) => { const q = f(0, 0, 0.17); neon.box(q[0], yy, q[2], 0.26, 0.26, 0.02, ang, c); };
      lamp(y + 0.38, C.sigRed); lamp(y, C.sigAmber); lamp(y - 0.38, C.sigGreen);
    };
    if (kind === 1) {
      // arm reaches over the lanes (local +x = the driver's right = the road, for a left-side pole facing traffic)
      const tip = P(arm, 0, 0);
      surf.box((x + tip[0]) / 2, H - 0.25, (z + tip[2]) / 2, arm, 0.14, 0.14, ang, C.metal);
      head(P(arm - 0.4, 0, 0), H - 1.0);
      head(P(arm * 0.55, 0, 0), H - 1.0);
      head(P(0, 0, 0.2), 3.0);
    } else head(P(0, 0, 0.2), H - 0.65);
  }

  // ── street-name plates (global textured mesh, readable from both sides) ──
  for (let i = 0; i + 3 < ss.signs.length; i += 4) {
    const x = ss.signs[i] * M, z = ss.signs[i + 1] * M, ang = ss.signs[i + 2] / 1000, slot = ss.signs[i + 3];
    const { surf } = target(x, z), P = frameAt(x, z, ang);
    surf.prism(x, z, 0, 2.95, 0.05, 0.05, 6, C.signPost);
    const uv = signUV(slot), w = 1.45, h = w / 8, y = 2.65, white = col(0xffffff);
    const a = P(-w / 2, y - h / 2, 0.06), b = P(w / 2, y - h / 2, 0.06), c = P(w / 2, y + h / 2, 0.06), d = P(-w / 2, y + h / 2, 0.06);
    plates.quadN(a, b, c, d, white, [Math.sin(ang), 0, Math.cos(ang)], [[uv.u0, uv.v0], [uv.u1, uv.v0], [uv.u1, uv.v1], [uv.u0, uv.v1]]);
    const a2 = P(w / 2, y - h / 2, 0.04), b2 = P(-w / 2, y - h / 2, 0.04), c2 = P(-w / 2, y + h / 2, 0.04), d2 = P(w / 2, y + h / 2, 0.04);
    plates.quadN(a2, b2, c2, d2, white, [-Math.sin(ang), 0, -Math.cos(ang)], [[uv.u0, uv.v0], [uv.u1, uv.v0], [uv.u1, uv.v1], [uv.u0, uv.v1]]);
  }

  // ── trees ──
  for (let i = 0; i + 3 < ss.trees.length; i += 4) {
    const x = ss.trees[i] * M, z = ss.trees[i + 1] * M, type = ss.trees[i + 2], s = ss.trees[i + 3] / 100;
    if (claimed(x, z)) continue;
    const { surf } = target(x, z), r = h01(i * 3 + 1);
    if (type === 0) { // rain tree / jamjuree: short trunk, wide flat canopy
      surf.prism(x, z, 0, 3.6 * s, 0.28 * s, 0.2 * s, 5, C.trunk);
      surf.blob(x, 5.0 * s, z, 3.4 * s, 2.0 * s, 3.2 * s, r < 0.5 ? C.leaf : C.leaf2, r * 6);
      surf.blob(x + 1.3 * s, 6.0 * s, z - 0.9 * s, 2.3 * s, 1.7 * s, 2.3 * s, C.leaf2, r * 3);
      surf.blob(x - 1.2 * s, 5.8 * s, z + 1.0 * s, 2.0 * s, 1.5 * s, 2.0 * s, C.leaf, r * 2);
    } else if (type === 1) { // sugar palm (ต้นตาล): tall bare trunk + star of fronds
      const H = 9 * s;
      surf.prism(x, z, 0, H, 0.24, 0.18, 5, C.palmTrunk);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + r * 3, L = 2.6 * s, dx = Math.cos(a), dz = Math.sin(a);
        const tip: V3 = [x + dx * L, H - 0.9, z + dz * L], sx = -dz * 0.7, sz = dx * 0.7;
        surf.tri([x, H + 0.3, z], [x + dx * L * 0.5 + sx, H + 0.2, z + dz * L * 0.5 + sz], tip, C.palmLeaf);
        surf.tri([x, H + 0.3, z], tip, [x + dx * L * 0.5 - sx, H + 0.2, z + dz * L * 0.5 - sz], C.palmLeaf);
        surf.tri([x, H + 0.3, z], tip, [x + dx * L * 0.5 + sx, H + 0.2, z + dz * L * 0.5 + sz], C.palmLeaf);
        surf.tri([x, H + 0.3, z], [x + dx * L * 0.5 - sx, H + 0.2, z + dz * L * 0.5 - sz], tip, C.palmLeaf);
      }
    } else { // trimmed hedge on the 224 median (low, the car rolls over the kerb strip)
      surf.blob(x, 0.32, z, 0.9 * s, 0.22, 0.9 * s, C.hedge, r * 6);
    }
  }

  // ── footbridges over the 224 (deck clears the road by 5.5 m) ──
  for (let i = 0; i + 4 < ss.bridges.length; i += 5) {
    const ax = ss.bridges[i] * M, az = ss.bridges[i + 1] * M, bx = ss.bridges[i + 2] * M, bz = ss.bridges[i + 3] * M, roof = ss.bridges[i + 4];
    const { surf } = target((ax + bx) / 2, (az + bz) / 2);
    const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    const yaw = Math.atan2(-uz, ux); // box local +x along a→b
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, steel = roof ? C.roofWhite : C.orange;
    surf.box(mx, 5.8, mz, len, 0.45, 2.2, yaw, steel);
    for (const o of [-1.05, 1.05]) surf.box(mx - uz * o, 6.55, mz + ux * o, len, 1.1, 0.06, yaw, C.metal);
    for (const [px, pz] of [[ax, az], [bx, bz]]) { surf.box(px, 2.9, pz, 0.5, 5.8, 0.5, yaw, C.orange); }
    // stair down on the school side, outside the course
    const sx = ax - ux * 4.5, sz = az - uz * 4.5;
    for (let k = 0; k < 6; k++) surf.box(sx + uz * (k * 1.6 - 4), 5.6 - k * 0.95, sz - ux * (k * 1.6 - 4), 1.6, 0.25, 1.4, yaw + Math.PI / 2, C.orange);
    if (roof) surf.box(mx, 7.6, mz, len, 0.12, 2.8, yaw, C.roofWhite);
  }

  // ── side-street stubs (asphalt + walks + centre line) ──
  for (const st of ss.stubs) {
    const w = st.w * M, pts: Vec2[] = [];
    for (let k = 0; k + 1 < st.pts.length; k += 2) pts.push({ x: st.pts[k] * M, z: st.pts[k + 1] * M });
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k], b = pts[k + 1], l = Math.hypot(b.x - a.x, b.z - a.z) || 1, nx = -(b.z - a.z) / l, nz = (b.x - a.x) / l;
      const { surf } = target((a.x + b.x) / 2, (a.z + b.z) / 2);
      const strip = (o0: number, o1: number, y: number, c: THREE.Color) =>
        surf.quadN([a.x + nx * o0, y, a.z + nz * o0], [a.x + nx * o1, y, a.z + nz * o1], [b.x + nx * o1, y, b.z + nz * o1], [b.x + nx * o0, y, b.z + nz * o0], c, [0, 1, 0]);
      strip(-w / 2, w / 2, 0.012, C.asphalt);
      strip(w / 2, w / 2 + 1.6, 0.09, C.walk);
      strip(-w / 2 - 1.6, -w / 2, 0.09, C.walk);
      if (k % 2 === 0) strip(-0.07, 0.07, 0.02, C.white);
    }
  }

  // ── parked cars (sedans / Thai pickups) along the closed side streets ──
  for (let i = 0; i + 4 < ss.parked.length; i += 5) {
    const x = ss.parked[i] * M, z = ss.parked[i + 1] * M, ang = ss.parked[i + 2] / 1000, paint = CAR_PAINT[ss.parked[i + 3] % CAR_PAINT.length], pickup = ss.parked[i + 4] === 1;
    if (claimed(x, z)) continue;
    const { detail } = target(x, z), P = frameAt(x, z, ang), yaw = ang + Math.PI / 2; // box local x = car length
    detail.box(x, 0.62, z, 4.3, 0.62, 1.72, yaw, paint);
    if (pickup) {
      const c = P(0, 0, 0.75);
      detail.box(c[0], 1.22, c[2], 1.6, 0.6, 1.6, yaw, C.glassCar, paint);
    } else {
      detail.box(x, 1.18, z, 2.2, 0.55, 1.5, yaw, C.glassCar, paint);
    }
    for (const v of [-1.35, 1.35]) { const p = P(0, 0, v); detail.box(p[0], 0.32, p[2], 0.62, 0.62, 1.78, yaw, C.wheel); }
  }

  // ── crosswalks (zebra across the carriageway) + stop lines on the approach ──
  const N = samples.length, ds = lengthM / N;
  for (let i = 0; i + 1 < ss.xwalks.length; i += 2) {
    const s0 = ss.xwalks[i] * M, stop = ss.xwalks[i + 1] === 1;
    const k = ((Math.round(s0 / ds) % N) + N) % N, sm = samples[k];
    if (inPad(sm.x, sm.z)) continue;
    const { surf } = target(sm.x, sm.z);
    const rx = -sm.tz, rz = sm.tx, w = sm.w / 2 - 0.4;
    const at = (o: number, f: number, y: number): V3 => [sm.x + rx * o + sm.tx * f, y, sm.z + rz * o + sm.tz * f];
    for (let o = -w; o + 0.5 <= w; o += 1.0) surf.quadN(at(o, 0, 0.035), at(o + 0.5, 0, 0.035), at(o + 0.5, 3.6, 0.035), at(o, 3.6, 0.035), C.white, [0, 1, 0]);
    if (stop) surf.quadN(at(-w, 4.8, 0.035), at(w, 4.8, 0.035), at(w, 5.2, 0.035), at(-w, 5.2, 0.035), C.white, [0, 1, 0]);
  }

  return { pools, plates };
}

// Static catenary cables (one LineSegments for the whole track). M3 swaps this for
// physics-cables' CableSystem using the same spans (TrackExtras.cableSpans).
export function cableSpans(ss: RawStreetscape) {
  const out: { ax: number; ay: number; az: number; bx: number; by: number; bz: number; sag: number }[] = [];
  const c = ss.cables;
  for (let i = 0; i + 6 < c.length; i += 7) out.push({ ax: c[i] * M, ay: c[i + 1] * M, az: c[i + 2] * M, bx: c[i + 3] * M, by: c[i + 4] * M, bz: c[i + 5] * M, sag: c[i + 6] / 100 });
  return out;
}
export function buildCables(spans: ReturnType<typeof cableSpans>, material: THREE.Material) {
  const pos: number[] = [], n = 10;
  for (const sp of spans) {
    let px = sp.ax, py = sp.ay, pz = sp.az;
    for (let k = 1; k <= n; k++) {
      const u = k / n, x = sp.ax + (sp.bx - sp.ax) * u, z = sp.az + (sp.bz - sp.az) * u, y = sp.ay + (sp.by - sp.ay) * u - 4 * sp.sag * u * (1 - u);
      pos.push(px, py, pz, x, y, z);
      px = x; py = y; pz = z;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeBoundingSphere();
  const m = new THREE.LineSegments(g, material);
  m.name = 'cables';
  return m;
}
