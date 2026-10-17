#!/usr/bin/env node
// Headless physics proof for KORAT Cyberpunk (track A). No packages needed.
// Derives every gameplay number from the real car (Rocket trim) + real roads (OSM),
// prints markdown tables that docs/dev/PHYSICS.md quotes and QA uses as pass criteria.
// Usage: node scripts/physics-sim.mjs            (markdown report)
//        node scripts/physics-sim.mjs --json     (machine-readable criteria for QA)
// Map data © OpenStreetMap contributors (ODbL)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_OUT = process.argv.includes('--json');
const G = 9.81; // real gravity — used for tyre loads and all "g" readouts
const RHO = 1.2; // air density, kg/m^3 (30 °C night in Korat ~1.16; 1.2 kept for round numbers)
const KMH = 3.6;
const DEG = Math.PI / 180;
const DT = 1 / 120; // fixed physics step (same as the game)

// ───────────────────────── 1. Real car (research/car/specs.json) ─────────────────────────
const REAL = {
  massDry: 1700, // kg, exec interview (lightest trim)
  gasMass: 225, // kg air in 600 L COPV @ 5,500 psi (derived below)
  driver: 75,
  wheelbase: 2.82, // m [unconfirmed]
  track: 1.72, // m, width 2.0 m minus tyres/body
  cgHeight: 0.4, // m, battery in floor
  rearShare: 0.58, // static weight on rear axle (2 rear motors + rear 200 L tank) [estimated]
  powerW: 1.0e6, // > 1 MW at the wheels-ish (exec)
  driveEff: 0.92,
  muTyre: 1.26, // Trofeo RS, "tyres alone ~1.26 g" (exec)
  muStreet: 1.1, // brief: plain city asphalt
  lateralGFans: 2.0, // "> 2 g with fans" (exec)
  topSpeedKmh: 370, // > 230 mph (official)
  crr: 0.012,
  tankL: 600,
  tankPsi: 5500,
  thrustPeakN: 80e3, // > 80 kN (exec)
  burnTimeS: [5, 6], // per full tank (exec)
  fans: 4,
  fanPowerW: 20e3, // each
  zeroTo60: { performance: 1.6, thrust: 0.9, rocket: 0.59 },
  flightHeightPhotoM: 7,
};
REAL.mass = REAL.massDry + REAL.gasMass + REAL.driver; // 2,000 kg full tank + driver

// Cold gas: ideal exhaust velocity of N2/air expanded from 379 bar to 1 bar at 293 K
const gamma = 1.4, Rgas = 287, Ttank = 293;
const pTank = REAL.tankPsi * 6894.76;
const veIdeal = Math.sqrt(((2 * gamma) / (gamma - 1)) * Rgas * Ttank * (1 - Math.pow(1e5 / pTank, (gamma - 1) / gamma)));
const VE = 650; // m/s — ideal ~700, minus blow-down cooling + nozzle losses
const Z = 1.2; // compressibility of air at ~380 bar
const gasMassCalc = (pTank / (Z * Rgas * Ttank)) * (REAL.tankL / 1000);
const IMPULSE_TOTAL = REAL.gasMass * VE; // N·s for a full tank
const UNIT = IMPULSE_TOTAL / 100; // N·s per gauge unit (gauge 0..100)

// Drag area from top speed: P·eff = ½ρCdA v³ + Crr m g v
const vTopReal = REAL.topSpeedKmh / KMH;
const CDA = (REAL.powerW * REAL.driveEff - REAL.crr * REAL.mass * G * vTopReal) / (0.5 * RHO * vTopReal ** 3);

// Fan downforce implied by "> 2 g with fans" vs "1.26 g tyres alone": μ(W + D) = 2·m·g
const FAN_D_REAL = (REAL.lateralGFans / REAL.muTyre - 1) * REAL.mass * G;
// Sanity: suction ΔP over usable floor + skirt leakage → fan power
const floorArea = 2.8, gapArea = 12 * 0.005, Cd = 0.6, fanEff = 0.6;
const dP = FAN_D_REAL / floorArea;
const leakQ = Cd * gapArea * Math.sqrt((2 * dP) / RHO);
const fanPowerNeed = (leakQ * dP) / fanEff;

// ───────────────────────── 2. Game tuning (owned by PHYSICS.md) ─────────────────────────
const GAME = {
  mass: REAL.mass,
  gGame: 12, // vertical only (jump arcs). Tyre loads use real G.
  muTyre: REAL.muTyre,
  fanStreet: 0.27, // fan downforce / weight while cruising  → μ_eff 1.6
  fanFull: 0.75, // braking / drifting / launch               → μ_eff 2.2
  fanMaxKmh: 160,
  wetMul: 0.85, // real wet asphalt ~0.65 of dry
  accelTrac: 12.5, // m/s² traction cap in normal driving (1.27 g)
  vMaxKmh: 240,
  vBoostMaxKmh: 320,
  limiterExp: 2.2, // torque taper shape a·(1-(v/vMax)^k) — same as GAMEPLAY §2.2
  boostG: 1.5,
  brakeG: 1.3,
  brakeFanG: 2.0, // brake while fans at full (below fanMaxKmh)
  coastG: 0.12,
  dragK: 0.0004, // GAMEPLAY coasting drag (1/m); real CdA·ρ/2m = see report
  jumpVy: 9.2,
  hoverG: 2.5,
  hoverMaxS: 1.2,
  launchG: 4.64, // average over 0–60 mph = real Rocket
  tank: { boostPerS: 20, jump: 35, hoverPerS: 25, regen: 3, driftRegen: 10, launch: 0 },
  driftRearMul: 0.85, // proposed (GAMEPLAY v1 had 0.35 — see corner section)
  driftBaseDeg: 18,
  driftSteerDeg: 22,
  driftMaxDeg: 40,
};
const muEff = (fan, wet = false) => GAME.muTyre * (1 + fan) * (wet ? GAME.wetMul : 1);

// ───────────────────────── helpers ─────────────────────────
const out = [];
const p = (s = '') => out.push(s);
const table = (head, rows) => {
  p('| ' + head.join(' | ') + ' |');
  p('|' + head.map(() => '---').join('|') + '|');
  for (const r of rows) p('| ' + r.join(' | ') + ' |');
  p();
};
const f = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x) ? '—' : Number(x).toFixed(d));
const criteria = {};

// ───────────────────────── 3. Longitudinal sim (load transfer + tyres + fans + thrust) ─────────────────────────
// One-axle-driven (RWD) car. Rear normal load includes static share, fan downforce (70 % rear),
// longitudinal weight transfer m·a·h/L, capped at total normal load (front wheels lift = wheelie limit).
// Tyre force acts at the ground (h below CG) → nose-up moment; rear thrust acts at the nozzle height
// (hT ≈ 0.50 m, above CG) → slight nose-down moment. ΔFz = (F_tyre·h − T·(hT − h)) / L.
function launchSim({ mu, fanD = 0, thrust = 0, thrustUntilKmh = 999, power = REAL.powerW * REAL.driveEff, mass = REAL.mass, cda = CDA, targetKmh = 100, maxT = 30, hT = 0.5 }) {
  const L = REAL.wheelbase, h = REAL.cgHeight;
  let v = 0, x = 0, t = 0, a = 0, peakA = 0, frontMin = Infinity;
  const marks = {};
  const W = mass * G;
  while (t < maxT) {
    const drag = 0.5 * RHO * cda * v * v + REAL.crr * W;
    const T = v * KMH < thrustUntilKmh ? thrust : 0;
    // iterate a (load transfer depends on a)
    let tyre = 0;
    for (let k = 0; k < 6; k++) {
      const fzRear = Math.min(W * REAL.rearShare + 0.7 * fanD + (tyre * h - T * (hT - h)) / L, W + fanD);
      tyre = Math.min(mu * fzRear, power / Math.max(v, 0.5));
      a = (tyre + T - drag) / mass;
    }
    const fzFront = W * (1 - REAL.rearShare) + 0.3 * fanD - (tyre * h - T * (hT - h)) / L;
    frontMin = Math.min(frontMin, fzFront);
    peakA = Math.max(peakA, a);
    v += a * DT;
    x += v * DT;
    t += DT;
    for (const m of [60 / 0.621371, 100, 200, 300]) if (!marks[m] && v * KMH >= m) marks[m] = { t, x };
    if (v * KMH >= targetKmh && marks[targetKmh]) break;
    if (a < 0.05) break;
  }
  return { marks, peakA, frontMin, v };
}
const t060 = (r) => r.marks[60 / 0.621371]?.t;

// Bisection: rear thrust needed for a target 0–60 mph time
function thrustFor060(target, opts) {
  let lo = 0, hi = 200e3;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const r = launchSim({ ...opts, thrust: mid, targetKmh: 100 });
    if ((t060(r) ?? 99) > target) lo = mid; else hi = mid;
  }
  return hi;
}

