// PERF-04/05/06/07/10 + FEEL-10/11 (camera) — long runs. Chromium only (CDP network/CPU emulation, heap).
import { chromium, expect, test } from '@playwright/test';
import { litFraction, pct, record, seedSettings } from './helpers';

test.describe.configure({ mode: 'parallel' });

test('PERF-04/05 draw calls + triangles over a full lap at each quality · FEEL-10/11 camera', async ({ page }) => {
  test.setTimeout(1_800_000); // M3 scene (bloom, neon, sponsors, fx) renders slower under SwiftShader
  await seedSettings(page);
  const out: Record<string, unknown> = {};
  for (const q of ['medium', 'low'] as const) {
    await page.goto(`./?qa=1&track=A&laps=1&skip=1&quality=${q}`);
    await page.waitForFunction(() => window.__game?.state() === 'racing', null, { timeout: 30_000 });
    const r = await page.evaluate(async () => {
      const g = window.__game!;
      g.qa.fixedStep(true, 1000 / 60); g.qa.autopilot(true);
      let maxDc = 0, maxTri = 0, jumps = 0, steps = 0, inside = 0;
      const acc: number[] = []; let prev: { x: number; y: number; z: number } | null = null, prevV: { x: number; y: number; z: number } | null = null;
      while (g.state() === 'racing' && steps < 60 * 200) {
        await g.qa.step(1); steps++;
        const s = g.stats(); maxDc = Math.max(maxDc, s.drawCalls); maxTri = Math.max(maxTri, s.triangles);
        const c = g.camera(); const p = c.pos;
        if (c.insideMesh) inside++;
        if (prev) {
          const v = { x: p.x - prev.x, y: p.y - prev.y, z: p.z - prev.z };
          if (Math.hypot(v.x, v.y, v.z) > 2) jumps++;
          if (prevV) acc.push(Math.hypot(v.x - prevV.x, v.y - prevV.y, v.z - prevV.z));
          prevV = v;
        }
        prev = { ...p };
        // Yield to the page; the rAF loop still eases the camera with real dt in fixedStep mode, so restart deltas after a yield.
        if (steps % 600 === 0) { await new Promise((r) => setTimeout(r, 0)); prev = null; prevV = null; }
      }
      g.qa.autopilot(false);
      const cam = g.camera();
      return { maxDc, maxTri, jumps, steps, accs: acc, inside, occludedFrames: cam.occludedFrames, totalFrames: cam.totalFrames, state: g.state(), respawns: g.world().respawnCount };
    });
    const med = pct(r.accs, 0.5), spikes = r.accs.filter((a) => a > 3 * Math.max(med, 0.01)).length;
    out[q] = { maxDc: r.maxDc, maxTri: r.maxTri, camJumps: r.jumps, accMedian: med, accP99: pct(r.accs, 0.99), accSpikes: spikes, accSpikePct: (spikes / r.accs.length) * 100, insideFrames: r.inside, occluded: `${r.occludedFrames}/${r.totalFrames}`, steps: r.steps, finished: r.state, respawns: r.respawns };
  }
  record(test.info(), 'PERF-04', out);
  const m = out.medium as { maxDc: number; maxTri: number; camJumps: number; insideFrames: number }, l = out.low as { maxDc: number; maxTri: number };
  expect(m.maxDc).toBeLessThanOrEqual(150); expect(l.maxDc).toBeLessThanOrEqual(100);
  expect(m.maxTri).toBeLessThanOrEqual(500_000); expect(l.maxTri).toBeLessThanOrEqual(250_000);
  expect(m.camJumps, 'FEEL-10 camera moved > 2 m in one frame').toBe(0);
  expect(m.insideFrames, 'FEEL-11 camera inside a mesh').toBe(0);
});

