#!/usr/bin/env node
// Build public/data/track-A.json (+ track-A.debug.json for ?qa=1&view=top) from
// OpenStreetMap (research/osm) + Street View notes (research/streetview) + landmarks.
// Re-runnable: `node scripts/build-track.mjs`. All coordinates in game space:
// metres, origin = Thao Suranari monument, x = east, z = -north (three.js, y up).
//
// What it fixes vs. the raw OSM route (research/streetview/REPORT-track-A.md §4):
//  - the "148° hairpin" at the head of Ratchadamnoen does not exist: the route goes
//    straight into the Hwy 224 intersection and turns right ~95° (no wrong-way run).
//  - Hwy 224 is a dual carriageway along the north moat; both carriageways are part
//    of the closed course so the moat shortcut at Manat Rd can be reached.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { buildStreetscape, SIGN_NAMES, SIGN_GREEN } from './streetscape.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const LON0 = 102.098117, LAT0 = 14.974731;
const KX = 107550, KY = 110574;
const P = ([lon, lat]) => [(lon - LON0) * KX, -(lat - LAT0) * KY]; // -> [x, z]

const CFG = {
  step: 2.5,              // centerline sample spacing (m)
  res: 0.5,               // surface grid cell (m)
  filletR: 11,            // default corner radius at city intersections (m)
  hairpinR: 15,           // radius of the 95° right turn at the head of Ratchadamnoen (m)
  walk: 2.5,              // default sidewalk width (m)
  checkpoints: 33,        // PHYSICS.md §7: ~3,311 m → ~33 checkpoints (≈100 m apart)
  zoneBufferM: 15,        // GAMEPLAY §2.5
  finishBeforeZoneM: 70,  // start/finish this far south of the plaza zone (grid at +10 m → launch ends ~50 m before it)
  westboundW: 10.5,       // Hwy 224 westbound carriageway, 3 lanes (Street View A-03..A-11)
  bank: 1.5,              // footpath between the westbound kerb and the moat edge
  moatWindowX: [480, 520],// north moat (way/544097464) rail section the jump line crosses (PHYSICS §2.2)
  landingPadX: [470, 528],// Phon Saen Rd + south bank grass west of Manat (jump run-out, PHYSICS §2.2)
  railH: 1.0,             // moat rails + west Phon Saen barrier can be cleared by a jump (PHYSICS §1.6)
  waterY: -1.2,           // water surface below road level (m)
  chunks: 12,
  buildingRadius: 95,     // keep OSM buildings within this distance of the centerline
};

// ───────────────────────── geometry helpers ─────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
// heading: 0 = north (−z), clockwise +  ->  forward = (sin h, −cos h), right = (cos h, sin h)
const headingOf = (t) => Math.atan2(t[0], -t[1]);
const rightOf = (t) => [-t[1], t[0]];

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function segIntersect(p, p2, q, q2) {
  const r = sub(p2, p), s = sub(q2, q), d = cross(r, s);
  if (Math.abs(d) < 1e-9) return null;
  const t = cross(sub(q, p), s) / d, u = cross(sub(q, p), r) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { t, u, p: add(p, mul(r, t)) } : null;
}
function rayRingHit(o, dir, ring, maxD) {
  let best = Infinity;
  const far = add(o, mul(dir, maxD));
  for (let i = 0; i < ring.length; i++) {
    const h = segIntersect(o, far, ring[i], ring[(i + 1) % ring.length]);
    if (h && h.t * maxD < best) best = h.t * maxD;
  }
  return best;
}
function distPointSeg(p, a, b) {
  const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  return dist(p, add(a, mul(ab, t)));
}
function convexHull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(sub(lower.at(-1), lower.at(-2)), sub(q, lower.at(-2))) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(sub(upper.at(-1), upper.at(-2)), sub(q, upper.at(-2))) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
function bufferHull(ring, r) {
  const pts = [];
  for (const v of ring) for (let k = 0; k < 16; k++) pts.push([v[0] + r * Math.cos((k / 16) * 2 * Math.PI), v[1] + r * Math.sin((k / 16) * 2 * Math.PI)]);
  return convexHull(pts);
}
function signedArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) a += cross(ring[i], ring[(i + 1) % ring.length]);
  return a / 2;
}
function dp(pts, tol) { // Douglas–Peucker for open polylines
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let md = 0, mi = -1;
    for (let k = i + 1; k < j; k++) { const d = distPointSeg(pts[k], pts[i], pts[j]); if (d > md) { md = d; mi = k; } }
    if (md > tol) { keep[mi] = 1; stack.push([i, mi], [mi, j]); }
  }
  return pts.filter((_, k) => keep[k]);
}
const closeRing = (r) => (dist(r[0], r.at(-1)) < 1e-6 ? r.slice(0, -1) : r);
const hash = (n) => { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };

// ───────────────────────── inputs ─────────────────────────
const trackGeo = rd('research/osm/track-A.geojson');
const roads = rd('research/osm/roads.geojson').features;
const water = rd('research/osm/water.geojson').features;
const buildingsGeo = rd('research/osm/buildings.geojson').features;
const segsAll = rd('research/streetview/segments.json').segments;
const landmarks = rd('research/landmarks/landmarks.json').landmarks;
const footprints = rd('research/landmarks/footprints.geojson').features;

const osmLine = trackGeo.features.find((f) => f.geometry.type === 'LineString').geometry.coordinates.map(P);
const lmById = Object.fromEntries(landmarks.map((l) => [l.id, l]));
const fpById = {};
for (const f of footprints) (fpById[f.properties.landmark_id] ??= []).push(f);
const fpRing = (id) => closeRing(fpById[id][0].geometry.coordinates[0].map(P));

const moats = water
  .filter((f) => f.properties.water === 'moat' && f.geometry.type === 'Polygon')
  .map((f) => ({ id: f.properties.osm_id, ring: closeRing(f.geometry.coordinates[0].map(P)) }));
const otherWater = water
  .filter((f) => f.properties.natural === 'water' && f.properties.water !== 'moat' && f.geometry.type === 'Polygon')
  .map((f) => ({ id: f.properties.osm_id, ring: closeRing(f.geometry.coordinates[0].map(P)) }));

const CAR_ROADS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link', 'living_street']);
const ROAD_W = { motorway: 14, trunk: 12, primary: 11, secondary: 10, tertiary: 9, unclassified: 8, residential: 6, living_street: 5 };
const carRoads = roads
  .filter((f) => f.geometry.type === 'LineString' && CAR_ROADS.has(f.properties.highway))
  .map((f) => ({
    id: f.properties.osm_id, name: f.properties.name ?? '', hw: f.properties.highway, oneway: f.properties.oneway === 'yes',
    w: (f.properties.lanes ? +f.properties.lanes * 3.2 : 0) || ROAD_W[f.properties.highway.replace('_link', '')] || 7,
    pts: f.geometry.coordinates.map(P),
  }));