// Game drive model (what src/car will run). Net longitudinal accel under full throttle:
//   a = A0·(1 − (v/vLim)^k)            (GAMEPLAY §2.2 curve — already net of drag)
//   + boost thrust 1.5 g·√(1 − v/vBoostMax)
//   above vLim the limiter cuts torque → only drag (dragK·v², = real ½ρCdA/m) acts
// Power check: the curve never asks for more than the real 1 MW (see report §2).
function gameAccel(v, { boost = false, launch = false } = {}) {
  const vLim = (boost ? GAME.vBoostMaxKmh : GAME.vMaxKmh) / KMH;
  let a = v <= vLim ? GAME.accelTrac * (1 - Math.pow(v / vLim, GAME.limiterExp)) : -GAME.dragK * v * v;
  if (boost) a += GAME.boostG * G * Math.sqrt(Math.max(0, 1 - v / (GAME.vBoostMaxKmh / KMH)));
  if (launch) a = Math.max(a, GAME.launchG * G);
  return a;
}
function gameRun({ boost = false, launchS = 0, v0 = 0, distance = Infinity, maxT = 60 }) {
  let v = v0, x = 0, t = 0;
  const marks = {};
  while (t < maxT && x < distance) {
    const a = gameAccel(v, { boost, launch: t < launchS });
    v = Math.max(0, v + a * DT);
    x += v * DT;
    t += DT;
    for (const m of [60 / 0.621371, 100, 200, 240, 300]) if (!marks[m] && v * KMH >= m) marks[m] = { t, x };
  }
  return { marks, v, t, x };
}

// ───────────────────────── 4. OSM geometry ─────────────────────────
const KX = 107550, KY = 110574, LON0 = 102.098117, LAT0 = 14.974731;
const toXY = ([lon, lat]) => [(lon - LON0) * KX, (lat - LAT0) * KY];
const readGeo = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const trackGeo = readGeo('research/osm/track-A.geojson');
const waterGeo = readGeo('research/osm/water.geojson');
const roadsGeo = readGeo('research/osm/roads.geojson');
const centerRaw = trackGeo.features.find((f) => f.geometry.type === 'LineString').geometry.coordinates.map(toXY);

function resample(pts, step) {
  const res = [];
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const L = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(L / step));
    for (let k = 0; k < n; k++) res.push({ x: ax + ((bx - ax) * k) / n, y: ay + ((by - ay) * k) / n, s: s + (L * k) / n });
    s += L;
  }
  return { pts: res, length: s };
}
const center = resample(centerRaw, 2);
const moatPolys = waterGeo.features
  .filter((f) => f.properties.water === 'moat' && f.geometry.type === 'Polygon')
  .map((f) => ({ id: f.properties.osm_id, ring: f.geometry.coordinates[0].map(toXY) }));
const pointInRing = (x, y, r) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const inMoat = (x, y) => moatPolys.some((m) => pointInRing(x, y, m.ring));
const roadByName = (name, hw) => roadsGeo.features.filter((f) => f.properties.name === name && (!hw || f.properties.highway === hw) && f.geometry.type === 'LineString').map((f) => f.geometry.coordinates.map(toXY));

// Road width along track A (m). Street View round 1 where surveyed, else lane-count estimate [unconfirmed].
const WIDTH_BY_S = [
  [0, 520, 13, 'ราชดำเนิน (SV 12–15 ม.)'],
  [520, 640, 16, 'หัวราชดำเนิน/วงเวียนมุมเมือง (SV 14 ม. + ปากแยก)'],
  [640, 1188, 12, 'ราชสีมา-โชคชัย (ทล.224) ขาไปตะวันออก (SV2 11–13 ม.)'],
  [1188, 2105, 9, 'มนัส (SV2 9–10 ม.)'],
  [2105, 2421, 9, 'สรรพสิทธิ์ (SV2 9 ม.)'],
  [2421, 2550, 9, 'วัชรสฤษดิ์ (SV2 8–10 ม.)'],
  [2550, 2854, 9, 'กำแหงสงคราม (SV2 9 ม.)'],
  [2854, 99999, 12, 'ราชดำเนินช่วงใต้ (SV S1 12 ม.)'],
];
const widthAt = (s) => WIDTH_BY_S.find(([a, b]) => s >= a && s < b)[2];

// Corner model: constant-radius racing line through a corner of deflection θ using the usable width
// w_u = road width − 2.6 m (car 2.0 m + 0.3 m each side): outside → apex → outside, R = w_u / (1 − cos(θ/2)).
// The 53° left kink 30 m before the hairpin is absorbed by the hairpin's racing line (wide entry from the left).
const corners = JSON.parse(readFileSync(join(ROOT, 'research/osm/stats.json'), 'utf8')).tracks.A.corner_list;
const cornerR = corners
  .filter((c) => !(c.angle === 53 && c.at_m === 520))
  .map((c) => {
    const w = widthAt(c.at_m), wu = w - 2.6, th = c.angle * DEG;
    const R = wu / (1 - Math.cos(th / 2));
    return { ...c, at: c.at_m, w, wu, R, arc: R * th };
  });
const TRACK_LEN = center.length;

// Speed-limit profile along s (1 m bins): corners clamp v over their arc length
function profile(cornerList, len, { fanCorner = true, wet = false } = {}) {
  const n = Math.ceil(len);
  const vLim = new Float64Array(n).fill(GAME.vMaxKmh / KMH);
  const mu = muEff(fanCorner ? GAME.fanFull : GAME.fanStreet, wet);
  for (const c of cornerList) {
    const v = Math.sqrt(mu * G * c.R);
    for (let k = Math.floor(c.at - c.arc / 2); k <= Math.ceil(c.at + c.arc / 2); k++) vLim[((k % n) + n) % n] = Math.min(vLim[((k % n) + n) % n], v);
  }
  return vLim;
}
// Quasi-steady lap solver (forward/backward pass, 1 m bins)
function lapTime(vLim, { wet = false, closed = true, startV = null, endV = null } = {}) {
  const n = vLim.length, v = Float64Array.from(vLim);
  const passes = closed ? 3 : 1;
  if (endV !== null) v[n - 1] = Math.min(v[n - 1], endV);
  for (let pass = 0; pass < passes; pass++)
    for (let j = (closed ? 2 * n : n - 1) - 1; j >= 0; j--) {
      const i = j % n, nx = (i + 1) % n;
      const b = (v[nx] * KMH < GAME.fanMaxKmh ? GAME.brakeFanG : GAME.brakeG) * G * (wet ? GAME.wetMul : 1);
      v[i] = Math.min(v[i], Math.sqrt(v[nx] ** 2 + 2 * b));
    }
  if (startV !== null) v[0] = Math.min(v[0], startV);
  for (let pass = 0; pass < passes; pass++)
    for (let j = 0; j < (closed ? 2 * n : n - 1); j++) {
      const i = j % n, nx = (i + 1) % n;
      v[nx] = Math.min(v[nx], Math.sqrt(v[i] ** 2 + 2 * Math.max(gameAccel(v[i]), 0)));
    }
  let t = 0;
  for (let i = 0; i < (closed ? n : n - 1); i++) t += 1 / Math.max((v[i] + v[(i + 1) % n]) / 2, 0.5);
  return { t, v };
}
const segTime = (res, s0, s1) => {
  let t = 0;
  for (let i = Math.floor(s0); i < Math.floor(s1); i++) t += 1 / Math.max((res.v[i] + res.v[i + 1]) / 2, 0.5);
  return t;
};

// ───────────────────────── 5. Bicycle model (Pacejka-lite) for skidpad + drift ─────────────────────────
const TYRE = { B: 14, C: 1.4 }; // α_peak = atan(tan(π/2C))/B ≈ 8.5°
const pacejka = (alpha, Fmax) => Fmax * Math.sin(TYRE.C * Math.atan(TYRE.B * alpha));
const alphaPeak = Math.tan(Math.PI / (2 * TYRE.C)) / TYRE.B;

const invPacejka = (ratio) => Math.tan(Math.asin(Math.max(-0.999, Math.min(0.999, ratio))) / TYRE.C) / TYRE.B;

