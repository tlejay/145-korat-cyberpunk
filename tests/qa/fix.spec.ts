// Regression tests for docs/dev/fix/REPORT-fix.md (#5 game name, #7 cache headers, #9 teleport speed).
// FIX-01/02 (countdown voice/clock) live in voice.spec.ts · #6 = MOB-03 (mobile.spec) · #8 = FEEL-10b (physics.spec).
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToRegexp } from 'path-to-regexp';
import { ROOT, openGame, readJson, record } from './helpers';

const OLD_NAME = 'โคราชไซเบอร์พังก์', NAME = 'โคราชโรสเตอร์';

test('FIX-05 game name: โคราชโรสเตอร์ in title + menu, old name gone from player-facing files', async ({ page }) => {
  await openGame(page);
  expect(await page.title()).toContain(NAME);
  await expect(page.locator('[data-qa=menu] h1')).toHaveText(NAME);
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const f of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, f.name);
      if (f.isDirectory()) walk(rel);
      else if (/\.(ts|html|css|json|js)$/.test(f.name) && fs.readFileSync(path.join(ROOT, rel), 'utf8').includes(OLD_NAME)) hits.push(rel);
    }
  };
  for (const d of ['src', 'public']) walk(d);
  if (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes(OLD_NAME)) hits.push('index.html');
  expect(hits).toEqual([]);
});

test('FIX-07 DEP-03 vercel.json: hashed js/css/fonts immutable 1 y, audio + html untouched', async ({ browserName }) => {
  test.skip(browserName !== 'chromium', 'static check');
  const dist = path.join(ROOT, 'dist/assets');
  test.skip(!fs.existsSync(dist), 'needs pnpm build');
  // Vercel matches `source` with path-to-regexp; the game is served under /koratrocketcar/ (base).
  const rules = readJson<{ headers: { source: string; headers: { key: string; value: string }[] }[] }>('vercel.json').headers
    .map((h) => ({ re: pathToRegexp(h.source), cache: h.headers.find((x) => x.key.toLowerCase() === 'cache-control')?.value }));
  const cacheFor = (url: string) => rules.filter((r) => r.cache && r.re.test(url)).map((r) => r.cache!);
  const hashed = fs.readdirSync(dist).filter((f) => /-[A-Za-z0-9_-]{8}\.(js|css|woff2?)$/.test(f));
  const out = Object.fromEntries(hashed.map((f) => [f, cacheFor(`/koratrocketcar/assets/${f}`)]));
  record(test.info(), 'FIX-07', out);
  expect(hashed.some((f) => f.endsWith('.js')) && hashed.some((f) => f.endsWith('.css')) && hashed.some((f) => f.endsWith('.woff2'))).toBe(true);
  for (const [f, c] of Object.entries(out)) expect(c, f).toEqual(['public, max-age=31536000, immutable']);
  // Not hashed → must not be cached for a year.
  for (const u of ['/koratrocketcar/', '/koratrocketcar/index.html', '/koratrocketcar/assets/audio/sfx/beep.ogg',
    '/koratrocketcar/assets/audio/manifest.json', '/koratrocketcar/assets/img/cover-1280x720.webp', '/koratrocketcar/assets/sponsors/nda-h-dark.png'])
    expect(cacheFor(u).filter((c) => /immutable/.test(c)), u).toEqual([]);
});

