// Gate A + UI-*: hooks present only with ?qa=1, full menu → race flow, Thai-only text, credits, pause.
import { expect, test } from '@playwright/test';
import { VERSION } from '../../src/version';
import { box, expectClean, openGame, record, seedSettings, shot, watch } from './helpers';

// UI-01 allowlist: proper nouns + version string + credit names ("Android" = product name in the haptics setting).
const ALLOW = /^(Tesla|Roadster|OpenStreetMap|ODbL|CC|BY|SA|CC0|OFL|SIL|MIT|Noto|Sans|Thai|Heroicons|three|js|Inc|Android|ElevenLabs|Claude|Opus|Tle|R1|v\d.*|build\d+)$/;
const englishWords = (s: string) => (s.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !ALLOW.test(w));

test('A: hooks only with ?qa=1 · version matches', async ({ page }) => {
  await page.goto('./');
  await page.waitForSelector('[data-qa=btn-start]');
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => 'window.__game' in globalThis && !!window.__game)).toBe(false);
  await openGame(page);
  const v = await page.evaluate(() => window.__game!.version);
  expect(v).toBe(VERSION);
  await expect(page.locator('[data-qa=version]')).toHaveText(VERSION);
  const mods = await page.evaluate(() => window.__game!.modules());
  expect(mods).toEqual({ track: 'real', model: 'real', physics: 'real', audio: 'real' });
});

test('menu → tutorial → intro → countdown → racing by touch, clean console', async ({ page }) => {
  const w = watch(page);
  await openGame(page, '', { seed: false }); // brand-new device: tutorial shows first
  await shot(page, `menu-${test.info().project.name}`);
  const t0 = Date.now();
  await page.locator('[data-qa=btn-start]').tap();
  await page.locator('[data-qa=btn-tutorial-ok]').tap();
  await page.waitForFunction(() => window.__game!.state() === 'countdown', null, { timeout: 15_000 });
  await page.waitForFunction(() => window.__game!.state() === 'racing', null, { timeout: 20_000 });
  record(test.info(), 'FEEL-20-taps', { taps: 2, msToRacing: Date.now() - t0 });
  await shot(page, `racing-${test.info().project.name}`);
  await page.waitForTimeout(1000);
  expectClean(w);
});

test('UI-01 Thai only on every screen · UI-11 lang + aria', async ({ page }) => {
  const w = watch(page);
  await openGame(page);
  const collect = () => page.evaluate(() => {
    const out: string[] = [document.title];
    const walker = document.createTreeWalker(document.getElementById('ui')!, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode as Text;
      const el = n.parentElement!;
      if (el.closest('[data-qa=credits],[data-qa=version]')) continue;
      if (getComputedStyle(el).display !== 'none' && n.textContent!.trim()) out.push(n.textContent!.trim());
    }
    document.querySelectorAll('[aria-label]').forEach((e) => out.push(e.getAttribute('aria-label')!));
    return out;
  });
  const seen: Record<string, string[]> = {};
  seen.menu = await collect();
  await page.locator('[data-qa=btn-settings]').first().tap();
  seen.settings = await collect();
  await page.locator('[data-qa=btn-close]').first().tap();
  await page.locator('[data-qa=btn-credits]').tap();
  const credits = await page.locator('[data-qa=credits]').innerText();
  await page.locator('[data-qa=btn-close]').first().tap();
  await page.evaluate(() => window.__game!.qa.start('A', { laps: 1, skipCountdown: true }));
  await page.waitForTimeout(800);
  seen.hud = await collect();
  await page.locator('[data-qa=btn-pause]').tap();
  seen.pause = await collect();
  const bad = Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.flatMap(englishWords)]).filter(([, v]) => v.length));
  const lang = await page.evaluate(() => document.documentElement.lang);
  const unlabeled = await page.evaluate(() => [...document.querySelectorAll('button,[role=button]')]
    .filter((b) => !(b.getAttribute('aria-label') || (b as HTMLElement).innerText.trim())).map((b) => (b as HTMLElement).dataset.qa ?? b.className));
  record(test.info(), 'UI-01', { bad, lang, unlabeled, creditsChars: credits.length });
  expect(bad).toEqual({});
  expect(lang).toBe('th');
  expect(unlabeled).toEqual([]);
  // UI-07: credits
  expect(credits).toContain('© OpenStreetMap contributors');
  expect(credits).toContain('ODbL');
  expect(credits).toContain('ElevenLabs');
  expect(credits).toMatch(/ไม่มีส่วนเกี่ยวข้องกับ Tesla, Inc\./);
  for (const who of ['Jingjing.pro', 'Kenney', 'MintoDog', 'ZaninDevelopers']) expect(credits).toContain(who);
  expectClean(w);
});

