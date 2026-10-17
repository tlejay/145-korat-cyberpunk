#!/usr/bin/env node
// Analyse research/osm/raw.json: monument origin, road table, building stats,
// and route the candidate race tracks (A/B/C) over the real OSM road graph.
// Usage: node scripts/analyze-osm.mjs   (run fetch-osm.mjs first)
// Map data © OpenStreetMap contributors (ODbL)

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'research', 'osm');
const raw = JSON.parse(await readFile(join(OUT, 'raw.json'), 'utf8'));
const els = raw.elements;
const bbox = raw.query?.bbox;

// --- Origin = centroid of the monument polygon (way 549315244) ---
const monument = els.find((e) => e.type === 'way' && e.tags?.historic === 'monument' && e.tags?.['name:en'] === 'Thao Suranari Monument');
const ring = monument.geometry.slice(0, -1);
const ORIGIN = {
  lat: ring.reduce((s, p) => s + p.lat, 0) / ring.length,
  lon: ring.reduce((s, p) => s + p.lon, 0) / ring.length,
};
const KX = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const KY = 110574;
const toXY = (lat, lon) => [(lon - ORIGIN.lon) * KX, (lat - ORIGIN.lat) * KY]; // x = east, y = north (m)
const toLL = (x, y) => [ORIGIN.lon + x / KX, ORIGIN.lat + y / KY];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const polyLen = (pts) => pts.slice(1).reduce((s, p, i) => s + dist(p, pts[i]), 0);
const inBox = (p) => !bbox || (p.lat >= bbox.south && p.lat <= bbox.north && p.lon >= bbox.west && p.lon <= bbox.east);

// --- Road table (length clipped to the fetched bbox) ---
const DRIVABLE = new Set(['trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service']);
const MAJOR = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'unclassified']);
const roadWays = els.filter((e) => e.type === 'way' && e.tags?.highway && e.geometry);
const table = new Map();
for (const w of roadWays) {
  const t = w.tags;
  if (!MAJOR.has(t.highway) || !t.name) continue;
  let len = 0;
  for (let i = 1; i < w.geometry.length; i++) {
    const a = w.geometry[i - 1], b = w.geometry[i];
    if (inBox(a) && inBox(b)) len += dist(toXY(a.lat, a.lon), toXY(b.lat, b.lon));
  }
  const r = table.get(t.name) ?? { name: t.name, name_en: new Set(), highway: new Set(), lanes: new Set(), oneway: { yes: 0, no: 0 }, width: new Set(), surface: new Set(), length_m: 0, ways: 0 };
  if (t['name:en']) r.name_en.add(t['name:en']);
  r.highway.add(t.highway);
  if (t.lanes) r.lanes.add(t.lanes);
  if (t.width) r.width.add(t.width);
  if (t.surface) r.surface.add(t.surface);
  r.oneway[t.oneway === 'yes' || t.oneway === '-1' ? 'yes' : 'no'] += len;
  r.length_m += len;
  r.ways++;
  table.set(t.name, r);
}
const roads = [...table.values()]
  .filter((r) => r.length_m > 150)
  .sort((a, b) => b.length_m - a.length_m)
  .map((r) => ({
    ...r,
    name_en: [...r.name_en].join(' / '),
    highway: [...r.highway].join(','),
    lanes: [...r.lanes].join(',') || null,
    width: [...r.width].join(',') || null,
    surface: [...r.surface].join(',') || null,
    oneway_share: Math.round((r.oneway.yes / (r.length_m || 1)) * 100),
    length_m: Math.round(r.length_m),
    oneway: undefined,
  }));
const roadTagCoverage = (() => {
  const major = roadWays.filter((w) => MAJOR.has(w.tags.highway));
  const pct = (k) => Math.round((major.filter((w) => w.tags[k]).length / major.length) * 100);
  return { major_ways: major.length, name: pct('name'), lanes: pct('lanes'), width: pct('width'), surface: pct('surface'), oneway: pct('oneway') };
})();