test('FIX-09 qa.teleport(x, z, yaw, speedKmh) gives the real car that speed (+ PHY-04 via teleport)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'physics is engine-independent');
  await page.setViewportSize({ width: 400, height: 200 });
  await openGame(page, 'track=A&laps=2&skip=1&quality=low');
  await page.waitForFunction(() => window.__game!.state() === 'racing');
  const r = await page.evaluate(async () => {
    const g = window.__game!;
    g.qa.fixedStep(true, 1000 / 60);
    const t = g.track();
    const [x0, z0] = t.centerline[40], [x1, z1] = t.centerline[41];
    const yaw = (Math.atan2(x1 - x0, -(z1 - z0)) * 180) / Math.PI;
    g.qa.teleport(x0, z0, yaw, 100);
    const now = JSON.parse(JSON.stringify(g.car()));
    await g.qa.step(6);
    const after = JSON.parse(JSON.stringify(g.car()));
    // PHY-04 as written in TEST-PLAN: put the car on the 55° Manat jump line at speed, jump at the bank.
    const T = { x: 495, z: -577.4 }, L = { x: 529.5, z: -528 };
    const lineYaw = (Math.atan2(L.x - T.x, -(L.z - T.z)) * 180) / Math.PI;
    const ul = Math.hypot(L.x - T.x, L.z - T.z), u = { x: (L.x - T.x) / ul, z: (L.z - T.z) / ul };
    const phy04: { v: number; land: string | null; landX: number | null; landZ: number | null; splash: boolean }[] = [];
    for (const v of [100, 110, 120]) {
      g.qa.teleport(T.x - u.x * 12, T.z - u.z * 12, lineYaw, v);
      g.qa.setTank(100);
      const hit: { land: { quality?: string } | null; splash: boolean } = { land: null, splash: false };
      const offs = [g.on('land', (e) => { hit.land ??= e as { quality?: string }; }), g.on('splash', () => { hit.splash = true; })];
      let jumped = false, landPos: { x: number; z: number } | null = null;
      for (let i = 0; i < 60 * 4 && !landPos; i++) {
        const c = g.car();
        const along = (c.pos.x - T.x) * u.x + (c.pos.z - T.z) * u.z;
        g.qa.setInput({ throttle: 1, jump: !jumped && along > -3.2 });
        if (!jumped && along > -3.2) jumped = true;
        await g.qa.step(1);
        if (hit.land && !landPos) landPos = { x: g.car().pos.x, z: g.car().pos.z };
      }
      g.qa.clearInput();
      offs.forEach((f) => f());
      phy04.push({ v, land: hit.land?.quality ?? null, landX: landPos ? +landPos.x.toFixed(1) : null, landZ: landPos ? +landPos.z.toFixed(1) : null, splash: hit.splash });
    }
    return { now: { speedKmh: now.speedKmh, gTotal: now.g?.total }, after: { speedKmh: after.speedKmh, gTotal: after.g?.total, yawDeg: after.yawDeg }, yaw, phy04 };
  });
  record(test.info(), 'FIX-09', r);
  expect(r.now.speedKmh).toBeGreaterThan(99);
  expect(r.now.speedKmh).toBeLessThan(101);
  expect(r.after.speedKmh, 'speed holds after a few steps (no reset to 0)').toBeGreaterThan(90);
  expect(Math.abs(r.after.gTotal ?? 0), 'no fake g spike from the teleport').toBeLessThan(2);
  // PHY-04 runnable: the car reaches the bank at speed and leaves the ground (land or splash), result recorded for QA.
  for (const a of r.phy04) expect(a.land !== null || a.splash, `PHY-04 ${a.v} km/h ran`).toBe(true);
});

test('FIX-03 car: 4 side-down nozzles (2 per rear corner, outer + inboard) pointing at the road', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'model data is engine-independent');
  await page.goto('./?qa=1&view=car');
  await page.waitForFunction(() => !!(window as unknown as { __carPreview?: unknown }).__carPreview, null, { timeout: 30_000 });
  const n = await page.evaluate(() => (window as unknown as { __carPreview: { nozzles(): { name: string; kind: string; pos: number[]; dir: number[] }[] } }).__carPreview.nozzles());
  record(test.info(), 'FIX-03', n);
  const side = n.filter((x) => x.kind === 'side-down'), rear = n.filter((x) => x.kind === 'rear');
  expect(rear).toHaveLength(4);
  expect(side).toHaveLength(4);
  const left = side.filter((x) => x.pos[0] < 0), right = side.filter((x) => x.pos[0] > 0);
  expect(left).toHaveLength(2);
  expect(right).toHaveLength(2);
  for (const x of side) {
    expect(x.dir[1], `${x.name} blows down`).toBeLessThan(-0.99);
    expect(x.pos[1], `${x.name} under the body`).toBeLessThan(0.35);
    expect(x.pos[2], `${x.name} at the rear axle area`).toBeGreaterThan(0.5); // +z = rear
  }
  // mirror-symmetric pairs, inboard tip ~0.19 m inside the outer can
  const xs = side.map((x) => x.pos[0]).sort((a, b) => a - b);
  expect(Math.abs(xs[0] + xs[3])).toBeLessThan(0.01);
  expect(Math.abs(xs[1] + xs[2])).toBeLessThan(0.01);
  expect(xs[1] - xs[0]).toBeGreaterThan(0.12);
  expect(xs[1] - xs[0]).toBeLessThan(0.3);
});