// Single-track model on a CCW circle of radius R. "Driver" = what the game's steering assist does:
// front angle chosen so the front tyre supplies its share of the needed centripetal force (+ path feedback).
// Drift mode adds the yaw-moment assist (PD on slip angle β, GAMEPLAY kP 6 kD 0.8) limited to what the
// real car's rear torque vectoring can give (2 rear motors, no diff): |Mz| ≤ μ·Fz_rear·track/2.
function bicycle({ R, v0, fan, rearMul = 1, drift = false, betaTargetDeg = 30, T = 12, wet = false, mzMul = 1 }) {
  const m = GAME.mass, L = REAL.wheelbase, a = L * REAL.rearShare, b = L - a, Iz = m * 1.2 ** 2;
  const mu = GAME.muTyre * (wet ? GAME.wetMul : 1);
  const D = fan * m * G;
  const fzf = m * G * (1 - REAL.rearShare) + 0.3 * D, fzr = m * G * REAL.rearShare + 0.7 * D;
  let X = 0, Y = -R, psi = 0, vx = v0, vy = 0, r = v0 / R, t = 0;
  let maxErr = 0, betaSum = 0, betaN = 0, deltaSum = 0, spun = false, ePrev = 0;
  if (drift) { const bt = betaTargetDeg * DEG; vx = v0 * Math.cos(bt); vy = -v0 * Math.sin(bt); psi = bt; }
  const mzMax = mzMul * mu * fzr * (REAL.track / 2);
  while (t < T) {
    const V = Math.hypot(vx, vy);
    const err = Math.hypot(X, Y) - R; // + = outside the circle
    const errD = (err - ePrev) / DT; ePrev = err;
    const beta = Math.atan2(-vy, vx); // + = rear stepped out
    const ar = Math.atan2(vy - b * r, Math.max(vx, 0.5));
    const Fx = Math.max(-mu * fzr, Math.min(mu * fzr * 0.8, 3000 * (v0 - V) + 0.5 * RHO * CDA * V * V));
    const fyrMax = Math.sqrt(Math.max(0, (mu * fzr * rearMul) ** 2 - Fx * Fx));
    const Fyr = -pacejka(ar, fyrMax);
    const FyReq = m * (V * V / R + 1.5 * err + 1.2 * errD); // inward force wanted (body lateral ≈ inward)
    const FyfReq = drift ? FyReq - Fyr : (FyReq * b) / L;
    let delta = Math.atan2(vy + a * r, Math.max(vx, 0.5)) + invPacejka(FyfReq / (mu * fzf));
    delta = Math.max(-32 * DEG, Math.min(32 * DEG, delta));
    let Mz = 0;
    if (drift) Mz = Math.max(-mzMax, Math.min(mzMax, Iz * (6 * (betaTargetDeg * DEG - beta) - 0.8 * (r - V / R))));
    const af = Math.atan2(vy + a * r, Math.max(vx, 0.5)) - delta;
    const Fyf = -pacejka(af, mu * fzf);
    const ax = (Fx - Fyf * Math.sin(delta)) / m + vy * r;
    const ay = (Fyr + Fyf * Math.cos(delta)) / m - vx * r;
    const rd = (a * Fyf * Math.cos(delta) - b * Fyr + Mz) / Iz;
    vx += ax * DT; vy += ay * DT; r += rd * DT; psi += r * DT;
    X += (vx * Math.cos(psi) - vy * Math.sin(psi)) * DT;
    Y += (vx * Math.sin(psi) + vy * Math.cos(psi)) * DT;
    t += DT;
    if (t > 3) {
      maxErr = Math.max(maxErr, Math.abs(err));
      betaSum += beta / DEG; betaN++; deltaSum += delta / DEG;
      if (Math.abs(beta) > 75 * DEG) spun = true;
    }
  }
  return { maxErr, betaAvg: betaSum / Math.max(betaN, 1), deltaAvg: deltaSum / Math.max(betaN, 1), spun, V: Math.hypot(vx, vy) };
}
// highest steady speed that holds the circle within ±2.5 m
function maxCircleSpeed(R, opts) {
  let lo = 3, hi = 60;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    const r = bicycle({ R, v0: mid, ...opts });
    if (r.maxErr < 2.5 && !r.spun) lo = mid; else hi = mid;
  }
  return lo;
}

// ───────────────────────── 6. Verlet rope + pendulum ─────────────────────────
function catenarySag(span, wPerM, H) { return (wPerM * span * span) / (8 * H); }
// Cable = analytic catenary rest shape + Verlet-integrated displacement d (y up, z sideways).
// Linearised string: a = (H/μ)·∂²d/∂x² − (g/ℓ)·d_z + wind/μ, H = μgL²/(8·sag) (horizontal tension),
// ℓ = local depth below the chord + 0.3 m (sideways swing restoring, pendulum-like). Exact sag by
// construction, stable while (c·dt/dx)² < 1 with c = √(H/μ). Ends pinned.
function ropeSim({ span = 35, n = 12, sag = 0.9, gust = null, T = 10, massPerM = 0.6, mul = 1 }) {
  const N = n + 1, dx = span / n, c2 = (G * span * span) / (8 * sag), dt = 1 / 60, damp = 0.99;
  const dy = new Float64Array(N), dz = new Float64Array(N), py = new Float64Array(N), pz = new Float64Array(N), accY = new Float64Array(N), accZ = new Float64Array(N);
  const ell = Array.from({ length: N }, (_, i) => 4 * sag * (i / n) * (1 - i / n) + 0.3);
  let maxDisp = 0, settleT = null, t = 0, courant = (Math.sqrt(c2) * dt) / dx;
  while (t < T) {
    // Jacobi: all accelerations from the same state (in-place Gauss-Seidel makes Verlet unstable here)
    for (let i = 1; i < n; i++) {
      const g = gust ? gust(t, i * dx) : {};
      accY[i] = (c2 * (dy[i - 1] + dy[i + 1] - 2 * dy[i])) / (dx * dx) + mul * (g.ay || 0);
      accZ[i] = (c2 * (dz[i - 1] + dz[i + 1] - 2 * dz[i])) / (dx * dx) - (G / ell[i]) * dz[i] + mul * (g.az || 0);
    }
    for (let i = 1; i < n; i++) {
      const vy = (dy[i] - py[i]) * damp, vz = (dz[i] - pz[i]) * damp;
      py[i] = dy[i]; pz[i] = dz[i];
      dy[i] += vy + accY[i] * dt * dt; dz[i] += vz + accZ[i] * dt * dt;
    }
    let disp = 0;
    for (let i = 1; i < n; i++) disp = Math.max(disp, Math.hypot(dy[i], dz[i]));
    maxDisp = Math.max(maxDisp, disp);
    if (disp > 0.05) settleT = null; else if (settleT === null && maxDisp > 0.05) settleT = t;
    t += dt;
  }
  return { maxDisp, settleT, courant, f1: Math.sqrt(c2) / (2 * span), swingT: 2 * Math.PI * Math.sqrt(((2 / 3) * sag + 0.3) / G) };
}
// Lantern / hanging sign: damped spherical pendulum (small angle) driven by wind drag.
function pendulumSim({ L = 0.6, mass = 1.0, area = 0.126, Cd = 0.5, zeta = 0.05, wind, T = 8 }) {
  const w0 = Math.sqrt(G / L), dt = 1 / 60;
  let th = 0, om = 0, t = 0, maxTh = 0;
  while (t < T) {
    const u = wind(t);
    const F = 0.5 * RHO * Cd * area * u * Math.abs(u);
    const al = -w0 * w0 * Math.sin(th) - 2 * zeta * w0 * om + (F * Math.cos(th)) / (mass * L);
    om += al * dt; th += om * dt; t += dt;
    maxTh = Math.max(maxTh, Math.abs(th));
  }
  return { maxDeg: maxTh / DEG, period: (2 * Math.PI) / w0 };
}
function ropeBench(points = 1200, frames = 2000, iters = 3) {
  const n = points;
  const x = new Float32Array(n), y = new Float32Array(n), z = new Float32Array(n), px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n);
  for (let i = 0; i < n; i++) { x[i] = px[i] = (i % 12) * 3; y[i] = py[i] = 7; z[i] = pz[i] = 0; }
  const t0 = performance.now();
  for (let fr = 0; fr < frames; fr++) {
    for (let i = 0; i < n; i++) {
      if (i % 12 === 0 || i % 12 === 11) continue;
      const vx = (x[i] - px[i]) * 0.985, vy = (y[i] - py[i]) * 0.985, vz = (z[i] - pz[i]) * 0.985;
      px[i] = x[i]; py[i] = y[i]; pz[i] = z[i];
      x[i] += vx; y[i] += vy - G / 3600; z[i] += vz + Math.sin(fr * 0.01 + i) * 1e-5;
    }
    for (let k = 0; k < iters; k++) {
      for (let i = 0; i < n - 1; i++) {
        if (i % 12 === 11) continue;
        const dx = x[i + 1] - x[i], dy = y[i + 1] - y[i], dz = z[i + 1] - z[i];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, diff = ((d - 3) / d) * 0.5;
        x[i] += dx * diff; y[i] += dy * diff; z[i] += dz * diff;
        x[i + 1] -= dx * diff; y[i + 1] -= dy * diff; z[i + 1] -= dz * diff;
      }
    }
  }
  return (performance.now() - t0) / frames; // ms per frame on this machine
}

// ═════════════════════════ REPORT ═════════════════════════
p('# physics-sim — ผลจำลองฟิสิกส์ (สร้างโดย `node scripts/physics-sim.mjs`)');
p();
p(`step ${1 / DT} Hz · g จริง ${G} (แรงยาง/ค่า g ทุกตัว) · g เกม ${GAME.gGame} (แนวดิ่งตอนลอยเท่านั้น) · มวลเต็มถัง ${REAL.mass} กก.`);
p();

