#!/usr/bin/env node
// Headless test for the alcohol checkpoint (src/checkpoint): the real car physics (src/car/physics.ts)
// drives through / jumps over the real prop simulation on a straight 12.6 m road with kerb walls.
// Usage: node scripts/test-checkpoint.mjs        (exit code 1 if any check fails)
import { register } from 'node:module';

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
const { CheckpointSim, CP } = await import('../src/checkpoint/sim.ts');

const DT = 1 / 120, FRAME = 1 / 60, KMH = 3.6;
// straight road heading north (−z): centreline x = 0 from z = +600 to z = −1400, site at s = 1000 → z = −400
const centerline = [];
for (let z = 600; z >= -1400; z -= 2.5) centerline.push({ x: 0, z });
const barriers = [
  { a: { x: -6.3, z: 600 }, b: { x: -6.3, z: -1400 }, kind: 'wall' },
  { a: { x: 6.3, z: 600 }, b: { x: 6.3, z: -1400 }, kind: 'wall' },
];
const env = {
  barriers, heightAt: () => 0, surfaceAt: () => 'road', zones: { noBoostNoJump: [] },
  moatJump: { takeoff: { x: 1e5, z: 1e5 }, landing: { x: 1e5, z: 1e5 + 1 }, widthM: 28.6 },
};
const track = { centerline, heightAt: () => 0, barriers };
const SITE = [{ id: 9, name: 'ด่านทดสอบ', road: 'ทดสอบ', at: { x: 0, z: -400 } }];

const results = [];
const check = (name, ok, value) => results.push({ name, ok: !!ok, value });

function run({ kmh, lane = 0, jumpAt = null, jumpOnCue = false, cueBias = 0.5, seconds = 6, hover = false }) {
  const events = [];
  const sim = new CheckpointSim(track, (type, detail) => events.push({ type, ...detail }), SITE);
  const car = new CarPhysics();
  const site = sim.sites[0];
  // start 120 m before the first cone
  const z0 = site.oz - (site.u0 - 200);
  car.reset(lane, 0, z0, 0);
  for (let i = 0; i < 60; i++) car.step(DT, idle, env);
  car.freeLaunch = false;
  car.vz = -kmh / KMH; car.vx = 0;
  car.gas = 100;
  const ctl = {
    slow(f) { car.vx *= f; car.vz *= f; },
    push(dx, dz, vx, vz) { car.x += dx; car.z += dz; car.vx = vx; car.vz = vz; },
  };
  let jumped = false, minPropY = Infinity, nanSeen = false, minKmh = Infinity, t = 0, maxMs = 0, sumMs = 0, frames = 0;
  let cueNowAt = null, peakMoved = 0, peakTipped = 0, peakFly = 0, settleAt = null, hitT = null, peakG = 0;
  const view = { x: 0, y: 0, z: 0, heading: 0, vx: 0, vy: 0, vz: 0, airborne: false, liftN: 0, jumpSeq: 0 };
  const sync = () => {
    view.x = car.x; view.y = car.y; view.z = car.z; view.heading = car.heading;
    view.vx = car.vx; view.vy = car.vy; view.vz = car.vz; view.airborne = car.airborne;
    view.liftN = car.tel.thrustN.lift; view.jumpSeq = car.tel.events.jump;
  };
  while (t < seconds) {
    const sp = car.speed * KMH;
    const dist = site.u0 - (-(car.z - site.oz)); // first hazard − car centre (road runs −z)
    let jump = false;
    if (jumpAt !== null && dist <= jumpAt && !jumped) jump = true;
    if (jumpOnCue) {
      const now = events.find((e) => e.type === 'cue' && e.jump === 'now');
      if (now && cueNowAt === null) cueNowAt = { t, windowM: now.windowM };
      // press inside the window: cueBias 0 = as soon as "now" shows, 1 = at the last moment
      if (cueNowAt && !jumped && t >= cueNowAt.t + (cueNowAt.windowM * cueBias) / Math.max(1, car.speed)) jump = true;
    }
    if (jump) jumped = true;
    const inp = { steer: 0, throttle: sp < kmh ? 1 : 0, brake: 0, jump: jump || (hover && jumped && car.airborne), boost: false };
    car.step(DT, inp, env); car.step(DT, { ...inp, jump: inp.jump && hover }, env);
    sync();
    sim.update(FRAME, view, ctl);
    if (view.x !== car.x || view.z !== car.z) { /* truck push already applied to car */ }
    maxMs = Math.max(maxMs, sim.lastMs); sumMs += sim.lastMs; frames++;
    for (const b of sim.bodies) {
      for (let i = 0; i < b.def.hull.length; i += 3) {
        const R = b.R, h = b.def.hull;
        const y = b.py + R[3] * h[i] + R[4] * h[i + 1] + R[5] * h[i + 2];
        if (y < minPropY) minPropY = y;
      }
      if (!Number.isFinite(b.px + b.py + b.pz + b.qw)) nanSeen = true;
    }
    const mv = sim.bodies.filter((b) => Math.hypot(b.px - b.home.x, b.pz - b.home.z) > 1).length;
    peakMoved = Math.max(peakMoved, mv);
    peakTipped = Math.max(peakTipped, sim.bodies.filter((b) => b.R[4] < 0.5).length);
    for (const b of sim.bodies) peakFly = Math.max(peakFly, Math.hypot(b.px - b.home.x, b.pz - b.home.z));
    if (hitT === null && events.some((e) => e.type === 'hit')) hitT = t;
    if (hitT !== null && settleAt === null && sim.bodies.every((b) => !b.awake)) settleAt = t - hitT;
    if (t > 0.5) peakG = Math.max(peakG, car.tel.g.total);
    if (t > 0.5) minKmh = Math.min(minKmh, car.speed * KMH);
    t += FRAME;
  }
  const moved = peakMoved, tipped = peakTipped, maxFly = peakFly;
  const awake = sim.bodies.filter((b) => b.awake).length;
  const firstHit = events.find((e) => e.type === 'hit');
  return { sim, car, events, minPropY, nanSeen, minKmh, moved, tipped, awake, maxFly, endKmh: car.speed * KMH, passedM: -(car.z - site.oz) - site.u1, peakG, settleAt, endMoved: sim.bodies.filter((b) => Math.hypot(b.px - b.home.x, b.pz - b.home.z) > 1).length, maxMs, avgMs: sumMs / frames, steps: sim.steps };
}
const idle = { steer: 0, throttle: 0, brake: 0, jump: false, boost: false };
const ev = (r, type) => r.events.filter((e) => e.type === type);
const fmt = (r) => `ชน ${ev(r, 'hit').length} ชิ้น · ปลิว >1 ม. ${r.moved} · ล้ม ${r.tipped} · ไกลสุด ${r.maxFly.toFixed(1)} ม. · ต่ำสุดของ ${r.minPropY.toFixed(3)} ม. · รถ ${r.endKmh.toFixed(0)} กม./ชม. (ต่ำสุด ${r.minKmh.toFixed(0)}) · ยังไม่หลับ ${r.awake}`;

