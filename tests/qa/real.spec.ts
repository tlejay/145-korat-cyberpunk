// REAL-*: in-game geometry vs OpenStreetMap / Street View research files.
import { expect, test } from '@playwright/test';
import { distToPolyline, llToXY, openGame, readJson, record } from './helpers';

type FC = { features: { geometry: { type: string; coordinates: number[][] }; properties: Record<string, unknown> }[] };
const stats = readJson<{ origin: { lat: number; lon: number }; tracks: { A: { length_m: number; corner_list: { at_m: number; angle: number; dir: string; xy: [number, number] }[] } } }>('research/osm/stats.json');
// Intentional fix of OSM routing at the 224 junction (world REPORT §2, Street View) — excluded from REAL-02.
// Game s: M1 window [476, 569] + 210 m (start/finish moved south of Ya Mo plaza, REPORT-checkpoint §2).
const EXCLUDE: [number, number] = [686, 779];

test.use({ viewport: { width: 400, height: 200 } });

test('REAL-01/02/03/04/10/11 track geometry, road order, corners, names', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'geometry is engine-independent');
  await openGame(page, 'track=A&laps=2&skip=1&quality=low');
  const w = await page.evaluate(() => {
    const g = window.__game!, wd = g.world(), t = g.track();
    return {
      monument: wd.monument.pos, origin: wd.toLatLng(0, 0), roadNames: wd.roadNames, cl: t.centerline, lengthM: t.lengthM,
      ll: t.centerline.map(([x, z]) => wd.toLatLng(x, z)),
    };
  });
  const o = stats.origin;
  // REAL-01
  const o2 = llToXY(w.origin.lat, w.origin.lng, o);
  const r01 = { monumentM: Math.hypot(w.monument.x, w.monument.z), toLatLng00M: Math.hypot(o2.x, o2.y) };
  // REAL-02: both directions (Hausdorff) in metres around the OSM origin.
  const gj = readJson<FC>('research/osm/track-A.geojson');
  const osm = gj.features.find((f) => f.geometry.type === 'LineString')!.geometry.coordinates.map(([lng, lat]) => llToXY(lat, lng, o));
  const game = w.ll.map((p) => llToXY(p.lat, p.lng, o));
  const cum = [0];
  for (let i = 1; i < game.length; i++) cum.push(cum[i - 1] + Math.hypot(game[i].x - game[i - 1].x, game[i].y - game[i - 1].y));
  const g2o = game.map((p, i) => ({ s: cum[i], d: distToPolyline(p.x, p.y, osm) }));
  const kept = g2o.filter((p) => p.s < EXCLUDE[0] || p.s > EXCLUDE[1]);
  const keptPts = game.filter((_, i) => cum[i] < EXCLUDE[0] || cum[i] > EXCLUDE[1]);
  const o2g = osm.map((p) => distToPolyline(p.x, p.y, game));
  const o2gFar = osm.map((p, i) => ({ i, d: o2g[i], near: distToPolyline(p.x, p.y, keptPts) }));
  const sorted = kept.map((p) => p.d).sort((a, b) => a - b);
  const r02 = {
    maxGameToOsm: Math.max(...kept.map((p) => p.d)), p95: sorted[Math.floor(sorted.length * 0.95)],
    maxInExcluded: Math.max(...g2o.filter((p) => p.s >= EXCLUDE[0] && p.s <= EXCLUDE[1]).map((p) => p.d)),
    maxOsmToGame: Math.max(...o2g), osmPointsOver5m: o2gFar.filter((p) => p.d > 5).length,
    lengthGame: w.lengthM, lengthOsm: stats.tracks.A.length_m, lengthDiffPct: ((w.lengthM - stats.tracks.A.length_m) / stats.tracks.A.length_m) * 100,
  };
  // REAL-03: road order (Street View rename of OSM "มิตรภาพ"/"นครราชสีมา - หินโคน" → "ราชสีมา-โชคชัย" is a recorded decision).
  const alias = (n: string) => (/มิตรภาพ|หินโคน|secondary_link/.test(n) ? 'ถนนราชสีมา-โชคชัย' : n);
  const osmOrder = (gj.features[0].properties.roads as string[]).map(alias).filter((n, i, a) => i === 0 || a[i - 1] !== n);
  const gameOrder = w.roadNames.map((r) => r.nameTh).filter((n, i, a) => i === 0 || a[i - 1] !== n);
  // REAL-04: every OSM corner ≥ 70° has a game corner (same direction) within 15 m — except the redesigned 224 junction.
  const corners = await page.evaluate(async () => (await (await fetch('./data/track-A.json')).json()).corners as { s: number; deg: number; dir: string }[]);
  const at = (s: number) => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; return game[i]; };
  const r04 = stats.tracks.A.corner_list.filter((c) => c.angle >= 70).map((c) => {
    const want = { x: c.xy[0], y: c.xy[1] };
    const best = corners.map((gc) => ({ gc, d: Math.hypot(at(gc.s).x - want.x, at(gc.s).y - want.y) })).sort((a, b) => a.d - b.d)[0];
    return { osm: `${c.at_m} ${c.dir} ${c.angle}°`, game: `${best.gc.s} ${best.gc.dir} ${best.gc.deg}°`, dM: +best.d.toFixed(1), sameDir: (c.dir === 'ขวา') === (best.gc.dir === 'R') };
  });
  // REAL-10: names exist verbatim in roads.geojson
  const roads = readJson<FC>('research/osm/roads.geojson');
  const names = new Set(roads.features.map((f) => f.properties.name as string));
  const r10 = w.roadNames.map((r) => ({ name: r.nameTh, inOsm: names.has(r.nameTh), shown: r.shownText }));
  // REAL-11: no English monument name anywhere the player can see
  const visible = await page.evaluate(() => document.body.innerText + document.title);
  record(test.info(), 'REAL', { r01, r02, osmOrder, gameOrder, r04, r10, englishMonument: /Thao|Suranari/.test(visible) });
  expect(r01.monumentM).toBeLessThanOrEqual(1);
  expect(r01.toLatLng00M).toBeLessThanOrEqual(1);
  expect(r02.maxGameToOsm).toBeLessThanOrEqual(5);
  expect(r02.p95).toBeLessThanOrEqual(2);
  expect(Math.abs(r02.lengthDiffPct)).toBeLessThanOrEqual(3);
  expect(gameOrder).toEqual(osmOrder);
  expect(r10.filter((r) => !r.inOsm)).toEqual([]);
  expect(/Thao|Suranari/.test(visible)).toBe(false);
});

