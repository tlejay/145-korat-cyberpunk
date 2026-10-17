// FEEL-03..18 + PHY-01..08 in the real game (real track, real physics, input through the QA pipeline).
// Chromium only (physics is engine-independent); small viewport + low quality keeps software GL fast.
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, record, seedSettings } from './helpers';

test.use({ viewport: { width: 400, height: 200 } });
test.describe.configure({ mode: 'parallel' });

type Drv = Record<string, never>;
declare global { interface Window { __drv: Drv & Record<string, (...a: never[]) => unknown> } }

async function setup(page: Page, laps = 2) {
  await seedSettings(page, { tutorialSeen: true, assist: 'off' });
  await page.goto(`./?qa=1&track=A&laps=${laps}&skip=1&quality=low`);
  await page.waitForFunction(() => window.__game?.state() === 'racing', null, { timeout: 30_000 });
  await page.evaluate(() => window.__game!.qa.fixedStep(true, 1000 / 60));
  await page.addScriptTag({ path: path.join(ROOT, 'tests/qa/driver.js') });
}

// Every evaluate below is plain JS against window.__game / window.__drv (see driver.js).
// Track distances s: the start/finish moved 210 m south of Ya Mo plaza (REPORT-checkpoint §2), so every s here is
// the M1 value + 210 (224 corner turn-in 710, longest straight 720–1322, corners per wayfinding turns).
/* eslint-disable @typescript-eslint/no-explicit-any */
const run = <T>(page: Page, fn: string) => page.evaluate(`(async () => { const g = window.__game, d = window.__drv; ${fn} })()`) as Promise<T>;

test('FEEL-03 / 03b launch: 0–100 normal, boost, launch+boost, peak g, front wheels', async ({ page }) => {
  await setup(page);
  const r = await run<any>(page, `
    const t100 = async (inp, arm) => {
      d.place(770); g.qa.setTank(100);
      if (arm) { await d.drive((c, t) => t < 0.6 ? { boost: true } : null, { frames: 1 }); }
      const g0 = g.car().g.peak;
      let lifted = false, peak = 0, t = 0;
      await d.drive((c, tt) => { t = tt; peak = Math.max(peak, c.g.total); if (!c.contact.wheels[0] || !c.contact.wheels[1]) lifted = true; return c.speedKmh < 100 ? inp : null; }, { frames: 1, maxS: 6 });
      return { t: +t.toFixed(3), peak: +peak.toFixed(2), lifted };
    };
    return { normal: await t100({ throttle: 1 }), boost: await t100({ throttle: 1, boost: true }), launch: await t100({ throttle: 1, boost: true }, true) };
  `);
  record(test.info(), 'FEEL-03', r);
  expect(r.normal.t).toBeGreaterThanOrEqual(2.33 * 0.9); expect(r.normal.t).toBeLessThanOrEqual(2.33 * 1.1);
  expect(r.boost.t).toBeGreaterThanOrEqual(1.08 * 0.9); expect(r.boost.t).toBeLessThanOrEqual(1.08 * 1.1);
  expect(r.launch.t).toBeGreaterThanOrEqual(0.63 * 0.9); expect(r.launch.t).toBeLessThanOrEqual(0.63 * 1.1);
  expect(r.launch.peak).toBeGreaterThanOrEqual(4.4); expect(r.launch.peak).toBeLessThanOrEqual(4.9);
  expect(r.launch.lifted).toBe(false);
});