// ── 0. derived constants
p('## 0. ค่าที่คำนวณจากสเปกจริง');
table(['ค่า', 'ผล', 'ที่มา'], [
  ['มวลอากาศในถัง 600 ลิตร @ 5,500 psi', `${f(gasMassCalc, 0)} กก. (ใช้ ${REAL.gasMass})`, 'ρ = P/(Z·R·T), Z≈1.2 · ข่าวบอก ~250 กก.'],
  ['ความเร็วไอพ่นแก๊สเย็น (ideal → ใช้)', `${f(veIdeal, 0)} → ${VE} ม./วิ (Isp ${f(VE / G, 0)} วิ)`, 'nozzle isentropic 379→1 bar, หักความเย็นตอนปล่อยแก๊ส'],
  ['แรงกระตุ้นรวมต่อถัง', `${f(IMPULSE_TOTAL / 1000, 0)} kN·s`, 'm_gas × v_e'],
  ['1 หน่วยเกจ (100 หน่วย/ถัง)', `${f(UNIT / 1000, 2)} kN·s`, ''],
  ['พ่นเต็มแรง 80 kN ได้นาน', `${f(IMPULSE_TOTAL / REAL.thrustPeakN, 1)} วิ`, 'ข่าว 80 kN กับ 5–6 วิ ขัดกัน → แรงเฉลี่ยถ้าพ่น 5.5 วิ = ' + f(IMPULSE_TOTAL / 5.5 / 1000, 1) + ' kN'],
  ['CdA จากท็อปสปีด 370 + 1 MW', `${f(CDA, 2)} ม.²`, 'P·η = ½ρCdA·v³ + Crr·m·g·v'],
  ['แรงกดพัดลม (จาก >2 g vs 1.26 g)', `${f(FAN_D_REAL / 1000, 1)} kN = ${f(FAN_D_REAL / (REAL.mass * G), 2)} เท่าน้ำหนัก`, 'μ(W+D)=2mg'],
  ['พัดลมต้องใช้กำลัง', `${f(fanPowerNeed / 1000, 1)} kW (มี 4×20 = 80 kW)`, `ΔP ${f(dP / 1000, 1)} kPa ใต้พื้น ${floorArea} ม.² · รั่วขอบ skirt 5 มม.`],
]);

// ── 1. launch
p('## 1. ออกตัว — ยาง vs พัดลม vs หัวพ่น (โมเดลถ่ายน้ำหนัก RWD)');
const L = REAL.wheelbase, h = REAL.cgHeight, W = REAL.mass * G;
const aTyreOnly = (mu) => (mu * G * REAL.rearShare) / (1 - (mu * h) / L);
const aWheelie = (G * (1 - REAL.rearShare) * L) / h;
const runs = [
  ['ยาง μ 1.1 อย่างเดียว (ถนนเมือง)', { mu: REAL.muStreet }],
  ['ยาง μ 1.26 อย่างเดียว (Trofeo RS)', { mu: REAL.muTyre }],
  ['+ พัดลม (Performance)', { mu: REAL.muTyre, fanD: FAN_D_REAL, mass: REAL.massDry + REAL.driver }],
  ['+ พัดลม + 4 หัวพ่น 80 kN (Rocket เต็มแรง)', { mu: REAL.muTyre, fanD: FAN_D_REAL, thrust: REAL.thrustPeakN }],
];
const launchRows = runs.map(([name, o]) => {
  const r = launchSim({ ...o, targetKmh: 100 });
  return [name, f(r.peakA / G, 2) + ' g', f(t060(r), 2), f(r.marks[100]?.t, 2), r.frontMin < 0 ? '**หน้าลอย**' : f(r.frontMin / 1000, 1) + ' kN'];
});
const thrNeedStreet = thrustFor060(REAL.zeroTo60.rocket, { mu: REAL.muStreet, fanD: FAN_D_REAL });
const thrNeedNoFan = thrustFor060(REAL.zeroTo60.rocket, { mu: REAL.muStreet });
const thrNeedTyre = thrustFor060(REAL.zeroTo60.rocket, { mu: REAL.muTyre, fanD: FAN_D_REAL });
const rNeed = launchSim({ mu: REAL.muStreet, fanD: FAN_D_REAL, thrust: thrNeedStreet });
launchRows.push([`**เป้า Rocket 0.59 วิ: μ 1.1 + พัดลม + หัวพ่น ${f(thrNeedStreet / 1000, 1)} kN**`, f(rNeed.peakA / G, 2) + ' g', f(t060(rNeed), 2), f(rNeed.marks[100]?.t, 2), rNeed.frontMin < 0 ? '**หน้าลอย**' : f(rNeed.frontMin / 1000, 1) + ' kN']);
table(['ชุด', 'g สูงสุด', '0–60 mph (วิ)', '0–100 (วิ)', 'น้ำหนักล้อหน้าต่ำสุด'], launchRows);
p(`- ยางล้วน RWD ทำได้แค่ **${f(aTyreOnly(REAL.muStreet) / G, 2)} g** (μ 1.1) / ${f(aTyreOnly(REAL.muTyre) / G, 2)} g (μ 1.26) เพราะล้อหลังรับน้ำหนักแค่ ${f(REAL.rearShare * 100, 0)}% + ถ่ายน้ำหนัก m·a·h/L`);
p(`- เพดาน "หน้าลอย" (wheelie) ที่ CG ${h} ม. ฐานล้อ ${L} ม. = **${f(aWheelie / G, 2)} g** — เกินนี้ยางหลังได้น้ำหนักทั้งคันแล้ว เพิ่มได้จากแรงกดพัดลมกับหัวพ่นเท่านั้น`);
p(`- หัวพ่นท้ายที่ต้องใช้เพื่อ 4.64 g: **${f(thrNeedStreet / 1000, 1)} kN** (μ 1.1 + พัดลม) · ${f(thrNeedTyre / 1000, 1)} kN (μ 1.26 + พัดลม) · ${f(thrNeedNoFan / 1000, 1)} kN (ไม่มีพัดลม) — เทียบ 80 kN ที่ผู้บริหารบอก: ทำได้ถ้ามีพัดลม ✔ · ไม่มีพัดลมเกินเพดาน = พัดลมจำเป็นจริง`);
p(`- หัวพ่นดันที่ความสูง ~0.5 ม. (เหนือ CG 0.1 ม.) จึงไม่เพิ่มแรงเงยหน้า → น้ำหนักล้อหน้ายังเหลือ ${f(rNeed.frontMin / 1000, 1)} kN ที่ 4.7 g ✔ ถ้าทำด้วยยางล้วนจะหน้าลอยตั้งแต่ 2.96 g`);
p(`- ใช้แก๊สตอนออกตัว 0.59 วิ ≈ ${f((thrNeedStreet * 0.59) / UNIT, 0)} หน่วยเกจ`);
p();
criteria.launch = { real060: REAL.zeroTo60.rocket, thrustNeededKN: +(thrNeedStreet / 1000).toFixed(1), wheelieG: +(aWheelie / G).toFixed(2) };

// ── 2. game drive
p('## 2. เครื่องในเกม (สิ่งที่ `src/car` จะรัน) — 0–100 / ท็อปสปีด');
const gNormal = gameRun({});
const gBoost = gameRun({ boost: true });
const gLaunch = gameRun({ boost: true, launchS: 0.6 });
const gLaunchOnly = gameRun({ launchS: 0.6 });
const manat = 917;
const onManat = gameRun({ v0: 90 / KMH, distance: manat });
const onManatB = gameRun({ v0: 90 / KMH, distance: manat, boost: true });
table(['โหมด', '0–100', '0–200', 'ความเร็วปลายทางตรงมนัส 917 ม. (เข้า 90)', 'ของจริง'], [
  ['ปกติ', f(gNormal.marks[100]?.t, 2), f(gNormal.marks[200]?.t, 2), f(onManat.v * KMH, 0) + ' กม./ชม.', 'Rocket 0–100 ≈ 0.62'],
  ['BOOST ค้าง (+1.5 g)', f(gBoost.marks[100]?.t, 2), f(gBoost.marks[200]?.t, 2), f(onManatB.v * KMH, 0) + ' กม./ชม.', 'ใช้ถัง 20/วิ'],
  ['LAUNCH (4.64 g 0.6 วิ) + BOOST', f(gLaunch.marks[100]?.t, 2), f(gLaunch.marks[200]?.t, 2), '—', '0–60 mph ' + f(gLaunch.marks[60 / 0.621371]?.t, 2) + ' (จริง < 0.59)'],
  ['LAUNCH แล้วปล่อย (ไม่ boost)', f(gLaunchOnly.marks[100]?.t, 2), f(gLaunchOnly.marks[200]?.t, 2), '—', ''],
]);
const vmaxN = gameRun({ maxT: 120 }).v * KMH, vmaxB = gameRun({ maxT: 120, boost: true }).v * KMH;
p(`- ท็อปสปีดจริงในเกม (วิ่งไม่จำกัดระยะ): ปกติ ${f(vmaxN, 0)} · boost ${f(vmaxB, 0)} กม./ชม. (limiter ${GAME.vMaxKmh}/${GAME.vBoostMaxKmh} ลบลมต้าน)`);
p();
criteria.drive = { t0100: +gNormal.marks[100].t.toFixed(2), t0100Boost: +gBoost.marks[100].t.toFixed(2), t0100Launch: +gLaunch.marks[100].t.toFixed(2), vmaxKmh: Math.round(vmaxN), vmaxBoostKmh: Math.round(vmaxB) };

