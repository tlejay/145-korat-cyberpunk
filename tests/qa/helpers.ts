// Shared QA helpers: open the game with ?qa=1, collect console errors / dialogs / failed
// requests (ERR-08, UI-04, DEP-02), and small math utils used by several specs.
import { expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameQA } from '../../src/qa/types';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const IMG_DIR = path.join(ROOT, 'docs/qa/reports/img');
export const RESULTS_DIR = path.join(ROOT, 'tests/qa/.results');

export interface Watch { errors: string[]; dialogs: string[]; badRequests: string[] }

/** Attach listeners that every test asserts on at the end (ERR-08 / UI-04 / DEP-02). */
export function watch(page: Page): Watch {
  const w: Watch = { errors: [], dialogs: [], badRequests: [] };
  page.on('console', (m) => { if (m.type() === 'error') w.errors.push(m.text()); });
  page.on('pageerror', (e) => w.errors.push(`pageerror: ${e.message}`));
  page.on('dialog', (d) => { w.dialogs.push(`${d.type()}: ${d.message()}`); void d.dismiss(); });
  page.on('response', (r) => { if (r.status() >= 400) w.badRequests.push(`${r.status()} ${r.url()}`); });
  return w;
}

export function expectClean(w: Watch, opts: { allowErrors?: RegExp; allowRequests?: RegExp } = {}) {
  expect(w.dialogs, 'UI-04: alert/confirm/prompt').toEqual([]);
  expect(w.errors.filter((e) => !opts.allowErrors?.test(e)), 'ERR-08: console errors').toEqual([]);
  expect(w.badRequests.filter((e) => !opts.allowRequests?.test(e)), 'DEP-02: 4xx/5xx').toEqual([]);
}

/** Fresh device: skip tutorial unless asked, so specs land on the menu deterministically. */
export async function seedSettings(page: Page, patch: Record<string, unknown> = { tutorialSeen: true }) {
  await page.addInitScript((p) => {
    try {
      if (!sessionStorage.getItem('__qaSeeded')) {
        localStorage.setItem('settings.v1', JSON.stringify(p));
        sessionStorage.setItem('__qaSeeded', '1');
      }
    } catch { /* storage blocked */ }
  }, patch);
}

/** Open the game in QA mode and wait for hooks + world data. */
export async function openGame(page: Page, query = '', opts: { seed?: boolean } = {}) {
  if (opts.seed !== false) await seedSettings(page);
  await page.goto(`./?qa=1${query ? `&${query}` : ''}`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
  await page.evaluate(() => window.__game!.ready);
}

/** Straight into a race (H-04), deterministic stepping on. */
export async function openRace(page: Page, laps = 2, fixedHz = 120) {
  await openGame(page, `track=A&laps=${laps}&skip=1`);
  await page.waitForFunction(() => window.__game!.state() === 'racing');
  await page.evaluate((hz) => window.__game!.qa.fixedStep(true, 1000 / hz), fixedHz);
}

export const g = (page: Page) => ({
  car: () => page.evaluate(() => JSON.parse(JSON.stringify(window.__game!.car())) as ReturnType<GameQA['car']>),
  track: () => page.evaluate(() => { const t = window.__game!.track(); return { ...t, centerline: [] as [number, number][] }; }),
  stats: () => page.evaluate(() => window.__game!.stats()),
});

export async function shot(page: Page, name: string) {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  await page.screenshot({ path: path.join(IMG_DIR, `${name}.png`) });
}

/** Persist measured values so the report can quote them (tests/qa/.results/metrics/*.json). */
export function record(info: TestInfo, id: string, data: unknown) {
  const dir = path.join(ROOT, 'tests/qa/.metrics'); // outside outputDir (Playwright wipes that each run)
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.${info.project.name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 1));
  void info.attach(id, { body: JSON.stringify(data, null, 1), contentType: 'application/json' });
}

export async function box(page: Page, qa: string) {
  const b = await page.locator(`[data-qa=${qa}]`).first().boundingBox();
  if (!b) throw new Error(`no box for ${qa}`);
  return { ...b, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
}

// Equirectangular metres around the OSM origin (same convention as research/osm/stats.json: x=east, y=north).
export const R_EARTH = 6378137;
export function llToXY(lat: number, lng: number, o: { lat: number; lon: number }) {
  const k = Math.PI / 180;
  return { x: (lng - o.lon) * k * R_EARTH * Math.cos(o.lat * k), y: (lat - o.lat) * k * R_EARTH };
}

export function distPointSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function distToPolyline(px: number, py: number, pts: { x: number; y: number }[]) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) best = Math.min(best, distPointSeg(px, py, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y));
  return best;
}

export const readJson = <T = unknown>(rel: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')) as T;

export const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

/** Fraction of "lit" pixels in a screenshot region (WebGL canvases can't be read back without preserveDrawingBuffer). */
export async function litFraction(page: Page, clip?: { x: number; y: number; width: number; height: number }) {
  const b64 = (await page.screenshot({ clip })).toString('base64');
  return page.evaluate(async (src) => {
    const img = new Image(); img.src = `data:image/png;base64,${src}`; await img.decode();
    const c = document.createElement('canvas'); c.width = 96; c.height = 48;
    const x = c.getContext('2d')!; x.drawImage(img, 0, 0, 96, 48);
    const d = x.getImageData(0, 0, 96, 48).data; let lit = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
    return lit / (96 * 48);
  }, b64);
}