test('FEEL-04 top speed on the longest straight + PHY-06 braking 100→0', async ({ page }) => {
  await setup(page);
  const r = await run<any>(page, `
    // Ratchasima-Chokchai eastbound (s 720–1322) is the longest straight; start at the corner exit.
    d.place(750); let vmax = 0, sAt = 0;
    await d.drive((c) => { vmax = Math.max(vmax, c.speedKmh); const s = d.nearestS(c.pos.x, c.pos.z, 810); sAt = s; if (s > 1270) return null; const a = d.at(s + 25); return { throttle: 1, steer: d.steerTo(c, d.headingTo(c.pos.x, c.pos.z, a.x, a.z)) }; }, { frames: 1, maxS: 20 });
    const top = { vmax, untilS: sAt };
    await d.runUp(770, 101);
    const p0 = d.snap().pos; let p1 = p0;
    await d.drive((c, t) => { p1 = c.pos; return c.speedKmh > 0.5 && t < 6 ? { brake: 1 } : null; }, { frames: 1 });
    return { top, brakeM: Math.hypot(p1.x - p0.x, p1.z - p0.z) };
  `);
  record(test.info(), 'FEEL-04', r);
  expect(r.brakeM).toBeGreaterThanOrEqual(17.8 * 0.9); expect(r.brakeM).toBeLessThanOrEqual(17.8 * 1.1 + 2); // +2 m: started at 101
  expect(r.top.vmax, 'reached on the in-game straight (design top 240 needs a longer run; headless suite checks 240)').toBeGreaterThan(200);
});

test('FEEL-05 / 05b jump at 60: height, airtime, landing burn, 4 wheels, tank, spam', async ({ page }) => {
  await setup(page);
  const r = await run<any>(page, `
    const land = []; g.on('land', (e) => land.push(JSON.parse(JSON.stringify(e))));
    const jumps = [];
    for (let i = 0; i < 20; i++) {
      await d.runUp(770 + (i % 4) * 40, 60, { tank: 100 });
      const u0 = g.car().tank.units; let apex = 0, air = 0, landT = null, four = null, minY = 0, clear = Infinity;
      await d.drive((c, t) => { apex = Math.max(apex, c.pos.y); minY = Math.min(minY, c.pos.y); const wc = g.qa.wheelClearanceM(); if (wc !== null) clear = Math.min(clear, wc); if (c.airborne) air = t; if (t > 0.2 && !c.airborne && landT === null) landT = t; if (landT !== null && four === null && c.wheelsOnGround === 4) four = (t - landT) * 1000; return t < 2.4 ? { throttle: 0.3, jump: t < 0.03 } : null; }, { frames: 1 });
      jumps.push({ apex, air, four, minY, clear, used: g.car().tank.lastUseUnits });
    }
    // Spam: hammer jump every 50 ms for 4 s with a full tank — must not climb into the sky.
    await d.runUp(770, 60, { tank: 100 });
    let spamApex = 0;
    await d.drive((c, t) => { spamApex = Math.max(spamApex, c.pos.y); return t < 4 ? { throttle: 0.3, jump: Math.floor(t * 20) % 2 === 0 } : null; }, { frames: 1 });
    return { jumps, land: land.slice(0, 20), spamApex };
  `);
  const apex = r.jumps.map((j: any) => j.apex), air = r.jumps.map((j: any) => j.air);
  const sum = { apexMin: Math.min(...apex), apexMax: Math.max(...apex), airMin: Math.min(...air), airMax: Math.max(...air), fourMax: Math.max(...r.jumps.map((j: any) => j.four ?? 9999)), minY: Math.min(...r.jumps.map((j: any) => j.minY)),
    wheelClearM: Math.min(...r.jumps.map((j: any) => j.clear)), used: [...new Set(r.jumps.map((j: any) => j.used))], vyMin: Math.min(...r.land.map((l: any) => l.vyMs)), spamApex: r.spamApex, qualities: [...new Set(r.land.map((l: any) => l.quality))] };
  record(test.info(), 'FEEL-05', sum);
  expect(sum.apexMin).toBeGreaterThanOrEqual(3.53 * 0.85); expect(sum.apexMax).toBeLessThanOrEqual(3.53 * 1.15);
  expect(sum.airMin).toBeGreaterThanOrEqual(1.53 * 0.85); expect(sum.airMax).toBeLessThanOrEqual(1.53 * 1.15);
  expect(sum.fourMax).toBeLessThanOrEqual(300);
  // conductor 20:52: suspension squat is real — body ref ≥ −0.15 m, and no wheel below the road surface.
  expect(sum.minY).toBeGreaterThanOrEqual(-0.15);
  expect(sum.wheelClearM, 'lowest drawn tyre vs road (qa.wheelClearanceM)').toBeGreaterThanOrEqual(-0.03);
  expect(sum.vyMin).toBeGreaterThanOrEqual(-3.5);
  for (const u of sum.used) { expect(u).toBeGreaterThanOrEqual(34); expect(u).toBeLessThanOrEqual(36); }
  expect(sum.spamApex).toBeLessThanOrEqual(6);
});