// ── 3. jump
p('## 3. กระโดด');
const gg = GAME.gGame;
const apex = GAME.jumpVy ** 2 / (2 * gg), tAir = (2 * GAME.jumpVy) / gg;
// real Rocket: 6 lift nozzles 60 kN, burn to reach photo-estimate 7 m
const Flift = 60e3, aNet = Flift / REAL.mass - G;
const tb7 = Math.sqrt(REAL.flightHeightPhotoM / ((aNet / 2) * (1 + aNet / G)));
const vb7 = aNet * tb7;
const air7 = tb7 + vb7 / G + Math.sqrt((2 * REAL.flightHeightPhotoM) / G);
const imp7 = Flift * tb7;
// game jump impulse if it were real (3.5 m apex at real g, 0.15 s burn)
const vy35 = Math.sqrt(2 * G * apex);
const impAscent = REAL.mass * vy35 + REAL.mass * G * 0.15;
// landing burn: from -jumpVy to -3 m/s over the last 1.5 m
const vLandTarget = 3, landH = 1.5;
const aLand = (GAME.jumpVy ** 2 - vLandTarget ** 2) / (2 * landH);
const tLand = (GAME.jumpVy - vLandTarget) / aLand;
const FLand = REAL.mass * (aLand + gg);
const impLand = FLand * tLand;
table(['', 'ของจริง (ประเมิน)', 'ในเกม'], [
  ['ความสูงสูงสุด', `~${REAL.flightHeightPhotoM} ม. (ภาพเดโมข้าม Semi)`, `${f(apex, 2)} ม. (vy ${GAME.jumpVy} ม./วิ, g ${gg})`],
  ['เวลาลอย', `${f(air7, 2)} วิ (60 kN 6 หัว พ่น ${f(tb7, 2)} วิ)`, `${f(tAir, 2)} วิ + landing burn ${f(tLand, 2)} วิ = ${f(tAir + tLand * 0.5, 2)} วิ`],
  ['แรงกระตุ้นขาขึ้น', `${f(imp7 / 1000, 1)} kN·s = ${f(imp7 / UNIT, 0)} หน่วย`, `${f(impAscent / 1000, 1)} kN·s = ${f(impAscent / UNIT, 0)} หน่วย (ถ้าคิดแบบจริงที่ 3.5 ม.)`],
  ['landing burn (−9.2 → −3 ม./วิ ใน 1.5 ม.สุดท้าย)', 'Rocket ลงนุ่มด้วยหัวพ่น', `${f(FLand / 1000, 0)} kN ${f(tLand, 2)} วิ = ${f(impLand / UNIT, 0)} หน่วย`],
  ['ทรงตัว/ปรับมุมกลางอากาศ', 'actuator หัวพ่น', '~3 หน่วย'],
  ['**รวมต่อการกระโดด**', '', `**จริง ≈ ${f((impAscent + impLand) / UNIT + 3, 0)} หน่วย → เกมเก็บ ${GAME.tank.jump}** (ส่วนเกินเป็นค่า balance)`],
]);
// Jump distance table
const jumpRows = [];
for (const kmh of [40, 60, 80, 100, 120, 140, 160, 200]) {
  const v = kmh / KMH;
  const dNo = v * tAir;
  // full hover: rise to apex, then hover gravity for up to hoverMaxS, then fall remaining
  const tUp = GAME.jumpVy / gg;
  const hHover = apex - 0.5 * GAME.hoverG * GAME.hoverMaxS ** 2; // height left after hover
  const tFall = Math.sqrt((2 * Math.max(hHover, 0)) / gg);
  const tHov = tUp + GAME.hoverMaxS + tFall;
  jumpRows.push([kmh, f(dNo, 1), f(v * tHov, 1), f(tHov, 2)]);
}
p('ระยะลอยตามความเร็วเข้า (พื้นเรียบ ระดับเดียวกัน):');
table(['เข้า (กม./ชม.)', 'ระยะ ไม่ลอยค้าง (ม.)', 'ระยะ ลอยค้างเต็ม 1.2 วิ (ม.)', 'เวลาลอย ลอยค้างเต็ม (วิ)'], jumpRows);
criteria.jump = { apexM: +apex.toFixed(2), airtimeS: +tAir.toFixed(2), landingVyMax: vLandTarget, tankCost: GAME.tank.jump };

// ── 3b. Moat jump at ถนนมนัส (track_m ~1,180): diagonal cut over the north moat west of the causeway
p('### 3.1 จุดกระโดดข้ามคูเหนือ — ตัดโค้งแยกมนัส (track_m ~1,180) ข้ามน้ำข้างคันดิน `way/544097464`');
const tHoverMax = GAME.jumpVy / gg + GAME.hoverMaxS + Math.sqrt((2 * (apex - 0.5 * GAME.hoverG * GAME.hoverMaxS ** 2)) / gg);
const moat464 = moatPolys.find((m) => String(m.id).includes('544097464')).ring;
const yEdgesAt = (ring, x) => {
  const ys = [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j], [x2, y2] = ring[i];
    if (x1 > x !== x2 > x) ys.push(y1 + ((y2 - y1) * (x - x1)) / (x2 - x1));
  }
  return ys.sort((a, b) => a - b);
};
// Real layout (Street View round 2 + OSM): eastbound 224 lanes centre y≈598 (12 m) · median ≤ 6 m with an
// opening at the Manat junction · westbound lanes centre y≈580 (11 m, closed by barriers in-race) · low white
// moat railing · water · south bank + ถนนพลแสน (y≈516) · ถนนมนัส x≈532 (9–10 m) crossing on a 10 m causeway.
const manatX = 532, manatW = 9.5, causewayWestX = 521;
const landAimM = { x: manatX - 2.5, y: 528 }; // west half of มนัส just north of the พลแสน junction
const eastRoomM = manatX + manatW / 2 + 4 - 1.3 - landAimM.x; // to the colonial shophouse/barrier east of มนัส
const routes = [];
for (const angDeg of [40, 45, 50, 55, 60]) {
  const th = angDeg * DEG; // flight direction measured from due-east, turning south
  // takeoff point = where the line through landAim crosses the railing (moat north edge + 1 m)
  let xT = landAimM.x, yT = landAimM.y;
  for (let k = 0; k < 400; k++) {
    const x = landAimM.x - (k * 0.25) * Math.cos(th), y = landAimM.y + (k * 0.25) * Math.sin(th);
    const e = yEdgesAt(moat464, x);
    if (e.length && y >= e[e.length - 1] + 1) { xT = x; yT = y; break; }
  }
  const eW = yEdgesAt(moat464, xT), waterAlong = (eW[eW.length - 1] - eW[0]) / Math.sin(th);
  const dNeed = Math.hypot(landAimM.x - xT, landAimM.y - yT);
  // turn-in from the eastbound lane centre (y 598) to heading θ must fit above the railing (fan grip 2.2 g)
  const latRoom = 598 - yT;
  const rows = [];
  for (let kmh = 60; kmh <= 160; kmh += 5) {
    const v = kmh / KMH, R = (v * v) / (muEff(GAME.fanFull) * G), lat = R * (1 - Math.cos(th));
    const T = dNeed / v, hoverOk = T >= tAir - 1e-9 && T <= tHoverMax, rawOk = Math.abs(T - tAir) < 0.08;
    const vE = v * Math.cos(th), aE = (vE * vE) / (2 * eastRoomM);
    const ok = lat <= latRoom && (hoverOk || rawOk) && aE <= muEff(GAME.fanFull) * G;
    rows.push({ kmh, lat, T, aE, ok, turnOk: lat <= latRoom, flyOk: hoverOk || rawOk, scrubOk: aE <= muEff(GAME.fanFull) * G });
  }
  const okRows = rows.filter((r) => r.ok);
  routes.push({ angDeg, xT, yT, dNeed, waterAlong, latRoom, rows, lo: okRows[0]?.kmh ?? null, hi: okRows.at(-1)?.kmh ?? null });
}
const yCw = yEdgesAt(moat464, 515);
p(`- น้ำกว้าง (เหนือ-ใต้) ข้างคันดินที่ x 515: **${f(yCw.at(-1) - yCw[0], 1)} ม.** (y ${f(yCw[0], 0)} → ${f(yCw.at(-1), 0)}) · คันดินมนัส x ${causewayWestX}–541 · จุดลงเล็งไว้ที่มนัสฝั่งตะวันตก (${landAimM.x}, ${landAimM.y}) เหนือแยกพลแสน · ที่ให้เบรกข้างหลังลงก่อนชนตึกโคโลเนียล/แบริเออร์ฝั่งตะวันออก ≈ ${f(eastRoomM, 1)} ม.`);
p('- ไลน์: ออกจากเลนขาไปตะวันออก เลี้ยวขวาเฉียงข้ามเกาะกลาง (ช่องเปิดหน้าแยก) + ฝั่งขาไปตะวันตก (ปิดแข่ง) → กระโดดที่ราวเตี้ยริมคู → ลอยข้ามน้ำข้างคันดิน → ลงมนัส แล้วหักลงใต้');
table(['มุมเฉียง (จากทิศตะวันออก)', 'จุดขึ้น (x, y)', 'ระยะลอยต้องได้ (ม.)', 'ผ่านน้ำ (ม.)', 'ที่ให้เลี้ยวเข้า (ม.)', 'ความเร็วที่ลงสวย (+ ลอยค้าง)'], routes.map((r) => [
  r.angDeg + '°', `${f(r.xT, 0)}, ${f(r.yT, 0)}`, f(r.dNeed, 1), f(r.waterAlong, 1), f(r.latRoom, 1), r.lo ? `**${r.lo}–${r.hi} กม./ชม.**` : 'ไม่มี (ไกลเกิน/เบรกข้างไม่พอ)',
]));
const best = routes.filter((r) => r.lo).sort((a, b) => b.hi - b.lo - (a.hi - a.lo))[0];
{
  const rows = best.rows.filter((r) => r.kmh % 10 === 0).map((r) => [
    r.kmh, r.turnOk ? `ใช้ ${f(r.lat, 1)} ม. ✔` : `ต้องใช้ ${f(r.lat, 1)} ม. ✘`,
    r.flyOk ? (r.T > tAir + 0.01 ? `ลอยค้าง ${f(r.T - tAir, 2)} วิ ✔` : 'กระโดดเฉย ๆ พอดี ✔') : r.T < tAir ? 'เลยจุดลง (เร็วไป) ✘' : 'ลอยไม่ถึง → ตกน้ำ ✘',
    r.scrubOk ? `${f(r.aE / G, 1)} g ✔` : `${f(r.aE / G, 1)} g → ครูดตึก ✘`, r.ok ? '**ลงสวย**' : '—',
  ]);
  p(`รายละเอียดมุม ${best.angDeg}° (หน้าต่างกว้างที่สุด):`);
  table(['ขาเข้า (กม./ชม.)', 'เลี้ยวเข้าเฉียงทันไหม', 'ลอย', 'เบรกข้างหลังลง', 'ผล'], rows);
}
const tClear = (GAME.jumpVy - Math.sqrt(GAME.jumpVy ** 2 - 2 * gg * 1.0)) / gg;
p(`- กดกระโดดช้าสุด ${f(tClear * (best.lo / KMH), 1)}–${f(tClear * (best.hi / KMH), 1)} ม. ก่อนราว (ใต้ท้องพ้นราวสูง 1.0 ม. ใน ${f(tClear, 3)} วิ) · ห่างลานย่าโมกว่า 500 ม. ✔ · ตกน้ำ = ผิวน้ำต่ำกว่าถนน ~2 ม. [ยังไม่ยืนยัน] → respawn`);
p(`- ต้องเตรียมฉาก: แบริเออร์ปากถนนพลแสนฝั่งตะวันตกกับราวริมคูเป็นแบบ "เตี้ย" สูง ≤ 1.0 ม. (กระโดดข้ามได้) · เว้นโคมเสาประดับริมคูช่วง x ${f(best.xT - 15, 0)}–${f(best.xT + 10, 0)} ให้ช่องกว้าง ≥ 10 ม.`);
p();
criteria.moatJump = { trackM: 1180, waterWidthM: +(yCw.at(-1) - yCw[0]).toFixed(1), angleDeg: best.angDeg, takeoff: [+best.xT.toFixed(1), +best.yT.toFixed(1)], flightM: +best.dNeed.toFixed(1), cleanKmhWithHover: [best.lo, best.hi] };