test('UI-02 HUD units + th-TH number formats', async ({ page }) => {
  await openGame(page, 'track=A&laps=2&skip=1');
  await page.waitForFunction(() => window.__game!.state() === 'racing');
  await page.evaluate(async () => { const g = window.__game!; g.qa.fixedStep(true, 1000 / 120); g.qa.setInput({ throttle: 1 }); await g.qa.step(500); });
  const hud = await page.evaluate(() => ({
    speed: document.querySelector('[data-qa=hud-speed]')!.textContent!,
    unit: document.querySelector('[data-qa=hud-speed]')!.parentElement!.textContent!,
    time: document.querySelector('[data-qa=hud-time]')!.textContent!,
    lap: document.querySelector('[data-qa=hud-lap]')!.textContent!,
    kmh: window.__game!.car().speedKmh,
  }));
  record(test.info(), 'UI-02', hud);
  expect(hud.unit).toContain('กม./ชม.');
  expect(Math.abs(Number(hud.speed.replace(/[^\d]/g, '')) - Math.round(hud.kmh))).toBeLessThanOrEqual(1); // FEEL-04 HUD = speedKmh ±1
  expect(hud.time).toMatch(/\d+:\d{2}\.\d{2,3}/);
  expect(hud.lap).toMatch(/1\s*\/\s*2/);
});

test('UI-03 Noto Sans Thai really loaded, no tofu', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(() => ({
    family: getComputedStyle(document.querySelector('h1')!).fontFamily,
    loaded: [...document.fonts].filter((f) => /Noto Sans Thai/i.test(f.family) && f.status === 'loaded').length,
    check: document.fonts.check('16px "Noto Sans Thai"', 'กำแหงสงคราม จอมสุรางค์ยาตร์ ปุ่ม'),
  }));
  record(test.info(), 'UI-03', r);
  expect(r.family).toMatch(/Noto Sans Thai/);
  expect(r.loaded).toBeGreaterThan(0);
  expect(r.check).toBe(true);
  // Visual check of stacked marks (above/below vowels + tone marks) in the real font.
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = 'qa-thai';
    d.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:99;background:#000;color:#fff;font:700 28px "Noto Sans Thai";padding:8px';
    d.textContent = 'ถนนกำแหงสงคราม จอมสุรางค์ยาตร์ ผู้ใหญ่ ปู่ ฤๅษี ป้ายไฟ';
    document.body.append(d);
  });
  await page.locator('#qa-thai').screenshot({ path: `docs/qa/reports/img/ui-03-thai-${test.info().project.name}.png` });
});