test('FEEL-06 jump next to walls / on corners × 30: never stuck or under the world', async ({ page }) => {
  test.setTimeout(600_000);
  await setup(page);
  const r = await run<any>(page, `
    const rnd = d.rng(6); const res = [];
    const corners = [715, 1325, 2227, 2542, 2667, 2960];
    for (let i = 0; i < 30; i++) {
      const s = corners[i % 6] - 40 + rnd() * 30; const lat = (rnd() < 0.5 ? -1 : 1) * (3 + rnd() * 2);
      d.place(s, lat, (rnd() - 0.5) * 30); g.qa.setTank(100);
      await d.drive((c, t) => t < 0.9 ? { throttle: 1 } : null, { frames: 1 });
      let minY = 0, landT = null, okT = null, blocked = false, maxStuck = 0; const rs0 = g.world().respawnCount;
      await d.drive((c, t) => {
        minY = Math.min(minY, c.pos.y); if (c.contact.surface === 'blocked') blocked = true;
        if (t > 0.2 && !c.airborne && landT === null) landT = t;
        if (landT !== null && okT === null && c.wheelsOnGround === 4) okT = t - landT;
        if (landT !== null) maxStuck = Math.max(maxStuck, c.stuckMs);
        if (t >= 5) return null;
        if (landT === null) return { throttle: 0.4, jump: t < 0.03 };
        const k = t - landT; // player-like recovery: drive, back off a wall, drive again
        return k < 1 ? { throttle: 1 } : k < 2.2 ? { brake: 1, steer: 1 } : { throttle: 1, steer: -0.6 };
      }, { frames: 1 });
      const c = d.snap();
      res.push({ s: +s.toFixed(0), lat: +lat.toFixed(1), minY, blocked, landed: landT !== null, recoverS: okT, maxStuck: Math.round(maxStuck), respawned: g.world().respawnCount > rs0, y: c.pos.y });
    }
    return res;
  `);
  const bad = r.filter((x: any) => x.minY < -0.5 || x.blocked || !x.landed || x.recoverS === null || x.recoverS > 0.5 || (x.maxStuck >= 3000 && !x.respawned));
  record(test.info(), 'FEEL-06', { n: r.length, bad, all: r });
  expect(bad).toEqual([]);
});

test('FEEL-08 slalom at 120 for 10 s: no spin', async ({ page }) => {
  await setup(page);
  const r = await run<any>(page, `
    await d.runUp(740, 120);
    let maxDev = 0, maxSlip = 0, hits = 0; const lc0 = JSON.stringify(g.car().lastCollision);
    await d.drive((c, t) => {
      const s = d.nearestS(c.pos.x, c.pos.z, 810); const dev = Math.abs(d.wrap(c.yawDeg - d.at(s).h));
      maxDev = Math.max(maxDev, dev); maxSlip = Math.max(maxSlip, Math.abs(c.slipAngleDeg));
      return t < 10 ? { throttle: c.speedKmh < 120 ? 1 : 0.4, steer: Math.floor(t / 0.5) % 2 ? 1 : -1 } : null;
    }, { frames: 1, maxS: 11 });
    return { maxDev, maxSlip, collided: JSON.stringify(g.car().lastCollision) !== lc0 };
  `);
  record(test.info(), 'FEEL-08', r);
  expect(r.maxDev).toBeLessThanOrEqual(90);
});