// ───────────────────────── 1. corrected route ─────────────────────────
// OSM indices: 0..14 Ratchadamnoen northbound up to the 224 junction mouth,
// 15..25 = wrong-way left turn + secondary_link, 26.. = 224 eastbound onwards.
const JUNCTION_IN = 14, JUNCTION_OUT = 26;
function lineX(a1, a2, b1, b2) { // infinite line intersection
  const r = sub(a2, a1), s = sub(b2, b1), d = cross(r, s);
  const t = cross(sub(b1, a1), s) / d;
  return add(a1, mul(r, t));
}
const cornerC = lineX(osmLine[12], osmLine[JUNCTION_IN], osmLine[JUNCTION_OUT], osmLine[JUNCTION_OUT + 1]);
let route = [...osmLine.slice(0, JUNCTION_IN + 1), cornerC, ...osmLine.slice(JUNCTION_OUT)];
route = route.filter((p, i) => i === 0 || dist(p, route[i - 1]) > 0.5);
if (dist(route[0], route.at(-1)) < 0.5) route.pop(); // closed loop, no duplicate

// Fillet corners > 12° with circular arcs (radius limited by neighbouring segment lengths).
function fillet(pts) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    const u = norm(sub(b, a)), v = norm(sub(c, b));
    const theta = Math.acos(Math.max(-1, Math.min(1, dot(u, v))));
    if (theta < (12 * Math.PI) / 180) { out.push(b); continue; }
    let r = dist(b, cornerC) < 1 ? CFG.hairpinR : CFG.filletR;
    let t = r * Math.tan(theta / 2);
    const tMax = Math.min(dist(a, b), dist(b, c)) * 0.48;
    if (t > tMax) { t = tMax; r = t / Math.tan(theta / 2); }
    const p0 = sub(b, mul(u, t)), p1 = add(b, mul(v, t));
    const turn = Math.sign(cross(u, v));
    const center = add(p0, mul(turn > 0 ? [-u[1], u[0]] : [u[1], -u[0]], r));
    const a0 = Math.atan2(p0[1] - center[1], p0[0] - center[0]);
    const k = Math.max(2, Math.ceil((theta * r) / 1.5));
    for (let j = 0; j <= k; j++) {
      const ang = a0 + turn * theta * (j / k);
      out.push([center[0] + r * Math.cos(ang), center[1] + r * Math.sin(ang)]);
    }
  }
  return out;
}
route = fillet(route);

function resampleLoop(pts, step) {
  const n = pts.length, cum = [0];
  for (let i = 0; i < n; i++) cum.push(cum[i] + dist(pts[i], pts[(i + 1) % n]));
  const L = cum[n], m = Math.round(L / step), out = [];
  let seg = 0;
  for (let k = 0; k < m; k++) {
    const s = (k * L) / m;
    while (cum[seg + 1] < s) seg++;
    const t = (s - cum[seg]) / (cum[seg + 1] - cum[seg] || 1);
    out.push(add(pts[seg], mul(sub(pts[(seg + 1) % n], pts[seg]), t)));
  }
  return { pts: out, L };
}
let { pts: C, L } = resampleLoop(route, CFG.step);
let N = C.length;

// ───────────────────────── 2. start/finish + zones ─────────────────────────
const plazaRing = fpRing('yamo-plaza'), gateRing = fpRing('chumphon-gate'), monumentRing = fpRing('thao-suranari-monument');
const zonePlaza = bufferHull(convexHull(plazaRing), CFG.zoneBufferM);
const zoneGate = bufferHull(convexHull(gateRing), CFG.zoneBufferM);
const inZone = (p) => pointInRing(p[0], p[1], zonePlaza) || pointInRing(p[0], p[1], zoneGate);
// Start/finish SOUTH of the Ya Mo plaza on northbound Ratchadamnoen (Tle 2026-10-17 20:55): the race
// opens by driving past the plaza, monument and Chumphon gate. Walk back from the research start
// (in front of the monument, inside the zone) to the southern zone edge, then CFG.finishBeforeZoneM
// further south so the 4.64 g launch (~8 m, 0.6 s) and the grid sit outside the no-boost zone.
let i0 = 0;
{
  let k = 0;
  while (!inZone(C[k])) k = (k + 1) % N;         // into zone (we start inside)
  while (inZone(C[k])) k = (k - 1 + N) % N;      // back out of the zone's southern edge
  i0 = (k - Math.round(CFG.finishBeforeZoneM / (L / N)) + N) % N;
}
const researchStartIdx = 0; // OSM start point = research track_m 0
C = [...C.slice(i0), ...C.slice(0, i0)];
const researchOffsetM = ((N - i0) % N) * (L / N); // new s of research track_m 0 (wraps: = L - i0*step)
const ds = L / N;
const S = (i) => i * ds;

const tangent = (i) => norm(sub(C[(i + 1) % N], C[(i - 1 + N) % N]));
const T = C.map((_, i) => tangent(i));
const H = T.map(headingOf);

// Project a point onto the centerline (brute force, fine at build time).
function project(p, maxD = Infinity) {
  let best = { d: Infinity, s: 0, i: 0, side: 0 };
  for (let i = 0; i < N; i++) {
    const a = C[i], b = C[(i + 1) % N], ab = sub(b, a);
    const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
    const q = add(a, mul(ab, t)), d = dist(p, q);
    if (d < best.d) best = { d, s: (i + t) * ds, i, side: Math.sign(dot(sub(p, q), rightOf(T[i]))) };
  }
  return best.d <= maxD ? best : null;
}