test('FIX-04 HUD speed + tank readable over the white plume (contrast ≥ 4.5 on pure white)', async ({ page }) => {
  await openGame(page, 'track=A&laps=2&skip=1');
  await page.waitForFunction(() => window.__game!.state() === 'racing');
  const r = await page.evaluate(() => {
    const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const plate = rgba(getComputedStyle(document.querySelector('.hud-bottom')!).backgroundColor);
    const a = plate[3] ?? 1;
    const bg = [0, 1, 2].map((i) => plate[i] * a + 255 * (1 - a)); // plate over a pure-white plume
    const fg = rgba(getComputedStyle(document.querySelector('[data-qa=hud-speed]')!).color);
    const L1 = lum(fg), L2 = lum(bg);
    return { plate, fg, bg, contrast: (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05) };
  });
  record(test.info(), 'FIX-04', r);
  expect(r.contrast).toBeGreaterThanOrEqual(4.5);
});

// ---------- #10 one lap · #11 checkpoint clears in style + ghost track version ----------

test('FIX-10 default race is 1 lap: finish after one lap, fast BGM in the last 25 %, no lap counter', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'game logic is engine-independent');
  test.setTimeout(400_000);
  await page.setViewportSize({ width: 400, height: 200 });
  await openGame(page, 'track=A&quality=low'); // no laps= → TRACK_RULES.A.laps
  await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('[data-qa=btn-start]')?.disabled, null, { timeout: 60_000 });
  await page.locator('[data-qa=btn-start]').click(); // real tap → audio unlock (music state is observable)
  await page.waitForFunction(() => window.__game!.state() === 'racing', null, { timeout: 120_000 });
  const r = await page.evaluate(async () => {
    const g = window.__game!;
    g.qa.fixedStep(true, 1000 / 60);
    g.qa.autopilot(true);
    const laps: unknown[] = []; g.on('lap', (e) => laps.push(e));
    const hudLap = document.querySelector('[data-qa=hud-lap]')!.textContent;
    const L = g.track().lengthM, frac = () => g.track().progressM / L;
    // Fast-forward to 70 % of the lap, then run in real time: the fast BGM streams in and switches on the
    // next bar (audio clock), which a fast-forwarded finish would beat.
    let steps = 0;
    while (g.state() === 'racing' && !(frac() > 0.7 && frac() < 0.74) && steps < 60 * 300) { await g.qa.step(30); steps += 30; }
    const before = { frac: frac(), playing: g.audio().playing.slice() };
    g.qa.fixedStep(false);
    let finalAt: number | null = null;
    const t0 = performance.now();
    while (g.state() === 'racing' && performance.now() - t0 < 120_000) {
      await new Promise((r) => setTimeout(r, 100));
      if (finalAt === null && g.audio().playing.includes('music:race-final')) finalAt = frac();
    }
    g.qa.autopilot(false);
    return { state: g.state(), laps: laps.length, lapTimes: g.track().lapTimesMs, before, finalAtFrac: finalAt, hudLap,
      resLaps: !!document.querySelector('.res-laps'), playing: g.audio().playing };
  });
  record(test.info(), 'FIX-10', r);
  expect(r.state).toBe('finished');
  expect(r.lapTimes).toHaveLength(1);
  expect(r.hudLap, 'no "รอบ 1/1" counter').toBe('');
  expect(r.resLaps, 'no per-lap list on the results screen').toBe(false);
  expect(r.before.playing, 'normal race BGM until the last stretch').not.toContain('music:race-final');
  expect(r.finalAtFrac, 'fast BGM before the finish').not.toBeNull();
  expect(r.finalAtFrac!).toBeGreaterThanOrEqual(0.75); // trigger at 75 % of the lap, lands on the next bar
});