test('FEEL-07 / PHY-02 / PHY-03 drift through the 224 right-hander (scripted driver, 10 tries)', async ({ page }) => {
  await setup(page);
  const r = await run<any>(page, `
    const tries = [];
    const turn = d.at(715), exitH = d.at(810).h, entryH = d.at(650).h;
    for (let i = 0; i < 10; i++) {
      const target = 105 + i * 2;      // 105 … 123 km/h entry
      const brakeAt = 30 + (i % 3) * 4; // metres before the apex
      d.place(510); g.qa.setTank(100);
      let phase = 'run', driftT = 0, maxSpin = 0, entryV = 0, minSlipAfter = 99, releaseT = null, hit = false;
      const lc0 = JSON.stringify(g.car().lastCollision);
      await d.drive((c, t) => {
        const s = d.nearestS(c.pos.x, c.pos.z, 610);
        if (c.drifting) driftT += 1 / 60;
        maxSpin = Math.max(maxSpin, Math.abs(d.wrap(c.yawDeg - entryH)));
        if (phase === 'run') { if (s > 715 - brakeAt) { phase = 'turn'; entryV = c.speedKmh; } const a = d.at(s + 20); return { ...d.speedCtl(c, target), steer: d.steerTo(c, d.headingTo(c.pos.x, c.pos.z, a.x, a.z)) }; }
        if (phase === 'turn') {
          const dh = Math.abs(d.wrap(c.yawDeg - exitH));
          if (dh < 12 || s > 770) { phase = 'exit'; releaseT = t; }
          return { throttle: 0.8, brake: t % 1 < 0.15 && c.speedKmh > 60 ? 1 : 0, steer: 1 };
        }
        if (t - releaseT > 0.3) minSlipAfter = Math.min(minSlipAfter, Math.abs(c.slipAngleDeg));
        return t - releaseT < 1.5 ? { throttle: 1, steer: 0 } : null;
      }, { frames: 1, maxS: 14 });
      hit = JSON.stringify(g.car().lastCollision) !== lc0;
      const c = d.snap();
      tries.push({ target, entryV: +entryV.toFixed(0), driftS: +driftT.toFixed(2), maxSpin: +maxSpin.toFixed(0), exitDev: +Math.abs(d.wrap(c.yawDeg - exitH)).toFixed(0), slipAfter: +minSlipAfter.toFixed(1), hit, endS: +d.nearestS(c.pos.x, c.pos.z, 770).toFixed(0) });
    }
    return tries;
  `);
  const ok = r.filter((t: any) => t.driftS >= 1.0 && t.maxSpin <= 120 + 0 && t.exitDev <= 30 && t.slipAfter < 5);
  record(test.info(), 'FEEL-07', { ok: ok.length, tries: r });
  // Scripted driver is not a human (TEST-PLAN: "คนเล่น" 8/10). Gate only on "never spins out"; drift feel → real-device checklist.
  expect(r.filter((t: any) => t.maxSpin > 120 + 93), 'spun past 120° beyond the corner').toEqual([]);
});

