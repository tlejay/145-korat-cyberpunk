// M3 checks (docs/qa/BRIEF-qa-m3.md): VIS-04 flashing (neon, sponsor LED, checkpoint lights, turn chevrons),
// nothing decorative inside Ya Mo plaza / gates / temples / shrines, checkpoint jump-over + smash-through,
// turn-warning HUD before every corner, draw calls / triangles / GPU texture memory per quality tier,
// and full autopilot laps at low / medium / high. Chromium only (engine-independent, SwiftShader).
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { IMG_DIR, ROOT, expectClean, readJson, record, seedSettings, watch } from './helpers';

test.describe.configure({ mode: 'parallel' });
test.skip(({ browserName }) => browserName !== 'chromium', 'scene inspection + SwiftShader captures run once on Chromium');

const SACRED_IDS = /yamo-plaza|thao-suranari-monument|chumphon-gate|chai-narong-gate|phon-saen-gate|gate-lawn|lan-lang-pratu-mueang|city-pillar-shrine|heroes-memorial|light-sound-pavilion|^wat-|sanchao/;
// Game-coord sacred spots without their own polygon in research/landmarks/footprints.geojson
// (values from src/track/landmarks/sites.ts — OSM way ids there):
const EXTRA_ZONES = [
  // NW-corner replica city gate + royal-portrait garden, way/549397539 (OSM.nwGate in sites.ts, game metres)
  { id: 'nw-replica-gate (way/549397539)', cx: -33.5, cz: -520.5, r: 15 },
  // Wat Sutthachinda east gate structure (sutthachinda-lit mesh x −17.8..−16.2, z 466..473) + its hall way/1228205994
  { id: 'wat-sutthachinda east gate', cx: -17, cz: 469.5, r: 8 },
  { id: 'wat-sutthachinda hall (way/1228205994)', cx: -46, cz: 504.5, r: 14 },
];

async function open(page: Page, q: 'low' | 'medium' | 'high', extra = '') {
  await seedSettings(page);
  await page.goto(`./?qa=1&track=A&laps=1&skip=1&quality=${q}${extra}`);
  await page.waitForFunction(() => window.__game?.state() === 'racing', null, { timeout: 60_000 });
}