// ── 4. corners
const muF = muEff(GAME.fanFull);
p('## 4. โค้งสนาม A — racing line ในความกว้างถนนจริง');
// Show 3: ~95° right across the 224 junction at the head of ราชดำเนิน (open box ~40 × 50 m).
// Local frame: entry heading +y, inner corner (Ratchadamnoen east curb × westbound south curb) at the origin.
const XJ = { w1: 13, w2: 29.5, gapE: 40 - 13, yMedian: 14.5, theta: 95 };
function junctionR({ w1, w2, gapE, yMedian, theta }) {
  const th = theta * DEG, m = 1.3;
  const d = [Math.sin(th), Math.cos(th)], nOut = [-Math.cos(th), Math.sin(th)]; // exit dir, its left normal
  const k = nOut[0] * 0 + nOut[1] * w2 - m;
  let bestR = 0;
  for (let R = 5; R < 200; R += 0.1) {
    const cx = -w1 + m + R, cy = (k - R - nOut[0] * cx) / nOut[1];
    // feasible only while the inner corner stays inside the circle (≥ m from the path) — true between two roots
    if (Math.hypot(cx, cy) > R - m) continue;
    const xm = cx - Math.sqrt(Math.max(R * R - (yMedian - cy) ** 2, 0)); // where the arc crosses the median line
    if (xm > gapE - m) continue;
    bestR = R;
  }
  return bestR;
}
const RJ = junctionR(XJ);
const RJtight = junctionR({ ...XJ, w2: 12 + 2.6 }); // if barriers keep you inside the westbound lanes' width
const turnCorner = { at_m: 525, angle: XJ.theta, dir: 'ขวา', xy: [-71, 560], w: '13 → 29.5', wu: null, R: RJ, at: 525 };
const cornerList = [turnCorner, ...cornerR.filter((c) => c.angle !== 148)];
cornerList.forEach((c) => (c.arc = c.R * c.angle * DEG));
table(['ที่ (ม.)', 'มุม', 'ทิศ', 'กว้าง (ม.)', 'R racing line (ม.)', 'grip ปกติ 1.6 g', 'พัดลม/ดริฟต์ 2.2 g', 'ฝน + พัดลม'], cornerList.map((c) => [
  c.at_m, c.angle + '°', c.dir, c.w, f(c.R, 1),
  f(Math.sqrt(muN0() * G * c.R) * KMH, 0), f(Math.sqrt(muEff(GAME.fanFull) * G * c.R) * KMH, 0), f(Math.sqrt(muEff(GAME.fanFull, true) * G * c.R) * KMH, 0),
]));
function muN0() { return muEff(GAME.fanStreet); }
p(`- โค้งทั่วไป: R = w_ใช้ได้ / (1 − cos(θ/2)), w_ใช้ได้ = กว้าง − 2.6 ม. · ความกว้างจาก Street View รอบ 2 (±2 ม.)`);
p(`- **โชว์ 3 แยก 224 หัวราชดำเนิน (เลี้ยวขวา ${XJ.theta}°):** เข้าจากราชดำเนินกว้าง ${XJ.w1} ม. → ออกฝั่งขาไปตะวันออก · ขอบในคือมุมสวนซุ้มประตู · ข้ามฝั่งขาไปตะวันตก + ช่องเกาะกลางได้ (ปิดแข่ง) รวมลึก ${XJ.w2} ม. · ช่องเกาะกลางเปิดกว้าง ~${XJ.gapE} ม. จากขอบทางราชดำเนิน → วงกลมใหญ่สุดที่ไม่ชนมุมสวนและผ่านช่องเกาะได้ **R ${f(RJ, 1)} ม.** · ถ้าแบริเออร์บังคับให้อยู่ในเลนขาไปตะวันออกอย่างเดียว R ${f(RJtight, 1)} ม.`);
p();
const Rh = RJ;
const vG = maxCircleSpeed(Rh, { fan: GAME.fanStreet });
const vGF = maxCircleSpeed(Rh, { fan: GAME.fanFull });
const vD35 = maxCircleSpeed(Rh, { fan: GAME.fanFull, drift: true, rearMul: 0.35 });
const vD85 = maxCircleSpeed(Rh, { fan: GAME.fanFull, drift: true, rearMul: GAME.driftRearMul });
const vDw = maxCircleSpeed(Rh, { fan: GAME.fanFull, drift: true, rearMul: GAME.driftRearMul, wet: true });
const vD85s = maxCircleSpeed(Rh, { fan: GAME.fanStreet, drift: true, rearMul: GAME.driftRearMul });
const bG = bicycle({ R: Rh, v0: vG * 0.97, fan: GAME.fanStreet });
const bD = bicycle({ R: Rh, v0: vD85 * 0.97, fan: GAME.fanFull, drift: true, rearMul: GAME.driftRearMul });
const latG = (v) => f((v * v) / Rh / G, 2);
p(`สกิดแพดจำลอง (bicycle model + Pacejka B ${TYRE.B} C ${TYRE.C} → มุมลื่นที่ยางเกาะสุด ${f(alphaPeak / DEG, 1)}°) บนวง R ${f(Rh, 1)} ม. — ความเร็วสูงสุดที่ยังรักษาเส้น ±2.5 ม. ได้ 9 วินาทีต่อเนื่อง:`);
table(['โหมด', 'v สูงสุด (กม./ชม.)', 'g ด้านข้าง', 'มุมสไลด์ β เฉลี่ย', 'มุมล้อหน้า δ เฉลี่ย (− = เลี้ยวสวน)'], [
  ['grip พัดลมปกติ', f(vG * KMH, 0), latG(vG), f(bG.betaAvg, 1) + '°', f(bG.deltaAvg, 1) + '°'],
  ['grip พัดลมเต็ม', f(vGF * KMH, 0), latG(vGF), '—', '—'],
  ['ดริฟต์ ยางหลัง ×0.35 (GAMEPLAY v1)', f(vD35 * KMH, 0), latG(vD35), '—', '—'],
  ['ดริฟต์ ยางหลัง ×0.85 แต่พัดลมปกติ', f(vD85s * KMH, 0), latG(vD85s), '—', '—'],
  [`**ดริฟต์ ยางหลัง ×${GAME.driftRearMul} + พัดลมเต็ม (เสนอ)**`, f(vD85 * KMH, 0), latG(vD85), f(bD.betaAvg, 1) + '°', f(bD.deltaAvg, 1) + '°'],
  ['ดริฟต์ (เสนอ) + ฝน', f(vDw * KMH, 0), latG(vDw), '—', '—'],
]);
const tTurn = (Rh * XJ.theta * DEG) / vD85;
p(`- ดริฟต์ผ่านแยก: ส่วนโค้งยาว ${f(Rh * XJ.theta * DEG, 0)} ม. ใช้เวลา ~${f(tTurn, 1)} วิ ที่ ${f(vD85 * KMH, 0)} กม./ชม. — ยาวพอให้นับแต้มดริฟต์ (เกณฑ์ ≥ 1.0 วิ FEEL-07) · เติมถัง ${f(tTurn * GAME.tank.driftRegen, 0)} หน่วย`);
criteria.showDrift = { R: +Rh.toFixed(1), Rtight: +RJtight.toFixed(1), vGripKmh: Math.round(vG * KMH), vDriftKmh: Math.round(vD85 * KMH), vDriftWetKmh: Math.round(vDw * KMH), driftRearMul: GAME.driftRearMul, turnS: +tTurn.toFixed(1) };
{
  const rows = [];
  for (const mzMul of [1]) for (const bt of [18, 30, 40]) {
    const r = bicycle({ R: Rh, v0: vD85 * 0.95, fan: GAME.fanFull, drift: true, rearMul: GAME.driftRearMul, betaTargetDeg: bt, mzMul });
    rows.push(['torque vectoring', bt + '°', f(r.betaAvg, 1) + '°', f(r.deltaAvg, 1) + '°', r.spun ? 'หมุน' : r.maxErr < 2.5 ? 'อยู่ในเส้น' : `หลุดเส้น ${f(r.maxErr, 1)} ม.`]);
  }
  const mz1 = GAME.muTyre * (GAME.mass * G * REAL.rearShare + 0.7 * GAME.fanFull * GAME.mass * G) * (REAL.track / 2);
  p(`มุมสไลด์ที่ระบบช่วยดริฟต์ถือได้ (ที่ ${f(vD85 * 0.95 * KMH, 0)} กม./ชม.) — yaw moment จาก torque vectoring 2 มอเตอร์หลังสูงสุด ${f(mz1 / 1000, 1)} kN·m:`);
  table(['แหล่ง yaw moment', 'β เป้า', 'β ที่ได้', 'มุมล้อหน้า δ', 'ผล'], rows);
}