test('FEEL-13 / FEEL-14 crash into walls at 30/80/110/150/200+ km/h, 0° and 45°: not stuck, no tunnelling, no launch', async ({ page }) => {
  test.setTimeout(900_000);
  await setup(page);
  const r = await run<any>(page, `
    const res = [];
    // Overshoot every 90° corner straight into the outer wall (0°) or angled (45°).
    const corners = [1325, 2227, 2542, 2667, 2960, 715];
    const speeds = [30, 80, 110, 150, 210]; // 110 = QA M3 FEEL-14 bounce (Sanphasit → Watcharasarit)
    let n = 0;
    for (const sc of corners) for (const v of speeds) for (const ang of [0, 45]) {
      n++;
      const runup = v > 150 ? 260 : 180;
      d.place(sc - runup); g.qa.setTank(100);
      await g.qa.step(2); // hook: the previous trial's lastCollision re-appears one step after a teleport — baseline after it
      const h0 = d.at(sc - 30).h;
      let before = 0, after = null, maxY = 0, hitAt = null, blocked = false;
      const lc0 = JSON.stringify(g.car().lastCollision); let lc = lc0;
      await d.drive((c, t) => {
        maxY = Math.max(maxY, c.pos.y); if (c.contact.surface === 'blocked') blocked = true;
        lc = JSON.stringify(c.lastCollision);
        if (hitAt === null && lc !== lc0) { hitAt = t; after = c.speedKmh; }
        if (hitAt === null) {
          before = c.speedKmh;
          const s = d.nearestS(c.pos.x, c.pos.z, sc - 50);
          const aim = s > sc - 35 ? h0 + (ang ? (sc % 2 ? 45 : -45) : 0) : d.headingTo(c.pos.x, c.pos.z, d.at(s + 20).x, d.at(s + 20).z);
          return { throttle: c.speedKmh < v ? 1 : 0.2, boost: v > 200 && c.speedKmh < v, steer: d.steerTo(c, aim) };
        }
        return null;
      }, { frames: 1, maxS: 14 });
      // Recovery: hold throttle 1.2 s; if not moving, reverse 1.5 s; then throttle again.
      let maxStuck = 0, autoRespawn = false; const rs0 = g.world().respawnCount;
      await d.drive((c, t) => { maxStuck = Math.max(maxStuck, c.stuckMs); if (c.contact.surface === 'blocked') blocked = true; maxY = Math.max(maxY, c.pos.y); if (t > 5) return null; return t < 1.2 ? { throttle: 1 } : t < 2.7 ? { brake: 1, steer: 1 } : { throttle: 1, steer: -0.5 }; }, { frames: 1 });
      autoRespawn = g.world().respawnCount > rs0;
      res.push({ corner: sc, v, ang, before: +before.toFixed(0), after: after === null ? null : +after.toFixed(0), hit: hitAt !== null, maxY: +maxY.toFixed(2), blocked, maxStuck: Math.round(maxStuck), autoRespawn, kind: g.car().lastCollision?.objectKind ?? null });
    }
    return res;
  `);
  const hits = r.filter((x: any) => x.hit);
  const bad14 = hits.filter((x: any) => x.blocked || x.maxY > 3 || (x.after ?? 0) > x.before + 1);
  const bad13 = hits.filter((x: any) => x.maxStuck >= 2000 && !x.autoRespawn);
  record(test.info(), 'FEEL-13', { trials: r.length, hits: hits.length, bad13, bad14, all: r });
  expect(hits.length).toBeGreaterThanOrEqual(30);
  expect(bad14, 'FEEL-14').toEqual([]);
  expect(bad13, 'FEEL-13').toEqual([]);
});

test('FEEL-15 fuzz 5 min (seeded): never below the world, every out-of-bounds respawns ≤ 1.5 s', async ({ page }) => {
  await setup(page, 9);
  const r = await run<any>(page, `
    const rnd = d.rng(15); let belowT = 0, worstBelow = 0, outside = 0, waterSince = null, worstWater = 0;
    const b = g.world().boundsM; let inp = {};
    await d.drive((c, t) => {
      if (Math.floor(t * 2) !== Math.floor((t - 1 / 30) * 2)) inp = { throttle: rnd() < 0.8 ? 1 : 0, brake: rnd() < 0.15 ? 1 : 0, steer: rnd() * 2 - 1, jump: rnd() < 0.05, boost: rnd() < 0.2 };
      if (c.pos.y < -5) { belowT += 1 / 30; worstBelow = Math.max(worstBelow, belowT); } else belowT = 0;
      if (c.pos.x < b.minX || c.pos.x > b.maxX || c.pos.z < b.minZ || c.pos.z > b.maxZ) outside++;
      if (c.contact.surface === 'water') { if (waterSince === null) waterSince = t; worstWater = Math.max(worstWater, t - waterSince); } else waterSince = null;
      return t < 300 ? inp : null;
    }, { frames: 2, maxS: 301 });
    const w = g.world();
    return { worstBelowS: worstBelow, outside, worstWaterS: worstWater, respawns: w.respawnCount, oob: w.outOfBoundsCount, lap: g.track().lap, prog: g.track().progressM };
  `);
  record(test.info(), 'FEEL-15', r);
  expect(r.worstBelowS).toBeLessThanOrEqual(1);
  expect(r.outside).toBe(0);
  expect(r.worstWaterS).toBeLessThanOrEqual(1.5);
});