// ── M3-ZONE ──────────────────────────────────────────────────────────────────────────────────────
test('M3-ZONE no neon / sponsor / turn sign / checkpoint geometry inside Ya Mo plaza, gates, temples, shrines', async ({ page }, info) => {
  test.setTimeout(180_000);
  const w = watch(page);
  const fc = readJson<{ features: { properties: { landmark_id: string }; geometry: { type: string; coordinates: number[][][] } }[] }>('research/landmarks/footprints.geojson');
  const zones = fc.features.filter((f) => SACRED_IDS.test(f.properties.landmark_id) && f.geometry.type === 'Polygon')
    .map((f) => ({ id: f.properties.landmark_id, ring: f.geometry.coordinates[0] }));
  const res: Record<string, unknown> = {};
  for (const q of ['high', 'low'] as const) {
    await open(page, q);
    res[q] = await page.evaluate(({ zones, extra }) => {
      const g = window.__game!;
      const polys = zones.map((z) => ({ id: z.id, pts: z.ring.map(([lng, lat]) => g.world().fromLatLng(lat, lng)) }));
      const inPoly = (x: number, z: number, p: { x: number; z: number }[]) => {
        let ins = false;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
          const a = p[i], b = p[j];
          if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) ins = !ins;
        }
        return ins;
      };
      const segD = (x: number, z: number, p: { x: number; z: number }[]) => {
        let best = Infinity;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
          const a = p[j], b = p[i], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
          const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
          best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
        }
        return inPoly(x, z, p) ? -best : best;
      };
      const plaza = polys.find((p) => p.id === 'yamo-plaza')!.pts;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scene = (window as any).__visualsScene;
      const cat = (n: string) => (/^neon-\d+$/.test(n) ? 'neon-street' : /^neon-/.test(n) ? 'neon-m3' : /^sponsor-/.test(n) ? 'sponsor' : /^wayfinding-/.test(n) ? 'wayfinding' : /^checkpoint-/.test(n) ? 'checkpoint' : null);
      const hits: { cat: string; mesh: string; zone: string; x: number; z: number; hex: string }[] = [];
      const minPlaza: Record<string, number> = {}, verts: Record<string, number> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scene.updateMatrixWorld(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scene.traverse((o: any) => {
        const c = o.isMesh ? cat(o.name) : null;
        const pos = c ? o.geometry?.attributes?.position : null;
        if (!c || !pos) return;
        const M = o.matrixWorld.clone(), I = o.isInstancedMesh ? o.count : 1, tmp = M.clone();
        const v = pos.array, n = pos.count, e = new Float32Array(16);
        for (let k = 0; k < I; k++) {
          if (o.isInstancedMesh) { o.getMatrixAt(k, tmp); tmp.premultiply(M); } else tmp.copy(M);
          tmp.toArray(e);
          for (let i = 0; i < n; i += 1) {
            const lx = v[i * 3], ly = v[i * 3 + 1], lz = v[i * 3 + 2];
            const x = e[0] * lx + e[4] * ly + e[8] * lz + e[12], z = e[2] * lx + e[6] * ly + e[10] * lz + e[14];
            verts[c] = (verts[c] ?? 0) + 1;
            const dp = segD(x, z, plaza);
            minPlaza[c] = Math.min(minPlaza[c] ?? Infinity, dp);
            // The per-chunk "neon-N" bucket holds every emissive bit (street lamps, signals, the plaza's warm footlights,
            // rail edge lines). Only saturated non-warm colours (pink / cyan / purple / green / blue) count as neon there.
            let hex = '';
            if (c === 'neon-street') {
              const ca = o.geometry.attributes.color;
              if (ca) {
                const r = ca.getX(i), gg = ca.getY(i), bb = ca.getZ(i), mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
                const sat = mx ? (mx - mn) / mx : 0;
                let h = 0;
                if (mx !== mn) h = mx === r ? ((gg - bb) / (mx - mn)) * 60 : mx === gg ? (2 + (bb - r) / (mx - mn)) * 60 : (4 + (r - gg) / (mx - mn)) * 60;
                h = (h + 360) % 360;
                hex = [r, gg, bb].map((u) => Math.round(Math.min(1, u) * 255).toString(16).padStart(2, '0')).join('');
                if (sat < 0.45 || (h >= 10 && h <= 65) || mx < 0.25) continue; // white / amber / sodium / warm / dim rail trim = not neon
              }
            }
            for (const p of polys) if (inPoly(x, z, p.pts)) { if (hits.length < 4000) hits.push({ cat: c, mesh: o.name, zone: p.id, x: +x.toFixed(1), z: +z.toFixed(1), hex }); }
            for (const ez of extra) if (Math.hypot(x - ez.cx, z - ez.cz) < ez.r) { if (hits.length < 4000) hits.push({ cat: c, mesh: o.name, zone: ez.id, x: +x.toFixed(1), z: +z.toFixed(1), hex }); }
          }
        }
      });
      const byZone: Record<string, number> = {};
      for (const h of hits) { const k = `${h.cat}:${h.mesh}${h.hex ? '#' + h.hex : ''}@${h.zone}`; byZone[k] = (byZone[k] ?? 0) + 1; }
      // the checkpoint/sponsor/wayfinding hooks report their own placements too
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const W = window as any;
      const placed = [
        ...(W.__sponsors?.stats.placements ?? []).map((p: { kind: string; x: number; z: number }) => ({ k: `sponsor:${p.kind}`, x: p.x, z: p.z })),
        ...(W.__wayfinding?.stats.signs ?? []).map((p: { kind: string; x: number; z: number }) => ({ k: `wayfinding:${p.kind}`, x: p.x, z: p.z })),
      ].map((p) => ({ ...p, plazaM: +segD(p.x, p.z, plaza).toFixed(1) }));
      const closest = placed.sort((a, b) => a.plazaM - b.plazaM).slice(0, 5);
      const nearWatGate = placed.map((p) => ({ k: p.k, x: p.x, z: p.z, gateM: +Math.hypot(p.x + 17, p.z - 469.5).toFixed(1) })).sort((a, b) => a.gateM - b.gateM).slice(0, 4);
      return { verts, minPlazaM: Object.fromEntries(Object.entries(minPlaza).map(([k, v]) => [k, +v.toFixed(1)])), byZone, sample: Object.values(Object.fromEntries(hits.map((h) => [`${h.mesh}${h.hex}@${h.zone}`, h]))), closestPlacements: closest, nearWatSutthachindaGate: nearWatGate, zones: polys.map((p) => p.id) };
    }, { zones, extra: EXTRA_ZONES });
  }
  record(info, 'M3-ZONE', res);
  for (const q of ['high', 'low']) expect((res[q] as { byZone: object }).byZone, `${q}: decorative geometry inside a sacred zone`).toEqual({});
  expectClean(w);
});