// ── 1. smash at 60 and 120 km/h, centre and off-centre ──
for (const [kmh, lane] of [[60, 0], [120, 0], [120, 3.6], [200, -1.5]]) {
  const r = run({ kmh, lane, seconds: 260 / (kmh / KMH) + 8 });
  const sm = ev(r, 'smash')[0];
  const tag = `ชน ${kmh} กม./ชม. เลน ${lane >= 0 ? '+' : ''}${lane}`;
  check(`${tag}: เกิด smash`, sm, sm ? `${sm.items} ชิ้น · เสีย ${sm.lossPct}% (${sm.speedBeforeKmh}→${sm.speedAfterKmh})` : 'ไม่มี');
  check(`${tag}: เสียความเร็ว 5–20%`, sm && sm.lossPct >= 5 && sm.lossPct <= 20, sm?.lossPct);
  check(`${tag}: ของไม่ทะลุพื้น (hull y ≥ −2 ซม.)`, r.minPropY >= -0.02, r.minPropY.toFixed(3));
  check(`${tag}: ของกระเด็น (≥ 3 ชิ้นขยับ > 1 ม., ไกลสุด ≤ 80 ม.)`, r.moved >= 3 && r.maxFly <= 80, fmt(r));
  check(`${tag}: รถไม่ติด (ผ่านด่าน > 50 ม., ไม่หยุด)`, r.passedM > 50 && r.minKmh > kmh * 0.6, `ผ่าน ${r.passedM.toFixed(0)} ม. ต่ำสุด ${r.minKmh.toFixed(0)}`);
  check(`${tag}: แรง g ตอนชน ≤ 3 g (ไม่กระชากกล้อง/HUD)`, r.peakG <= 3, r.peakG.toFixed(2));
  check(`${tag}: ไม่มี NaN`, !r.nanSeen, r.nanSeen);
  check(`${tag}: ของนิ่ง (หลับ) หลังชน`, r.awake === 0 && r.settleAt !== null, `นิ่งหลังชน ${r.settleAt?.toFixed(1)} วิ`);
  check(`${tag}: ไม่มี clear`, ev(r, 'clear').length === 0, ev(r, 'clear').length);
  check(`${tag}: physics ด่าน avg < 0.06 ms (desktop ≈ มือถือกลาง/5 → < 0.3 ms)`, r.avgMs < 0.06, `avg ${r.avgMs.toFixed(4)} · max ${r.maxMs.toFixed(3)} ms`);
}

// ── 2. jump over on the cue at 100 / 150 / 230 km/h ──
for (const kmh of [100, 150, 230]) {
  for (const bias of [0.15, 0.5, 0.85]) {
    const r = run({ kmh, jumpOnCue: true, cueBias: bias, seconds: 9 });
    const cl = ev(r, 'clear')[0], cue = ev(r, 'cue').find((e) => e.jump === 'now');
    check(`กระโดด ${kmh} กม./ชม. ตามสัญญาณ (จังหวะ ${Math.round(bias * 100)}% ของช่วง): ข้ามสะอาด`, cl && ev(r, 'hit').length === 0,
      cl ? `ใต้ท้องต่ำสุด ${cl.minClearanceM} ม. · ช่วงกด ${cue?.windowM} ม.` : `ชน ${ev(r, 'hit').length} ชิ้น`);
  }
}

