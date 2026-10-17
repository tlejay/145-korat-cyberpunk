// Thai shophouse kit (M2): street-facing walls are tiled per bay × floor from the facade atlas
// (ground floor = roller shutters / open shop fronts, upper floors = louvred windows, grilles,
// balcony rails, AC units), plus geometry where depth matters: awnings, balcony slabs, gabled
// Thai roofs, rooftop water tanks / satellite dishes, and the red-gold fascia of gold shops.
import * as THREE from 'three';
import { GeoBuilder, col, type V3 } from './builder.js';
import type { Building } from './data.js';
import { cellUV, COL_GROUND, COL_SIDE, COL_UPPER, goldUV, SOLID, solidUV, ST, UPPER_VARIANTS } from './facade-atlas.js';
import type { Vec2 } from '../types.js';

const GROUND_H = 4.2, FLOOR_H = 3.4, BAY = 3.6;
const AWNING = [0x2f7a4a, 0xa83a32, 0x2f5aa0, 0xc8742a, 0x6a8a3a, 0x8a2a5a].map(col);
const TANK = col(0xb8bcc4), TANK_BLUE = col(0x3a6ab0), STEEL = col(0x55575e), DISH = col(0xd0d0cc), SLAB = col(0xc8c4bc), ROOF_TILE = col(0xa8442a), GOLD = col(0xd8a838);

// deterministic hash → [0,1)
export const h01 = (n: number) => { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };

function triangulate(ring: Vec2[]): number[][] {
  return THREE.ShapeUtils.triangulateShape(ring.map((p) => new THREE.Vector2(p.x, p.z)), []);
}
const ringArea = (r: Vec2[]) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p.x * q.z - q.x * p.z; } return a / 2; };

// Long axis + extents of a footprint (PCA) — used for gabled roofs.
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

export interface BuildingTargets { fac: GeoBuilder; detail: GeoBuilder }