// ── 5. lap time + shortcut
p('## 5. เวลาต่อรอบ สนาม A + ทางลัดข้ามคูเหนือ');
const lenFix = 50; // the legal 95° right is ~40–60 m shorter than the OSM left+148° routing (SV round 2 §4)
const LAPLEN = TRACK_LEN - lenFix;
const shiftC = cornerList.map((c) => (c.at > 600 ? { ...c, at: c.at - lenFix } : c));
const prof = profile(shiftC, LAPLEN);
const lapDry = lapTime(prof);
const lapGripOnly = lapTime(profile(shiftC, LAPLEN, { fanCorner: false }));
const lapWet = lapTime(profile(shiftC, LAPLEN, { wet: true }), { wet: true });
// main route vs cut, in shifted s
const sMain0 = 950 - lenFix, sMerge = 1251 - lenFix;
const mainSeg = segTime(lapDry, sMain0, sMerge);
const xStart = center.pts.find((q) => q.s >= 950).x; // north-road x at the branch
function cut(kmh) {
  const v0 = lapDry.v[sMain0], vJ = kmh / KMH, th = best.angDeg * DEG;
  const R = (vJ * vJ) / (muEff(GAME.fanFull) * G);
  const turnLen = R * th, xTurnIn = best.xT - R * Math.sin(th);
  const straight = Math.max(0, xTurnIn - xStart);
  const n = Math.max(1, Math.round(straight));
  const vs = new Float64Array(n + 1);
  vs[0] = v0;
  for (let i = 0; i < n; i++) vs[i + 1] = Math.sqrt(vs[i] ** 2 + 2 * Math.max(gameAccel(vs[i]), 0) * (straight / n));
  vs[n] = Math.min(vs[n], vJ);
  for (let i = n - 1; i >= 0; i--) vs[i] = Math.min(vs[i], Math.sqrt(vs[i + 1] ** 2 + 2 * GAME.brakeFanG * G * (straight / n)));
  let t = 0;
  for (let i = 0; i < n; i++) t += straight / n / ((vs[i] + vs[i + 1]) / 2);
  const tTurnIn = turnLen / vJ, tFly = best.dNeed / vJ;
  const vE = vJ * Math.cos(th), vS = vJ * Math.sin(th);
  const aE = (vE * vE) / (2 * eastRoomM), aS = Math.sqrt(Math.max((muEff(GAME.fanFull) * G) ** 2 - aE * aE, 0));
  const tScrub = vE / aE, vAfter = vS + 0.5 * aS * tScrub; // half of the remaining grip goes into accelerating south
  let v1 = vAfter, v2 = lapDry.v[sMerge], gap = 0, tt = 0;
  while (tt < 30 && v1 < v2 - 0.2) { v1 += gameAccel(v1) * DT; v2 += Math.max(gameAccel(v2), 0) * DT; gap += (v2 - v1) * DT; tt += DT; }
  return { total: t + tTurnIn + tFly + tScrub, debt: gap / Math.max(v2, 1), t, tTurnIn, tFly, tScrub, vAfter };
}
const cutMid = cut(Math.round((best.lo + best.hi) / 2));
const saveCut = mainSeg - cutMid.total - cutMid.debt;
const hoverUsed = Math.max(0, cutMid.tFly - tAir);
const gasCut = GAME.tank.jump + hoverUsed * GAME.tank.hoverPerS;
const sResp = 1130 - lenFix; // last progress ≈ takeoff abeam track_m 1140, respawn 10 m behind
const restart = lapTime(prof.slice(sResp, sMerge + 1), { closed: false, startV: 40 / KMH, endV: lapDry.v[sMerge] });
const failCost = cutMid.t + cutMid.tTurnIn + 0.7 * tAir + 0.6 + restart.t - mainSeg;
table(['', 'เวลา (วิ)'], [
  [`รอบปกติ แห้ง (สนามยาว ${f(LAPLEN, 0)} ม. หลังแก้แยก 224 · พัดลมช่วยในโค้ง ไม่ boost ไม่ทางลัด)`, f(lapDry.t, 1)],
  ['รอบปกติ ไม่ใช้พัดลมในโค้ง (grip 1.6 g)', f(lapGripOnly.t, 1)],
  ['รอบปกติ ฝน', f(lapWet.t, 1)],
  [`เส้นทางหลัก track_m 950→1251 (ราชสีมา-โชคชัย → โค้งขวา 90° แยกมนัส → คันดิน → แยกพลแสน)`, f(mainSeg, 2)],
  [`ทางลัดตัดโค้ง ${best.angDeg}° ที่ ${Math.round((best.lo + best.hi) / 2)} กม./ชม.: ตรง+เบรก ${f(cutMid.t, 2)} + เลี้ยวเฉียง ${f(cutMid.tTurnIn, 2)} + ลอย ${f(cutMid.tFly, 2)} + เบรกข้าง ${f(cutMid.tScrub, 2)} + ไล่ความเร็วคืน ${f(cutMid.debt, 2)}`, f(cutMid.total + cutMid.debt, 2)],
  ['**ทางลัดได้เปรียบต่อรอบ**', `**${f(saveCut, 1)} วิ** (ใช้ถัง ${f(gasCut, 0)} หน่วย)`],
  ['ตกน้ำ → respawn บนเส้นทางหลักที่ 40 กม./ชม. + จาง 0.6 วิ (เทียบกับไม่เสี่ยง)', `เสีย ~${f(Math.max(failCost, 0), 1)} วิ`],
]);
criteria.lap = { lapLenM: Math.round(LAPLEN), lapS: +lapDry.t.toFixed(1), lapWetS: +lapWet.t.toFixed(1), moatCutSaveS: +saveCut.toFixed(1), moatFailCostS: +Math.max(failCost, 0).toFixed(1), moatCutGas: Math.round(gasCut) };
const manatT = (boostS) => { let v = 80 / KMH, x = 0, t = 0; while (x < 917) { v += gameAccel(v, { boost: t < boostS }) * DT; x += v * DT; t += DT; } return t; };
const perUnit = (manatT(0) - manatT(2.5)) / 50;
const lapBoostAll = (() => {
  const vL = profile(shiftC, LAPLEN), n = vL.length, v = Float64Array.from(vL);
  for (let pass = 0; pass < 3; pass++) for (let j = 2 * n - 1; j >= 0; j--) { const i = j % n, nx = (i + 1) % n; v[i] = Math.min(v[i], Math.sqrt(v[nx] ** 2 + 2 * GAME.brakeFanG * G)); }
  for (let pass = 0; pass < 3; pass++) for (let j = 0; j < 2 * n; j++) { const i = j % n, nx = (i + 1) % n; v[nx] = Math.min(v[nx], Math.sqrt(v[i] ** 2 + 2 * Math.max(gameAccel(v[i], { boost: true }), 0))); }
  let t = 0; for (let i = 0; i < n; i++) t += 1 / Math.max((v[i] + v[(i + 1) % n]) / 2, 0.5); return t;
})();
const floorLap = (lapBoostAll - Math.max(saveCut, 0)) * 0.85;
p(`- ค่าของถังลม: boost 2.5 วิ (50 หน่วย) บนทางตรงมนัสได้ ${f(manatT(0) - manatT(2.5), 2)} วิ → **1 หน่วย ≈ ${f(perUnit, 3)} วิ** · ทางลัดใช้ ${f(gasCut, 0)} หน่วย = เสียโอกาส boost ~${f(gasCut * perUnit, 1)} วิ → ได้สุทธิ ~${f(saveCut - gasCut * perUnit, 1)} วิ/รอบ`);
p(`- เพดานล่างกันโกง (boost ตลอดรอบไม่จำกัดถัง ${f(lapBoostAll, 1)} วิ − ทางลัด แล้ว ×0.85): **${f(floorLap, 1)} วิ/รอบ** (GAMEPLAY v1 ตั้ง 48.0)`);
p();
criteria.lap.minPossibleLapS = +floorLap.toFixed(1);
criteria.lap.secPerGasUnit = +perUnit.toFixed(3);