// --- Buildings ---
const shoelace = (pts) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const bWays = els.filter((e) => e.type === 'way' && (e.tags?.building || e.tags?.['building:part']) && e.geometry);
const bRels = els.filter((e) => e.type === 'relation' && e.tags?.building);
const bStats = { total: bWays.length + bRels.length, ways: bWays.length, relations: bRels.length, with_height: 0, with_levels: 0, with_name: 0, by_type: {}, area_m2: { lt100: 0, '100_400': 0, '400_1500': 0, gt1500: 0 }, tall: [], near_track_area: 0 };
for (const b of [...bWays, ...bRels]) {
  const t = b.tags;
  if (t.height) bStats.with_height++;
  if (t['building:levels']) bStats.with_levels++;
  if (t.name) bStats.with_name++;
  const k = t.building ?? 'part';
  bStats.by_type[k] = (bStats.by_type[k] ?? 0) + 1;
  if (b.geometry) {
    const pts = b.geometry.map((p) => toXY(p.lat, p.lon));
    const a = shoelace(pts);
    bStats.area_m2[a < 100 ? 'lt100' : a < 400 ? '100_400' : a < 1500 ? '400_1500' : 'gt1500']++;
    const c = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
    if (Math.abs(c[0]) < 1000 && Math.abs(c[1]) < 800) bStats.near_track_area++;
    if (t.height || +t['building:levels'] >= 3) bStats.tall.push({ id: `way/${b.id}`, name: t.name ?? null, levels: t['building:levels'] ?? null, height: t.height ?? null, xy: c.map(Math.round), area_m2: Math.round(a) });
  }
}
bStats.by_type = Object.fromEntries(Object.entries(bStats.by_type).sort((a, b) => b[1] - a[1]));

// --- Road graph for track routing ---
const nodePos = new Map();
const adj = new Map();
const COST = { trunk: 1.4, trunk_link: 2, primary: 1, primary_link: 1.5, secondary: 1, secondary_link: 1.5, tertiary: 1, tertiary_link: 1.5, unclassified: 1.2, residential: 3, living_street: 5, service: 12 };
for (const w of roadWays) {
  const t = w.tags;
  if (!DRIVABLE.has(t.highway) || t.area === 'yes' || t.access === 'private' || t.access === 'no') continue;
  w.nodes.forEach((id, i) => nodePos.set(id, toXY(w.geometry[i].lat, w.geometry[i].lon)));
  for (let i = 1; i < w.nodes.length; i++) {
    const a = w.nodes[i - 1], b = w.nodes[i];
    const d = dist(nodePos.get(a), nodePos.get(b));
    const edge = { d, cost: d * COST[t.highway], way: w.id, name: t.name ?? `(${t.highway} ไม่มีชื่อ)`, highway: t.highway, oneway: t.oneway === 'yes' ? 1 : t.oneway === '-1' ? -1 : 0, lanes: t.lanes };
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push({ to: b, fwd: true, ...edge });
    adj.get(b).push({ to: a, fwd: false, ...edge });
  }
}
const edgeKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// Dijkstra (undirected: a closed race course ignores one-way rules, but we report them)
function route(from, to, banned) {
  const distTo = new Map([[from, 0]]);
  const prev = new Map();
  const heap = [[0, from]];
  while (heap.length) {
    let bi = 0;
    for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i;
    const [d, u] = heap.splice(bi, 1)[0];
    if (u === to) break;
    if (d > distTo.get(u)) continue;
    for (const e of adj.get(u) ?? []) {
      if (banned.has(edgeKey(u, e.to))) continue;
      // Prefer the legal carriageway on divided / one-way roads (x4 cost against traffic)
      const wrongWay = e.oneway !== 0 && ((e.oneway === 1) !== e.fwd);
      const nd = d + e.cost * (wrongWay ? 4 : 1);
      if (nd < (distTo.get(e.to) ?? Infinity)) { distTo.set(e.to, nd); prev.set(e.to, { from: u, e }); heap.push([nd, e.to]); }
    }
  }
  if (from === to) return [];
  if (!prev.has(to)) throw new Error(`no route ${from} -> ${to}`);
  const path = [];
  for (let v = to; v !== from; v = prev.get(v).from) path.push({ node: v, ...prev.get(v) });
  return path.reverse();
}

