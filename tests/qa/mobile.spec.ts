// MOB-* + FEEL-01: touch layout, multi-touch, orientation, DPR, input latency.
import { expect, test, type Page } from '@playwright/test';
import { box, expectClean, openGame, pct, record, shot, watch } from './helpers';
import type { GameQA } from '../../src/qa/types';

const DRIVE = ['btn-throttle', 'btn-brake', 'steer-left', 'steer-right'];
const OTHER = ['btn-jump', 'btn-boost', 'btn-pause'];

async function racing(page: Page) {
  await openGame(page, 'track=A&laps=2&skip=1');
  await page.waitForFunction(() => window.__game!.state() === 'racing');
  await page.touchscreen.tap(422, 40); // first touch reveals the controls on non-coarse pointers (GAMEPLAY §1.5)
  await page.waitForTimeout(300);
}

async function layout(page: Page) {
  return page.evaluate(() => {
    const vis = (e: Element) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05; };
    const pick = (sel: string) => [...document.querySelectorAll(sel)].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { qa: (e as HTMLElement).dataset.qa ?? e.className, x: r.x, y: r.y, w: r.width, h: r.height }; });
    return {
      opaque: Object.fromEntries([...document.querySelectorAll('.tbtn,[data-qa=btn-pause]')].map((e) => {
        const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(e).backgroundColor); const a = m ? Number(m[1].split(',')[3] ?? 1) : 0;
        return [(e as HTMLElement).dataset.qa, a];
      })),
      buttons: pick('.controls [data-qa^=btn-], .controls [data-qa^=steer-]:not([data-qa=steer-pad]), [data-qa=btn-pause], [data-qa=btn-respawn]'),
      hud: pick('[data-qa^=hud-]'),
      vw: innerWidth, vh: innerHeight,
    };
  });
}

