#!/usr/bin/env node
// Headless straight-line stability check (hotfix handling-wobble): real CarPhysics on a flat road,
// steering through the real touch ramp (src/input sample()) and the lane-align assist law
// (engine.ts assist(), heading error to a straight north road). Prints heading oscillation,
// yaw rate and settle time after a thumb tap. Usage: node scripts/test-wobble.mjs [--json] [--yawDamp=16 --laneAlignKp=3.5 …]
// (any TUNING / ASSIST key can be overridden for tuning sweeps).
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs'; import { fileURLToPath } from 'node:url';
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('.') && spec.endsWith('.js') && ctx.parentURL?.endsWith('.ts')) {
      const ts = new URL(spec.slice(0, -3) + '.ts', ctx.parentURL);
      if (existsSync(fileURLToPath(ts))) return next(ts.href, ctx);
    }
    return next(spec, ctx);
  }`), import.meta.url);
const { CarPhysics } = await import('../src/car/physics.ts');
const { TUNING, KMH } = await import('../src/car/config.ts');
const { ASSIST, laneAlignSteer } = await import('../src/input/index.ts');
for (const a of process.argv.slice(2)) { const m = a.match(/^--(\w+)=(.+)$/); if (m) { if (m[1] in TUNING) TUNING[m[1]] = +m[2]; else if (m[1] in ASSIST) ASSIST[m[1]] = +m[2]; } }

const DT = 1 / 120, DEG = 180 / Math.PI;
const env = { barriers: [], heightAt: () => 0, surfaceAt: () => 'road', zones: { noBoostNoJump: [] },
  moatJump: { takeoff: { x: 1e5, z: 1e5 }, landing: { x: 1e5, z: 1e5 + 1 }, widthM: 28.6 } };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Same law as input/index.ts sample() for a digital (touch/keyboard) source.
function makeRamp() {
  let steer = 0;
  return (digital, speedFrac) => {
    if (digital !== 0 && Math.sign(steer) !== digital && steer !== 0) steer = 0;
    const rampS = ASSIST.rampLowS + (ASSIST.rampHighS - ASSIST.rampLowS) * Math.min(1, speedFrac);
    if (digital !== 0) steer += (digital * DT) / rampS;
    else steer -= Math.sign(steer) * Math.min(Math.abs(steer), DT / ASSIST.returnS);
    steer = Math.max(-1, Math.min(1, steer));
    if (digital === 0 && Math.abs(steer) < 1e-3) steer = 0;
    return steer;
  };
}
// engine.ts assist() on a straight north road (heading 0); prevHeading → yaw rate like the engine.
const assistK = { off: 0, normal: 0.5, high: 0.9 };
function assist(steer, car, mode, prev) {
  const k = assistK[mode];
  if (!k || Math.abs(steer) > 0.02 || car.drifting || car.airborne || car.speed * KMH < 20) return steer;
  const err = wrap(0 - car.heading);
  if (Math.abs(err) > 15 / DEG) return steer;
  return laneAlignSteer(err, wrap(car.heading - prev) * 120, k);
}
function cruise(kmh, mode, tap = null, seconds = 4) {
  const car = new CarPhysics();
  car.reset(0, 0, 0, 0);
  for (let i = 0; i < 120; i++) car.step(DT, { steer: 0, throttle: 0, brake: 0, jump: false, boost: false }, env);
  car.setPlanarVelocity(0, -kmh / KMH);
  const ramp = makeRamp();
  const vLim = kmh > TUNING.vMaxKmh;
  const trace = [];
  let t = 0, prevH = 0;
  // settle 1 s at speed first
  const total = 1 + seconds;
  while (t < total) {
    const u = car.forwardSpeed * KMH;
    let digital = 0;
    if (tap && t >= 1 && t < 1 + tap.s) digital = tap.dir;
    const raw = ramp(digital, car.speed * KMH / TUNING.vMaxKmh);
    const steer = assist(raw, car, mode, prevH);
    prevH = car.heading;
    const throttle = u < kmh - 1 ? 1 : u > kmh + 1 ? 0 : 0.5;
    car.step(DT, { steer, throttle, brake: 0, jump: false, boost: vLim && u < kmh }, env);
    car.gas = 100;
    t += DT;
    if (t >= 1) trace.push({ t: t - 1, h: car.heading * DEG, r: car.r * DEG, beta: car.tel.slip.betaDeg, steer, x: car.x });
  }
  return trace;
}

function metrics(tr, fromT = 0) {
  const s = tr.filter((p) => p.t >= fromT);
  const hs = s.map((p) => p.h), rs = s.map((p) => p.r);
  const hMean = hs.reduce((a, b) => a + b, 0) / hs.length;
  const pp = Math.max(...hs) - Math.min(...hs);
  // zero crossings of yaw rate (> 0.05°/s) → oscillation frequency
  let cross = 0, prev = 0;
  for (const r of rs) { const sg = Math.abs(r) < 0.05 ? 0 : Math.sign(r); if (sg && prev && sg !== prev) cross++; if (sg) prev = sg; }
  const dur = s.length * DT;
  return { headingPPdeg: +pp.toFixed(3), yawRateMaxDegS: +Math.max(...rs.map(Math.abs)).toFixed(3), betaMaxDeg: +Math.max(...s.map((p) => Math.abs(p.beta))).toFixed(3), yawSignFlips: cross, freqHz: +(cross / 2 / dur).toFixed(2), latDriftM: +(Math.max(...s.map((p) => p.x)) - Math.min(...s.map((p) => p.x))).toFixed(2) };
}

// settle time after tap: time from tap release until |r| < 0.5°/s for good + overshoot count
function settle(tr, tapEnd) {
  const s = tr.filter((p) => p.t >= tapEnd);
  let settled = null;
  for (let i = 0; i < s.length; i++) if (s.slice(i).every((p) => Math.abs(p.r) < 0.5)) { settled = s[i].t - tapEnd; break; }
  let flips = 0, prev = 0;
  for (const p of s) { const sg = Math.abs(p.r) < 0.5 ? 0 : Math.sign(p.r); if (sg && prev && sg !== prev) flips++; if (sg) prev = sg; }
  return { settleS: settled === null ? null : +settled.toFixed(3), overshoots: flips };
}

const out = { hold: [], tap: [] };
for (const mode of ['off', 'normal', 'high']) {
  for (const kmh of [100, 200, 300]) out.hold.push({ mode, kmh, ...metrics(cruise(kmh, mode), 0) });
  for (const kmh of [100, 200, 300]) for (const s of [0.06, 0.1, 0.15]) {
    const tr = cruise(kmh, mode, { dir: 1, s }, 5);
    out.tap.push({ mode, kmh, tapS: s, ...settle(tr, s), after2s: metrics(tr, s + 2) });
  }
}
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
else { console.table(out.hold); console.table(out.tap.map((r) => ({ mode: r.mode, kmh: r.kmh, tapS: r.tapS, settleS: r.settleS, overshoots: r.overshoots, ppAfter2s: r.after2s.headingPPdeg, hz: r.after2s.freqHz }))); }