test('FEEL-17 cheating: skipping checkpoints or reversing over the line never counts a lap', async ({ page }) => {
  await setup(page);
  const r = await run<any>(page, `
    const laps = []; g.on('lap', (e) => laps.push(JSON.parse(JSON.stringify(e))));
    // 1) teleport ahead past most checkpoints, then autopilot over the line
    d.place(3110); g.qa.autopilot(true);
    await d.drive((c, t) => t < 25 ? {} : null, { frames: 4, maxS: 26 });
    g.qa.autopilot(false);
    const a = { lap: g.track().lap, lapTimes: g.track().lapTimesMs.slice(), missed: g.track().checkpoint.missed, laps: laps.length };
    // 2) cross the line backwards from just after it
    await g.qa.restart(); await new Promise((res) => setTimeout(res, 50));
    g.qa.fixedStep(true, 1000 / 60);
    d.place(30, 0, 180);
    await d.drive((c, t) => t < 8 ? { throttle: 1 } : null, { frames: 2 });
    const b = { lap: g.track().lap, lapTimes: g.track().lapTimesMs.slice(), laps: laps.length };
    return { skip: a, reverse: b };
  `);
  record(test.info(), 'FEEL-17', r);
  expect(r.skip.lapTimes.length, 'teleport past checkpoints must not complete a lap').toBe(0);
  expect(r.reverse.lapTimes.length, 'driving backwards over the line must not count').toBe(0);
});

test('FEEL-18 lap timing = simulated time (2 laps autopilot)', async ({ page }) => {
  await setup(page);
  const r = await run<any>(page, `
    g.qa.autopilot(true);
    const t0 = g.track().lapTimeMs; let steps = 0;
    while (g.track().lapTimesMs.length < 2 && steps < 60 * 400) { await g.qa.step(30); steps += 30; }
    g.qa.autopilot(false);
    const t = g.track();
    return { lapTimesMs: t.lapTimesMs, simMs: steps * 1000 / 60 + t0, startOffsetMs: t0, missed: t.checkpoint.missed, respawns: g.world().respawnCount, state: g.state() };
  `);
  const sum = r.lapTimesMs.reduce((a: number, b: number) => a + b, 0);
  record(test.info(), 'FEEL-18', { ...r, sumMs: sum, diffMs: r.simMs - sum });
  expect(r.lapTimesMs.length).toBe(2);
  expect(r.missed).toBe(0);
  // simMs = lap clock before fixedStep + stepped sim time. The last 30-frame chunk can overshoot ≤ 500 ms; ±50 ms/lap error.
  expect(r.simMs - sum).toBeGreaterThanOrEqual(-100);
  expect(r.simMs - sum).toBeLessThanOrEqual(600);
});

