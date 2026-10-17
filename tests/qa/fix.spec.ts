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