// ───────────────────────── 3. widths from Street View ─────────────────────────
function parseLanes(str) {
  const m2 = str.match(/(\d)\s*\+\s*(\d)/);
  if (m2) return { lanes: +m2[1] + +m2[2], twoWay: true };
  const m = str.match(/(\d)(?:\s*[–-]\s*(\d))?/);
  return { lanes: m ? +(m[2] ?? m[1]) : 2, twoWay: false };
}
const anchors = [];
for (const sg of segsAll) {
  const p = P([sg.lng, sg.lat]);
  const pr = project(p, 14);
  if (!pr) continue;
  const hd = ((sg.heading * Math.PI) / 180 - H[pr.i] + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  const aligned = Math.abs(hd) < (40 * Math.PI) / 180;
  const opposite = Math.abs(Math.abs(hd) - Math.PI) < (40 * Math.PI) / 180;
  if (!aligned && !(opposite && !sg.oneway)) continue;
  const { lanes, twoWay } = parseLanes(sg.lanes ?? '');
  anchors.push({ s: pr.s, w: sg.width_m, lanes, twoWay: twoWay || sg.oneway === false, seg: sg, flip: !aligned });
}
anchors.sort((a, b) => a.s - b.s);
function interpAnchor(s, key) {
  const n = anchors.length;
  let j = anchors.findIndex((a) => a.s > s);
  if (j < 0) j = 0;
  const b = anchors[j], a = anchors[(j - 1 + n) % n];
  let span = b.s - a.s; if (span <= 0) span += L;
  let t = s - a.s; if (t < 0) t += L;
  return a[key] + (b[key] - a[key]) * Math.max(0, Math.min(1, t / span));
}
const nearestAnchor = (s) => anchors.reduce((best, a) => {
  const d = Math.min(Math.abs(a.s - s), L - Math.abs(a.s - s));
  return d < best.d ? { d, a } : best;
}, { d: Infinity, a: null }).a;

// Road names: nearest aligned named OSM car road (224 renamed per Street View REPORT §6).
const RENAME = { 'ถนนมิตรภาพ': 'ถนนราชสีมา-โชคชัย', 'ถนนนครราชสีมา - หินโคน': 'ถนนราชสีมา-โชคชัย' };
const north224 = (p) => p[1] < -540 && p[0] > -110 && p[0] < 545; // z < -540 = north stretch
const nameAt = C.map((p, i) => {
  let best = { d: 12, r: null };
  for (const r of carRoads) {
    for (let k = 0; k < r.pts.length - 1; k++) {
      const d = distPointSeg(p, r.pts[k], r.pts[k + 1]);
      if (d >= best.d) continue;
      const rt = norm(sub(r.pts[k + 1], r.pts[k]));
      if (Math.abs(dot(rt, T[i])) < 0.7) continue;
      best = { d, r };
    }
  }
  return best.r;
});
for (let i = 0; i < N; i++) if (!nameAt[i]?.name) nameAt[i] = nameAt[(i - 1 + N) % N] ?? nameAt[i];
for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) if (!nameAt[i]?.name) nameAt[i] = nameAt[(i - 1 + N) % N];

// Westbound 224 carriageway lines (for the dual-carriageway corridor).
const westbound = carRoads.filter((r) => r.oneway && /มิตรภาพ/.test(r.name) && r.pts[0][0] > r.pts.at(-1)[0]
  && r.pts.every((p) => p[1] < -540 && p[1] > -600) && r.pts.some((p) => p[0] > -120 && p[0] < 560));

const cornerIdx = C.findIndex((p) => dist(p, cornerC) < 18);
const W = new Float32Array(N), MED = new Float32Array(N), W2 = new Float32Array(N), WL = new Float32Array(N), WR = new Float32Array(N);
const LANES = new Int8Array(N);
for (let i = 0; i < N; i++) {
  const s = S(i), p = C[i];
  W[i] = interpAnchor(s, 'w');
  const na = nearestAnchor(s);
  LANES[i] = (na.twoWay ? -1 : 1) * na.lanes;
  const name = nameAt[i]?.name ?? '';
  WL[i] = WR[i] = /มนัส|สรรพสิทธิ์|วัชรสฤษดิ์|กำแหงสงคราม/.test(name) ? 1.8 : CFG.walk;
  if (/ราชดำเนิน/.test(name)) WR[i] = 3; // moat-side footpath
  if (north224(p)) {
    WL[i] = 3;
    const r = rightOf(T[i]);
    // Distance to the westbound carriageway centre on the right.
    let dW = Infinity;
    for (const wb of westbound) for (let k = 0; k < wb.pts.length - 1; k++) {
      const h = segIntersect(p, add(p, mul(r, 40)), wb.pts[k], wb.pts[k + 1]);
      if (h) dW = Math.min(dW, h.t * 40);
    }
    let dWater = Infinity;
    for (const m of moats) dWater = Math.min(dWater, rayRingHit(p, r, m.ring, 45));
    const inWindow = p[0] >= CFG.moatWindowX[0] && p[0] <= CFG.moatWindowX[1];
    if (dW < 40) {
      const wbEdge = dW + CFG.westboundW / 2;
      let ext = wbEdge + CFG.bank;
      if (dWater < 45) ext = inWindow ? dWater : Math.min(ext, dWater - 0.6);
      const med = Math.max(0.5, Math.min(6, dW - CFG.westboundW / 2 - W[i] / 2));
      MED[i] = med;
      W2[i] = Math.max(0, Math.min(CFG.westboundW, ext - W[i] / 2 - med));
      WR[i] = Math.max(0.3, ext - W[i] / 2 - med - W2[i]);
    }
  }
}
// Ramp the westbound in/out so the corridor edge has no cliffs (≤ 0.5 m per m) and
// clamp inner-corner extents to the local radius so offset edges never fold.
const extR = (i) => W[i] / 2 + MED[i] + W2[i] + WR[i];
function smoothExt() {
  for (let pass = 0; pass < 2; pass++) for (let dir of [1, -1]) {
    for (let k = 0; k < N; k++) {
      const i = dir > 0 ? k : N - 1 - k, j = (i - dir + N) % N;
      const lim = extR(j) + 0.5 * ds;
      if (extR(i) > lim && W2[i] > 0) {
        let over = extR(i) - lim;
        const cutWR = Math.min(over, Math.max(0, WR[i] - 0.3)); WR[i] -= cutWR; over -= cutWR;
        const cut2 = Math.min(over, W2[i]); W2[i] -= cut2; over -= cut2;
        MED[i] = Math.max(0, MED[i] - over);
      }
    }
  }
}
smoothExt();
const kappa = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const a = H[(i - 3 + N) % N], b = H[(i + 3) % N];
  let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  kappa[i] = d / (6 * ds); // + = turning right
}
let clamped = 0;
for (let i = 0; i < N; i++) {
  if (Math.abs(kappa[i]) < 1e-3) continue;
  const rmax = 0.92 / Math.abs(kappa[i]);
  if (kappa[i] > 0) { // right turn: right side is inner
    let over = extR(i) - rmax;
    if (over > 0) {
      clamped++;
      for (const arr of [WR, W2, MED]) { const c = Math.min(over, arr === WR ? Math.max(0, arr[i] - 0.3) : arr[i]); arr[i] -= c; over -= c; }
    }
  } else {
    const over = W[i] / 2 + WL[i] - rmax;
    if (over > 0) { clamped++; WL[i] = Math.max(0.3, WL[i] - over); }
  }
}
smoothExt();

// ───────────────────────── 4. pads (extra drivable polygons) ─────────────────────────
// Whole intersection at the head of Ratchadamnoen is open (PHYSICS §4.1: R 56 m line
// through the westbound carriageway + median gap). Ratchadamnoen mouth + both 224 carriageways.
const [Cx, Cz] = cornerC;
const junctionPad = { kind: 'junction', cls: 1, ring: [
  [Cx - 11, Cz - 7], [Cx + 35, Cz - 7], [Cx + 35, Cz + 24.5], [Cx + 7, Cz + 24.5],
  [Cx + 7, Cz + 45], [Cx - 7, Cz + 45], [Cx - 7, Cz + 24.5], [Cx - 11, Cz + 24.5]] };
