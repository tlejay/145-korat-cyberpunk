#!/usr/bin/env node
// Headless check that the real game physics (src/car/physics.ts) matches the numbers proven in
// scripts/physics-sim.mjs / docs/dev/PHYSICS.md §9. Runs the actual TypeScript step via Node's
// built-in type stripping (Node ≥ 22.18) — no packages.
// Usage: node scripts/test-car-physics.mjs        (exit code 1 if any check fails)
import { register } from 'node:module';

// The game imports './x.js' for TypeScript files (Vite/TS bundler style) → map to .ts for Node.
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath } from 'node:url';
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('.') && spec.endsWith('.js') && ctx.parentURL?.endsWith('.ts')) {
          const ts = new URL(spec.slice(0, -3) + '.ts', ctx.parentURL);
          if (existsSync(fileURLToPath(ts))) return next(ts.href, ctx);
        }
        return next(spec, ctx);
      }`),
  import.meta.url,
);
const { CarPhysics } = await import('../src/car/physics.ts');
const { TUNING, G, KMH } = await import('../src/car/config.ts');

const DT = 1 / 120;
const DEG_R = Math.PI / 180;
const flat = (barriers = []) => ({
  barriers, heightAt: () => 0, surfaceAt: () => 'road', zones: { noBoostNoJump: [] },
  moatJump: { takeoff: { x: 1e5, z: 1e5 }, landing: { x: 1e5, z: 1e5 + 1 }, widthM: 28.6 },
});
const idle = { steer: 0, throttle: 0, brake: 0, jump: false, boost: false };
const results = [];
const check = (name, value, want, tol, unit = '') => {
  const ok = Array.isArray(want) ? value >= want[0] && value <= want[1] : Math.abs(value - want) <= Math.abs(want) * tol;
  const target = Array.isArray(want) ? `${want[0]}–${want[1]}` : `${want} ±${Math.round(tol * 100)}%`;
  results.push({ name, value: +value.toFixed(3), target: target + unit, ok });
};
const settle = (car, env) => { for (let i = 0; i < 120; i++) car.step(DT, idle, env); };

// 0–100 / 0–200: normal, boost, launch
function sprint({ boost = false, launch = false }) {
  const env = flat(), car = new CarPhysics();
  car.reset(0, 0, 0, 0); settle(car, env);
  car.freeLaunch = true;
  if (launch) for (let i = 0; i < 120; i++) car.step(DT, { ...idle, boost: true }, env);
  let t = 0, t100 = null, t60mph = null, frontLift = false;
  while (t < 20 && car.speed * KMH < 200) {
    car.step(DT, { ...idle, throttle: 1, boost: boost && t > 0.02 }, env);
    t += DT;
    if (car.tel.launch.active && !(car.contact[0] || car.contact[1])) frontLift = true;
    if (t60mph === null && car.speed >= 26.82) t60mph = t;
    if (t100 === null && car.speed * KMH >= 100) t100 = t;
  }
  return { t100, t60mph, t200: t, peak: car.tel.g.peak, frontLift };
}
const n = sprint({}), bo = sprint({ boost: true }), la = sprint({ launch: true, boost: true }), la0 = sprint({ launch: true });
check('FEEL-03 0–100 ปกติ (วิ)', n.t100, 2.33, 0.1);
check('FEEL-03 0–100 boost (วิ)', bo.t100, 1.08, 0.1);
check('FEEL-03 0–100 launch+boost (วิ)', la.t100, 0.63, 0.1);
check('launch 0–60 mph (วิ, จริง < 0.59)', la0.t60mph, [0.5, 0.65]);
check('FEEL-03b g สูงสุดตอนออกตัว', la0.peak, [4.4, 4.9]);
check('FEEL-03b ล้อหน้าไม่ลอยตอนออกตัว (1 = ผ่าน)', la0.frontLift ? 0 : 1, [1, 1]);

// top speed
function topSpeed(boost) {
  const env = flat(), car = new CarPhysics();
  car.reset(0, 0, 0, 0); settle(car, env);
  for (let i = 0; i < 120 * 60; i++) { car.step(DT, { ...idle, throttle: 1, boost }, env); car.gas = 100; }
  return car.speed * KMH;
}
check('FEEL-04 ท็อปสปีด (กม./ชม.)', topSpeed(false), 240, 0.05);
check('FEEL-04 ท็อปสปีด boost (กม./ชม.)', topSpeed(true), 320, 0.05);

// braking 100 → 0 with fans already full (just accelerated to 100)
{
  const env = flat(), car = new CarPhysics();
  car.reset(0, 0, 0, 0); settle(car, env);
  while (car.speed * KMH < 100) car.step(DT, { ...idle, throttle: 1 }, env);
  const z0 = car.z;
  let t = 0;
  while (car.speed > 0.05 && t < 10) { car.step(DT, { ...idle, brake: 1 }, env); t += DT; }
  check('PHY-06 เบรก 100→0 พัดลมเต็ม (ม.)', Math.abs(car.z - z0), 17.8, 0.1);
  check('เบรกแล้วไม่ถอยเอง (กม./ชม.)', car.speed * KMH, [0, 1]);
}

// skidpad R 56.2 (the 224 junction): highest speed holding ±2.5 m for 9 s, grip mode
function circle(R, vKmh, { drift = false, rain = 0 } = {}) {
  const env = flat(), car = new CarPhysics();
  TUNING.rain = rain;
  car.reset(0, 0, 0, Math.PI / 2); // heading east, circle centre to the south (+z) → right turn
  const cx = 0, cz = R;
  const v0 = vKmh / KMH;
  car.vx = v0; car.vz = 0; car.r = v0 / R;
  settle(car, { ...env }); car.vx = v0; car.vz = 0; car.x = 0; car.z = 0; car.heading = Math.PI / 2; car.r = v0 / R;
  let maxErr = 0, t = 0, betaSum = 0, nB = 0, spun = false, minV = 1e9;
  const L = TUNING.wheelbaseM;
  while (t < 12) {
    const dx = car.x - cx, dz = car.z - cz, dist = Math.hypot(dx, dz);
    const err = dist - R; // + outside
    const tang = Math.atan2(-dz, dx) + Math.PI / 2; // clockwise tangent as heading (0 = north)
    const tangH = Math.atan2(-dz / dist, -dx / dist) ;
    void tangH;
    const chi = Math.atan2(car.vx, -car.vz);
    // heading of the clockwise tangent at (dx,dz): direction ( -dz, dx ) rotated → use cross product
    const tx = -dz / dist, tz = dx / dist; // clockwise around centre (viewed from above, z south)
    const want = Math.atan2(tx, -tz);
    let hErr = Math.atan2(Math.sin(chi - want), Math.cos(chi - want)); // + = travelling right of tangent (inward)
    void tang;
    const kmh = car.speed * KMH;
    const dMax = (kmh < 120 ? 32 + (14 - 32) * (kmh / 120) : 14 + (7 - 14) * Math.min(1, (kmh - 120) / 120)) * Math.PI / 180;
    let steer, brake = 0, throttle;
    if (!drift) {
      steer = (Math.atan(L / R) + 0.04 * err - 0.8 * hErr) / dMax;
      throttle = Math.max(0, Math.min(1, (v0 - car.speed) * 0.8 + 0.25));
    } else {
      steer = Math.max(0.05, Math.min(1, 0.75 + 0.15 * err - 1.5 * hErr));
      throttle = 1;
      if (t < 0.1) brake = 1;
      if (car.speed < v0) car.gas = 100; // keep test independent of boost economy
    }
    car.step(DT, { steer: Math.max(-1, Math.min(1, steer)), throttle, brake, jump: false, boost: drift && car.speed < v0 }, env);
    t += DT;
    if (t > 3) {
      maxErr = Math.max(maxErr, Math.abs(err));
      betaSum += Math.abs(car.tel.slip.betaDeg); nB++;
      minV = Math.min(minV, car.speed);
      if (Math.abs(car.tel.slip.betaDeg) > 75) spun = true;
    }
  }
  TUNING.rain = 0;
  return { ok: maxErr < 2.5 && !spun && (!drift || car.drifting), maxErr, beta: betaSum / Math.max(nB, 1), minV };
}
// Highest speed that holds the circle. The drift controller is a crude "test driver" that only holds
// the line near the drift limit, so the drift search starts at 95 km/h (bisection needs lo to pass).
const maxCircle = (R, opts) => {
  let lo = opts.drift ? 95 : 40, hi = 180;
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (circle(R, mid, opts).ok) lo = mid; else hi = mid; }
  return lo;
};
const vGrip = maxCircle(56.2, {});
const vDrift = maxCircle(56.2, { drift: true });
check('PHY-01 skidpad R56 grip (กม./ชม.)', vGrip, 107, 0.07);
check('PHY-02 ดริฟต์แยก 224 R56 (กม./ชม.)', vDrift, 122, 0.08);
check('PHY-03 ดริฟต์ ÷ grip', vDrift / vGrip, [1.05, 1.4]);
const dr = circle(56.2, vDrift * 0.97, { drift: true });
check('ดริฟต์: มุมสไลด์เฉลี่ย ≥ 15° (นับแต้มได้)', dr.beta, [15, 45]);
check('ดริฟต์ฝน R56 (กม./ชม.)', maxCircle(56.2, { drift: true, rain: 1 }), 112, 0.1);

// FEEL-08: 120 km/h, alternate full steer every 0.5 s for 10 s → no spin
{
  const env = flat(), car = new CarPhysics();
  car.reset(0, 0, 0, 0); settle(car, env);
  car.vz = -120 / KMH;
  let maxBeta = 0, maxYaw = 0;
  for (let i = 0; i < 1200; i++) {
    const steer = Math.floor(i / 60) % 2 ? 1 : -1;
    car.step(DT, { ...idle, steer, throttle: 0.6 }, env);
    maxBeta = Math.max(maxBeta, Math.abs(car.tel.slip.betaDeg));
    maxYaw = Math.max(maxYaw, Math.abs(car.heading) * 180 / Math.PI);
  }
  check('FEEL-08 สลับเลี้ยวที่ 120: มุมสไลด์สูงสุด (°)', maxBeta, [0, 20]);
  check('FEEL-08 สลับเลี้ยวที่ 120: หัวรถเบี่ยงสูงสุด (°)', maxYaw, [0, 90]);
}

// FEEL-09: 20 km/h full lock turning radius ≤ 8 m
{
  const env = flat(), car = new CarPhysics();
  car.reset(0, 0, 0, 0); settle(car, env);
  car.vz = -20 / KMH;
  let minX = 0, maxX = 0;
  for (let i = 0; i < 1200; i++) {
    car.step(DT, { ...idle, steer: 1, throttle: car.speed * KMH < 20 ? 0.3 : 0 }, env);
    minX = Math.min(minX, car.x); maxX = Math.max(maxX, car.x);
  }
  check('FEEL-09 วงเลี้ยว 20 กม./ชม. รัศมี (ม.)', (maxX - minX) / 2, [2, 8]);
}

// FEEL-05 jump at 60 km/h
{
  const env = flat(), car = new CarPhysics();
  car.reset(0, 0, 0, 0); settle(car, env);
  car.vz = -60 / KMH;
  for (let i = 0; i < 30; i++) car.step(DT, { ...idle, throttle: 0.2 }, env);
  const gas0 = car.gas, z0 = car.z;
  let t = 0, airT = 0, landed = false, j = 0;
  const jumps = car.tel.events.jump;
  while (t < 4 && !landed) {
    car.step(DT, { ...idle, throttle: 0.2, jump: t < 0.05 }, env);
    t += DT;
    if (car.airborne) airT += DT;
    if (car.tel.events.land > j && car.tel.events.jump > jumps) landed = true;
  }
  j = car.tel.events.land;
  check('FEEL-05 กระโดด 60: สูงสุด (ม.)', car.tel.apexM, 3.53, 0.15);
  check('FEEL-05 กระโดด 60: เวลาลอย (วิ)', airT, 1.53, 0.15);
  check('FEEL-05 กระโดด 60: ระยะ (ม.)', Math.abs(car.z - z0), 25.6, 0.15);
  check('FEEL-05 ความเร็วแตะพื้น (ม./วิ, landing burn)', -(car.tel.lastLand?.vyMs ?? -99), [0, 3.5]);
  check('FEEL-05b ถังลมต่อการกระโดด', gas0 - car.gas + 3 * airT /* regen during air excluded below */ - 3 * airT, 35, 0.03);
  let settled = 0;
  for (let i = 0; i < 36; i++) { car.step(DT, { ...idle }, env); if (car.contact.every(Boolean)) { settled = i + 1; break; } }
  check('FEEL-05 ล้อแตะครบ 4 หลังลง (ms)', (settled / 120) * 1000, [0, 300]);
  // spam jump: cooldown + gas must stop it flying away
  let maxY = 0;
  for (let i = 0; i < 600; i++) { car.step(DT, { ...idle, jump: i % 2 === 0 }, env); maxY = Math.max(maxY, car.y); }
  check('FEEL-05 กดกระโดดรัว: สูงสุด (ม.)', maxY, [0, 6]);
}

// boost drain 20/s
{
  const env = flat(), car = new CarPhysics();
  car.reset(0, 0, 0, 0); settle(car, env);
  car.vz = -100 / KMH; car.gas = 100;
  for (let i = 0; i < 120; i++) car.step(DT, { ...idle, throttle: 1, boost: true }, env);
  check('FEEL-05b boost กินถัง/วิ', 100 - car.gas, 20, 0.03);
}

// FEEL-13/14: walls (north wall at z = −40)
function wallHit(angleDeg, kmh) {
  const wall = [{ a: { x: -500, z: -40 }, b: { x: 500, z: -40 } }];
  const env = flat(wall), car = new CarPhysics();
  const h = (angleDeg - 90) * Math.PI / 180; // angle between path and wall: 90 = straight in
  car.reset(0, 0, -40 + 12 * Math.sin(angleDeg * Math.PI / 180) + 2, h); settle(car, env);
  const v = kmh / KMH;
  car.vx = Math.sin(h) * v; car.vz = -Math.cos(h) * v; car.heading = h;
  let before = v, after = null, minZ = 0, stuck = 0;
  for (let i = 0; i < 600; i++) {
    const seq = car.lastImpact?.seq ?? 0;
    car.step(DT, { ...idle, throttle: i > 240 ? 1 : 0 }, env);
    minZ = Math.min(minZ, car.z);
    if ((car.lastImpact?.seq ?? 0) > seq && after === null) after = car.speed;
    if (i > 240 && car.speed < 3 / KMH) stuck++;
  }
  return { keep: (after ?? before) / before, through: minZ < -40, stuckS: stuck / 120 };
}
const head = wallHit(90, 80), glance = wallHit(20, 80), boostHit = wallHit(90, 220);
check('ชนตรง 80: ความเร็วที่เหลือ', head.keep, [0.15, 0.35]);
check('เฉียด 20° 80: ความเร็วที่เหลือ', glance.keep, [0.75, 0.95]);
check('FEEL-14 ชน 220 ไม่ทะลุกำแพง (1 = ผ่าน)', boostHit.through ? 0 : 1, [1, 1]);
check('FEEL-13 ชนแล้วกดเร่งไม่ติด (วิ)', head.stuckS, [0, 2]);


// FEEL-14 on the real track A: overshoot every corner into its outer wall at 80/110/150 km/h, straight (0°)
// and angled (45°), hands off or steering — the car must never leave the ground by more than 3 m.
// (M3 regression: wall impulses fed the body-roll moment → 5.9 m bounce at Sanphasit→Watcharasarit.)
{
  const { readFileSync } = await import('node:fs');
  const { decodeTrack, makeLookups } = await import('../src/track/data.ts');
  const raw = JSON.parse(readFileSync(new URL('../public/data/track-A.json', import.meta.url), 'utf8'));
  const data = decodeTrack(raw);
  const { surfaceAt, heightAt } = makeLookups(data, raw.water.level);
  const KIND = ['wall', 'barrier', 'wall', 'building', 'monument', 'prop'];
  const ring = (a) => { const o = []; for (let i = 0; i < a.length; i += 2) o.push({ x: a[i] * 0.1, z: a[i + 1] * 0.1 }); return o; };
  const env = {
    barriers: data.walls.map((w) => ({ a: w.a, b: w.b, h: w.h, kind: KIND[w.kind] })), heightAt, surfaceAt,
    zones: { noBoostNoJump: raw.zones.map(ring) }, moatJump: raw.moatJump,
  };
  const S = data.samples, step = data.lengthM / S.length;
  const at = (s) => S[((Math.round(s / step) % S.length) + S.length) % S.length];
  const hdg = (p) => Math.atan2(p.tx, -p.tz);
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  let worst = 0, worstAt = '', hits = 0;
  for (const c of raw.corners) for (const kmh of [80, 110, 150]) for (const ang of [0, 45]) for (const hands of [0, 1]) {
    const p0 = at(c.s - 90), car = new CarPhysics();
    car.reset(p0.x, heightAt(p0.x, p0.z), p0.z, hdg(p0)); settle(car, env);
    const aim0 = hdg(at(c.s - 30)) + (ang ? (c.dir === 'R' ? -1 : 1) * ang * DEG_R : 0); // angled = away from the turn
    let maxH = 0, seq0 = car.lastImpact?.seq ?? 0, hit = false, tHit = 0;
    for (let i = 0; i < 8 * 120; i++) {
      const sNow = c.s - 90 + i * (kmh / KMH) / 120;
      const look = at(Math.min(sNow + 20, c.s - 30));
      const want = sNow > c.s - 35 ? aim0 : Math.atan2(look.x - car.x, -(look.z - car.z));
      const steer = hit && !hands ? 0 : Math.max(-1, Math.min(1, wrapA(want - car.heading) / (25 * DEG_R)));
      if (i === 0) { car.vx = Math.sin(car.heading) * kmh / KMH; car.vz = -Math.cos(car.heading) * kmh / KMH; }
      if (hit) tHit += DT;
      const inp = !hit || tHit < 0.3 ? { throttle: car.speed * KMH < kmh ? 1 : 0.2, steer }
        : tHit < 1.5 ? { throttle: 1, steer } : tHit < 3 ? { brake: 1, steer: 1 } : { throttle: 1, steer: -0.5 }; // QA FEEL-13 recovery
      car.step(DT, { ...idle, ...inp }, env);
      if ((car.lastImpact?.seq ?? 0) > seq0) hit = true;
      const hNow = car.y - heightAt(car.x, car.z);
      if (hNow > maxH) maxH = hNow;
    }
    if (hit) hits++;
    if (maxH > worst) { worst = maxH; worstAt = `s${c.s} ${kmh} กม./ชม. ${ang}°`; }
  }
  check(`FEEL-14 ชนทุกโค้งสนาม A ที่ 80/110/150: ลอยสูงสุด (ม.) [${worstAt}]`, worst, [0, 3]);
  check('FEEL-14 สนาม A: จำนวนครั้งที่ชนจริง (จาก 72)', hits, [72, 72]);
}

// FEEL-14 sweep on a flat wall: every angle 10–90°, 80–210 km/h, steering held left / none / right.
// Before the fix a 30° hit at 210 with steering barrel-rolled the car 590° and threw it 8.7 m (90° → 11.8 m).
{
  let worst = 0, worstAt = '';
  for (const kind of ['barrier', 'wall']) for (const ang of [10, 20, 30, 45, 60, 75, 90]) for (const kmh of [80, 110, 150, 210]) for (const steer of [-1, 0, 1]) {
    const env = flat([{ a: { x: -500, z: -40 }, b: { x: 500, z: -40 }, h: kind === 'barrier' ? 1.15 : Infinity, kind }]);
    const car = new CarPhysics(), h = (ang - 90) * DEG_R;
    car.reset(0, 0, -26, h); settle(car, env);
    car.vx = Math.sin(h) * kmh / KMH; car.vz = -Math.cos(h) * kmh / KMH;
    let maxY = 0;
    for (let i = 0; i < 480; i++) { car.step(DT, { ...idle, throttle: 1, steer }, env); maxY = Math.max(maxY, car.y); }
    if (maxY > worst) { worst = maxY; worstAt = `${kind} ${ang}° ${kmh}`; }
  }
  check(`FEEL-14 ชนกำแพงทุกมุม 10–90° ที่ 80–210: ลอยสูงสุด (ม.) [${worstAt}]`, worst, [0, 3]);
}

// moat rules: railing inside the jump corridor is low (jumpable), a tall wall elsewhere is not
function jumpOver(wallZ, corridor) {
  const wall = [{ a: { x: -50, z: wallZ }, b: { x: 50, z: wallZ } }];
  const env = flat(wall);
  if (corridor) env.moatJump = { takeoff: { x: 0, z: wallZ + 15 }, landing: { x: 0, z: wallZ - 40 }, widthM: 28.6 };
  const car = new CarPhysics();
  car.reset(0, 0, 0, 0); settle(car, env);
  car.vz = -100 / KMH;
  let minZ = 0;
  for (let i = 0; i < 360; i++) {
    const jump = car.z < wallZ + 8 && car.z > wallZ + 9 - 3; // press ~5–8 m before the wall
    car.step(DT, { ...idle, throttle: 0.5, jump }, env);
    minZ = Math.min(minZ, car.z);
  }
  return minZ < wallZ - 5;
}
check('กระโดดข้ามราวริมคู (ในช่วงคู) ได้ (1 = ผ่าน)', jumpOver(-40, true) ? 1 : 0, [1, 1]);
check('กระโดดข้ามกำแพงสูงนอกช่วงคูไม่ได้ (1 = ผ่าน)', jumpOver(-40, false) ? 0 : 1, [1, 1]);

// plaza zone: no jump / boost inside, and no jump that would land inside
{
  const zone = [{ x: -20, z: -80 }, { x: 20, z: -80 }, { x: 20, z: -40 }, { x: -20, z: -40 }];
  const env = { ...flat(), zones: { noBoostNoJump: [zone] } };
  const car = new CarPhysics();
  car.reset(0, 0, 0, 0); settle(car, env);
  car.vz = -100 / KMH;
  const j0 = car.tel.events.jump;
  for (let i = 0; i < 20; i++) car.step(DT, { ...idle, jump: i === 2 }, env); // would land at z ≈ −45 → refused
  check('ห้ามกระโดดถ้าจุดตกอยู่ในเขตลานย่าโม (1 = ผ่าน)', car.tel.events.jump === j0 ? 1 : 0, [1, 1]);
  car.reset(0, 0, -60, 0); settle(car, env); car.vz = -100 / KMH;
  for (let i = 0; i < 60; i++) car.step(DT, { ...idle, throttle: 1, boost: true, jump: i === 5 }, env);
  check('ในเขตลาน: boost/กระโดดไม่ทำงาน (1 = ผ่าน)', !car.tel.boosting && car.tel.events.jump === j0 ? 1 : 0, [1, 1]);
}

// water: driving into the moat fires one splash event and reports the surface
{
  const env = { ...flat(), surfaceAt: (x, z) => (z < -30 ? 'water' : 'road'), heightAt: (x, z) => (z < -30 ? -2 : 0) };
  const car = new CarPhysics();
  car.reset(0, 0, 0, 0); settle(car, env);
  car.vz = -60 / KMH;
  for (let i = 0; i < 360; i++) car.step(DT, { ...idle, throttle: 0.3 }, env);
  check('ตกคู: splash 1 ครั้ง + surface = water (1 = ผ่าน)', car.tel.events.splash === 1 && car.surface === 'water' ? 1 : 0, [1, 1]);
}

// hydroplaning
{
  const env = { ...flat(), puddleAt: (x, z) => z < -20 && z > -40 };
  const run = (kmh) => { const car = new CarPhysics(); car.reset(0, 0, 0, 0); settle(car, env); car.vz = -kmh / KMH; let hp = false; for (let i = 0; i < 120; i++) { car.step(DT, { ...idle }, env); hp ||= car.tel.hydroplaning; } return hp; };
  check('PHY-07 hydroplaning 110 = ใช่ / 90 = ไม่ (1 = ผ่าน)', run(110) && !run(90) ? 1 : 0, [1, 1]);
}


// cables (M3 module): stays stable, moves a visible amount when the car jumps under it
{
  const { CableSystem, CABLE_TUNING } = await import('../src/car/physics-cables.ts');
  const cs = new CableSystem([{ ax: -7, ay: 6, az: -30, bx: 7, by: 6, bz: -30, sag: 0.5, n: 8 }], [{ x: 2, y: 4, z: -30, length: 0.6 }]);
  const rest = Float32Array.from(cs.positions);
  let maxD = 0, lantern = 0;
  for (let i = 0; i < 600; i++) {
    const z = -i * (100 / KMH) / 60; // car at 100 km/h heading north, airborne roof ~4.9 m near z −30
    cs.step(1 / 60, { x: 0, y: Math.abs(z + 30) < 6 ? 3.5 : 0, z, vx: 0, vz: -100 / KMH, airborne: true, jumpJet: false });
    for (let k = 0; k < rest.length; k += 3) maxD = Math.max(maxD, Math.hypot(cs.positions[k] - rest[k], cs.positions[k + 1] - rest[k + 1], cs.positions[k + 2] - rest[k + 2]));
    lantern = Math.max(lantern, Math.abs(cs.lanternAngles[0]), Math.abs(cs.lanternAngles[1]));
  }
  check('สายไฟ: รถกระโดดลอด แกว่ง (ม., ×8)', maxD, [0.1, 1.5]);
  check('โคมจีน: รถผ่านห่าง ~1 ม. แกว่ง (°)', lantern * 180 / Math.PI, [5, 60]);
  CABLE_TUNING.stormWind = 12;
  for (let i = 0; i < 3600; i++) cs.step(1 / 60, { x: 0, y: 0, z: -20, vx: 0, vz: 0, airborne: false, jumpJet: false });
  CABLE_TUNING.stormWind = 0;
  let finite = true, md = 0;
  for (let k = 0; k < rest.length; k++) { if (!Number.isFinite(cs.positions[k])) finite = false; }
  for (let k = 0; k < rest.length; k += 3) md = Math.max(md, Math.hypot(cs.positions[k] - rest[k], cs.positions[k + 2] - rest[k + 2]));
  check('สายไฟ: ลมพายุ 6–12 ม./วิ 60 วิ เสถียร แกว่ง (ม.)', finite ? md : 99, [0.05, 1.5]);
}

// performance
{
  const env = flat(), car = new CarPhysics();
  car.reset(0, 0, 0, 0); settle(car, env);
  const t0 = performance.now();
  for (let i = 0; i < 12000; i++) car.step(DT, { ...idle, throttle: 1, steer: Math.sin(i / 90) }, env);
  const us = ((performance.now() - t0) / 12000) * 1000;
  check('PHY-08 เวลาต่อ step บนเครื่องนี้ (µs) — มือถือ ×6 ต้อง < 1 ms/เฟรม (2 step)', us, [0, 80]);
}

const w = Math.max(...results.map((r) => r.name.length));
let fail = 0;
for (const r of results) {
  if (!r.ok) fail++;
  console.log(`${r.ok ? 'ผ่าน' : 'ไม่ผ่าน'}  ${r.name.padEnd(w)}  ${String(r.value).padStart(8)}   เป้า ${r.target}`);
}
console.log(`\n${results.length - fail}/${results.length} ผ่าน`);
process.exit(fail ? 1 : 0);
