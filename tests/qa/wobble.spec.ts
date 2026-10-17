// FEEL-19 straight-line stability (hotfix handling-wobble): on the real straights of track A, hands off
// at 100/200/300 km/h the heading must not oscillate (peak-to-peak < 0.3°), and a thumb tap (keyboard =
// same digital ramp as the touch pad) must settle within 1 s with ≤ 1 overshoot. Assist 'normal' (default) and 'off'.
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { ROOT, record, seedSettings } from './helpers';

test.use({ viewport: { width: 400, height: 200 } });

async function setup(page: Page, assist: string) {
  await seedSettings(page, { tutorialSeen: true, assist });
  await page.goto(`./?qa=1&track=A&laps=1&skip=1&quality=low`);
  await page.waitForFunction(() => window.__game?.state() === 'racing', null, { timeout: 30_000 });
  await page.evaluate(() => window.__game!.qa.fixedStep(true, 1000 / 60));
  await page.addScriptTag({ path: path.join(ROOT, 'tests/qa/driver.js') });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Straight runs on track A (s = track metres). Chord heading of the road stays within 1° over
// 355–590 (Ratchadamnoen north of the plaza) and 715–1255 (224 along the north moat); Manat bends
// gently, so there only yaw-rate sign flips count. Each run needs ~1 s warm-up + 2.6 s of road.
const RUNS = [
  { name: 'ratchadamnoen', s: 360, speeds: [100, 200], straight: true },
  { name: '224', s: 740, speeds: [100, 200, 300], straight: true },
  { name: 'manat', s: 1450, speeds: [100, 200, 300], straight: false },
];

async function cruise(page: Page, s: number, kmh: number, tap: null | { key: string; frames: number }) {
  // Place, hold speed with QA throttle only (steer left to the digital/assist path), sample each 60 Hz frame.
  await page.evaluate(([s0, v]) => {
    const g = window.__game!, d = (window as any).__drv;
    const p = d.place(s0);
    g.qa.teleport(p.x, p.z, p.h, v);
    g.qa.clearInput();
    g.qa.setTank(100);
    (window as any).__tr = [];
  }, [s, kmh]);
  const sample = async (n: number, phase: string) => {
    for (let i = 0; i < n; i++) {
      await page.evaluate(([v, ph]) => {
        const g = window.__game!, c = g.car(), cam = g.camera();
        // 300: hold boost (re-pressing it every few frames would fire the boost camera shake each time)
        const throttle = v > 235 || c.speedKmh < v - 1 ? 1 : c.speedKmh > v + 1 ? 0 : 0.6;
        g.qa.setInput({ throttle, boost: v > 235 });
        g.qa.setTank(100);
        const camYaw = Math.atan2(c.pos.x - cam.pos.x, -(c.pos.z - cam.pos.z)) * 180 / Math.PI;
        // road heading the lane assist aims at: chord 10–60 m ahead (ASSIST.laneAlignSpanM)
        const d = (window as any).__drv, pr = g.track().progressM, a = d.at(pr + 10), b = d.at(pr + 60);
        const road = Math.atan2(b.x - a.x, -(b.z - a.z)) * 180 / Math.PI;
        (window as any).__tr.push({ ph, road, yaw: c.yawDeg, slip: c.slipAngleDeg, kmh: c.speedKmh, steer: g.input().steer, camYaw, x: c.pos.x, z: c.pos.z, coll: c.lastCollision?.atMs ?? 0 });
      }, [kmh, phase] as [number, string]);
      await page.evaluate(() => window.__game!.qa.step(1));
    }
  };
  await sample(60, 'warm');
  if (tap) {
    await page.keyboard.down(tap.key);
    await sample(tap.frames, 'tap');
    await page.keyboard.up(tap.key);
  }
  await sample(150, 'free');
  return page.evaluate(() => (window as any).__tr) as Promise<any[]>;
}

const wrap = (a: number) => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };
// Wobble = the fast part of the heading: minus its 1 s centred moving average, so following a gently
// bending road (≪ 1 Hz) does not count, rocking at 1–5 Hz does. Peak-to-peak in degrees.
function wobblePP(ys: number[], win = 60) {
  const h = win >> 1, res: number[] = [];
  for (let i = h; i < ys.length - h; i++) {
    let m = 0;
    for (let j = i - h; j <= i + h; j++) m += ys[j];
    res.push(ys[i] - m / (2 * h + 1));
  }
  return res.length ? Math.max(...res) - Math.min(...res) : 0;
}
// yaw rates below 1°/s count as still (road chord jitter alone gives ~0.5°/s)
const RATE_EPS = 1;
function analyse(tr: any[]) {
  let free = tr.filter((p) => p.ph === 'free');
  // stop at the first wall contact (speed drop) — long hands-off runs end in the barrier where the road bends
  const hit = free.findIndex((p, i) => i > 0 && (p.kmh < free[i - 1].kmh * 0.97 || p.coll !== free[0].coll));
  if (hit > 0) free = free.slice(0, hit);
  const y0 = free[0].yaw;
  const hs = free.map((p) => wrap(p.yaw - y0));
  const cs = free.map((p) => wrap(p.camYaw - y0));
  const es = free.map((p) => wrap(p.yaw - p.road)); // heading error to the road the assist aims at
  const rates = free.slice(1).map((p, i) => wrap(p.yaw - free[i].yaw) * 60);
  const eRates = es.slice(1).map((e, i) => (e - es[i]) * 60);
  const flips = (arr: number[], th: number) => { let n = 0, prev = 0; for (const r of arr) { const s = Math.abs(r) < th ? 0 : Math.sign(r); if (s && prev && s !== prev) n++; if (s) prev = s; } return n; };
  // settled = turning no more than the road does: still in heading, or tracking the road (bends on Manat)
  const settledAt = (arr: number[]) => { for (let i = 0; i < arr.length; i++) if (arr.slice(i).every((r) => Math.abs(r) < RATE_EPS)) return i / 60; return null; };
  const sa = settledAt(rates), sb = settledAt(eRates);
  const settle = sa === null ? sb : sb === null ? sa : Math.min(sa, sb);
  const tail = hs.slice(30); // free phase minus the first 0.5 s (tap release)
  return {
    headingPPdeg: +(Math.max(...hs) - Math.min(...hs)).toFixed(3),
    wobblePPdeg: +wobblePP(tail).toFixed(3),
    camWobblePPdeg: +wobblePP(cs.slice(30)).toFixed(3),
    yawRateMaxDegS: +Math.max(...rates.map(Math.abs)).toFixed(2),
    yawFlips: Math.min(flips(rates, RATE_EPS), flips(eRates, RATE_EPS)),
    slipMaxDeg: +Math.max(...free.map((p) => Math.abs(p.slip))).toFixed(2),
    settleS: settle === null ? null : +settle.toFixed(2), samples: free.length, kmh: +free[free.length - 1].kmh.toFixed(0),
  };
}