// Neon apex cones on the inner (garden) corner — visual guide only, never a collider.
const cones = [];
for (let k = 0; k <= 4; k++) {
  const a = (k / 4) * (Math.PI / 2);
  cones.push([Cx + 7 + 4 * (1 - Math.cos(a)) + 0.6, Cz + 24.5 + 4 * (1 - Math.sin(a)) + 0.6]);
}
// Landing pad: Phon Saen Rd (way/910301882) + grass bank between it and the north moat.
const moatN = moats.find((m) => m.id === 'way/544097464');
const phonSaen = carRoads.find((r) => r.id === 'way/910301882');
const yOnLine = (pts, x) => {
  for (let k = 0; k < pts.length - 1; k++) {
    const [a, b] = [pts[k], pts[k + 1]];
    if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
  }
  return null;
};
const moatSouthEdge = (x) => { // largest z of the moat polygon along a vertical line (south bank, z grows south)
  let best = -Infinity;
  const r = moatN.ring;
  for (let k = 0; k < r.length; k++) {
    const a = r[k], b = r[(k + 1) % r.length];
    if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) best = Math.max(best, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
  }
  return best;
};
const moatNorthEdge = (x) => {
  let best = Infinity;
  const r = moatN.ring;
  for (let k = 0; k < r.length; k++) {
    const a = r[k], b = r[(k + 1) % r.length];
    if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) best = Math.min(best, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
  }
  return best;
};
const padTop = [], padRoadN = [], padRoadS = [];
for (let x = CFG.landingPadX[0]; x <= CFG.landingPadX[1] + 0.01; x += 4) {
  const xc = Math.min(x, CFG.landingPadX[1]);
  const zr = yOnLine(phonSaen.pts, xc);
  const zs = Math.min(moatSouthEdge(Math.min(xc, CFG.moatWindowX[1] + 0.5)), zr - 5);
  padTop.push([xc, zs]); padRoadN.push([xc, zr - 5]); padRoadS.push([xc, zr + 5]);
}
const landingGrass = { kind: 'bank', cls: 2, ring: [...padTop, ...padRoadN.slice().reverse()] };
const landingRoad = { kind: 'landing', cls: 1, ring: [...padRoadN, ...padRoadS.slice().reverse()] };
// Manat junction: westbound lanes + median meet Manat (real signalised crossroads, Street View A-11).
let manatPadS = Infinity;
for (let x = 488; x <= 521; x += 1) manatPadS = Math.min(manatPadS, moatNorthEdge(x));
const manatPad = { kind: 'junction', cls: 1, ring: [[488, -606], [540, -606], [540, manatPadS - 0.3], [488, manatPadS - 0.3]] };
const pads = [junctionPad, manatPad, landingGrass, landingRoad];

// ───────────────────────── 5. surface raster ─────────────────────────
// Bands left→right at each sample: walkL(curb) | road | median(curb) | westbound(road) | walkR/bank(curb)
const bandEdges = (i) => {
  const w = W[i] / 2;
  return [-(w + WL[i]), -w, w, w + MED[i], w + MED[i] + W2[i], extR(i)];
};
const BAND_CLS = [2, 1, 2, 1, 2];
let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
const edgePt = (i, off) => add(C[i], mul(rightOf(T[i]), off));
for (let i = 0; i < N; i++) for (const off of [bandEdges(i)[0], extR(i)]) {
  const q = edgePt(i, off); minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minZ = Math.min(minZ, q[1]); maxZ = Math.max(maxZ, q[1]);
}
for (const pd of pads) for (const q of pd.ring) { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minZ = Math.min(minZ, q[1]); maxZ = Math.max(maxZ, q[1]); }
const RES = CFG.res;
const GX0 = Math.floor((minX - 6) / RES) * RES, GZ0 = Math.floor((minZ - 6) / RES) * RES;
const GW = Math.ceil((maxX + 6 - GX0) / RES), GH = Math.ceil((maxZ + 6 - GZ0) / RES);
const grid = new Uint8Array(GW * GH); // 0 blocked, 1 road, 2 curb, 3 water (open, shortcut only)
const cellOf = (x, z) => [Math.floor((x - GX0) / RES), Math.floor((z - GZ0) / RES)];

function fillPoly(ring, fn) { // scanline fill over cell centres
  let zmin = Infinity, zmax = -Infinity;
  for (const p of ring) { zmin = Math.min(zmin, p[1]); zmax = Math.max(zmax, p[1]); }
  const j0 = Math.max(0, Math.floor((zmin - GZ0) / RES)), j1 = Math.min(GH - 1, Math.ceil((zmax - GZ0) / RES));
  for (let j = j0; j <= j1; j++) {
    const z = GZ0 + (j + 0.5) * RES, xs = [];
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length];
      if ((a[1] > z) !== (b[1] > z)) xs.push(a[0] + ((z - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const ia = Math.max(0, Math.ceil((xs[k] - GX0) / RES - 0.5)), ib = Math.min(GW - 1, Math.floor((xs[k + 1] - GX0) / RES - 0.5));
      for (let c = ia; c <= ib; c++) fn(j * GW + c);
    }
  }
}
const paint = (cls, onlyOver) => (idx) => { if (onlyOver === undefined || onlyOver.includes(grid[idx])) grid[idx] = cls; };
// curb bands first, road bands override
for (const pass of [2, 1]) {
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, ei = bandEdges(i), ej = bandEdges(j);
    for (let b = 0; b < 5; b++) {
      if (BAND_CLS[b] !== pass) continue;
      if (ei[b + 1] - ei[b] < 0.01 && ej[b + 1] - ej[b] < 0.01) continue;
      fillPoly([edgePt(i, ei[b]), edgePt(i, ei[b + 1]), edgePt(j, ej[b + 1]), edgePt(j, ej[b])], paint(pass, pass === 1 ? undefined : [0]));
    }
  }
  for (const pd of pads) if (pd.cls === pass) fillPoly(pd.ring, paint(pass, pass === 1 ? undefined : [0]));
}
// Water polygons cut kerbs/bank (never asphalt); in the shortcut window water is "open".
let roadOverWater = 0;
for (const m of moats) fillPoly(m.ring, (idx) => {
  const x = GX0 + ((idx % GW) + 0.5) * RES;
  if (grid[idx] === 1) { roadOverWater++; return; }
  grid[idx] = 3; void x;
});

