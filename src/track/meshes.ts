// Turns decoded track data into merged meshes: per chunk (track split along its length)
// one mesh per material — road surface, facades, neon — plus global water/ground.
import * as THREE from 'three';
import { GeoBuilder, col, type V3 } from './builder.js';
import { WALL_MOAT, WALL_NEON, WALL_PLAZA, type Sample, type TrackData, toRing } from './data.js';
import { WIN_CELL_H, WIN_CELL_W, WIN_CELLS, type TrackMaterials } from './materials.js';
import type { Vec2 } from '../types.js';

export const CHUNKS = 12;

const Y_ROAD = 0.02, Y_WALK = 0.1, Y_MEDIAN = 0.15, Y_MARK = 0.03;
const C = {
  asphalt: col(0x24242c), asphalt2: col(0x1f1f27), walk: col(0x4a4852), median: col(0x26352a),
  kerbRed: col(0xb0303a), kerbWhite: col(0xd9d9d9), white: col(0xd6d6d6), yellow: col(0xe2b52a),
  grass: col(0x1d2a1f), rail: col(0x30323c), balustrade: col(0xbdb9ae), barrierBody: col(0x17171f),
  fenceLow: col(0x7c7a72), fenceHigh: col(0x2d4a3c), bank: col(0x3b3a36),
  neonCyan: col(0x22e6ff), neonPink: col(0xff2fa8), neonDim: col(0x1a5f73), amber: col(0xffb030), cone: col(0xff5a1f),
};
const PALETTE = [0x8a8578, 0x9c8f7a, 0x7d8a8c, 0xa08a8a, 0x8c9a86, 0x948c9e, 0xb0a48c, 0x7a7a80].map((h) => col(h).multiplyScalar(0.85));

function pip(x: number, z: number, ring: Vec2[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
const ringArea = (r: Vec2[]) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p.x * q.z - q.x * p.z; } return a / 2; };

function triangulate(ring: Vec2[]): number[][] {
  const pts = ring.map((p) => new THREE.Vector2(p.x, p.z));
  return THREE.ShapeUtils.triangulateShape(pts, []);
}

export interface BuiltTrack {
  root: THREE.Group;
  chunks: { group: THREE.Group; center: THREE.Vector3; radius: number }[];
  stats: { meshes: number; triangles: number };
}