test('FIX-10/11 server rules: 1 lap, checkpoint clears scored inside the style cap, plausibility', async () => {
  const { TRACK_RULES, SCORE, computeScore, validateRun } = await import('../../src/net/score');
  const { VERSION } = await import('../../src/version');
  const rule = TRACK_RULES.A;
  expect(rule.laps).toBe(1);
  const lapMs = 70_000;
  const run = {
    trackId: 'A', build: VERSION, laps: 1, totalMs: lapMs, lapMs: [lapMs],
    splitsMs: Array.from({ length: rule.checkpoints }, (_, i) => Math.round(((i + 1) * lapMs) / (rule.checkpoints + 1))),
    shortcuts: 1, driftMs: 20_000, driftChains: 6, jumps: 4, cleanLandings: 2, launches: { perfect: 1, total: 1 },
    boostMs: 4_000, refills: 1, cleanLaps: 1, respawns: 0, checkpointClears: 2, maxG: 4.6,
  };
  const t = { startedAtMs: 0, nowMs: lapMs + 5_000, trackId: 'A', allowTest: false };
  expect(validateRun(run, t)).toBeNull();
  // the GAMEPLAY §6 example: 124,163 + style 8,200 (includes 2 × 300 for the checkpoints)
  expect(computeScore(run, rule)).toMatchObject({ time: 124_163, styleRaw: 8_200, style: 8_200, total: 132_363 });
  expect(computeScore({ ...run, checkpointClears: 0 }, rule).styleRaw).toBe(8_200 - 2 * SCORE.checkpointClear);
  // cap still 20 %: a huge style run is clipped
  const slow = computeScore({ ...run, totalMs: 150_000, lapMs: [150_000] }, rule); // time 27,040 → cap 5,408 < 8,200
  expect(slow.styleRaw).toBe(8_200);
  expect(slow.style).toBe(Math.round(slow.time * SCORE.styleCapRatio));
  // 2-lap results from older builds are refused; impossible clears too
  expect(validateRun({ ...run, laps: 2, lapMs: [35_000, 35_000] }, t)).toBe('BAD_LAPS');
  expect(validateRun({ ...run, checkpointClears: 3 }, t)).toBe('BAD_STYLE'); // only 2 sites
  expect(validateRun({ ...run, checkpointClears: 2, jumps: 1, cleanLandings: 1, shortcuts: 1 }, t)).toBe('BAD_STYLE');
});

test('FIX-11 ghost v2 carries the track version; old/other layouts are never replayed; clears need ghost evidence', async () => {
  const gf = await import('../../src/net/ghost-format');
  const { TRACK_VERSION } = await import('../../src/net/track-version');
  const { SITES } = await import('../../src/checkpoint/sim');
  // committed version = sha256(track-A.json) — catches a track rebuild without `pnpm build`
  const { createHash } = await import('node:crypto');
  const hash = createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'public/data/track-A.json'))).digest('hex').slice(0, 8);
  expect(TRACK_VERSION.toString(16).padStart(8, '0')).toBe(hash);

  const lapMs = 3_000;
  const samples = Array.from({ length: lapMs / 100 }, (_, i) => ({ x: SITES[0].at.x, y: 0, z: SITES[0].at.z - 15 + i, yawDeg: 0, flags: 0 }));
  const ghost = { hz: gf.GHOST_HZ, lapMs, trackVersion: TRACK_VERSION, samples };
  const back = gf.unpackGhost(gf.packGhost(ghost))!;
  expect(back.trackVersion).toBe(TRACK_VERSION);
  expect(gf.ghostMatchesTrack(back)).toBe(true);
  expect(gf.ghostMatchesTrack(gf.unpackGhost(gf.packGhost({ ...ghost, trackVersion: TRACK_VERSION ^ 1 })))).toBe(false);
  const v1 = gf.packGhost(ghost); v1[1] = 0x31; // 'G1' (no track version)
  expect(gf.unpackGhost(v1)).toBeNull();

  // evidence: rolling through the site on the ground = 0 clears; airborne over it = 1
  expect(gf.ghostCheckpointClears(back, SITES)).toBe(0);
  const air = { ...ghost, samples: samples.map((s) => ({ ...s, y: 2, flags: Math.abs(s.z - SITES[0].at.z) < 6 ? gf.GHOST_FLAG.airborne : 0 })) };
  expect(gf.ghostCheckpointClears(air, SITES)).toBe(1);
  // airborne somewhere else (e.g. the moat jump) does not count
  const elsewhere = { ...air, samples: air.samples.map((s) => ({ ...s, x: s.x + 200 })) };
  expect(gf.ghostCheckpointClears(elsewhere, SITES)).toBe(0);
});