// ── 3. jump too late → lands into the set: still not stuck ──
{
  const r = run({ kmh: 120, jumpAt: -4.5, seconds: 9 });
  check('กระโดดช้าไป 120: ชนแต่ไม่ติด', r.passedM > 40 && !r.nanSeen && r.minPropY >= -0.02, fmt(r));
}

// ── 4. approach toast + cue sequence ──
{
  const r = run({ kmh: 150, jumpOnCue: true, cueBias: 0.5, seconds: 5 });
  const a = ev(r, 'approach')[0];
  check('ป้ายเตือน "ด่านข้างหน้า!" ขึ้นก่อนถึง ≥ 120 ม.', a && a.distM >= 120 && a.text.includes('ด่าน'), a ? `${a.distM} ม. "${a.text}"` : 'ไม่มี');
  check('ลำดับสัญญาณ early → now', ev(r, 'cue').map((e) => e.jump).join(',').startsWith('early,now'), ev(r, 'cue').map((e) => e.jump).join(','));
}

// ── 5. reset once the site is behind the car ──
{
  const r = run({ kmh: 120, seconds: 16 });
  check('รีเซ็ตด่านหลังผ่านไป > 60 ม. (เริ่มรอบใหม่ของตั้งครบ)', ev(r, 'reset').length >= 1 && r.endMoved === 0, `reset ${ev(r, 'reset').length} ครั้ง · ของที่ยังไม่กลับที่ ${r.endMoved}`);
}

// ── 6. static pickup: drive into it along the left shoulder ──
{
  const events = [];
  const sim = new CheckpointSim(track, (type, d) => events.push({ type, ...d }), SITE);
  const site = sim.sites[0], T = site.truck;
  const car = new CarPhysics();
  car.reset(T.x + 0.2, 0, T.z + 25, 0); // behind the truck, aligned with it, driving north into its tail
  for (let i = 0; i < 30; i++) car.step(DT, idle, env);
  car.vz = -60 / KMH;
  const ctl = { slow() {}, push(dx, dz, vx, vz) { car.x += dx; car.z += dz; car.vx = vx; car.vz = vz; } };
  let inside = 0;
  for (let i = 0; i < 180; i++) {
    car.step(DT, { ...idle, throttle: 0.4 }, env); car.step(DT, { ...idle, throttle: 0.4 }, env);
    sim.update(FRAME, { x: car.x, y: car.y, z: car.z, heading: car.heading, vx: car.vx, vy: car.vy, vz: car.vz, airborne: car.airborne, liftN: 0, jumpSeq: car.tel.events.jump }, ctl);
    const lu = site.local(car.x, car.z, { u: 0, v: 0 });
    const tl = site.local(T.x, T.z, { u: 0, v: 0 });
    if (Math.abs(lu.u - tl.u) < T.halfL && Math.abs(lu.v - tl.v) < T.halfW) inside++;
  }
  check('กระบะตำรวจ: รถชนแล้วไม่ทะลุ (static collider)', inside === 0 && events.some((e) => e.type === 'hit' && e.kind === 'truck'), `เฟรมที่ศูนย์กลางรถอยู่ในกระบะ ${inside}`);
}

// ── 7. jet wind: hovering 1.2 m above a cone topples it ──
{
  const sim = new CheckpointSim(track, () => {}, SITE);
  const cone = sim.bodies.find((b) => b.def.kind === 'cone');
  const ctl = { slow() {}, push() {} };
  for (let i = 0; i < 90; i++) {
    sim.update(FRAME, { x: cone.home.x + 1.2, y: 1.1, z: cone.home.z, heading: 0, vx: 0, vy: 0, vz: 0, airborne: true, liftN: 19000, jumpSeq: 0 }, ctl);
  }
  check('ไอพ่นลอยค้างต่ำ 1.1 ม. ข้างกรวย → กรวยล้ม', cone.R[4] < 0.5, `แกนตั้งของกรวย cos = ${cone.R[4].toFixed(2)}`);
  const af = sim.bodies.find((b) => b.def.kind === 'aframe');
  check('ไอพ่นเดียวกันไม่ทำให้ป้าย A-frame ไกลเกิน 0.5 ม.', Math.hypot(af.px - af.home.x, af.pz - af.home.z) < 0.5, Math.hypot(af.px - af.home.x, af.pz - af.home.z).toFixed(2));
}

let fail = 0;
for (const r of results) { if (!r.ok) fail++; console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.value !== undefined ? ` — ${r.value}` : ''}`); }
console.log(`\n${results.length - fail}/${results.length} ผ่าน`);
process.exit(fail ? 1 : 0);
