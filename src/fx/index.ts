// M3 fx entry: createFx(scene, track, car) → { update(dt, camera), dispose() }  (docs/dev/REPORT-M3-fx.md)
// Owns: swinging power cables (CableSystem), lantern + blade-sign swing, cold-gas thruster plume,
// tyre smoke / wet spray, splashes, impact sparks. Draw calls: cables 1 (replaces M2's static one),
// soft particles 1, sparks 1 (+2 placeholder sign meshes until src/neon ships `neon-lanterns`/`neon-blades`).
import * as THREE from 'three';
import { CableSystem, CABLE_TUNING, type CableSpan } from '../car/physics-cables.js';
import { TUNING } from '../car/config.js';
import { getQuality, onQuality } from '../game/quality.js';
import type { Car, Quality, Track } from '../types.js';
import { Effects, FX_TUNING, type NozzleState } from './effects.js';
import { JetCores } from './core.js';
import { JET, eqDiameter, exitTempK, isentropicVe } from './jet.js';
import { ParticlePool } from './particles.js';
import { SwingSystem, type SwingAnchor } from './swing.js';
import { WindField } from './wind.js';

export { FX_TUNING } from './effects.js';
export { JET } from './jet.js';
export { SWING_NAMES } from './swing.js';

type Telemetry = {
  thrustN: { rear: number; lift: number };
  events: { jump: number; land: number; splash: number; launch: number; boost: number };
  slip: { betaDeg: number };
  contact: { surface: string; wheels: boolean[] };
  hydroplaning: boolean; drifting: boolean; airborne: boolean;
};
type CarLike = Car & { telemetry?: Telemetry };
type TrackExtrasLike = { cableSpans?: CableSpan[]; anchors?: Record<string, SwingAnchor[]> };

const POOLS: Record<Quality, { soft: number; sparks: number; mul: number; cableR: number; cablePts: number; swingR: number }> = {
  low: { soft: 180, sparks: 48, mul: 0.4, cableR: 60, cablePts: 500, swingR: 60 },
  mid: { soft: 420, sparks: 96, mul: 0.75, cableR: 120, cablePts: 1200, swingR: 120 },
  high: { soft: 640, sparks: 128, mul: 1, cableR: 120, cablePts: 1200, swingR: 120 },
};

export interface FxStats {
  ms: number; msP95: number;
  plume: { massFlowKgS: number; rearKgS: number; liftKgS: number; particles: number; groundEffect: boolean; visibleUntilDilution: number };
  particles: { soft: number; sparks: number; cap: number };
  cables: { simulatedPoints: number; spans: number; simRadius: number };
  swing: { simulated: number; lanternMaxDeg: number; bladeMaxDeg: number };
  wind: { stormMs: number };
  drawCalls: number;
}

export interface Fx {
  update(dt: number, camera: THREE.Camera): void;
  dispose(): void;
  stats(): FxStats;
  /** Visuals may set the light the smoke picks up (sky/fog ambient + average street/neon colour). */
  setLighting(ambient: THREE.ColorRepresentation, key: THREE.ColorRepresentation): void;
  setRain(rain: number): void; // 0..1 (defaults to car-physics TUNING.rain)
  /** Off = never shrink cable/sign simulation on slow frames (QA in headless/SwiftShader). */
  setAutoBackoff(on: boolean): void;
  readonly wind: WindField;
}