for (const assist of ['normal', 'off']) {
  test(`FEEL-19 straight-line stability (assist ${assist})`, async ({ page }) => {
    await setup(page, assist);
    const out: any[] = [];
    for (const r of RUNS) for (const kmh of r.speeds) {
      out.push({ run: r.name, straight: r.straight, kmh, kind: 'hold', ...analyse(await cruise(page, r.s, kmh, null)) });
      out.push({ run: r.name, straight: r.straight, kmh, kind: 'tap', ...analyse(await cruise(page, r.s, kmh, { key: 'ArrowRight', frames: 6 })) });
    }
    record(test.info(), `FEEL-19-${assist}`, out);
    console.table(out);
    for (const o of out) {
      const id = `${o.run} ${o.kmh} ${o.kind}`;
      // Manat bends (5° in 50 m): following it reads as a slow wave and as ongoing yaw, so only the sign flips count there
      if (o.straight) {
        expect(o.wobblePPdeg, `${id}: heading oscillation`).toBeLessThan(0.3);
        expect(o.camWobblePPdeg, `${id}: camera oscillation`).toBeLessThan(0.3);
      }
      expect(o.yawFlips, `${id}: overshoot`).toBeLessThanOrEqual(o.kind === 'tap' ? 1 : 0);
      if (o.kind === 'tap' && o.straight) expect(o.settleS ?? 99, `${id}: settle`).toBeLessThanOrEqual(1.0);
    }
  });
}