test('PERF-06/07 first load on Fast 4G / Slow 4G (CDP), bytes until racing', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP network emulation');
  const res: Record<string, unknown> = {};
  // M3 compiles ~86 shader programs at load: SwiftShader (CPU) spends ~10 s on that alone, a real GPU < 1 s.
  // On macOS use the machine's GPU (ANGLE Metal) so the number reflects network + JS, not software GL.
  const gpu = process.platform === 'darwin' ? await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }) : null;
  const br = gpu ?? browser;
  res.gl = gpu ? 'ANGLE Metal (real GPU)' : 'SwiftShader';
  for (const [name, down, up, rtt] of [['fast4g', 9e6, 1.5e6, 170], ['slow4g', 1.6e6, 750e3, 150]] as const) {
    const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, extraHTTPHeaders: test.info().project.use.extraHTTPHeaders });
    const page = await ctx.newPage();
    await page.addInitScript(() => { try { localStorage.setItem('settings.v1', '{"tutorialSeen":true}'); } catch { /* */ } });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: rtt, downloadThroughput: down / 8, uploadThroughput: up / 8 });
    let bytes = 0; const big: { url: string; b: number }[] = [];
    cdp.on('Network.loadingFinished', (e: { encodedDataLength: number }) => { bytes += e.encodedDataLength; });
    cdp.on('Network.responseReceived', (e: { response: { url: string; encodedDataLength: number } }) => { big.push({ url: e.response.url.replace(/^.*koratrocketcar\//, ''), b: e.response.encodedDataLength }); });
    const t0 = Date.now();
    await page.goto(new URL('./?qa=1', test.info().project.use.baseURL).toString());
    // "no black screen > 2 s": something lit on screen (loading cover / text) 2 s after navigation
    await page.waitForTimeout(Math.max(0, 2000 - (Date.now() - t0)));
    const litAt2s = await litFraction(page);
    const firstPaintMs = await page.waitForSelector('[data-qa=btn-start]').then(() => Date.now() - t0);
    await page.waitForFunction(() => !(document.querySelector('[data-qa=btn-start]') as HTMLButtonElement)?.disabled, null, { timeout: 60_000 });
    const menuReadyMs = Date.now() - t0;
    await page.locator('[data-qa=btn-start]').tap();
    await page.waitForFunction(() => ['countdown', 'racing'].includes(window.__game?.state() ?? ''), null, { timeout: 60_000 });
    const inGameMs = Date.now() - t0;
    await page.waitForTimeout(1500);
    res[name] = { firstPaintMs, menuReadyMs, inGameMs, transferMB: bytes / 1e6, litAt2s };
    await ctx.close();
  }
  await gpu?.close();
  record(test.info(), 'PERF-06', res);
  const f = res.fast4g as { menuReadyMs: number; inGameMs: number; transferMB: number }, s = res.slow4g as { inGameMs: number; litAt2s: number };
  expect(f.menuReadyMs).toBeLessThanOrEqual(5000);
  expect(f.inGameMs).toBeLessThanOrEqual(10_000);
  expect(s.inGameMs).toBeLessThanOrEqual(20_000);
  expect(s.litAt2s, 'no black screen > 2 s (lit pixels at 2 s on Slow 4G)').toBeGreaterThan(0.02);
  expect(f.transferMB).toBeLessThanOrEqual(8);
});

test('PERF-10 no leak: 10 autopilot laps with restart + 10 menu round-trips', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'performance.memory + forced GC are Chromium-only');
  test.setTimeout(900_000);
  await seedSettings(page);
  await page.goto('./?qa=1&track=A&laps=1&skip=1&quality=low');
  await page.waitForFunction(() => window.__game?.state() === 'racing', null, { timeout: 30_000 });
  const cdp = await page.context().newCDPSession(page);
  const gc = async () => { await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(300); };
  const snap = async () => { await gc(); return page.evaluate(() => { const s = window.__game!.stats(); return { geo: s.geometries, tex: s.textures, prog: s.programs, heap: s.jsHeapMB }; }); };
  const rows: unknown[] = [];
  for (let lap = 1; lap <= 10; lap++) {
    await page.evaluate(async () => {
      const g = window.__game!;
      g.qa.fixedStep(true, 1000 / 30); g.qa.autopilot(true);
      let n = 0; while (g.state() === 'racing' && n < 30 * 200) { await g.qa.step(30); n += 30; }
      g.qa.autopilot(false);
    });
    rows.push({ lap, ...(await snap()), state: await page.evaluate(() => window.__game!.state()) });
    await page.evaluate(async () => { const g = window.__game!; await g.qa.toMenu(); await g.qa.start('A', { laps: 1, skipCountdown: true }); });
  }
  for (let i = 0; i < 10; i++) await page.evaluate(async () => { const g = window.__game!; await g.qa.toMenu(); await g.qa.start('A', { laps: 1, skipCountdown: true }); });
  const end = await snap();
  // Baseline = lap 3: the first finishes build the ghost car / results UI once (+2 geometries, +2 programs) — warm-up, not a leak.
  const r2 = rows[2] as { geo: number; tex: number; prog: number; heap: number };
  const r10 = rows[9] as { geo: number; tex: number; prog: number; heap: number };
  record(test.info(), 'PERF-10', { rows, end, heapGrowthPct: ((end.heap - r2.heap) / r2.heap) * 100 });
  expect(r10.geo).toBe(r2.geo); expect(r10.tex).toBe(r2.tex); expect(r10.prog).toBe(r2.prog);
  expect(end.geo).toBe(r2.geo);
  expect(((end.heap - r2.heap) / r2.heap) * 100).toBeLessThanOrEqual(10);
});

test('PERF-13 / ERR-04 auto low-fps path without ?qa=1 (CPU throttle 20×)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP CPU throttling');
  await seedSettings(page);
  await page.goto('./?track=A&laps=2&skip=1&quality=high');
  await page.waitForSelector('[data-qa=hud-speed]', { state: 'attached' });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
  const shown = await page.locator('[data-qa=error-box]').waitFor({ timeout: 40_000 }).then(() => true, () => false);
  const text = shown ? await page.locator('[data-qa=error-box]').innerText() : null;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  record(test.info(), 'PERF-13', { shown, text });
  expect(shown, 'low-fps offer should appear when fps collapses').toBe(true);
});

test('FEEL-11 camera occlusion in real time (autopilot 60 s, occlusion sampled by the hook)', async ({ page }) => {
  test.setTimeout(300_000);
  await seedSettings(page);
  await page.goto('./?qa=1&track=A&laps=2&skip=1&quality=low');
  await page.waitForFunction(() => window.__game?.state() === 'racing', null, { timeout: 30_000 });
  await page.evaluate(() => window.__game!.qa.autopilot(true));
  let inside = 0, samples = 0;
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(500);
    const c = await page.evaluate(() => window.__game!.camera());
    samples++; if (c.insideMesh) inside++;
  }
  const c = await page.evaluate(() => ({ ...window.__game!.camera(), prog: window.__game!.track().progressM, lap: window.__game!.track().lap }));
  record(test.info(), 'FEEL-11', { occludedFrames: c.occludedFrames, totalFrames: c.totalFrames, pct: (c.occludedFrames / Math.max(1, c.totalFrames)) * 100, insideSamples: inside, samples, prog: c.prog, lap: c.lap });
  expect(inside).toBe(0);
  expect(c.occludedFrames / Math.max(1, c.totalFrames)).toBeLessThanOrEqual(0.01);
});