// Snap a waypoint to the nearest graph node that belongs to a road with the given name
function snap([x, y], name) {
  let best = null, bd = Infinity;
  for (const [id, edges] of adj) {
    if (name && !edges.some((e) => e.name === name)) continue;
    const d = dist(nodePos.get(id), [x, y]);
    if (d < bd) { bd = d; best = id; }
  }
  if (bd > 80) console.warn(`[track] waypoint ${x},${y} (${name}) snapped ${Math.round(bd)} m away`);
  return best;
}

// Corner detection on a 5 m resampled loop: heading change over a 30 m window
function resample(pts, step = 5) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = dist(a, b);
    let t = step - carry;
    while (t <= seg) { out.push([a[0] + ((b[0] - a[0]) * t) / seg, a[1] + ((b[1] - a[1]) * t) / seg]); t += step; }
    carry = seg - (t - step);
  }
  return out;
}
function corners(loop) {
  const p = resample(loop);
  const n = p.length, W = 6; // 6 * 5 m = 30 m window each side
  const head = (i) => { const a = p[(i - W + n) % n], b = p[(i + W) % n]; return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  const turn = [];
  for (let i = 0; i < n; i++) {
    const h1 = Math.atan2(p[i][1] - p[(i - W + n) % n][1], p[i][0] - p[(i - W + n) % n][0]);
    const h2 = Math.atan2(p[(i + W) % n][1] - p[i][1], p[(i + W) % n][0] - p[i][0]);
    let d = ((h2 - h1) * 180) / Math.PI;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    turn.push(d);
  }
  void head;
  // Group consecutive samples turning > 3° per sample-window into corners
  const list = [];
  let i = 0;
  while (i < n) {
    if (Math.abs(turn[i]) < 12) { i++; continue; }
    const sign = Math.sign(turn[i]);
    let j = i, peak = 0, at = i;
    while (j < n && Math.sign(turn[j]) === sign && Math.abs(turn[j]) >= 6) { if (Math.abs(turn[j]) > peak) { peak = Math.abs(turn[j]); at = j; } j++; }
    if (peak >= 30) list.push({ at_m: at * 5, angle: Math.round(peak), dir: sign > 0 ? 'ซ้าย' : 'ขวา', xy: p[at].map(Math.round) });
    i = j + 1;
  }
  return list;
}

const TRACKS = {
  A: {
    title: 'วงคูเมืองตะวันตก (Ya Mo Moat Loop)',
    // start on Ratchadamnoen in front of the monument, northbound
    via: [
      [[-30, 40], 'ถนนราชดำเนิน'],
      [[-90, 568], 'ถนนราชดำเนิน'],
      [[530, 580], 'ถนนมิตรภาพ'],
      [[533, 300], 'ถนนมนัส'],
      [[600, -312], 'ถนนมนัส'],
      [[300, -466], 'ถนนกำแหงสงคราม'],
      [[5, -470], 'ถนนราชดำเนิน'],
      [[-17, -182], 'ถนนราชดำเนิน'],
    ],
  },
  B: {
    title: 'วงย่านการค้าฝั่งตะวันตก (Downtown West Loop)',
    via: [
      [[-30, 40], 'ถนนราชดำเนิน'],
      [[-42, 164], 'ถนนสุรนารี'],
      [[-500, 220], 'ถนนสุรนารี'],
      [[-775, 249], 'ถนนโยธา'],
      [[-821, -211], 'ถนนโยธา'],
      [[-400, -200], 'ถนนจอมสุรางค์ยาตร์'],
      [[-17, -182], 'ถนนราชดำเนิน'],
    ],
  },
  C: {
    title: 'สปรินต์รอบประตูชุมพล-คูใต้ (Gate & South Moat Sprint)',
    // follows the real one-way couplet around Lan Ya Mo: Ratchadamnoen northbound, Chum Phon southbound
    via: [
      [[-30, 40], 'ถนนราชดำเนิน'],
      [[-42, 164], 'ถนนราชดำเนิน'],
      [[30, 167], 'ถนนชุมพล'],
      [[38, 3], 'ถนนจอมพล'],
      [[271, 7], 'ถนนวัชรสฤษดิ์'],
      [[274, -174], 'ถนนวัชรสฤษดิ์'],
      [[340, -533], 'ถนนราชนิกูล'],
      [[5, -545], 'ถนนราชดำเนิน'],
      [[-17, -182], 'ถนนราชดำเนิน'],
    ],
  },
};

const trackSummaries = {};
for (const [key, def] of Object.entries(TRACKS)) {
  const ids = def.via.map(([xy, name]) => snap(xy, name));
  const banned = new Set();
  const steps = [];
  for (let i = 0; i < ids.length; i++) {
    const seg = route(ids[i], ids[(i + 1) % ids.length], banned);
    for (const s of seg) banned.add(edgeKey(s.from, s.node)); // no re-using an edge in the loop
    steps.push(...seg);
  }
  const pts = [nodePos.get(ids[0]), ...steps.map((s) => nodePos.get(s.node))];
  const length = polyLen(pts);
  // Road sequence with per-road length and one-way conflicts
  const seq = [];
  let againstOneway = 0;
  for (const s of steps) {
    const wrong = s.e.oneway !== 0 && ((s.e.oneway === 1) !== s.e.fwd);
    if (wrong) againstOneway += s.e.d;
    const last = seq.at(-1);
    if (last && last.name === s.e.name) { last.length_m += s.e.d; continue; }
    seq.push({ name: s.e.name, highway: s.e.highway, lanes: s.e.lanes ?? null, length_m: s.e.d });
  }
  seq.forEach((r) => (r.length_m = Math.round(r.length_m)));
  const cs = corners(pts.slice(0, -1));
  // Revisits of the same node = crossings / overlaps (loop should be simple)
  const visits = new Map();
  steps.forEach((s) => visits.set(s.node, (visits.get(s.node) ?? 0) + 1));
  const crossings = [...visits.values()].filter((v) => v > 1).length;
  trackSummaries[key] = {
    title: def.title,
    length_m: Math.round(length),
    corners: cs.length,
    corners_ge_70: cs.filter((c) => c.angle >= 70).length,
    corner_list: cs,
    against_oneway_m: Math.round(againstOneway),
    self_crossings: crossings,
    closed: ids[0] === steps.at(-1).node,
    sequence: seq,
  };
  const coords = pts.map(([x, y]) => toLL(x, y).map((v) => Math.round(v * 1e7) / 1e7));
  await writeFile(join(OUT, `track-${key}.geojson`), JSON.stringify({
    type: 'FeatureCollection',
    attribution: '© OpenStreetMap contributors (ODbL)',
    features: [
      { type: 'Feature', properties: { track: key, title: def.title, length_m: Math.round(length), corners: cs.length, roads: seq.map((r) => r.name), start: 'หน้าอนุสาวรีย์ท้าวสุรนารี ถนนราชดำเนิน', osm_nodes: [ids[0], ...steps.map((s) => s.node)] }, geometry: { type: 'LineString', coordinates: coords } },
      { type: 'Feature', properties: { track: key, role: 'start_finish' }, geometry: { type: 'Point', coordinates: coords[0] } },
    ],
  }, null, 0));
}

const stats = {
  attribution: '© OpenStreetMap contributors (ODbL)',
  fetched_at: raw.query?.fetched_at,
  osm_base: raw.osm3s?.timestamp_osm_base,
  bbox,
  origin: { ...ORIGIN, source: `way/${monument.id}`, note: 'centroid of monument polygon; x=east, y=north in metres' },
  road_tag_coverage_pct: roadTagCoverage,
  roads,
  buildings: bStats,
  tracks: trackSummaries,
};
await writeFile(join(OUT, 'stats.json'), JSON.stringify(stats, null, 2));
console.log(JSON.stringify({ origin: stats.origin, coverage: roadTagCoverage, buildings: { ...bStats, tall: bStats.tall.length }, tracks: Object.fromEntries(Object.entries(trackSummaries).map(([k, v]) => [k, { len: v.length_m, corners: v.corners, c70: v.corners_ge_70, wrong: v.against_oneway_m, x: v.self_crossings, closed: v.closed, seq: v.sequence.map((s) => `${s.name}:${s.length_m}`).join(' > ') }])) }, null, 2));