// ───────────────────────── 6. buildings ─────────────────────────
// Heights: OSM building:levels → landmark override → nearest Street View note (same side) → hashed 2–4 floors.
const lmByOsm = {};
for (const f of footprints) { const l = lmById[f.properties.landmark_id]; if (l?.size_m?.h) lmByOsm[f.properties.osm_id] = l; }
const SKIP_OSM = new Set(['way/549315243', 'way/549315244']); // gate + monument modelled separately
const svSides = [];
for (const a of anchors) {
  for (const side of ['left', 'right']) {
    const info = a.seg[side];
    if (!info) continue;
    const realSide = (side === 'left' ? -1 : 1) * (a.flip ? -1 : 1);
    svSides.push({ s: a.s, side: realSide, floors: info.floors, setback: info.setback_m, frontage: info.frontage_m, type: info.type, color: info.color, seg: a.seg.segment ?? a.seg.road_key });
  }
}
function svFloorsAt(s, side) {
  let best = null;
  for (const v of svSides) {
    if (v.side !== side) continue;
    const d = Math.min(Math.abs(v.s - s), L - Math.abs(v.s - s));
    if (d < 70 && (!best || d < best.d)) best = { d, v };
  }
  return best?.v ?? null;
}
const PALETTE = 8;
const buildings = [];
let dropped = 0, keptOSM = 0;
const cellCls = (p) => { const [c, r] = cellOf(p[0], p[1]); return c < 0 || r < 0 || c >= GW || r >= GH ? 0 : grid[r * GW + c]; };
for (const f of buildingsGeo) {
  if (SKIP_OSM.has(f.properties.osm_id)) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    let ring = closeRing(poly[0].map(P));
    if (ring.length < 3) continue;
    const cen = ring.reduce((a, p) => add(a, mul(p, 1 / ring.length)), [0, 0]);
    const pr = project(cen, CFG.buildingRadius);
    if (!pr) continue;
    // Drop buildings that sit on asphalt (bad OSM alignment) — REAL-07 "no building blocking the road".
    let onRoad = false;
    fillPoly(ring, (idx) => { if (grid[idx] === 1) onRoad = true; });
    if (onRoad || ring.some((p) => cellCls(p) === 1)) { dropped++; continue; }
    if (signedArea(ring) < 0) ring = ring.reverse(); // CCW in x/z (screen-space y down) consistent
    const lm = lmByOsm[f.properties.osm_id];
    const levels = +f.properties['building:levels'] || 0;
    let floors, src;
    if (lm) { floors = lm.size_m.h / 3.4; src = 'landmark'; }
    else if (levels) { floors = levels; src = 'osm'; }
    else {
      const sv = pr.d < 45 ? svFloorsAt(pr.s, pr.side) : null;
      if (sv && sv.floors > 0) { floors = sv.floors; src = 'sv'; }
      else if (sv && sv.floors === 0) { floors = 1; src = 'sv0'; }
      else { floors = 2 + Math.floor(hash(keptOSM + 17) * 3); src = 'default'; }
    }
    const h = lm ? lm.size_m.h : floors * 3.4 + 0.8;
    buildings.push({ ring, h, color: Math.floor(hash(keptOSM * 7 + 3) * PALETTE), src, s: pr.s, osm: f.properties.osm_id, tags: f.properties, area: Math.abs(signedArea(ring)) });
    keptOSM++;
    fillPoly(ring, (idx) => { if (grid[idx] === 2) grid[idx] = 0; }); // kerb under a building = wall
  }
}
// Synthetic buildings for the OSM gaps (REPORT-track-A §3a/§3b): rectangles from setback/frontage.
let synth = 0;
const fences = [];
for (const v of svSides) {
  if (v.setback === undefined || v.frontage === undefined) continue;
  const i = Math.round(v.s / ds) % N, t = T[i], r = rightOf(t);
  const edge = v.side > 0 ? extR(i) : W[i] / 2 + WL[i];
  const nrm = mul(r, v.side);
  const half = v.frontage / 2;
  // fence/low wall along the kerb for set-back schools and compounds
  if (v.setback >= 5 || v.floors === 0) {
    const a = add(add(C[i], mul(nrm, edge + 0.4)), mul(t, -half)), b = add(add(C[i], mul(nrm, edge + 0.4)), mul(t, half));
    fences.push({ a, b, h: 1.6 });
  }
  if (v.floors <= 0) continue;
  const depth = Math.max(10, Math.min(24, v.floors * 3.2));
  const near = edge + v.setback, far = near + depth;
  const ring = [add(add(C[i], mul(nrm, near)), mul(t, -half)), add(add(C[i], mul(nrm, near)), mul(t, half)),
    add(add(C[i], mul(nrm, far)), mul(t, half)), add(add(C[i], mul(nrm, far)), mul(t, -half))];
  const cen = ring.reduce((a, p) => add(a, mul(p, 0.25)), [0, 0]);
  if (buildings.some((b) => b.src !== 'synthetic' && pointInRing(cen[0], cen[1], b.ring))) continue;
  let onOpen = false;
  fillPoly(ring, (idx) => { if (grid[idx] === 1 || grid[idx] === 3) onOpen = true; });
  if (onOpen) continue;
  buildings.push({ ring: signedArea(ring) < 0 ? ring.reverse() : ring, h: v.floors * 3.4 + 0.8, color: Math.floor(hash(synth * 13 + 5) * PALETTE), src: 'synthetic', s: v.s, sv: v.seg, tags: {}, area: v.frontage * depth });
  synth++;
}