export function buildBuilding(b: Building, bi: number, t: BuildingTargets) {
  const { ring, h, st } = b;
  if (ring.length < 3) return;
  const tint = new THREE.Color(b.tint);
  const floors = Math.max(1, Math.round((h - 0.8) / FLOOR_H));
  const gH = floors > 1 ? GROUND_H : h, uH = floors > 1 ? (h - GROUND_H) / (floors - 1) : 0;
  const sgn = ringArea(ring) >= 0 ? 1 : -1; // outward normal of edge p→q = sgn·(dz, −dx)
  const solid = solidUV(SOLID.matte), sUV: [number, number][] = [[solid.u, solid.v], [solid.u, solid.v], [solid.u, solid.v], [solid.u, solid.v]];
  const shophouseLike = st === ST.SHOP || st === ST.OLD || st === ST.HOUSE || st === ST.MESH;
  const balconies = (st === ST.SHOP || st === ST.HOTEL || st === ST.HOUSE) && h01(bi * 31 + 3) < 0.55;
  const awn = AWNING[Math.floor(h01(bi * 7 + 1) * AWNING.length)];

  for (let k = 0; k < ring.length; k++) {
    const p = ring[k], q = ring[(k + 1) % ring.length];
    const ex = q.x - p.x, ez = q.z - p.z, el = Math.hypot(ex, ez);
    if (el < 0.05) continue;
    const tx = ex / el, tz = ez / el, nx = sgn * tz, nz = -sgn * tx;
    const want: V3 = [nx, 0, nz];
    if (!b.front.has(k)) {
      // side / back wall: short edges get one stretched plain cell; long ones are tiled per floor
      // (plain ground floor, upper floors from the darker upper variants) so backs seen across the
      // moat or down side streets still read as buildings, not boxes
      const c = cellUV(st, COL_SIDE);
      if (el < 6 || floors < 2) {
        t.fac.quadN([p.x, 0, p.z], [q.x, 0, q.z], [q.x, h, q.z], [p.x, h, p.z], tint, want, [[c.u0, c.v0], [c.u1, c.v0], [c.u1, c.v1], [c.u0, c.v1]]);
        continue;
      }
      const sb = Math.max(1, Math.round(el / 4.6)), sw = el / sb;
      t.fac.quadN([p.x, 0, p.z], [q.x, 0, q.z], [q.x, gH, q.z], [p.x, gH, p.z], tint, want, [[c.u0, c.v0], [c.u1, c.v0], [c.u1, c.v1], [c.u0, c.v1]]);
      for (let j = 0; j < sb; j++) {
        const ax = p.x + tx * sw * j, az = p.z + tz * sw * j, bx = ax + tx * sw, bz = az + tz * sw;
        for (let f = 1; f < floors; f++) {
          const y0 = gH + (f - 1) * uH, y1 = y0 + uH;
          const cc = cellUV(st, COL_UPPER + (h01(bi * 733 + k * 31 + j * 7 + f) < 0.7 ? 0 : 1));
          t.fac.quadN([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], tint, want, [[cc.u0, cc.v0], [cc.u1, cc.v0], [cc.u1, cc.v1], [cc.u0, cc.v1]]);
        }
      }
      continue;
    }
    const nb = Math.max(1, Math.round(el / BAY)), bw = el / nb;
    for (let j = 0; j < nb; j++) {
      const ax = p.x + tx * bw * j, az = p.z + tz * bw * j, bx = ax + tx * bw, bz = az + tz * bw;
      for (let f = 0; f < floors; f++) {
        const y0 = f === 0 ? 0 : gH + (f - 1) * uH, y1 = f === 0 ? gH : y0 + uH;
        const hv = h01(bi * 1009 + k * 97 + j * 13 + f);
        const colIdx = f === 0 ? COL_GROUND + (hv < 0.45 ? 0 : 1) : COL_UPPER + Math.floor(hv * UPPER_VARIANTS);
        const c = cellUV(st, colIdx);
        t.fac.quadN([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], tint, want, [[c.u0, c.v0], [c.u1, c.v0], [c.u1, c.v1], [c.u0, c.v1]]);
      }
    }
    // awning over the ground floor (corrugated / canvas, Street View: green, red, blue)
    if (shophouseLike && floors > 1 && el > 3) {
      const d = 1.25, y0 = 3.35, y1 = 2.95, o = 0.02;
      const A: V3 = [p.x + nx * o, y0, p.z + nz * o], B: V3 = [q.x + nx * o, y0, q.z + nz * o];
      const Bo: V3 = [q.x + nx * d, y1, q.z + nz * d], Ao: V3 = [p.x + nx * d, y1, p.z + nz * d];
      t.fac.quadN(A, B, Bo, Ao, awn, [nx * 0.3, 1, nz * 0.3], sUV);
      t.fac.quadN(Ao, Bo, [Bo[0], y1 - 0.28, Bo[2]], [Ao[0], y1 - 0.28, Ao[2]], awn.clone().multiplyScalar(0.8), want, sUV);
      t.fac.quadN([A[0], y0, A[2]], [B[0], y0, B[2]], Bo, Ao, awn.clone().multiplyScalar(0.45), [0, -1, 0], sUV);
    }
    // balcony slabs + railings on upper floors
    if (balconies && floors > 1) {
      for (let f = 1; f < floors; f++) {
        const y = gH + (f - 1) * uH, d = 0.8;
        const a0: V3 = [p.x + nx * d, y, p.z + nz * d], b0: V3 = [q.x + nx * d, y, q.z + nz * d];
        t.detail.quadN([p.x, y, p.z], [q.x, y, q.z], b0, a0, SLAB, [0, 1, 0]);
        t.detail.quadN([p.x, y - 0.15, p.z], [q.x, y - 0.15, q.z], b0, a0, SLAB.clone().multiplyScalar(0.6), [0, -1, 0]);
        t.detail.quadN([a0[0], y - 0.15, a0[2]], [b0[0], y - 0.15, b0[2]], [b0[0], y + 1.0, b0[2]], [a0[0], y + 1.0, a0[2]], STEEL, want);
      }
    }
  }

  // roof: flat slab, or a Thai gabled roof (orange tiles, white gables, gold finials)
  const roofC = tint.clone().multiplyScalar(0.45);
  if (st === ST.THAI) {
    const fr = frame(ring), ov = 0.9, rh = Math.min(6, fr.wid * 0.45);
    const L2 = fr.len / 2 + ov, W2 = fr.wid / 2 + ov;
    const P = (u: number, v: number, y: number): V3 => [fr.cx + fr.ax.x * u + fr.ay.x * v, y, fr.cz + fr.ax.z * u + fr.ay.z * v];
    const e0 = P(-L2, -W2, h), e1 = P(L2, -W2, h), e2 = P(L2, W2, h), e3 = P(-L2, W2, h), r0 = P(-L2 + 0.4, 0, h + rh), r1 = P(L2 - 0.4, 0, h + rh);
    t.fac.quadN(e0, e1, r1, r0, ROOF_TILE, [-fr.ay.x, 1, -fr.ay.z], sUV);
    t.fac.quadN(e2, e3, r0, r1, ROOF_TILE, [fr.ay.x, 1, fr.ay.z], sUV);
    t.fac.tri(e3, e0, r0, tint, [sUV[0], sUV[1], sUV[2]]);
    t.fac.tri(e1, e2, r1, tint, [sUV[0], sUV[1], sUV[2]]);
    t.fac.tri(e0, e3, r0, tint, [sUV[0], sUV[1], sUV[2]]);
    t.fac.tri(e2, e1, r1, tint, [sUV[0], sUV[1], sUV[2]]);
    for (const r of [r0, r1]) t.detail.box(r[0], r[1] + 0.6, r[2], 0.12, 1.2, 0.12, 0, GOLD); // chofa finials
  } else {
    for (const tr of triangulate(ring)) {
      const [A, B, Cc] = tr.map((i) => ring[i]);
      t.fac.triUp([A.x, h, A.z], [B.x, h, B.z], [Cc.x, h, Cc.z], roofC, [sUV[0], sUV[1], sUV[2]]);
    }
    // rooftop clutter: stainless / blue water tanks on stands, satellite dishes
    const fr = frame(ring);
    const nTanks = fr.len * fr.wid < 30 ? 0 : 1 + Math.floor(h01(bi * 5 + 2) * (st === ST.SHOP ? 3 : 2));
    for (let k = 0; k < nTanks; k++) {
      const u = (h01(bi * 13 + k) - 0.5) * fr.len * 0.6, v = (h01(bi * 17 + k) - 0.5) * fr.wid * 0.5;
      const x = fr.cx + fr.ax.x * u + fr.ay.x * v, z = fr.cz + fr.ax.z * u + fr.ay.z * v;
      t.detail.box(x, h + 0.4, z, 1.1, 0.8, 1.1, 0, STEEL);
      t.detail.prism(x, z, h + 0.8, h + 2.1, 0.6, 0.6, 7, h01(bi + k * 3) < 0.6 ? TANK : TANK_BLUE, true);
    }
    if (h01(bi * 23 + 9) < 0.5 && fr.len * fr.wid > 20) {
      const x = fr.cx + fr.ax.x * fr.len * 0.25, z = fr.cz + fr.ax.z * fr.len * 0.25;
      t.detail.prism(x, z, h, h + 1.0, 0.05, 0.05, 4, STEEL);
      t.detail.blob(x, h + 1.2, z, 0.5, 0.12, 0.5, DISH, h01(bi) * 6);
    }
  }
}