test('PHY-04 / PHY-05 / REAL-05 moat jump line (scripted) — falling in respawns ≤ 1.5 s', async ({ page }) => {
  await setup(page);
  const r = await run<any>(page, `
    const T = { x: 495, z: -577.4 }, Lp = { x: 529.5, z: -528 };
    const ul = Math.hypot(Lp.x - T.x, Lp.z - T.z), u = { x: (Lp.x - T.x) / ul, z: (Lp.z - T.z) / ul };
    const attempt = async (v, hoverS) => {
      const ev = []; const offs = ['jump', 'land', 'splash', 'respawn', 'collision'].map((e) => g.on(e, (x) => { const c = g.car(); ev.push({ e, x: +c.pos.x.toFixed(1), z: +c.pos.z.toFixed(1), v: +c.speedKmh.toFixed(0), k: x?.kind ?? x?.quality ?? '' }); }));
      d.place(1030); g.qa.setTank(100);
      let phase = 'run', tj = null, tSplash = null, tResp = null; const rs0 = g.world().respawnCount;
      await d.drive((c, t) => {
        const P = c.pos, along = (P.x - T.x) * u.x + (P.z - T.z) * u.z;
        if (tSplash === null && c.contact.surface === 'water' && !c.airborne) tSplash = t;
        if (tResp === null && g.world().respawnCount > rs0) tResp = t;
        if (phase === 'run') { if (P.x > 455) phase = 'cut'; const s = d.nearestS(P.x, P.z, 1110), a = d.at(s + 20); return { ...d.speedCtl(c, v), steer: d.steerTo(c, d.headingTo(P.x, P.z, a.x, a.z)) }; }
        const aim = { x: T.x + u.x * (along + 14), z: T.z + u.z * (along + 14) };
        if (phase === 'cut') { if (along > -3.2) { phase = 'air'; tj = t; } return { ...d.speedCtl(c, v), steer: d.steerTo(c, d.headingTo(P.x, P.z, aim.x, aim.z)), jump: phase === 'air' }; }
        if (phase === 'air') { if (!c.airborne && t - tj > 0.3) phase = 'out'; return { throttle: 0.2, jump: t - tj < 0.05 || (hoverS > 0 && t - tj > 0.6 && t - tj < 0.6 + hoverS), steer: d.steerTo(c, d.headingTo(P.x, P.z, aim.x, aim.z)) }; }
        return t - tj < 4 ? { brake: 0.6 } : null;
      }, { frames: 1, maxS: 18 });
      offs.forEach((f) => f());
      return { v, hoverS, ev, splashToRespawnS: tSplash !== null && tResp !== null ? +(tResp - tSplash).toFixed(2) : null, landedClean: ev.some((e) => e.e === 'land' && e.k === 'clean' && Math.abs(e.x - 532) < 8 && e.z > -548) };
    };
    return { show: [await attempt(100, 0.64), await attempt(110, 0.4)], slow: await attempt(70, 0) };
  `);
  record(test.info(), 'PHY-04', r);
  // PHY-04 (clean landing on Manat) is not asserted: the scripted line can't hold the 55° cut (see report) and
  // qa.teleport ignores speedKmh, so the TEST-PLAN procedure can't be run as written → real-device checklist.
  // PHY-05 / FEEL-15: whichever attempt ends in the water must respawn within 1.5 s (sim time).
  const wet = [...r.show, r.slow].filter((a: any) => a.ev.some((e: any) => e.e === 'splash'));
  expect(wet.length, 'at least one scripted attempt falls into the moat').toBeGreaterThan(0);
  for (const a of wet) { expect(a.splashToRespawnS).not.toBeNull(); expect(a.splashToRespawnS).toBeLessThanOrEqual(1.5); }
});

test('moat corridor: walls near the 55° jump line are jumpable (no invisible mid-air wall)', async () => {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/track-A.json'), 'utf8'));
  const T = { x: 495, z: -577.4 }, L = { x: 529.5, z: -528 };
  const ul = Math.hypot(L.x - T.x, L.z - T.z), u = { x: (L.x - T.x) / ul, z: (L.z - T.z) / ul };
  const tall: string[] = [];
  for (let i = 0; i < raw.walls.length; i += 6) {
    const [ax, az, bx, bz] = raw.walls.slice(i, i + 4).map((v: number) => v / 10), h = raw.walls[i + 5] ? raw.walls[i + 5] / 10 : Infinity;
    if (h <= 1.2) continue;
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const px = ax + (bx - ax) * f, pz = az + (bz - az) * f;
      const along = (px - T.x) * u.x + (pz - T.z) * u.z, lat = Math.abs((px - T.x) * u.z - (pz - T.z) * u.x);
      // Inside the flight corridor (takeoff → 40 m along, ±8 m) and over the water band (z −577.5 … −548).
      if (along > 0 && along < 40 && lat < 8 && pz < -548 && pz > -577.5) { tall.push(`(${ax},${az})→(${bx},${az === bz ? bz : bz}) h=${h}`); break; }
    }
  }
  record(test.info(), 'MOAT-WALL', { tall });
  expect(tall, 'infinite-height walls inside the jump corridor over water').toEqual([]);
});