test('UI-08 pause: resume/restart/mute/menu, all ≥ 48 px, timer frozen', async ({ page }) => {
  const w = watch(page);
  await openGame(page, 'track=A&laps=2&skip=1');
  await page.waitForFunction(() => window.__game!.state() === 'racing');
  await page.waitForTimeout(1500);
  await page.locator('[data-qa=btn-pause]').tap();
  await expect.poll(() => page.evaluate(() => window.__game!.state())).toBe('paused');
  const t1 = await page.evaluate(() => window.__game!.track().lapTimeMs);
  await page.waitForTimeout(2000);
  const t2 = await page.evaluate(() => window.__game!.track().lapTimeMs);
  expect(t2, 'FEEL-18 lap timer must not run while paused').toBe(t1);
  const ids = ['btn-resume', 'btn-restart', 'btn-mute', 'btn-menu'];
  const sizes = [];
  for (const id of ids) { const b = await box(page, id); sizes.push({ id, w: b.width, h: b.height }); }
  record(test.info(), 'UI-08', { sizes, frozenMs: t2 - t1 });
  for (const s of sizes) { expect(s.w).toBeGreaterThanOrEqual(48); expect(s.h).toBeGreaterThanOrEqual(48); }
  await shot(page, `pause-${test.info().project.name}`);
  // AUD-04: mute is instant and persists across reload.
  await page.locator('[data-qa=btn-mute]').tap();
  expect(await page.evaluate(() => window.__game!.audio().muted)).toBe(true);
  await page.locator('[data-qa=btn-resume]').tap();
  await expect.poll(() => page.evaluate(() => window.__game!.state())).toBe('racing');
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
  await page.evaluate(() => window.__game!.ready);
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('settings.v1') ?? '{}').muted);
  expect(persisted, 'AUD-04 mute persists after reload').toBe(true);
  expect(await page.evaluate(() => window.__game!.audio().muted)).toBe(true);
  // Back to menu from pause.
  await page.evaluate(() => window.__game!.qa.start('A', { laps: 1, skipCountdown: true }));
  await page.locator('[data-qa=btn-pause]').tap();
  await page.locator('[data-qa=btn-menu]').tap();
  await expect.poll(() => page.evaluate(() => window.__game!.state())).toBe('menu');
  expectClean(w);
});

test('AUD-01/02/05 audio unlock on first tap, engine pitch smooth, events audible', async ({ page }) => {
  await seedSettings(page);
  await openGame(page);
  expect(await page.evaluate(() => window.__game!.audio().contextState)).not.toBe('running'); // no sound before a tap
  await page.locator('[data-qa=btn-start]').tap();
  await expect.poll(() => page.evaluate(() => window.__game!.audio().unlocked), { timeout: 5000 }).toBe(true);
  await page.waitForFunction(() => window.__game!.state() === 'racing', null, { timeout: 20_000 });
  const res = await page.evaluate(async () => {
    const g = window.__game!;
    g.qa.fixedStep(true, 1000 / 60);
    g.qa.setInput({ throttle: 1 });
    const rates: { r: number; v: number }[] = [];
    for (let i = 0; i < 240; i++) { await g.qa.step(1); await new Promise((r) => setTimeout(r, 4)); rates.push({ r: g.audio().engineRate, v: g.car().speedKmh }); }
    g.qa.setInput({ throttle: 1, jump: true }); await g.qa.step(2);
    const afterJump = g.audio().playing.slice();
    g.qa.setInput({ throttle: 1, jump: false });
    return { rates, afterJump, state: g.audio().contextState };
  });
  let maxStep = 0, drops = 0;
  for (let i = 1; i < res.rates.length; i++) {
    const a = res.rates[i - 1].r, b = res.rates[i].r;
    if (a > 0) maxStep = Math.max(maxStep, Math.abs(b - a) / a);
    if (b < a - 1e-6 && res.rates[i].v > res.rates[i - 1].v) drops++;
  }
  record(test.info(), 'AUD-02', { maxStepPct: maxStep * 100, drops, first: res.rates[0], last: res.rates.at(-1), afterJump: res.afterJump, state: res.state });
  expect(res.state).toBe('running');
  expect(maxStep).toBeLessThanOrEqual(0.02);
  expect(drops).toBe(0);
  expect(res.afterJump.join(' ')).toMatch(/jump/);
});