// Gold shop fascia (anchor list `gold`): red board across the frontage + gold Thai lettering
// from the atlas strip. Glows through the emissive atlas (red swatch / letter tile).
export function buildGoldSign(g: GeoBuilder, a: { x: number; y: number; z: number; ang: number; w: number; h: number }, k: number) {
  const fx = Math.sin(a.ang), fz = Math.cos(a.ang), rx = Math.cos(a.ang), rz = -Math.sin(a.ang);
  const red = solidUV(SOLID.red), rUV: [number, number][] = [[red.u, red.v], [red.u, red.v], [red.u, red.v], [red.u, red.v]];
  const white = col(0xffffff), board = col(0xb0161a);
  const hw = a.w / 2, y0 = a.y - a.h / 2, y1 = a.y + a.h / 2;
  const P = (u: number, y: number, o: number): V3 => [a.x + rx * u + fx * o, y, a.z + rz * u + fz * o];
  // board (thin box front + top)
  g.quadN(P(-hw, y0, 0.1), P(hw, y0, 0.1), P(hw, y1, 0.1), P(-hw, y1, 0.1), board, [fx, 0, fz], rUV);
  g.quadN(P(-hw, y1, 0), P(hw, y1, 0), P(hw, y1, 0.1), P(-hw, y1, 0.1), board, [0, 1, 0], rUV);
  // lettering tile (4:1), centred
  const tw = Math.min(a.w - 0.2, (a.h - 0.1) * 4), th = tw / 4, c = goldUV(k);
  g.quadN(P(-tw / 2, a.y - th / 2, 0.12), P(tw / 2, a.y - th / 2, 0.12), P(tw / 2, a.y + th / 2, 0.12), P(-tw / 2, a.y + th / 2, 0.12), white, [fx, 0, fz],
    [[c.u0, c.v0], [c.u1, c.v0], [c.u1, c.v1], [c.u0, c.v1]]);
}