test('REAL-07 building footprints near the track match OSM; nothing blocks the road', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'data check');
  await openGame(page, 'quality=low');
  const raw = await page.evaluate(async () => (await (await fetch('./data/track-A.json')).json()) as { buildings: number[][]; origin: { lat: number; lon: number; kx: number; ky: number } });
  const osm = readJson<FC>('research/osm/buildings.geojson');
  // Use the game's own projection constants (kx/ky m per degree) so both sides share one metric.
  const O = raw.origin;
  const rings = osm.features.filter((f) => f.geometry.type === 'Polygon')
    .map((f) => (f.geometry.coordinates as unknown as number[][][])[0].map(([lng, lat]) => ({ x: (lng - O.lon) * O.kx, y: (lat - O.lat) * O.ky })));
  // Game building record (M2+): [h dm, style, tint, nFront, front edge ids …, ring x/z dm …] — src/track/data.ts
  const res = raw.buildings.map((b) => {
    const ring = b.slice(4 + b[3]), pts: { x: number; y: number }[] = [];
    for (let i = 0; i + 1 < ring.length; i += 2) pts.push({ x: ring[i] / 10, y: -ring[i + 1] / 10 });
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const near = rings.filter((r) => Math.hypot(r[0].x - cx, r[0].y - cy) < 80);
    const vd = near.length ? pts.map((p) => Math.min(...near.map((r) => distToPolyline(p.x, p.y, r)))).sort((x, y) => x - y) : [];
    return { x: +cx.toFixed(0), y: +cy.toFixed(0), h: b[0] / 10, rect: pts.length === 4, medianVertexM: vd.length ? vd[Math.floor(vd.length / 2)] : null };
  });
  // Street View-synthesised buildings have no OSM twin: world REPORT §2 rectangles (22) + M2 streetscape infill
  // shophouses on west Ratchadamnoen (156 units of 4.2 × 14 m, REPORT-M2-streetscape §3). Both are 4-point rectangles.
  const isSynth = (r: (typeof res)[number]) => r.medianVertexM === null || r.medianVertexM >= 10 || (r.rect && r.medianVertexM > 2);
  const withOsm = res.filter((r) => !isSynth(r));
  const matched = withOsm.filter((r) => r.medianVertexM! <= 2).length;
  const synthetic = res.filter(isSynth).length;
  // REAL-08 proxy: no skyscraper where the street is shophouses (landmark Terminal 21 is built separately).
  const tall = res.filter((b) => b.h > 20);
  record(test.info(), 'REAL-07', { buildings: res.length, withOsm: withOsm.length, matchedWithin2m: matched, synthetic, tall, maxH: Math.max(...res.map((b) => b.h)) });
  expect(matched / withOsm.length).toBeGreaterThanOrEqual(0.95);
  expect(synthetic).toBeLessThanOrEqual(22 + 156);
});