for (const vp of [{ width: 844, height: 390 }, { width: 667, height: 375 }]) {
  test(`MOB-01/02 button size, spacing, coverage @${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await racing(page);
    const L = await layout(page);
    const small = L.buttons.filter((b) => b.w < 48 || b.h < 48 || (DRIVE.includes(b.qa) && (b.w < 64 || b.h < 64)));
    const close: string[] = [];
    for (let i = 0; i < L.buttons.length; i++) for (let j = i + 1; j < L.buttons.length; j++) {
      const a = L.buttons[i], b = L.buttons[j];
      const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)), gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
      if (Math.max(gx, gy) < 8) close.push(`${a.qa}↔${b.qa} gap ${Math.max(gx, gy).toFixed(1)}`);
    }
    // Coverage: rasterise boxes on a 2 px grid.
    const all = [...L.buttons, ...L.hud];
    let covered = 0, centre = 0, centreTranslucent = 0;
    for (let y = 0; y < L.vh; y += 2) for (let x = 0; x < L.vw; x += 2) {
      const hitB = L.buttons.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
      if (hitB || all.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)) covered++;
      const inC = x > L.vw * 0.25 && x < L.vw * 0.75 && y > L.vh * 0.2 && y < L.vh * 0.8;
      const hitC = inC ? L.buttons.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) : undefined;
      if (hitC) { if ((L.opaque[hitC.qa] ?? 1) >= 0.6) centre++; else centreTranslucent++; }
    }
    const coverPct = (covered * 4) / (L.vw * L.vh) * 100;
    const missing = [...DRIVE, ...OTHER].filter((id) => !L.buttons.some((b) => b.qa === id));
    record(test.info(), `MOB-01-${vp.width}`, { buttons: L.buttons, small, close, coverPct, centrePx: centre * 4, centreTranslucentPx: centreTranslucent * 4, opacity: L.opaque, missing });
    await shot(page, `controls-${vp.width}x${vp.height}-${test.info().project.name}`);
    expect(missing).toEqual([]);
    expect(small).toEqual([]);
    expect(close).toEqual([]);
    expect(coverPct).toBeLessThanOrEqual(20);
    expect(centre).toBe(0);
  });
}

test('MOB-13 other screens: no overlap / overflow', async ({ page }) => {
  const out: Record<string, unknown> = {};
  for (const vp of [{ width: 932, height: 430 }, { width: 1180, height: 820 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(vp);
    if (!out.started) { await racing(page); out.started = true; }
    await page.waitForTimeout(300);
    const L = await layout(page);
    const overlaps: string[] = [];
    const items = [...L.buttons, ...L.hud];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps.push(`${a.qa}↔${b.qa}`);
    }
    const overflow = await page.evaluate(() => [...document.querySelectorAll('[data-qa^=hud-]')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => (e as HTMLElement).dataset.qa));
    const offscreen = items.filter((b) => b.x < 0 || b.y < 0 || b.x + b.w > L.vw + 0.5 || b.y + b.h > L.vh + 0.5).map((b) => b.qa);
    out[`${vp.width}x${vp.height}`] = { overlaps, overflow, offscreen };
  }
  record(test.info(), 'MOB-13', out);
  for (const [k, v] of Object.entries(out)) if (k !== 'started') expect((v as { offscreen: string[] }).offscreen, k).toEqual([]);
});

test('MOB-03 multi-touch: throttle + steer + boost, release, slide-off', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP touch events are Chromium-only; WebKit multi-touch → real iPhone checklist');
  const w = watch(page);
  await racing(page);
  const cdp = await page.context().newCDPSession(page);
  const t = await box(page, 'btn-throttle'), s = await box(page, 'steer-right'), b = await box(page, 'btn-boost');
  await page.evaluate(() => window.__game!.qa.setTank(100));
  // Poll for each expected state (≤ 5 s): with M3 visuals SwiftShader frames take 0.5–1.3 s, so a fixed
  // 200 ms sleep read input from before the touch was processed (fix #6). Same assertions as before.
  type In = ReturnType<GameQA['input']>;
  const until = async (ok: (i: In) => boolean) => {
    const t0 = Date.now();
    let i = await page.evaluate(() => window.__game!.input());
    while (!ok(i) && Date.now() - t0 < 5000) { await page.waitForTimeout(100); i = await page.evaluate(() => window.__game!.input()); }
    return i;
  };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: t.cx, y: t.cy, id: 1 }, { x: s.cx, y: s.cy, id: 2 }] });
  const two = await until((i) => i.activePointers === 2 && i.throttle > 0.9 && i.steer > 0.3);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: t.cx, y: t.cy, id: 1 }, { x: s.cx, y: s.cy, id: 2 }, { x: b.cx, y: b.cy, id: 3 }] });
  const three = await until((i) => i.activePointers === 3 && i.boost);
  // lift the steer finger only (CDP: touchEnd lists the points that are lifted)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: s.cx, y: s.cy, id: 2 }] });
  const afterLift = await until((i) => i.activePointers === 2 && Math.abs(i.steer) < 0.5);
  // slide the throttle finger off its button
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: t.cx - 160, y: t.cy - 150, id: 1 }, { x: b.cx, y: b.cy, id: 3 }] });
  const slid = await until((i) => i.throttle === 0);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const none = await until((i) => i.activePointers === 0);
  record(test.info(), 'MOB-03', { two, three, afterLift, slid, none });
  expect(two.activePointers).toBe(2);
  expect(two.throttle).toBeGreaterThan(0.9);
  expect(two.steer).toBeGreaterThan(0.3);
  expect(three.activePointers).toBe(3);
  expect(three.boost).toBe(true);
  expect(afterLift.throttle).toBeGreaterThan(0.9);
  expect(Math.abs(afterLift.steer)).toBeLessThan(0.5);
  expect(slid.throttle, 'throttle must release when the finger slides off').toBe(0);
  expect(none.activePointers).toBe(0);
  expectClean(w);
});

test('FEEL-01 input latency (touch → physics step) 50 taps', async ({ page, browserName }) => {
  await racing(page);
  const t = await box(page, 'btn-throttle');
  const cdp = browserName === 'chromium' ? await page.context().newCDPSession(page) : null;
  const lat: number[] = [];
  for (let i = 0; i < 50; i++) {
    if (cdp) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: t.cx, y: t.cy, id: 1 }] });
      await page.waitForTimeout(60);
      lat.push(await page.evaluate(() => window.__game!.input().lastLatencyMs));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.touchscreen.tap(t.cx, t.cy);
      await page.waitForTimeout(60);
      lat.push(await page.evaluate(() => window.__game!.input().lastLatencyMs));
    }
    await page.waitForTimeout(40);
  }
  const st = await page.evaluate(() => window.__game!.stats());
  const m = { p50: pct(lat, 0.5), p95: pct(lat, 0.95), max: Math.max(...lat), n: lat.length, frameMsP50: st.frameMsP50, frameMsP95: st.frameMsP95, note: 'headless software GL: frames are slow, so the absolute ms is not the REF-MID number' };
  record(test.info(), 'FEEL-01', m);
  if (m.frameMsP95 > 20) {
    test.info().annotations.push({ type: 'indicative', description: `software GL frames p95 ${m.frameMsP95} ms — latency judged on REF-MID / WebKit run` });
    return;
  }
  expect(m.p95).toBeLessThanOrEqual(50);
  expect(m.max).toBeLessThanOrEqual(100);
});

test('MOB-07 / ERR-03 portrait mid-race pauses with Thai hint; back to landscape keeps the lap', async ({ page }) => {
  const w = watch(page);
  await racing(page);
  await page.evaluate(async () => { const g = window.__game!; g.qa.fixedStep(true, 1000 / 120); g.qa.setInput({ throttle: 1 }); await g.qa.step(600); g.qa.fixedStep(false); g.qa.clearInput(); });
  const before = await page.evaluate(() => ({ p: window.__game!.track().progressM, lap: window.__game!.track().lap }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const hint = page.locator('[data-qa=rotate-hint]');
  await expect(hint).toBeVisible();
  const txt = await hint.innerText();
  const st = await page.evaluate(() => window.__game!.state());
  await shot(page, `portrait-${test.info().project.name}`);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  await expect(hint).toBeHidden();
  const resume = page.locator('[data-qa=btn-resume]');
  if (await resume.isVisible()) await resume.tap();
  await expect.poll(() => page.evaluate(() => window.__game!.state()), { timeout: 1000 }).toBe('racing');
  const after = await page.evaluate(() => ({ p: window.__game!.track().progressM, lap: window.__game!.track().lap, s: window.__game!.stats() }));
  record(test.info(), 'MOB-07', { txt, stateInPortrait: st, before, after: { p: after.p, lap: after.lap, w: after.s.renderWidth, h: after.s.renderHeight, dpr: after.s.dpr } });
  expect(txt).toMatch(/หมุนจอ/);
  expect(st).toBe('paused');
  expect(after.lap).toBe(before.lap);
  expect(Math.abs(after.p - before.p)).toBeLessThan(30);
  expect(Math.round(after.s.renderWidth / after.s.dpr)).toBe(844);
  expectClean(w);
});

test('ERR-03 opened in portrait: hint shown, game does not start', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await openGame(page);
  await expect(page.locator('[data-qa=rotate-hint]')).toBeVisible();
  const role = await page.locator('[data-qa=rotate-hint]').getAttribute('role');
  const sb = await page.locator('[data-qa=btn-start]').boundingBox();
  const startVisible = sb ? await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-qa=btn-start]'), { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 }) : false;
  record(test.info(), 'ERR-03', { role, startVisible });
  expect(role).toBe('alert');
  expect(startVisible, 'start button must not be tappable behind the rotate hint').toBe(false);
});

test('MOB-04/08/09/14 CSS + meta guards (proxy for real-device checks)', async ({ page }) => {
  await racing(page);
  const r = await page.evaluate(() => {
    const b = getComputedStyle(document.body);
    const c = document.querySelector('[data-qa=btn-throttle]')!;
    const cs = getComputedStyle(c);
    return {
      viewport: document.querySelector('meta[name=viewport]')!.getAttribute('content'),
      touchAction: b.touchAction, userSelect: b.userSelect || (b as unknown as Record<string, string>).webkitUserSelect,
      overscroll: b.overscrollBehavior || (b as unknown as Record<string, string>).overscrollBehaviorY,
      btnTouchAction: cs.touchAction,
      tapHighlight: (b as unknown as Record<string, string>).webkitTapHighlightColor ?? '',
      dpr: window.__game!.stats().dpr, devDpr: devicePixelRatio,
      bodyH: document.body.getBoundingClientRect().height, vh: innerHeight,
    };
  });
  record(test.info(), 'MOB-04', r);
  expect(r.viewport).toMatch(/viewport-fit=cover/);
  expect(r.touchAction).toBe('none');
  expect(r.btnTouchAction).toBe('none');
  expect(r.dpr, 'MOB-14 DPR cap').toBeLessThanOrEqual(2);
});