// ───────────────────────── 7. walls from the raster boundary ─────────────────────────
const open = (c, r) => c >= 0 && r >= 0 && c < GW && r < GH && (grid[r * GW + c] === 1 || grid[r * GW + c] === 2);
const edges = new Map(); // start vertex key -> list of end keys (open cell on the left)
const vk = (c, r) => r * (GW + 1) + c;
const addE = (a, b) => { const l = edges.get(a); l ? l.push(b) : edges.set(a, [b]); };
for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) {
  if (!open(c, r)) continue;
  if (!open(c, r - 1)) addE(vk(c + 1, r), vk(c, r));
  if (!open(c, r + 1)) addE(vk(c, r + 1), vk(c + 1, r + 1));
  if (!open(c - 1, r)) addE(vk(c, r), vk(c, r + 1));
  if (!open(c + 1, r)) addE(vk(c + 1, r + 1), vk(c + 1, r));
}
const loops = [];
while (edges.size) {
  const [start] = edges.keys();
  const loop = [start];
  let cur = start;
  for (;;) {
    const l = edges.get(cur);
    if (!l) break;
    const nxt = l.pop();
    if (!l.length) edges.delete(cur);
    if (nxt === start) break;
    loop.push(nxt); cur = nxt;
  }
  if (loop.length > 6) loops.push(loop.map((k) => [GX0 + (k % (GW + 1)) * RES, GZ0 + Math.floor(k / (GW + 1)) * RES]));
}
const wallSegs = [];
for (const lp of loops) {
  // split the closed loop into two halves so DP keeps both ends
  const half = Math.floor(lp.length / 2);
  for (const part of [lp.slice(0, half + 1), lp.slice(half).concat([lp[0]])]) {
    const simp = dp(part, 0.45);
    for (let k = 0; k < simp.length - 1; k++) if (dist(simp[k], simp[k + 1]) > 0.05) wallSegs.push([simp[k], simp[k + 1]]);
  }
}
// Classify: pieces where a real OSM road crosses the wall get a neon barrier (closed junction),
// pieces facing open water are moat rails, the rest are kerb rails/building fronts.
const walls = []; // [a, b, kind, side, h] kind: 0 rail, 1 neon junction barrier, 2 moat rail, 3 building front, 4 plaza/gate edge
const mouths = [];
for (const [a, b] of wallSegs) {
  const segLen = dist(a, b), dir = norm(sub(b, a));
  const cuts = [];
  for (const r of carRoads) for (let k = 0; k < r.pts.length - 1; k++) {
    const h = segIntersect(a, b, r.pts[k], r.pts[k + 1]);
    if (!h) continue;
    const rt = norm(sub(r.pts[k + 1], r.pts[k]));
    const sinA = Math.max(0.35, Math.abs(cross(rt, dir)));
    const hw = Math.min(9, (r.w / 2 + 0.8) / sinA);
    cuts.push([Math.max(0, h.t * segLen - hw), Math.min(segLen, h.t * segLen + hw), r]);
  }
  cuts.sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const c of cuts) { const m = merged.at(-1); if (m && c[0] <= m[1]) { m[1] = Math.max(m[1], c[1]); m[2].push(c[2]); } else merged.push([c[0], c[1], [c[2]]]); }
  const mid = mul(add(a, b), 0.5), nrmL = [dir[1], -dir[0]];
  const probe = (p, k) => cellCls(add(p, mul(nrmL, k)));
  const isD = (c) => c === 1 || c === 2;
  const sideOpen = isD(probe(mid, 0.3)) ? 1 : -1; // which side is the track
  const waterSide = probe(mid, -0.3 * sideOpen) === 3 || moats.some((m) => pointInRing(...add(mid, mul(nrmL, -1.2 * sideOpen)), m.ring));
  const baseKind = waterSide ? 2 : 0;
  let t0 = 0;
  // collider height: moat rails and the west end of the Phon Saen run-out can be jumped (PHYSICS §1.6)
  const lowAt = (p) => p[0] >= CFG.landingPadX[0] - 1.5 && p[0] <= CFG.landingPadX[0] + 1.5 && p[1] > -556 && p[1] < -500;
  const push = (u, v, kind) => {
    if (v - u <= 0.05) return;
    const pa = add(a, mul(dir, u)), pb = add(a, mul(dir, v));
    const h = kind === 2 || lowAt(mul(add(pa, pb), 0.5)) ? CFG.railH : 0;
    walls.push([pa, pb, kind, sideOpen, h]);
  };
  for (const [u, v, rs] of merged) {
    push(t0, u, baseKind); push(u, v, 1);
    const pm = add(a, mul(dir, (u + v) / 2));
    mouths.push({ p: pm, len: v - u, roads: [...new Set(rs.map((r) => r.name || r.id))], s: project(pm).s });
    t0 = v;
  }
  push(t0, segLen, baseKind);
}
// Refine plain rails: building fronts (3) and the Ya Mo plaza / Chumphon Gate edge (4, soft "monument"
// collisions — GAMEPLAY §2.5: no sparks, no shake). Probe 1–3 m outward from the wall.
const plazaBuf = bufferHull(convexHull(plazaRing), 4), gateBuf = bufferHull(convexHull(gateRing), 4);
for (const w of walls) {
  if (w[2] !== 0) continue;
  const [a, b, , side] = w, dir = norm(sub(b, a)), out = mul([dir[1], -dir[0]], -side), mid = mul(add(a, b), 0.5);
  const probes = [1, 2, 3].map((k) => add(mid, mul(out, k)));
  if (probes.some((q) => pointInRing(q[0], q[1], plazaBuf) || pointInRing(q[0], q[1], gateBuf))) w[2] = 4;
  else if (probes.some((q) => buildings.some((bd) => pointInRing(q[0], q[1], bd.ring)))) w[2] = 3;
}

// ───────────────────────── 8. checkpoints, moat jump ─────────────────────────
const crossAt = (i) => [edgePt(i, bandEdges(i)[0]), edgePt(i, extR(i))];
// The moat jump is a style move, not a shortcut (PHYSICS §2.3): no checkpoint may sit between
// where the jump line leaves the 224 (x ≈ 455) and where it lands on Manat (y ≈ 528 + run-out),
// so both lines pass every checkpoint.
const sJumpFrom = project([455, -598]).s, sJumpTo = project([532, -512]).s;
const cps = [];
for (let k = 1; k <= CFG.checkpoints; k++) {
  let i = Math.round((k * N) / CFG.checkpoints) % N;
  if (k < CFG.checkpoints && S(i) > sJumpFrom && S(i) < sJumpTo) i = Math.round((S(i) - sJumpFrom < sJumpTo - S(i) ? sJumpFrom - 5 : sJumpTo + 5) / ds) % N;
  // a checkpoint line must span the whole drivable width: never inside an open junction pad
  const nearPad = (j) => crossAt(j).concat([C[j]]).some((q) => pads.some((pd) => pd.cls === 1 && pd.kind === 'junction'
    && Math.min(...pd.ring.map((r) => dist(r, q))) < 60 && pointInRing(q[0], q[1], bufferHull(convexHull(pd.ring), 6))));
  if (k < CFG.checkpoints) while (nearPad(i)) i = (i + 1) % N;
  const [a, b] = crossAt(i);
  cps.push({ id: k - 1, a, b, s: k === CFG.checkpoints ? L : S(i) });
}
const winA = [CFG.moatWindowX[0], moatNorthEdge(CFG.moatWindowX[0])], winB = [CFG.moatWindowX[1], moatNorthEdge(CFG.moatWindowX[1])];
const landA = [CFG.moatWindowX[0], moatSouthEdge(CFG.moatWindowX[0])], landB = [CFG.moatWindowX[1], moatSouthEdge(CFG.moatWindowX[1])];
// PHYSICS §2.2 recommended 55° line: take off at the rail (495, y 578), land on Manat west lane (529.5, y 528).
const takeoff = [495, moatNorthEdge(495)], landing = [529.5, -528];
let wsum = 0, wn = 0;
for (let x = CFG.moatWindowX[0]; x <= CFG.moatWindowX[1]; x += 5) { wsum += moatSouthEdge(x) - moatNorthEdge(x); wn++; }
const moatWidth = wsum / wn;
const sTakeoff = sJumpFrom, sJoin = sJumpTo;
const altGroup = null; // not a shortcut — kept for the contract
const sGrid = 10;
const gi = Math.round(sGrid / ds);

