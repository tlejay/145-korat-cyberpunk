// ERR-01..07 (CLAUDE.md §9): Thai message in [role=alert], what to do next, never raw system text.
import { expect, test, type Page } from '@playwright/test';
import { expectClean, litFraction, openGame, record, seedSettings, shot, watch } from './helpers';

const RAW = /WebGL|Error|undefined|null|NaN|stack|Failed to fetch|TypeError|\bat \w+/;

async function errorBox(page: Page) {
  const box = page.locator('[data-qa=error-box]');
  await expect(box).toBeVisible({ timeout: 20_000 });
  const text = await box.innerText();
  expect(await box.getAttribute('role')).toBe('alert');
  expect(text).not.toMatch(RAW);
  expect(text).toMatch(/[฀-๿]/);
  return text;
}

test('ERR-01 no WebGL → Thai browser advice, no black screen', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error test override
    HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
      return /webgl/.test(type) ? null : orig.call(this, type, ...(rest as []));
    };
  });
  await seedSettings(page);
  await page.goto('./?qa=1');
  const text = await errorBox(page);
  await shot(page, `err-01-webgl-${test.info().project.name}`);
  const err = await page.waitForFunction(() => window.__game?.error()).then((h) => h.jsonValue());
  record(test.info(), 'ERR-01', { text, err });
  expect(text).toMatch(/Chrome|Safari/);
  expect((err as { code: string }).code).toBe('webgl');
});

for (const mode of ['abort', '500', 'badjson'] as const) {
  test(`ERR-02 map data ${mode} → Thai + retry works without reload`, async ({ page }) => {
    let broken = true;
    await page.route('**/data/track-A.json*', (r) => {
      if (!broken) return r.continue();
      if (mode === 'abort') return r.abort();
      if (mode === '500') return r.fulfill({ status: 500, body: 'oops' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"broken": ' });
    });
    await seedSettings(page);
    await page.goto('./?qa=1');
    await page.evaluate(() => { (window as unknown as { __marker: number }).__marker = 42; });
    const text = await errorBox(page);
    await shot(page, `err-02-mapload-${mode}-${test.info().project.name}`);
    expect(text).toMatch(/ลองใหม่/);
    broken = false;
    await page.locator('[data-qa=btn-retry]').tap();
    await expect.poll(() => page.evaluate(() => window.__game?.state()), { timeout: 30_000 }).toBe('menu');
    const marker = await page.evaluate(() => (window as unknown as { __marker?: number }).__marker);
    record(test.info(), `ERR-02-${mode}`, { text, marker });
    expect(marker, 'retry must not reload the page').toBe(42);
    await expect(page.locator('[data-qa=error-box]')).toHaveCount(0);
  });
}

test('ERR-04 low fps → Thai offer, button lowers quality', async ({ page }) => {
  await openGame(page, 'track=A&laps=2&skip=1&quality=high');
  await page.waitForFunction(() => window.__game!.state() === 'racing');
  const q0 = await page.evaluate(() => window.__game!.stats().quality);
  await page.evaluate(() => window.__game!.qa.forceError('lowfps'));
  const text = await errorBox(page);
  await shot(page, `err-04-lowfps-${test.info().project.name}`);
  const btn = page.locator('[data-qa=error-box] [data-qa=btn-retry]');
  const label = await btn.innerText();
  await btn.tap();
  const q1 = await page.evaluate(() => window.__game!.stats().quality);
  record(test.info(), 'ERR-04', { text, label, q0, q1 });
  expect(label).toMatch(/ลดคุณภาพ/);
  expect(q1).not.toBe(q0);
});

test('ERR-05 WebGL context lost → restore recovers', async ({ page, browserName }) => {
  await openGame(page, 'track=A&laps=2&skip=1');
  await page.waitForFunction(() => window.__game!.state() === 'racing');
  const ok = await page.evaluate(() => {
    const c = document.getElementById('scene') as HTMLCanvasElement;
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGL2RenderingContext | null;
    const ext = gl?.getExtension('WEBGL_lose_context');
    if (!ext) return false;
    (window as unknown as { __lc: WEBGL_lose_context }).__lc = ext;
    ext.loseContext();
    return true;
  });
  test.skip(!ok, `WEBGL_lose_context unavailable on ${browserName}`);
  const text = await errorBox(page);
  await shot(page, `err-05-lost-${test.info().project.name}`);
  await page.evaluate(() => (window as unknown as { __lc: WEBGL_lose_context }).__lc.restoreContext());
  await expect(page.locator('[data-qa=error-box]')).toHaveCount(0, { timeout: 10_000 });
  const st = await page.evaluate(() => window.__game!.state());
  await page.waitForTimeout(300);
  const resumeVisible = await page.locator('[data-qa=btn-resume]').isVisible();
  await shot(page, `err-05-after-restore-before-resume-${test.info().project.name}`);
  // After restore, resume and verify the scene actually draws again (not a stuck black canvas).
  await page.evaluate(() => window.__game!.qa.resume());
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => window.__game!.stats());
  await shot(page, `err-05-restored-${test.info().project.name}`);
  const pixels = await litFraction(page, { x: 211, y: 80, width: 422, height: 160 });
  record(test.info(), 'ERR-05', { text, stateAfterRestore: st, resumeVisible, drawCalls: after.drawCalls, litPixels: pixels });
  expect(after.drawCalls).toBeGreaterThan(0);
  expect(st !== 'paused' || resumeVisible, 'restored into paused state with no visible way to resume').toBe(true);
  expect(pixels, 'canvas must not stay black after restore').toBeGreaterThan(0.02);
});

test('ERR-06 audio files blocked → game still plays silently', async ({ page }) => {
  const w = watch(page);
  await page.route('**/assets/audio/**', (r) => r.abort());
  await openGame(page, 'track=A&laps=2&skip=1');
  await page.waitForFunction(() => window.__game!.state() === 'racing');
  await page.evaluate(async () => { const g = window.__game!; g.qa.fixedStep(true, 1000 / 120); g.qa.setInput({ throttle: 1 }); await g.qa.step(360); });
  const r = await page.evaluate(() => ({ kmh: window.__game!.car().speedKmh, err: window.__game!.error(), st: window.__game!.state() }));
  record(test.info(), 'ERR-06', { ...r, consoleErrors: w.errors.length });
  expect(r.err).toBeNull();
  expect(r.kmh).toBeGreaterThan(50);
  await expect(page.locator('[data-qa=error-box]')).toHaveCount(0);
});

test('ERR-07 offline mid-race keeps playing', async ({ page, context }) => {
  const w = watch(page);
  await openGame(page, 'track=A&laps=2&skip=1');
  await page.waitForFunction(() => window.__game!.state() === 'racing');
  await context.setOffline(true);
  await page.evaluate(async () => { const g = window.__game!; g.qa.fixedStep(true, 1000 / 120); g.qa.autopilot(true); await g.qa.step(1200); });
  const r = await page.evaluate(() => ({ p: window.__game!.track().progressM, err: window.__game!.error(), st: window.__game!.state() }));
  await context.setOffline(false);
  record(test.info(), 'ERR-07', r);
  expect(r.err).toBeNull();
  expect(r.st).toBe('racing');
  expect(r.p).toBeGreaterThan(100);
  expectClean(w, { allowErrors: /ERR_INTERNET_DISCONNECTED|network/i });
});