// ── 6. rain
p('## 6. ฝน');
const vBr = 100 / KMH;
const stop = (mu) => (vBr * vBr) / (2 * mu * G);
const hydroKmh = (psi) => 9 * Math.sqrt(psi) * 1.852;
table(['', 'แห้ง', 'เปียก (ของจริง ×0.65)', `เปียก (เกม ×${GAME.wetMul})`], [
  ['μ ยาง', f(REAL.muTyre, 2), f(REAL.muTyre * 0.65, 2), f(REAL.muTyre * GAME.wetMul, 2)],
  ['เบรก 100→0 ไม่ใช้พัดลม (ม.)', f(stop(REAL.muTyre), 1), f(stop(REAL.muTyre * 0.65), 1), f(stop(REAL.muTyre * GAME.wetMul), 1)],
  ['เบรก 100→0 พัดลมเต็ม (ม.)', f(stop(muF), 1), f(stop(muF * 0.65), 1), f(stop(muF * GAME.wetMul), 1)],
  ['ดริฟต์แยก 224 (กม./ชม.)', f(vD85 * KMH, 0), f(Math.sqrt(0.65) * vD85 * KMH, 0), f(vDw * KMH, 0)],
  ['เวลาต่อรอบ (วิ)', f(lapDry.t, 1), '—', f(lapWet.t, 1)],
]);
p(`- hydroplaning (สูตร NASA/Horne V = 9·√(psi) นอต): ยาง 36 psi → **${f(hydroKmh(36), 0)} กม./ชม.** · 42 psi → ${f(hydroKmh(42), 0)} · ยางกว้าง 335 มม. เริ่มเร็วกว่านี้ → เกมใช้ 100`);
p();
criteria.rain = { wetMul: GAME.wetMul, hydroplaneKmh: 100 };

// ── 7. ropes + pendulums
p('## 7. สายไฟ (catenary + Verlet) + โคม/ป้าย (ลูกตุ้ม)');
// bundle of Thai street cables: d 30 mm, 0.6 kg/m, Cd 1.2 → wind accel a = ½ρ·Cd·d·u² / m'
const wireAcc = (u) => (0.5 * RHO * 1.2 * 0.03 * u * Math.abs(u)) / 0.6;
// car wake at distance r from the body: u ≈ 0.35·v·min(1, (1.5/r)²) (near-wake of a bluff body)
const wake = (v, r) => 0.35 * v * Math.min(1, (1.5 / r) ** 2);
const storm = (t) => ({ az: wireAcc(6 + 6 * Math.max(0, Math.sin(t * 1.3)) * Math.max(0, Math.sin(t * 0.37 + 1))) });
const carUnder = (kmh, gapM) => (t, x) => {
  const v = kmh / KMH, live = t > 0.5 && t < 0.5 + 4.4 / v, k = Math.exp(-(((x - 7) / 2) ** 2));
  return live ? { az: wireAcc(wake(v, gapM)) * k, ay: 0.4 * wireAcc(wake(v, gapM)) * k } : {};
};
const jetUp = (t, x) => (t > 0.5 && t < 0.9 ? { ay: wireAcc(6) * Math.exp(-(((x - 7) / 2.5) ** 2)), az: wireAcc(4) * Math.exp(-(((x - 7) / 2.5) ** 2)) } : {});
const cases = [
  ['ลมพายุฝน 6–12 ม./วิ · สายเลียบถนน ช่วง 35 ม. หย่อน 0.9', { span: 35, sag: 0.9, gust: storm, T: 14 }],
  ['รถ 150 กม./ชม. วิ่งลอดสายคร่อมถนน 14 ม. (หลังคาห่างสาย 4.5 ม.)', { span: 14, n: 8, sag: 0.5, gust: carUnder(150, 4.5) }],
  ['รถกระโดดลอดสายคร่อมถนน 100 กม./ชม. (หลังคาห่างสาย 0.8 ม.)', { span: 14, n: 8, sag: 0.5, gust: carUnder(100, 0.8) }],
  ['ไอพ่นกระโดดสะท้อนพื้นขึ้นใต้สาย', { span: 14, n: 8, sag: 0.5, gust: jetUp }],
];
const ropeRows = cases.map(([k, o]) => {
  const r1 = ropeSim(o), r8 = ropeSim({ ...o, mul: o.gust === storm ? 1 : 8 });
  return [k, f(r1.maxDisp, 2), o.gust === storm ? '— (ใช้ค่าจริง)' : f(r8.maxDisp, 2), r8.maxDisp < 0.05 ? 'ไม่ถึง 5 ซม.' : r8.settleT === null ? 'แกว่งตลอดที่มีลม' : f(r8.settleT, 1)];
});
const r35 = ropeSim({ span: 35, sag: 0.9 }), r14 = ropeSim({ span: 14, n: 8, sag: 0.5 });
p(`หย่อนตรงตามสูตร catenary ทุกจุด (เป็นรูปทรงตั้งต้น) · ความถี่โหมดแรก ช่วง 35 ม. ${f(r35.f1, 2)} Hz · คาบแกว่งข้าง ${f(r35.swingT, 2)} วิ · ค่าเสถียร (c·dt/dx)² = ${f(r35.courant ** 2, 3)} / ${f(r14.courant ** 2, 3)} (< 1 ✔)`);
p();
table(['เหตุการณ์', 'แกว่งสูงสุด ของจริง (ม.)', 'ในเกม ×8 (ม.)', 'นิ่ง < 5 ซม. (วิ)'], ropeRows);
const msFrame = ropeBench(1200, 1500, 1);
p(`- งบมือถือ: 1,200 จุดต่อเฟรม ${f(msFrame, 3)} ms บนเครื่องนี้ → มือถือกลาง (ช้ากว่า ~6×) ≈ **${f(msFrame * 6, 2)} ms/เฟรม**`);
p();
const lantern = (kmh, r) => pendulumSim({ wind: (t) => (t > 0.5 && t < 0.5 + 4.4 / (kmh / KMH) + 0.3 ? wake(kmh / KMH, r) : 0) });
const lStorm = pendulumSim({ wind: (t) => 0.5 * (6 + 6 * Math.max(0, Math.sin(t * 1.3))), T: 14 }); // street canyon shelters ~50 %
const sign = (kmh, r) => pendulumSim({ L: 0.8, mass: 8, area: 0.48 * 0.15, wind: (t) => (t > 0.5 && t < 0.5 + 4.4 / (kmh / KMH) + 0.3 ? wake(kmh / KMH, r) : 0) });
table(['ของแขวน', 'คาบ (วิ)', 'รถ 100 ห่าง 3 ม.', 'รถ 200 ห่าง 3 ม.', 'รถกระโดดผ่านห่าง 1 ม. (100)', 'ลมพายุ'], [
  ['โคมจีน LED ⌀40 ซม. 1 กก. เชือก 0.6 ม.', f(lantern(100, 3).period, 2), f(lantern(100, 3).maxDeg, 0) + '°', f(lantern(200, 3).maxDeg, 0) + '°', f(lantern(100, 1).maxDeg, 0) + '°', f(lStorm.maxDeg, 0) + '°'],
  ['ป้าย blade 1.2×0.4 ม. 8 กก. (ลมกระทบด้านสัน)', f(sign(100, 3).period, 2), f(sign(100, 3).maxDeg, 1) + '°', f(sign(200, 3).maxDeg, 1) + '°', f(sign(100, 1).maxDeg, 1) + '°', '—'],
]);
criteria.ropes = { maxSimPoints: 1200, msPerFrameDesktop: +msFrame.toFixed(3), gameGustMul: 8 };

if (JSON_OUT) console.log(JSON.stringify({ generated: new Date().toISOString(), real: REAL, game: GAME, criteria }, null, 2));
else console.log(out.join('\n'));