// Corners (for HUD arrows / REAL-04): cumulative heading change over a 40 m window.
const corners = [];
{
  const win = Math.round(20 / ds);
  const turnOver = (i) => { let d = H[(i + win) % N] - H[(i - win + N) % N]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  for (let i = 0; i < N; i++) {
    const d = turnOver(i);
    if (Math.abs(d) < (45 * Math.PI) / 180) continue;
    if (Math.abs(d) >= Math.abs(turnOver((i - 1 + N) % N)) && Math.abs(d) >= Math.abs(turnOver((i + 1) % N))) {
      if (corners.length && S(i) - corners.at(-1).s < 30) continue;
      corners.push({ s: +S(i).toFixed(1), deg: Math.round((d * 180) / Math.PI), dir: d > 0 ? 'R' : 'L' });
    }
  }
}

// Road-name spans
const nameSpans = [];
for (let i = 0; i < N; i++) {
  const r = nameAt[i];
  const nm = RENAME[r?.name] && north224(C[i]) ? RENAME[r.name] : r?.name ?? '';
  const last = nameSpans.at(-1);
  if (last && last.name === nm) last.s1 = S(i + 1);
  else nameSpans.push({ s0: S(i), s1: S(i + 1), name: nm, osm: r?.id ?? '' });
}

// ───────────────────────── 9. QA: deviation vs OSM ─────────────────────────
const osmTrackDev = (p) => { let d = Infinity; for (let k = 0; k < osmLine.length - 1; k++) d = Math.min(d, distPointSeg(p, osmLine[k], osmLine[k + 1])); return d; };
const devs = C.map(osmTrackDev);
const correctedRange = [project(osmLine[JUNCTION_IN]).s - 5, project(osmLine[JUNCTION_OUT]).s + 5];
const devOutside = devs.filter((_, i) => S(i) < correctedRange[0] || S(i) > correctedRange[1]).sort((a, b) => a - b);
const dev = {
  maxM: +devOutside.at(-1).toFixed(2),
  p95M: +devOutside[Math.floor(devOutside.length * 0.95)].toFixed(2),
  meanM: +(devOutside.reduce((a, b) => a + b, 0) / devOutside.length).toFixed(2),
  correctedSpanM: correctedRange.map((v) => +v.toFixed(0)),
  maxInCorrectedM: +Math.max(...devs.filter((_, i) => S(i) >= correctedRange[0] && S(i) <= correctedRange[1])).toFixed(1),
};

// research track_m -> new s (sparse table)
const osmCum = [0];
for (let k = 0; k < osmLine.length - 1; k++) osmCum.push(osmCum[k] + dist(osmLine[k], osmLine[k + 1]));
const researchMap = [];
for (let m = 0; m <= osmCum.at(-1); m += 50) {
  let k = osmCum.findIndex((c) => c > m) - 1; if (k < 0) k = osmCum.length - 2;
  const t = (m - osmCum[k]) / (osmCum[k + 1] - osmCum[k]);
  const p = add(osmLine[k], mul(sub(osmLine[k + 1], osmLine[k]), t));
  researchMap.push([m, +project(p).s.toFixed(0)]);
}

// ───────────────────────── 8b. M2 streetscape (scripts/streetscape.mjs) ─────────────────────────
const sc = buildStreetscape({
  C, T, N, ds, L, W, MED, W2, WL, extR, rightOf, project, cellCls, pads, buildings, svSides, mouths, corners,
  nameSpans, carRoads, inZone, pointInRing, hash, researchMap, segsAll, P,
});
walls.push(...sc.propWalls);

// ───────────────────────── 10. encode + write ─────────────────────────
const dm = (v) => Math.round(v * 10);
const flat = (pts) => pts.flatMap((p) => [dm(p[0]), dm(p[1])]);
function rle(arr) {
  const bytes = [];
  const varint = (v) => { while (v >= 128) { bytes.push((v & 127) | 128); v >>>= 7; } bytes.push(v); };
  let i = 0;
  while (i < arr.length) {
    const c = arr[i]; let j = i;
    while (j < arr.length && arr[j] === c) j++;
    varint(((j - i) << 2) | c); i = j;
  }
  return Buffer.from(bytes).toString('base64');
}
const moatsNear = moats.filter((m) => m.ring.some((p) => p[0] > minX - 250 && p[0] < maxX + 250 && p[1] > minZ - 250 && p[1] < maxZ + 250));
const lm = (id) => lmById[id];
const t21 = fpRing('terminal21-korat');
const out = {
  v: 1, id: 'A', unit: 'dm', note: 'coords ×10 (decimetres), x = east, z = −north, origin = monument. © OpenStreetMap contributors (ODbL).',
  origin: { lat: LAT0, lon: LON0, kx: KX, ky: KY },
  lengthM: +L.toFixed(1), step: +ds.toFixed(4), researchOffsetM: +researchOffsetM.toFixed(1),
  center: flat(C),
  // per sample: road width, westbound-side median, westbound carriageway, left walk, right walk/bank (dm)
  widths: Array.from({ length: N }, (_, i) => [dm(W[i]), dm(MED[i]), dm(W2[i]), dm(WL[i]), dm(WR[i])]).flat(),
  lanes: Array.from(LANES),
  pads: pads.map((p) => ({ kind: p.kind, cls: p.cls, ring: flat(p.ring) })),
  grid: { x0: GX0, z0: GZ0, res: RES, w: GW, h: GH, rle: rle(grid) },
  // per wall: ax az bx bz (dm), kind*2 + side bit, collider height dm (0 = infinite)
  walls: walls.flatMap(([a, b, kind, side, h]) => [dm(a[0]), dm(a[1]), dm(b[0]), dm(b[1]), kind * 2 + (side > 0 ? 1 : 0), dm(h)]),
  cones: flat(cones),
  fences: fences.flatMap((f) => [dm(f.a[0]), dm(f.a[1]), dm(f.b[0]), dm(f.b[1])]),
  water: { level: CFG.waterY, rings: moatsNear.map((m) => flat(m.ring)), window: [...flat([winA, winB]), ...flat([landA, landB])] },
  // per building: h (dm), style (streetscape ST), paint tint (0xRRGGBB), n street-facing edges, edge indices…, ring
  buildings: buildings.map((b, i) => { const m = sc.buildingMeta[i]; return [dm(b.h), m.st, m.tint, m.front.length, ...m.front, ...flat(b.ring)]; }),
  // M2 street furniture — angles ×1000 = three.js rotation.y (local +z faces (sin, cos))
  streetscape: (() => {
    const ss = sc.streetscape, A = (a) => Math.round(a * 1000);
    return {
      lamps: ss.lamps.flatMap((l) => [dm(l.p[0]), dm(l.p[1]), A(l.ang), l.type]),
      poles: ss.poles.flatMap((l) => [dm(l.p[0]), dm(l.p[1]), A(l.ang), l.flags]),
      signals: ss.signals.flatMap((l) => [dm(l.p[0]), dm(l.p[1]), A(l.ang), dm(l.arm), l.kind]),
      xwalks: ss.xwalks.flatMap((v) => [dm(v.s), v.stop]),
      signs: ss.signs.flatMap((l) => [dm(l.p[0]), dm(l.p[1]), A(l.ang), l.slot]),
      signNames: SIGN_NAMES, signGreen: SIGN_NAMES.map((n) => (SIGN_GREEN.has(n) ? 1 : 0)),
      trees: ss.trees.flatMap((t) => [dm(t.p[0]), dm(t.p[1]), t.type, Math.round(t.scale * 100)]),
      bridges: ss.bridges.flatMap((b) => [dm(b.a[0]), dm(b.a[1]), dm(b.b[0]), dm(b.b[1]), b.roof]),
      stubs: ss.stubs.map((t) => ({ w: dm(t.w), pts: flat(t.pts) })),
      parked: ss.parked.flatMap((c) => [dm(c.p[0]), dm(c.p[1]), A(c.ang), c.color, c.type]),
      // cable spans for physics-cables (CableSpan): ax ay az bx by bz (dm), sag (cm)
      cables: ss.cables.flatMap((c) => [dm(c[0]), dm(c[1]), dm(c[2]), dm(c[3]), dm(c[4]), dm(c[5]), Math.round(c[6] * 100)]),
    };
  })(),
  // M3 anchors (neon pass): x y z (dm), angle ×1000 (facing), w h (dm). gold = already rendered as red/gold fascia.
  anchors: Object.fromEntries(Object.entries(sc.anchors).map(([k, v]) => [k, v.flatMap((a) => [dm(a[0]), dm(a[1]), dm(a[2]), Math.round(a[3] * 1000), dm(a[4]), dm(a[5])])])),
  checkpoints: cps.map((c) => [dm(c.a[0]), dm(c.a[1]), dm(c.b[0]), dm(c.b[1]), +c.s.toFixed(1)]),
  altGroup,
  startGrid: { x: +C[gi][0].toFixed(2), y: 0, z: +C[gi][1].toFixed(2), heading: +H[gi].toFixed(4), s: +S(gi).toFixed(1) },
  zones: [flat(zonePlaza), flat(zoneGate)],
  moatJump: {
    takeoff: { x: +takeoff[0].toFixed(1), z: +takeoff[1].toFixed(1) }, landing: { x: +landing[0].toFixed(1), z: +landing[1].toFixed(1) },
    widthM: +moatWidth.toFixed(1), takeoffLine: flat([winA, winB]), landingLine: flat([landA, landB]),
    landingPoly: flat([...padTop, ...padRoadS.slice().reverse()]), sTakeoff: +sTakeoff.toFixed(0), sJoin: +sJoin.toFixed(0),
  },
  corners,
  roadNames: nameSpans.filter((n) => n.s1 - n.s0 > 10).map((n) => ({ s0: +n.s0.toFixed(0), s1: +n.s1.toFixed(0), name: n.name, osm: n.osm })),
  landmarks: {
    monument: { x: 0, z: 0, terrace: flat(monumentRing), facingDeg: lm('thao-suranari-monument').facing_deg, h: lm('thao-suranari-monument').size_m.h },
    plaza: flat(plazaRing),
    gate: { ring: flat(gateRing), x: lm('chumphon-gate').local_xy[0], z: -lm('chumphon-gate').local_xy[1], ...lm('chumphon-gate').size_m },
    t21: { ring: flat(t21), h: lm('terminal21-korat').size_m.h },
  },
  researchMap,
};
const outPath = path.join(ROOT, 'public/data/track-A.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out));

// Debug sidecar (only fetched by ?qa=1&view=top): raw OSM reference for overlay.
const near = (pts) => pts.some((p) => p[0] > minX - 60 && p[0] < maxX + 60 && p[1] > minZ - 60 && p[1] < maxZ + 60);
const debug = {
  osmTrack: flat(osmLine),
  osmRoads: carRoads.filter((r) => near(r.pts)).map((r) => flat(r.pts)),
  osmWater: [...moats, ...otherWater].filter((m) => near(m.ring)).map((m) => flat(m.ring)),
  deviation: dev, mouths: mouths.map((m) => ({ x: +m.p[0].toFixed(1), z: +m.p[1].toFixed(1), s: +m.s.toFixed(0), len: +m.len.toFixed(1), roads: m.roads })),
};
fs.writeFileSync(path.join(ROOT, 'public/data/track-A.debug.json'), JSON.stringify(debug));

const size = fs.statSync(outPath).size;
const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
for (const w of walls) counts[w[2]]++;
console.log(JSON.stringify({
  lengthM: +L.toFixed(1), osmLengthM: trackGeo.features[0].properties.length_m, samples: N, researchOffsetM: +researchOffsetM.toFixed(1),
  startGrid: out.startGrid, grid: `${GW}×${GH} @${RES} m`, walls: walls.length, wallKinds: { rail: counts[0], neon: counts[1], moatRail: counts[2], building: counts[3], plaza: counts[4], prop: counts[5] },
  streetscape: Object.fromEntries(Object.entries(sc.streetscape).map(([k, v]) => [k, v.length])), anchors: Object.fromEntries(Object.entries(sc.anchors).map(([k, v]) => [k, v.length])),
  styles: sc.buildingMeta.reduce((a, m) => ((a[m.st] = (a[m.st] ?? 0) + 1), a), {}), junctions: sc.junctions.map((j) => `${j.s.toFixed(0)} ${j.names.join('/')}${j.signal ? ' 🚦' : ''}`),
  mouths: mouths.length, buildings: buildings.length, keptOSM, synthetic: synth, droppedOnRoad: dropped, fences: fences.length,
  heightSrc: buildings.reduce((a, b) => ((a[b.src] = (a[b.src] ?? 0) + 1), a), {}),
  innerClamped: clamped, roadOverWaterCells: roadOverWater, anchors: anchors.length, moatWidthM: +moatWidth.toFixed(1), altGroup,
  sTakeoff: out.moatJump.sTakeoff, sJoin: out.moatJump.sJoin, corners, deviation: dev,
  roadNames: out.roadNames.map((r) => `${r.s0}-${r.s1} ${r.name}`), bytes: size, gzipKB: +(require_gzip(outPath) / 1024).toFixed(1),
}, null, 1));

function require_gzip(p) {
  return zlib.gzipSync(fs.readFileSync(p), { level: 9 }).length;
}