// ── VIS-04 ───────────────────────────────────────────────────────────────────────────────────────
// Frozen virtual clock: performance.now() and rAF are paused, the game is advanced with qa.step(1) at
// a fixed 1/30 s, and each frame is captured. Every element that animates (neon dt-clock, checkpoint dt,
// sponsor + chevron performance.now) therefore runs at exactly the sampled time — no aliasing.
const FREEZE = () => {
  const realNow = performance.now.bind(performance);
  const realRaf = window.requestAnimationFrame.bind(window);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const W = window as any;
  W.__vclock = null; W.__rafFrozen = false; W.__rafQ = [];
  performance.now = () => (W.__vclock != null ? W.__vclock : realNow());
  window.requestAnimationFrame = (cb) => realRaf((t) => { if (W.__rafFrozen) W.__rafQ.push(cb); else cb(t); });
};

interface FlashScene { id: string; s: number; lateral?: number; settings?: Record<string, unknown> }

async function flashScene(page: Page, sc: FlashScene, seconds = 3, hz = 30) {
  await page.evaluate(async ({ s, lateral }) => {
    const g = window.__game!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const W = window as any;
    W.__visuals?.setRain(false); g.qa.setWeather({ rain: 0 });
    g.qa.fixedStep(true, 1000 / 30);
    W.__drv.place(s, lateral ?? 0);
    g.qa.clearInput();
    W.__vclock = performance.now(); W.__rafFrozen = true;
    for (let i = 0; i < 45; i++) await g.qa.step(1); // let the chase camera settle (1.5 s)
  }, { s: sc.s, lateral: sc.lateral });
  // Per-pixel analysis in the page (stricter than WCAG, which only counts flashes over ~25 % of 10° of view):
  // WCAG 2.x general flash = a pair of opposing changes in relative luminance ≥ 0.10 where the darker state < 0.80.
  // Each pixel tracks its last extreme with 0.10 hysteresis; flashes = opposing transitions / 2. The HUD bands
  // The HTML HUD (#ui: timer, speed digits, buttons, turn banner) is hidden during capture so only the 3D scene counts.
  await page.evaluate(() => { (window as unknown as { __fl: unknown }).__fl = null; const ui = document.getElementById('ui'); if (ui) ui.style.visibility = 'hidden'; });
  for (let k = 0; k < seconds * hz; k++) {
    await page.evaluate(async (dt) => { (window as unknown as { __vclock: number }).__vclock += dt; await window.__game!.qa.step(1); }, 1000 / hz);
    const b64 = (await page.screenshot({ scale: 'css' })).toString('base64');
    if (k === 0) { fs.mkdirSync(IMG_DIR, { recursive: true }); fs.writeFileSync(path.join(IMG_DIR, `m3-vis04-${sc.id}.png`), Buffer.from(b64, 'base64')); }
    await page.evaluate(async (src) => {
      const img = new Image(); img.src = `data:image/png;base64,${src}`; await img.decode();
      const W = img.width, H = img.height;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d')!; x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, W, H).data;
      const lut = new Float32Array(256); for (let i = 0; i < 256; i++) { const v = i / 255; lut[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Wn = window as any;
      const y0 = 0, y1 = H, x1 = W;
      if (!Wn.__fl) { const n = W * H; Wn.__fl = { W, H, first: new Float32Array(n).fill(-1), ext: new Float32Array(n).fill(-1), dir: new Int8Array(n), ch: new Uint16Array(n), maxDelta: 0, maxAt: 0 }; }
      const f = Wn.__fl;
      for (let y = y0; y < y1; y++) for (let xx = 0; xx < x1; xx++) {
        const p = y * W + xx, o = p * 4;
        const L = 0.2126 * lut[d[o]] + 0.7152 * lut[d[o + 1]] + 0.0722 * lut[d[o + 2]];
        if (f.first[p] < 0) { f.first[p] = L; f.ext[p] = L; continue; }
        const dl = Math.abs(L - f.first[p]);
        if (dl > f.maxDelta) { f.maxDelta = dl; f.maxAt = p; }
        // dir 0 = no direction yet: ext stays at the first value until L moves ≥ 0.10 away from it.
        // dir +1 = rising: ext follows the peak, a drop ≥ 0.10 from it is a change; dir −1 mirrors that.
        const dr = f.dir[p];
        if (dr === 1 && L > f.ext[p]) f.ext[p] = L;
        if (dr === -1 && L < f.ext[p]) f.ext[p] = L;
        const ee = f.ext[p];
        if (dr !== -1 && ee - L >= 0.1 && Math.min(ee, L) < 0.8) { f.ch[p]++; f.dir[p] = -1; f.ext[p] = L; }
        else if (dr !== 1 && L - ee >= 0.1 && Math.min(ee, L) < 0.8) { f.ch[p]++; f.dir[p] = 1; f.ext[p] = L; }
      }
    }, b64);
  }
  const worst = await page.evaluate((secs) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = (window as any).__fl;
    let best = 0, at = 0, flashingPx = 0, changedPx = 0;
    for (let p = 0; p < f.ch.length; p++) { if (f.ch[p] > best) { best = f.ch[p]; at = p; } if (f.ch[p] / 2 / secs > 3) flashingPx++; if (f.ch[p]) changedPx++; }
    return { flashesPerS: +(best / 2 / secs).toFixed(2), px: [at % f.W, Math.floor(at / f.W)], pxOver3PerS: flashingPx, pxWithAnyFlash: changedPx, maxDelta: +f.maxDelta.toFixed(3), maxDeltaPx: [f.maxAt % f.W, Math.floor(f.maxAt / f.W)] };
  }, seconds);
  await page.evaluate(() => { const W = window as unknown as { __vclock: number | null; __rafFrozen: boolean; __rafQ: FrameRequestCallback[] }; W.__vclock = null; W.__rafFrozen = false; const ui = document.getElementById('ui'); if (ui) ui.style.visibility = ''; const q = W.__rafQ.splice(0); q.forEach((cb) => requestAnimationFrame(cb)); window.__game!.qa.fixedStep(false); });
  return worst;
}

test('VIS-04 flashing ≤ 3 /s: checkpoint lights, turn chevrons, sponsor LED, neon streets (frozen clock, 30 Hz capture)', async ({ page }, info) => {
  test.setTimeout(900_000);
  const w = watch(page);
  await page.addInitScript(FREEZE);
  await open(page, 'high');
  await page.addScriptTag({ path: path.join(ROOT, 'tests/qa/driver.js') });
  const meta = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const W = window as any;
    const d = W.__drv;
    return {
      turns: (W.__wayfinding?.stats.turns ?? []).map((t: { id: number; s0: number; severity: number; dir: string }) => ({ id: t.id, s0: t.s0, sev: t.severity, dir: t.dir })),
      cp1: d.nearestS(-49.5, -245), cp2: d.nearestS(550, -151.3), L: d.L,
    };
  });
  const sev3 = meta.turns.find((t: { sev: number }) => t.sev === 3) ?? meta.turns[0];
  const t224 = meta.turns[0];
  const scenes: FlashScene[] = [
    { id: 'checkpoint-1', s: meta.cp1 - 22 },
    { id: 'checkpoint-2', s: meta.cp2 - 22 },
    { id: `chevrons-turn${sev3.id}-sev${sev3.sev}`, s: sev3.s0 - 30 },
    { id: `chevrons-turn${t224.id}`, s: t224.s0 - 30 },
    { id: 'chevrons-turn5-wat-sutthachinda', s: (meta.turns[5] ?? t224).s0 - 30 },
    { id: 'sponsors-start-straight', s: 25 },
    { id: 'neon-street-1500', s: 1500 },
    { id: 'neon-street-2300', s: 2300 },
  ];
  const out: Record<string, unknown> = { scenes: {} };
  for (const sc of scenes) (out.scenes as Record<string, unknown>)[sc.id] = { s: Math.round(sc.s), ...(await flashScene(page, sc)) };
  // "ลดแสงกะพริบ" setting: the chevrons must hold steady (wayfinding uChase = 0, neon flicker off).
  await page.evaluate(() => { try { const s = JSON.parse(localStorage.getItem('settings.v1') ?? '{}'); localStorage.setItem('settings.v1', JSON.stringify({ ...s, reduceFlicker: true })); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => window.__game?.state() === 'racing', null, { timeout: 60_000 });
  await page.addScriptTag({ path: path.join(ROOT, 'tests/qa/driver.js') });
  out.reduceFlicker = await flashScene(page, { id: `reduce-flicker-turn${sev3.id}`, s: sev3.s0 - 30 });
  record(info, 'VIS-04', out);
  const sc = out.scenes as Record<string, { flashesPerS: number; maxDelta: number; pxWithAnyFlash: number; pxOver3PerS: number }>;
  // Gate on area: WCAG only counts flashes over ~25 % of 10° of view; we are far stricter — at most 0.1 % of the
  // frame (≈ 330 px at 844×390) may exceed 3 flashes/s. Single anti-aliased edge pixels of swinging signs don't count.
  const areaPx = 0.001 * 844 * 390;
  for (const [id, r] of Object.entries(sc)) expect(r.pxOver3PerS, `VIS-04 ${id}: pixels flashing > 3/s`).toBeLessThanOrEqual(areaPx);
  // positive control: the checkpoint light bars and the running chevrons must be seen changing, else the capture is blind
  for (const id of Object.keys(sc).filter((k) => /checkpoint|chevrons/.test(k))) expect(sc[id].pxWithAnyFlash, `${id}: capture saw no change at all`).toBeGreaterThan(0);
  expect((out.reduceFlicker as { pxOver3PerS: number }).pxOver3PerS, 'reduce-flicker setting').toBeLessThanOrEqual(areaPx);
  out.reduceFlickerNote = 'compare pxWithAnyFlash with the same turn in scenes (chevrons should go steady)';
  expectClean(w);
});

// ── Checkpoint ───────────────────────────────────────────────────────────────────────────────────
test('M3-CP checkpoint: jump on the cue clears it · smashing through never sticks or stops the car', async ({ page }, info) => {
  test.setTimeout(300_000);
  const w = watch(page);
  await open(page, 'low');
  await page.addScriptTag({ path: path.join(ROOT, 'tests/qa/driver.js') });
  const r = await page.evaluate(async () => {
    const g = window.__game!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (window as any).__drv;
    g.qa.fixedStep(true, 1000 / 60);
    const ev: { type: string; [k: string]: unknown }[] = [];
    g.on('roadblock' as never, (e: unknown) => ev.push(JSON.parse(JSON.stringify(e))));
    const runs: unknown[] = [];
    for (const [site, x, z] of [['ratchadamnoen', -49.5, -245], ['manat', 550, -151.3]] as const) {
      const sSite = d.nearestS(x, z);
      for (const mode of ['jump', 'smash'] as const) for (const kmh of mode === 'jump' ? [100, 160] : [80, 160]) {
        await g.qa.start('A', { laps: 1, skipCountdown: true }); g.qa.fixedStep(true, 1000 / 60);
        ev.length = 0;
        const start = d.place(sSite - 160);
        g.qa.teleport(start.x, start.z, start.h, kmh);
        let jumped = false, minSpeedAfter = Infinity, maxStuck = 0, t = 0, passed = false;
        const respawn0 = g.world().respawnCount;
        while (t < 12) {
          const c = g.car();
          const pr = d.nearestS(c.pos.x, c.pos.z, sSite);
          const a = d.at(pr + 25);
          const cue = ev.filter((e) => e.type === 'cue').pop();
          const jump = mode === 'jump' && !jumped && cue?.jump === 'now';
          if (jump) jumped = true;
          g.qa.setInput({ throttle: d.speedCtl(c, kmh).throttle ?? 0, brake: d.speedCtl(c, kmh).brake ?? 0, steer: d.steerTo(c, d.headingTo(c.pos.x, c.pos.z, a.x, a.z)), jump });
          await g.qa.step(1); t += 1 / 60;
          maxStuck = Math.max(maxStuck, g.car().stuckMs);
          if (pr > sSite + 15) { passed = true; minSpeedAfter = Math.min(minSpeedAfter, g.car().speedKmh); }
          if (pr > sSite + 60) break;
        }
        g.qa.clearInput();
        const types = ev.map((e) => e.type);
        runs.push({ site, mode, kmh, passed, jumped, clear: types.includes('clear'), smash: types.includes('smash'), hits: types.filter((x) => x === 'hit').length,
          lossPct: (ev.find((e) => e.type === 'smash') as { lossPct?: number } | undefined)?.lossPct ?? null,
          minClearanceM: (ev.find((e) => e.type === 'clear') as { minClearanceM?: number } | undefined)?.minClearanceM ?? null,
          minSpeedAfterKmh: Math.round(minSpeedAfter), maxStuckMs: maxStuck, respawns: g.world().respawnCount - respawn0, simS: +t.toFixed(2),
          cues: [...new Set(ev.filter((e) => e.type === 'cue').map((e) => e.jump))] });
      }
    }
    return runs;
  });
  record(info, 'M3-CP', r);
  for (const run of r as { site: string; mode: string; kmh: number; passed: boolean; clear: boolean; smash: boolean; hits: number; minSpeedAfterKmh: number; maxStuckMs: number; respawns: number }[]) {
    const id = `${run.site} ${run.mode} @${run.kmh}`;
    expect(run.passed, `${id}: car got past the checkpoint`).toBe(true);
    expect(run.maxStuckMs, `${id}: stuck`).toBeLessThan(2000);
    expect(run.respawns, `${id}: respawned`).toBe(0);
    if (run.mode === 'jump') { expect(run.clear, `${id}: clear event`).toBe(true); expect(run.hits, `${id}: hit props while jumping`).toBe(0); }
    else { expect(run.smash || run.hits > 0, `${id}: smash registered`).toBe(true); expect(run.minSpeedAfterKmh, `${id}: kept ≥ 60 % speed`).toBeGreaterThanOrEqual(run.kmh * 0.6); }
  }
  expectClean(w);
});

// ── Autopilot laps per tier: budgets, GPU textures, turn HUD, no stuck / fall / errors ──────────────
for (const q of ['low', 'medium', 'high'] as const) {
  test(`M3-LAP ${q}: autopilot full lap — draw calls / tris / GPU textures, turn HUD before every corner, no stuck / fall / console error`, async ({ page }, info) => {
    test.setTimeout(900_000);
    const w = watch(page);
    await open(page, q);
    const r = await page.evaluate(async () => {
      const g = window.__game!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const W = window as any;
      g.qa.fixedStep(true, 1000 / 60); g.qa.autopilot(true);
      const turns = (W.__wayfinding?.stats.turns ?? []) as { id: number; s0: number; dir: string; severity: number }[];
      const firstSeen: Record<number, number | null> = Object.fromEntries(turns.map((t) => [t.id, null]));
      const rb: string[] = []; g.on('roadblock' as never, (e: unknown) => rb.push((e as { type: string }).type));
      const hud = document.querySelector('[data-qa=hud-turn-warn]') as HTMLElement | null;
      let maxDc = 0, maxTri = 0, maxStuck = 0, minY = Infinity, steps = 0, inside = 0, offTrackMaxM = 0, wrongWay = 0;
      const t0 = performance.now();
      while (g.state() === 'racing' && steps < 60 * 240) {
        await g.qa.step(2); steps += 2;
        const s = g.stats(), c = g.car(), tr = g.track();
        maxDc = Math.max(maxDc, s.drawCalls); maxTri = Math.max(maxTri, s.triangles);
        maxStuck = Math.max(maxStuck, c.stuckMs); minY = Math.min(minY, c.pos.y);
        offTrackMaxM = Math.max(offTrackMaxM, tr.distanceFromCenterlineM);
        if (g.camera().insideMesh) inside++;
        if (hud && hud.classList.contains('show') && hud.offsetParent !== null) {
          const pm = tr.progressM;
          for (const t of turns) if (firstSeen[t.id] === null && pm < t.s0 && t.s0 - pm < 400) firstSeen[t.id] = +(t.s0 - pm).toFixed(1);
        }
        if (steps % 600 === 0) await new Promise((res) => setTimeout(res, 0));
      }
      g.qa.autopilot(false);
      // GPU texture estimate: every texture reachable from the scene (materials, uniforms, background).
      const seen = new Set<unknown>(); let bytes = 0; const list: { name: string; w: number; h: number; mb: number }[] = [];
      const add = (t: { isTexture?: boolean; image?: { width?: number; height?: number; data?: unknown }; generateMipmaps?: boolean; minFilter?: number; name?: string; source?: { data?: { width?: number; height?: number; src?: string } } } | null | undefined) => {
        if (!t || !t.isTexture || seen.has(t)) return; seen.add(t);
        const img = t.image ?? t.source?.data; const wd = img?.width ?? 0, ht = img?.height ?? 0;
        const mip = t.generateMipmaps && t.minFilter !== 1006 && t.minFilter !== 1003 ? 4 / 3 : 1; // not Linear/Nearest
        const b = wd * ht * 4 * mip; bytes += b;
        list.push({ name: t.name || ((img as { src?: string })?.src ?? '').split('/').pop() || `${wd}x${ht}`, w: wd, h: ht, mb: +(b / 1048576).toFixed(2) });
      };
      const scene = W.__visualsScene;
      add(scene.background); add(scene.environment);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scene.traverse((o: any) => {
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          for (const k of Object.keys(m)) add(m[k]);
          for (const u of Object.values(m.uniforms ?? {}) as { value: unknown }[]) add(u?.value as never);
        }
      });
      const rt = g.stats();
      return {
        state: g.state(), steps, wallS: +((performance.now() - t0) / 1000).toFixed(1), lapMs: g.track().lapTimesMs[0] ?? null,
        maxDc, maxTri, maxStuck, minY: +minY.toFixed(2), insideFrames: inside, offTrackMaxM: +offTrackMaxM.toFixed(1),
        respawns: g.world().respawnCount, outOfBounds: g.world().outOfBoundsCount, wrongWay,
        roadblock: rb.reduce((a, t) => ({ ...a, [t]: (a[t] ?? 0) + 1 }), {} as Record<string, number>),
        turns: turns.map((t) => ({ id: t.id, dir: t.dir, sev: t.severity, s0: Math.round(t.s0), hudFirstSeenBeforeM: firstSeen[t.id] })),
        gpuTexMB: +(bytes / 1048576).toFixed(1), texturesInfo: rt.textures, renderPx: `${rt.renderWidth}x${rt.renderHeight}@${rt.dpr}`,
        biggestTex: list.sort((a, b) => b.mb - a.mb).slice(0, 8),
      };
    });
    record(info, `M3-LAP-${q}`, r);
    expect(r.state, 'lap finished').toBe('finished');
    expect(r.maxStuck, 'stuck').toBeLessThan(2000);
    expect(r.respawns, 'respawns').toBe(0);
    expect(r.outOfBounds, 'out of bounds').toBe(0);
    expect(r.minY, 'fell through the world').toBeGreaterThan(-3);
    expect(r.maxDc, 'draw calls (PERF-04)').toBeLessThanOrEqual(q === 'low' ? 100 : 150);
    expect(r.maxTri, 'triangles (PERF-05)').toBeLessThanOrEqual(q === 'low' ? 250_000 : 500_000);
    expect(r.gpuTexMB, 'PERF-09 VRAM estimate (textures) ≤ 256 MB').toBeLessThanOrEqual(256);
    // M3 art budget (BRIEF-art / BRIEF-qa-m3): ≤ 32 MB on low/medium — estimate (mips assumed), reported, not gating.
    if (q !== 'high' && r.gpuTexMB > 32) info.annotations.push({ type: 'budget', description: `GPU textures ${r.gpuTexMB} MB > 32 MB art budget (${q})` });
    expect(r.insideFrames, 'FEEL-11 camera inside a mesh').toBe(0);
    for (const t of r.turns) {
      expect(t.hudFirstSeenBeforeM, `turn ${t.id} (${t.dir}) HUD warning shown before turn-in`).not.toBeNull();
      expect(t.hudFirstSeenBeforeM!, `turn ${t.id} warned ≥ 50 m ahead`).toBeGreaterThanOrEqual(50);
    }
    expectClean(w);
  });
}