export function createFx(scene: THREE.Scene, track: Track, car: Car, opts: { placeholders?: boolean; autoBackoff?: boolean } = {}): Fx {
  const c = car as CarLike;
  const extras = (track as Track & { extras?: TrackExtrasLike }).extras ?? {};
  const group = new THREE.Group();
  group.name = 'fx';
  scene.add(group);

  // ── wind + cables ──
  const wind = new WindField();
  const spans = extras.cableSpans ?? [];
  const cables = new CableSystem(spans);
  const staticCables = track.root.getObjectByName('cables') as THREE.LineSegments | undefined;
  const cGeo = new THREE.BufferGeometry();
  const cPos = new THREE.BufferAttribute(cables.positions, 3).setUsage(THREE.DynamicDrawUsage);
  cGeo.setAttribute('position', cPos);
  cGeo.setIndex(new THREE.BufferAttribute(cables.indices, 1));
  cGeo.computeBoundingSphere();
  const cMat = (staticCables?.material as THREE.Material | undefined) ?? new THREE.LineBasicMaterial({ color: 0x0a0a0e, fog: true });
  const cableMesh = new THREE.LineSegments(cGeo, cMat);
  cableMesh.name = 'fx-cables';
  cableMesh.frustumCulled = false;
  if (spans.length) { group.add(cableMesh); if (staticCables) staticCables.visible = false; }

  // ── swing ──
  const an = extras.anchors ?? {};
  const swing = new SwingSystem(scene, an.lantern ?? [], an.blade ?? [], opts.placeholders ?? true);

  // ── particles ──
  let tier = getQuality().tier;
  let soft = new ParticlePool(POOLS[tier].soft, 'soft');
  let sparks = new ParticlePool(POOLS[tier].sparks, 'spark');
  group.add(soft.mesh, sparks.mesh);
  let fx = new Effects(soft, sparks, wind);
  const applyQ = () => {
    const q = getQuality().tier;
    const P = POOLS[q];
    CABLE_TUNING.simRadius = P.cableR; CABLE_TUNING.maxPoints = P.cablePts;
    swing.simRadius = P.swingR;
    if (q !== tier) {
      tier = q;
      soft.dispose(); sparks.dispose();
      soft = new ParticlePool(P.soft, 'soft'); sparks = new ParticlePool(P.sparks, 'spark');
      group.add(soft.mesh, sparks.mesh);
      const rain = fx.rain; fx = new Effects(soft, sparks, wind); fx.setRain(rain);
    }
    fx.qualityMul = P.mul;
  };
  applyQ();
  const offQ = onQuality(applyQ);

  // ── car parts ──
  const nozzles: { obj: THREE.Object3D; kind: 'rear' | 'side-down'; st: NozzleState }[] = [];
  car.object.traverse((o) => {
    if (/^nozzle-/.test(o.name)) nozzles.push({ obj: o, kind: o.userData.kind === 'side-down' ? 'side-down' : 'rear', st: { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 1, acc: 0 } });
  });
  const cores = new JetCores(Math.max(1, nozzles.length));
  group.add(cores.mesh);
  let clock = 0;
  const nRear = nozzles.filter((n) => n.kind === 'rear').length || 1;
  const nLift = nozzles.filter((n) => n.kind === 'side-down').length || 1;
  const wheels = ['wheel-rl', 'wheel-rr', 'wheel-fl', 'wheel-fr'].map((n) => car.object.getObjectByName(n)).filter(Boolean) as THREE.Object3D[];
  const tail = car.object.getObjectByName('tail-lights');
  const v3 = new THREE.Vector3(), q4 = new THREE.Quaternion(), fwd = new THREE.Vector3();

  // ── state ──
  let rainOverride: number | null = null;
  let autoBackoff = opts.autoBackoff ?? true;
  const ev = { jump: -1, land: -1, splash: -1, impact: -1 };
  let jumpBurnT = 0, msEma = 0, slowT = 0, frameEma = 1 / 60, smokeAcc = 0, sprayAcc = 0;
  const msHist = new Float32Array(120); let msI = 0;
  let cableSettle = 0;
  const now = () => performance.now();

  function emitWheels(dt: number, kind: 'smoke' | 'spray', rate: number, speed: number) {
    const acc = (kind === 'smoke' ? (smokeAcc += rate * dt * fx.qualityMul) : (sprayAcc += rate * dt * fx.qualityMul));
    let n = Math.floor(acc);
    if (kind === 'smoke') smokeAcc -= n; else sprayAcc -= n;
    const s = car.state, vx = s.velocity.x, vz = s.velocity.z;
    const gy = track.heightAt(s.pose.x, s.pose.z);
    while (n-- > 0) {
      const w = wheels[(Math.random() * 2) | 0]; // rear wheels throw it
      if (!w) break;
      w.getWorldPosition(v3);
      if (kind === 'smoke') {
        fx.puff(v3.x, gy + 0.25, v3.z, vx * 0.15 + (Math.random() - 0.5) * 2, 0.6 + Math.random(), vz * 0.15 + (Math.random() - 0.5) * 2,
          1.4 + Math.random() * 0.6, 0.35, 1.3, 1.5, -0.15, 0.45, 0.78, 0.78, 0.8, gy);
      } else {
        // PHYSICS §5.2: thrown at tyre surface speed backward, 15° up → world ≈ car velocity − v·fwd + up
        const up = speed * Math.sin(0.26), back = speed * Math.cos(0.26) * 0.9;
        fx.puff(v3.x, gy + 0.2, v3.z, vx - fwd.x * back + (Math.random() - 0.5) * 3, up * (0.4 + Math.random() * 0.6), vz - fwd.z * back + (Math.random() - 0.5) * 3,
          0.6 + Math.random() * 0.3, 0.25, 1.6, 4, 4, 0.35, 0.72, 0.78, 0.88, gy);
      }
    }
  }

  function splash(x: number, z: number, count: number, power: number) {
    const gy = track.heightAt(x, z);
    const n = Math.round(count * fx.qualityMul);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = (0.4 + Math.random()) * power;
      fx.puff(x + Math.cos(a) * 1.2, gy + 0.2, z + Math.sin(a) * 1.2, Math.cos(a) * 4 * r, (5 + Math.random() * 5) * power, Math.sin(a) * 4 * r,
        0.9 + Math.random() * 0.5, 0.3, 1.2, 1.2, 9.81, 0.5, 0.75, 0.82, 0.92, gy);
    }
  }

  function impactSparks(impulse: number) {
    const s = car.state;
    // contact point: closest barrier point to the car (one scan per hit)
    let bx = s.pose.x, bz = s.pose.z, bd = 9;
    for (const b of track.barriers) {
      const ax = b.a.x, az = b.a.z, ex = b.b.x - ax, ez = b.b.z - az, L = ex * ex + ez * ez;
      if (Math.abs(ax - s.pose.x) > 40 && Math.abs(b.b.x - s.pose.x) > 40) continue;
      const t = L > 0 ? Math.max(0, Math.min(1, ((s.pose.x - ax) * ex + (s.pose.z - az) * ez) / L)) : 0;
      const px = ax + ex * t, pz = az + ez * t, d = (px - s.pose.x) ** 2 + (pz - s.pose.z) ** 2;
      if (d < bd) { bd = d; bx = px; bz = pz; }
    }
    const gy = track.heightAt(bx, bz);
    const n = Math.round(Math.min(60, 10 + impulse / 800) * fx.qualityMul);
    for (let i = 0; i < n; i++) {
      const sp = 4 + Math.random() * 10;
      fx.spark(bx, gy + 0.3 + Math.random() * 0.5, bz,
        s.velocity.x * 0.35 + (Math.random() - 0.5) * sp, 1 + Math.random() * 5, s.velocity.z * 0.35 + (Math.random() - 0.5) * sp, gy);
    }
  }

  const windSrc = { x: 0, y: 0, z: 0, vx: 0, vz: 0, airborne: false, jumpJet: false, field: wind.field };

  function update(dtIn: number, camera: THREE.Camera) {
    const t0 = now();
    const dt = Math.min(dtIn, 1 / 20);
    const s = car.state, tel = c.telemetry;
    const rain = rainOverride ?? TUNING.rain;
    if (rain !== fx.rain) fx.setRain(rain);
    wind.storm = rain > 0 ? 7 * rain : 1.2; // PHYSICS §5.3 storm 6–12 m/s · dry night breeze
    CABLE_TUNING.stormWind = wind.storm; CABLE_TUNING.stormDirX = wind.dirX; CABLE_TUNING.stormDirZ = wind.dirZ;
    wind.tick(dt);

    car.object.getWorldQuaternion(q4);
    fwd.set(0, 0, -1).applyQuaternion(q4); // car nose (model faces −z)
    const speed = Math.hypot(s.velocity.x, s.velocity.z);
    wind.x = s.pose.x; wind.y = s.pose.y; wind.z = s.pose.z; wind.vx = s.velocity.x; wind.vz = s.velocity.z;

    // ── thruster forces from telemetry ──
    let rearN = 0, liftN = 0;
    if (tel) {
      rearN = Math.max(0, tel.thrustN.rear);
      if (ev.jump >= 0 && tel.events.jump > ev.jump) jumpBurnT = JET.jumpBurnS;
      ev.jump = tel.events.jump;
      liftN = Math.max(0, tel.thrustN.lift);
      if (jumpBurnT > 0) { jumpBurnT -= dt; liftN = Math.max(liftN, JET.jumpImpulseNs / JET.jumpBurnS); }
    }
    wind.setRear(rearN / nRear);
    wind.liftN = liftN;

    // ── nozzles → plume ──
    const groundY = track.heightAt(s.pose.x, s.pose.z);
    let rearKg = 0, liftKg = 0, ground = false;
    let rx = 0, ry = 0, rz = 0;
    clock += dt;
    cores.begin(clock);
    for (const n of nozzles) {
      n.obj.getWorldPosition(v3); n.st.x = v3.x; n.st.y = v3.y; n.st.z = v3.z;
      n.obj.getWorldQuaternion(q4); v3.set(0, 0, 1).applyQuaternion(q4); n.st.dx = v3.x; n.st.dy = v3.y; n.st.dz = v3.z;
      const F = n.kind === 'rear' ? rearN / nRear : liftN / nLift;
      const md = fx.emitJet(n.st, F, dt, s.velocity.x, s.velocity.y, s.velocity.z, groundY);
      if (md > 0) {
        // core axis = exhaust + car velocity (the jet leaves a moving car), cut at the road
        let ax = n.st.dx * JET.ve + s.velocity.x, ay = n.st.dy * JET.ve + s.velocity.y, az = n.st.dz * JET.ve + s.velocity.z;
        const l = Math.hypot(ax, ay, az); ax /= l; ay /= l; az /= l;
        const gd = ay < -0.02 ? (n.st.y - groundY) / -ay : 1e9;
        cores.add(n.st.x, n.st.y, n.st.z, ax, ay, az, eqDiameter(md), gd, Math.min(0.6, 0.25 + 0.4 * Math.sqrt(md / 55)));
      }
      if (n.kind === 'rear') { rearKg += md; rx += n.st.x; ry += n.st.y; rz += n.st.z; wind.ax = n.st.dx; wind.ay = n.st.dy; wind.az = n.st.dz; }
      else liftKg += md;
      if (md > 0 && n.st.y - groundY < FX_TUNING.groundEffectM && (n.kind === 'side-down' || n.st.y - groundY < 0.8)) ground = true;
    }
    cores.end();
    wind.rx = rx / nRear; wind.ry = ry / nRear; wind.rz = rz / nRear;
    fx.plume.rearKgS = rearKg; fx.plume.liftKgS = liftKg; fx.plume.massFlowKgS = rearKg + liftKg; fx.plume.groundEffect = ground;

    // ── tyres: smoke (dry drift) / spray (wet road, puddle) ──
    if (tel && !s.airborne && speed > 2) {
      const puddle = tel.contact.surface === 'puddle';
      const slip = speed * Math.sin(Math.min(Math.PI / 2, (Math.abs(tel.slip.betaDeg) * Math.PI) / 180));
      if (rain > 0 || puddle) {
        const depthMm = puddle ? 10 : 1 * rain; // film depth on a wet road vs a puddle (PHYSICS §5.2: rate ∝ v·depth)
        const rate = Math.min(400, speed * depthMm * 1.2 + (s.drifting ? slip * 4 : 0)) * (tel.hydroplaning ? 1.5 : 1);
        emitWheels(dt, 'spray', rate, speed);
      } else if (s.drifting && slip > 3) emitWheels(dt, 'smoke', slip * 3, speed);
    }
    // ── splashes ──
    if (tel) {
      if (ev.splash >= 0 && tel.events.splash > ev.splash) splash(s.pose.x, s.pose.z, 90, 1.2);
      if (ev.land >= 0 && tel.events.land > ev.land && (rain > 0 || s.onSurface === 'water')) splash(s.pose.x, s.pose.z, s.onSurface === 'water' ? 90 : 24, s.onSurface === 'water' ? 1.2 : 0.5);
      ev.splash = tel.events.splash; ev.land = tel.events.land;
    }
    // ── sparks ──
    const hit = car.lastImpact;
    if (hit && hit.seq !== ev.impact) {
      if (ev.impact >= 0 && hit.kind !== 'monument' && hit.impulse > 3000) impactSparks(hit.impulse);
      ev.impact = hit.seq;
    }

    fx.step(dt);

    // ── cables + swing ──
    windSrc.x = s.pose.x; windSrc.y = s.pose.y; windSrc.z = s.pose.z; windSrc.vx = s.velocity.x; windSrc.vz = s.velocity.z;
    windSrc.airborne = s.airborne; windSrc.jumpJet = liftN > 0;
    if (spans.length) {
      if (CABLE_TUNING.simRadius > 0) cables.step(dt, windSrc);
      if (cables.activePoints > 0 || cableSettle > 0) {
        cPos.needsUpdate = true;
        cableSettle = cables.activePoints > 0 ? 1.5 : cableSettle - dt;
      }
    }
    swing.step(dt, wind, s.pose.x, s.pose.z);

    // ── render buffers ──
    if (tail) { tail.getWorldPosition(v3); soft.material.uniforms.uTailPos.value.copy(v3); }
    soft.setFog(scene.fog as THREE.Fog | null);
    sparks.setFog(scene.fog as THREE.Fog | null);
    cores.setFog(soft.material.uniforms as never);
    soft.upload();
    sparks.upload(0, 0, 0, 0.025);
    void camera;

    // ── cost + automatic back-off when the device struggles (PHYSICS §5.6) ──
    const ms = now() - t0;
    msEma += (ms - msEma) * 0.05;
    msHist[msI++ % msHist.length] = ms;
    frameEma += (dtIn - frameEma) * 0.05;
    if (!autoBackoff) slowT = 0;
    else if (frameEma > 1 / 25) {
      slowT += dtIn;
      if (slowT > 3) { slowT = 0; CABLE_TUNING.simRadius = CABLE_TUNING.simRadius > 60 ? 60 : 0; swing.simRadius = 60; }
    } else slowT = 0;
    publish();
  }

  function stats(): FxStats {
    const sorted = Array.from(msHist).sort((a, b) => a - b);
    return {
      ms: msEma, msP95: sorted[Math.floor(sorted.length * 0.95)],
      plume: { ...fx.plume, visibleUntilDilution: fx.cond.visibleUntilD },
      particles: { soft: soft.count, sparks: sparks.count, cap: soft.cap + sparks.cap },
      cables: { simulatedPoints: cables.activePoints, spans: spans.length, simRadius: CABLE_TUNING.simRadius },
      swing: { simulated: swing.simulated, lanternMaxDeg: swing.maxDeg('lantern'), bladeMaxDeg: swing.maxDeg('blade') },
      wind: { stormMs: wind.stormNow() },
      drawCalls: (spans.length ? 1 : 0) + (soft.count ? 1 : 0) + (sparks.count ? 1 : 0) + (cores.mesh.count ? 1 : 0),
    };
  }

  // QA: window.__fx (game-ui may mirror it into window.__game.plume)
  const g = globalThis as { __fx?: unknown };
  const qa = { plume: fx.plume, stats, physics: { exitTempK: exitTempK(), isentropicVe: isentropicVe(), ve: JET.ve } };
  function publish() { qa.plume = fx.plume; }
  g.__fx = qa;

  return {
    update,
    stats,
    wind,
    setLighting(ambient, key) {
      for (const p of [soft, sparks]) { p.material.uniforms.uAmbient.value.set(ambient); p.material.uniforms.uKeyColor.value.set(key); }
    },
    setRain(r) { rainOverride = Math.max(0, Math.min(1, r)); },
    setAutoBackoff(on) { autoBackoff = on; if (!on) applyQ(); },
    dispose() {
      offQ();
      swing.dispose();
      soft.dispose(); sparks.dispose(); cores.dispose();
      cGeo.dispose();
      if (!staticCables) cMat.dispose();
      if (staticCables) staticCables.visible = true;
      group.removeFromParent();
      if (g.__fx === qa) delete g.__fx;
    },
  };
}