test('REAL-12 monument: 8 directions with boost + jump never reach the base', async ({ page }) => {
  await setup(page);
  const r = await run<any>(page, `
    const res = []; const m = g.world().monument.pos;
    // Start on the track (drivable), from the centreline point whose bearing is closest to each 45° direction, 40–220 m out.
    for (let k = 0; k < 8; k++) {
      const a = k * 45; let best = null, bd = 1e9;
      for (const [x, z] of d.cl) { const r0 = Math.hypot(x - m.x, z - m.z); if (r0 < 40 || r0 > 220) continue; const b = Math.abs(d.wrap(d.headingTo(m.x, m.z, x, z) - a)); if (b < bd) { bd = b; best = [x, z]; } }
      const [sx, sz] = best;
      g.qa.teleport(sx, sz, d.headingTo(sx, sz, m.x, m.z)); g.qa.setTank(100);
      let minD = 1e9, jumped = 0, boosted = false; const lc0 = JSON.stringify(g.car().lastCollision); let kind = null;
      g.on('jump', () => jumped++);
      await d.drive((c, t) => {
        minD = Math.min(minD, Math.hypot(c.pos.x - m.x, c.pos.z - m.z));
        if (c.boost.active && c.tank.lastUse === 'boost') boosted = true;
        if (JSON.stringify(c.lastCollision) !== lc0) kind = c.lastCollision.objectKind;
        return t < 9 ? { throttle: 1, boost: true, jump: Math.floor(t * 4) % 2 === 0, steer: d.steerTo(c, d.headingTo(c.pos.x, c.pos.z, m.x, m.z)) } : null;
      }, { frames: 1, maxS: 10 });
      res.push({ dir: a, from: [+sx.toFixed(0), +sz.toFixed(0)], bearingErr: +bd.toFixed(0), minD: +minD.toFixed(1), kind, monumentAfter: g.world().monument.pos });
    }
    return res;
  `);
  record(test.info(), 'REAL-12', r);
  // Base footprint 26×26 m (OSM) → the car centre must stay > 13 m + half car length (2.2 m) from the statue centre.
  for (const x of r) { expect(x.minD, `dir ${x.dir}`).toBeGreaterThan(15.2); expect(x.monumentAfter).toEqual({ x: 0, y: 0, z: 0 }); }
});

test('PHY-08 physics step budget (this machine) + stub check', async ({ page }) => {
  await setup(page);
  const r = await run<any>(page, `
    g.qa.fixedStep(false); g.qa.setInput({ throttle: 1 });
    const xs = []; for (let i = 0; i < 120; i++) { await new Promise((res) => requestAnimationFrame(res)); xs.push(g.physics().stepMsP95); }
    g.qa.clearInput();
    return { stepMs: xs.sort((a, b) => a - b)[Math.floor(xs.length * 0.95)], physics: (({ tuning, ...x }) => x)(g.physics()) };
  `);
  record(test.info(), 'PHY-08', r);
  expect(r.physics.source).toBe('real');
  expect(r.stepMs * 2).toBeLessThanOrEqual(1.0);
});

test('FEEL-10b camera keeps up with the car at 30 / 20 / 15 fps (top speed + boost on the 224 straight)', async ({ page }) => {
  await setup(page);
  const r = await run<any>(page, `
    const out = {};
    for (const hz of [60, 30, 20, 15]) {
      g.qa.fixedStep(true, 1000 / hz);
      d.place(750); g.qa.setTank(100);
      let maxDist = 0, vmax = 0; const frames = Math.round(hz * 9);
      for (let i = 0; i < frames; i++) {
        const c = g.car(); const s = d.nearestS(c.pos.x, c.pos.z, 910); const a = d.at(s + 25);
        if (s > 1270) break;
        g.qa.setInput({ throttle: 1, boost: true, steer: d.steerTo(c, d.headingTo(c.pos.x, c.pos.z, a.x, a.z)) });
        await g.qa.step(1);
        maxDist = Math.max(maxDist, g.camera().distanceToCarM); vmax = Math.max(vmax, g.car().speedKmh);
      }
      g.qa.clearInput();
      out[hz] = { maxCamDistM: +maxDist.toFixed(1), vmax: +vmax.toFixed(0) };
    }
    g.qa.fixedStep(true, 1000 / 60);
    return out;
  `);
  record(test.info(), 'FEEL-10b', r);
  // fix #8: camera travel limit is per second (camMaxStep × 60 × dt, ≥ the car's own travel) + snap beyond
  // camSnapM — it used to be 1.5 m per FRAME, so at 20 fps the camera fell 107 m behind (M1 report Y1).
  for (const hz of ['60', '30', '20', '15']) expect(r[hz].maxCamDistM, `${hz} fps`).toBeLessThanOrEqual(20);
});