export function buildTrackMeshes(d: TrackData, mats: TrackMaterials): BuiltTrack {
  const S = d.samples, N = S.length, L = d.lengthM, ds = L / N;
  const raw = d.raw;
  const pads = raw.pads.map((p) => ({ ...p, r: toRing(p.ring) }));
  const inPad = (x: number, z: number) => pads.some((p) => pip(x, z, p.r));
  const junctions = pads.filter((p) => p.kind === 'junction').map((p) => p.r);

  const surf = Array.from({ length: CHUNKS }, () => new GeoBuilder());
  const fac = Array.from({ length: CHUNKS }, () => new GeoBuilder());
  const neon = Array.from({ length: CHUNKS }, () => new GeoBuilder());
  const chunkOfS = (s: number) => Math.min(CHUNKS - 1, Math.max(0, Math.floor((((s % L) + L) % L / L) * CHUNKS)));
  const chunkAt = (x: number, z: number) => {
    let best = Infinity, bi = 0;
    for (let i = 0; i < N; i += 3) { const dd = (S[i].x - x) ** 2 + (S[i].z - z) ** 2; if (dd < best) { best = dd; bi = i; } }
    return chunkOfS(bi * ds);
  };

  // ── road ribbon: bands walkL | road | median | westbound | walkR ──
  const edges = (s: Sample) => { const w = s.w / 2; return [-(w + s.wl), -w, w, w + s.med, w + s.med + s.w2, w + s.med + s.w2 + s.wr]; };
  const at = (s: Sample, off: number, y: number): V3 => [s.x - s.tz * off, y, s.z + s.tx * off];
  const UP: V3 = [0, 1, 0];
  for (let i = 0; i < N; i++) {
    const a = S[i], b = S[(i + 1) % N], ea = edges(a), eb = edges(b);
    const g = surf[chunkOfS(i * ds)];
    const midX = (a.x + b.x) / 2, midZ = (a.z + b.z) / 2;
    const band = (k: number, y: number, c: THREE.Color, skipInPad: boolean) => {
      if (ea[k + 1] - ea[k] < 0.02 && eb[k + 1] - eb[k] < 0.02) return;
      if (skipInPad) {
        const pa = at(a, (ea[k] + ea[k + 1]) / 2, 0), pb = at(b, (eb[k] + eb[k + 1]) / 2, 0);
        if (inPad((pa[0] + pb[0]) / 2, (pa[2] + pb[2]) / 2)) return;
      }
      g.quadN(at(a, ea[k], y), at(a, ea[k + 1], y), at(b, eb[k + 1], y), at(b, eb[k], y), c, UP);
    };
    band(0, Y_WALK, C.walk, true);
    band(1, Y_ROAD, C.asphalt, false);
    band(2, Y_MEDIAN, C.median, true);
    band(3, Y_ROAD, C.asphalt2, false);
    band(4, Y_WALK, C.walk, true);
    // kerb faces (Thai red/white kerbs), facing the asphalt they border
    const kerbC = i % 2 ? C.kerbRed : C.kerbWhite;
    const kerb = (k: number, top: number, faceRight: boolean) => {
      const o = ea[k], p = at(a, o, 0);
      if (inPad(p[0], p[2])) return;
      const want: V3 = faceRight ? [-a.tz, 0, a.tx] : [a.tz, 0, -a.tx];
      g.quadN(at(a, ea[k], Y_ROAD), at(b, eb[k], Y_ROAD), at(b, eb[k], top), at(a, ea[k], top), kerbC, want);
    };
    if (a.wl > 0.05) kerb(1, Y_WALK, true);
    if (a.med > 0.05) { kerb(2, Y_MEDIAN, false); if (a.w2 > 0.05) kerb(3, Y_MEDIAN, true); }
    if (a.wr > 0.05) kerb(a.w2 > 0.05 ? 4 : 2, Y_WALK, false);

    // lane markings (none inside the junction box)
    if (junctions.some((r) => pip(midX, midZ, r))) continue;
    const dash = i % 3 === 0;
    const strip = (o: number, wdt: number, c: THREE.Color) =>
      g.quadN(at(a, o - wdt / 2, Y_MARK), at(a, o + wdt / 2, Y_MARK), at(b, o + wdt / 2, Y_MARK), at(b, o - wdt / 2, Y_MARK), c, UP);
    const w = a.w / 2;
    strip(-w + 0.3, 0.15, C.white);
    strip(w - 0.3, 0.15, C.white);
    const n = Math.max(1, a.lanes);
    for (let k = 1; k < n; k++) {
      const o = -w + (k * a.w) / n;
      if (a.twoWay && k === n / 2) { strip(o - 0.12, 0.1, C.yellow); strip(o + 0.12, 0.1, C.yellow); }
      else if (dash) strip(o, 0.13, C.white);
    }
    if (a.w2 > 3) {
      const o0 = w + a.med;
      strip(o0 + 0.3, 0.15, C.white);
      strip(o0 + a.w2 - 0.3, 0.15, C.white);
      if (dash) for (let k = 1; k < 3; k++) strip(o0 + (k * a.w2) / 3, 0.13, C.white);
    }
  }

  // ── pads: junction asphalt, landing run-out (Phon Saen + grass bank) ──
  for (const p of pads) {
    const tris = triangulate(p.r);
    const c = p.cls === 2 ? C.grass : C.asphalt;
    const y = p.cls === 2 ? Y_ROAD + 0.005 : Y_ROAD - 0.005;
    for (const t of tris) {
      const [A, B, Cc] = t.map((k) => p.r[k]);
      surf[chunkAt(A.x, A.z)].triUp([A.x, y, A.z], [B.x, y, B.z], [Cc.x, y, Cc.z], c);
    }
  }

  // ── walls: rails, moat balustrades, neon junction barriers ──
  const win = raw.water.window; // takeoff line x range
  const winX0 = Math.min(win[0], win[2]) * 0.1, winX1 = Math.max(win[0], win[2]) * 0.1;
  for (const wl of d.walls) {
    const dx = wl.b.x - wl.a.x, dz = wl.b.z - wl.a.z, l = Math.hypot(dx, dz) || 1;
    // left normal of a→b is (dz, −dx); track lies on side*left → outward = −side*left
    const ox = (-wl.side * dz) / l, oz = (wl.side * dx) / l;
    const ch = chunkAt((wl.a.x + wl.b.x) / 2, (wl.a.z + wl.b.z) / 2);
    const g = surf[ch], ng = neon[ch];
    const off = (t: number) => [wl.a.x + ox * t, wl.a.z + oz * t, wl.b.x + ox * t, wl.b.z + oz * t] as const;
    if (wl.kind === WALL_NEON) {
      const t = 0.45, [ax, az, bx, bz] = off(t / 2);
      g.wallBox(ax, az, bx, bz, t, 0, 1.15, C.barrierBody);
      // track-facing chevron blocks
      const segs = Math.max(1, Math.round(l / 0.9));
      const [fx0, fz0, fx1, fz1] = off(-0.01);
      const fn: V3 = [-ox, 0, -oz];
      for (let k = 0; k < segs; k++) {
        const u0 = k / segs, u1 = (k + 0.7) / segs;
        const p0x = fx0 + (fx1 - fx0) * u0, p0z = fz0 + (fz1 - fz0) * u0, p1x = fx0 + (fx1 - fx0) * u1, p1z = fz0 + (fz1 - fz0) * u1;
        ng.quadN([p0x, 0.35, p0z], [p1x, 0.35, p1z], [p1x, 0.85, p1z], [p0x, 0.85, p0z], k % 2 ? C.neonPink : C.neonCyan, fn);
      }
      const [tx0, tz0, tx1, tz1] = off(t / 2);
      ng.wallBox(tx0, tz0, tx1, tz1, t + 0.02, 1.15, 1.22, C.neonPink);
    } else if (wl.kind === WALL_MOAT) {
      const [ax, az, bx, bz] = off(0.08);
      g.wallBox(ax, az, bx, bz, 0.16, 0, 1.0, C.balustrade);
      const mx = (wl.a.x + wl.b.x) / 2;
      const hint = mx >= winX0 && mx <= winX1;
      ng.wallBox(ax, az, bx, bz, 0.2, 1.0, 1.05, hint ? C.amber : C.neonDim);
    } else if (wl.kind === WALL_PLAZA) {
      // Ya Mo plaza edge: low white stone balustrade with warm footlights (respectful, no neon)
      const [ax, az, bx, bz] = off(0.15);
      g.wallBox(ax, az, bx, bz, 0.3, 0, 0.75, C.balustrade, col(0xe0dccf));
      ng.wallBox(ax, az, bx, bz, 0.32, 0.02, 0.07, C.amber);
    } else {
      const [ax, az, bx, bz] = off(0.1);
      g.wallBox(ax, az, bx, bz, 0.18, 0, 0.85, C.rail);
      ng.wallBox(ax, az, bx, bz, 0.2, 0.85, 0.89, C.neonDim);
    }
  }
  // apex cones at the 224 junction (visual only)
  for (let i = 0; i < raw.cones.length; i += 2) {
    const x = raw.cones[i] * 0.1, z = raw.cones[i + 1] * 0.1, g = neon[chunkAt(x, z)];
    const r = 0.28, h = 0.9, top: V3 = [x, h, z];
    for (let k = 0; k < 6; k++) {
      const a0 = (k / 6) * Math.PI * 2, a1 = ((k + 1) / 6) * Math.PI * 2;
      g.tri([x + Math.cos(a0) * r, 0, z + Math.sin(a0) * r], top, [x + Math.cos(a1) * r, 0, z + Math.sin(a1) * r], k % 2 ? C.cone : C.neonPink);
    }
  }

  // ── fences (school walls along set-back frontages) ──
  for (let i = 0; i < raw.fences.length; i += 4) {
    const [ax, az, bx, bz] = raw.fences.slice(i, i + 4).map((v) => v * 0.1);
    const g = fac[chunkAt((ax + bx) / 2, (az + bz) / 2)];
    g.wallBox(ax, az, bx, bz, 0.25, 0, 0.9, C.fenceLow);
    g.wallBox(ax, az, bx, bz, 0.08, 0.9, 1.7, C.fenceHigh);
  }

  // ── buildings: extruded footprints with window atlas UVs, merged per chunk ──
  const uS = 1 / (WIN_CELL_W * WIN_CELLS), vS = 1 / (WIN_CELL_H * WIN_CELLS);
  for (const b of raw.buildings) {
    const h = b[0] * 0.1, colr = PALETTE[Math.abs(b[1]) % PALETTE.length];
    const ring = toRing(b.slice(2));
    if (ring.length < 3) continue;
    const cx = ring.reduce((a, p) => a + p.x, 0) / ring.length, cz = ring.reduce((a, p) => a + p.z, 0) / ring.length;
    const g = fac[chunkAt(cx, cz)];
    const windows = h > 4.5;
    const sgn = ringArea(ring) >= 0 ? 1 : -1; // + → interior on the math-left, outward normal (dz, −dx)
    let u = (b[1] * 7) % 8 * WIN_CELL_W; // stagger the atlas per building
    for (let k = 0; k < ring.length; k++) {
      const p = ring[k], q = ring[(k + 1) % ring.length];
      const ex = q.x - p.x, ez = q.z - p.z, el = Math.hypot(ex, ez);
      if (el < 0.05) continue;
      const want: V3 = [(sgn * ez) / el, 0, (-sgn * ex) / el];
      const uv = windows
        ? ([[u * uS, 0], [(u + el) * uS, 0], [(u + el) * uS, h * vS], [u * uS, h * vS]] as [number, number][])
        : ([[0.001, 0.001], [0.001, 0.001], [0.001, 0.001], [0.001, 0.001]] as [number, number][]);
      g.quadN([p.x, 0, p.z], [q.x, 0, q.z], [q.x, h, q.z], [p.x, h, p.z], colr, want, uv);
      u += el;
    }
    const roof = colr.clone().multiplyScalar(0.55);
    for (const t of triangulate(ring)) {
      const [A, B, Cc] = t.map((k) => ring[k]);
      g.triUp([A.x, h, A.z], [B.x, h, B.z], [Cc.x, h, Cc.z], roof);
    }
  }

  // ── assemble chunks ──
  const root = new THREE.Group();
  root.name = 'track-A';
  const chunks: BuiltTrack['chunks'] = [];
  let meshes = 0, triangles = 0;
  for (let c = 0; c < CHUNKS; c++) {
    const group = new THREE.Group();
    group.name = `chunk-${c}`;
    const box = new THREE.Box3();
    for (const [gb, mat, name] of [[surf[c], mats.surface, 'surface'], [fac[c], mats.facade, 'facade'], [neon[c], mats.neon, 'neon']] as const) {
      if (gb.empty) continue;
      const geo = gb.build();
      const m = new THREE.Mesh(geo, mat);
      m.name = `${name}-${c}`;
      m.matrixAutoUpdate = false;
      group.add(m);
      box.union(geo.boundingBox!);
      meshes++;
      triangles += geo.getAttribute('position').count / 3;
    }
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    chunks.push({ group, center: sphere.center, radius: sphere.radius });
    root.add(group);
  }

  // ── water + bank walls (one mesh) and ground with moat holes ──
  const wg = new GeoBuilder(), bankG = new GeoBuilder();
  const lvl = raw.water.level;
  const rings = raw.water.rings.map(toRing);
  for (const r of rings) {
    for (const t of triangulate(r)) {
      const [A, B, Cc] = t.map((k) => r[k]);
      wg.triUp([A.x, lvl, A.z], [B.x, lvl, B.z], [Cc.x, lvl, Cc.z], col(0xffffff));
    }
    const sgn = ringArea(r) >= 0 ? 1 : -1;
    for (let k = 0; k < r.length; k++) {
      const p = r[k], q = r[(k + 1) % r.length], ex = q.x - p.x, ez = q.z - p.z, el = Math.hypot(ex, ez) || 1;
      const inward: V3 = [(-sgn * ez) / el, 0, (sgn * ex) / el];
      bankG.quadN([p.x, lvl - 0.3, p.z], [q.x, lvl - 0.3, q.z], [q.x, 0, q.z], [p.x, 0, p.z], C.bank, inward);
    }
  }
  const waterMesh = new THREE.Mesh(wg.build(), mats.water);
  waterMesh.name = 'water';
  const bankMesh = new THREE.Mesh(bankG.build(), mats.surface);
  bankMesh.name = 'moat-banks';
  const shape = new THREE.Shape([
    new THREE.Vector2(-1900, 2100), new THREE.Vector2(2400, 2100), new THREE.Vector2(2400, -1900), new THREE.Vector2(-1900, -1900)]);
  for (const r of rings) {
    if (r.some((p) => p.x < -1890 || p.x > 2390 || p.z < -2090 || p.z > 1890)) continue;
    shape.holes.push(new THREE.Path(r.map((p) => new THREE.Vector2(p.x, -p.z))));
  }
  const groundGeo = new THREE.ShapeGeometry(shape);
  groundGeo.rotateX(-Math.PI / 2);
  groundGeo.translate(0, -0.03, 0);
  const ground = new THREE.Mesh(groundGeo, mats.ground);
  ground.name = 'ground';
  for (const m of [waterMesh, bankMesh, ground]) {
    m.matrixAutoUpdate = false;
    root.add(m);
    meshes++;
    const g = m.geometry;
    triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  }
  return { root, chunks, stats: { meshes, triangles } };
}
