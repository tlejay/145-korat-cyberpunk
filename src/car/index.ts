// createCar(model) — M1 contract (docs/dev/M1-CONTRACTS.md). Wraps CarPhysics (pure, headless-tested)
// with the three.js model: wheel steer/spin, body pitch/roll from the springs, fans, wing, camera.
import * as THREE from 'three';
import type { Car, CarModel, CarState, InputState, Pose, Track } from '../types.js';
import { ChaseCamera } from './camera.js';
import { KMH, TUNING } from './config.js';
import { CarPhysics, type Telemetry } from './physics.js';

export { TUNING } from './config.js';
export type { Telemetry } from './physics.js';

/** Car plus the extras game-ui reads for QA hooks / audio / settings (PHYSICS §8). */
export interface PhysicsCar extends Car {
  physics: CarPhysics;
  telemetry: Telemetry;
  tuning: typeof TUNING;
  setShakeScale(k: number): void;
  setRain(rain: number): void;
  /** Hidden Aero: 0 = wing folded flush (parked / menu), 1 = raised (> 80 km/h or hard braking). */
  readonly aeroDeploy: number;
}

/** Hidden Aero (tesla.com "flush-mounted aerodynamics"): raise above 80 km/h or on a hard stop, fold below 70. */
export const AERO = { upKmh: 80, downKmh: 70, brake: 0.7, brakeMinKmh: 30, moveS: 0.4 } as const;

export function createCar(model: CarModel): PhysicsCar {
  const phys = new CarPhysics();
  const chase = new ChaseCamera(phys);
  const object = new THREE.Group();
  object.name = 'player-car';
  object.add(model.root);
  const wing = (model as CarModel & { wing?: THREE.Object3D }).wing;
  const setAero = (model as CarModel & { setAero?: (deploy: number, angle: number) => void }).setAero;
  let aero = 0, aeroUp = false;
  let fanAngle = 0;
  // Wheel proxies in physics order (fl, fr, rl, rr = phys.comp[i]); rest height = their modelled y.
  const wheelList = [model.wheels.fl, model.wheels.fr, model.wheels.rl, model.wheels.rr];
  const wheelRestY = wheelList.map((o) => o.position.y);
  const wheelR = wheelRestY.slice(); // proxies sit at y = tyre radius (bottom on the road at rest)
  const tmpV = new THREE.Vector3();

  const state: CarState = {
    pose: { x: 0, y: 0, z: 0, heading: 0 }, speedKmh: 0, velocity: { x: 0, y: 0, z: 0 },
    gForce: 0, gas: 1, airborne: false, drifting: false, driftAngleDeg: 0, onSurface: 'road',
  };

  function sync() {
    const tel = phys.tel;
    state.pose.x = phys.x; state.pose.y = phys.y; state.pose.z = phys.z; state.pose.heading = phys.heading;
    state.velocity.x = phys.vx; state.velocity.y = phys.vy; state.velocity.z = phys.vz;
    state.speedKmh = phys.speed * KMH;
    state.gForce = tel.g.total;
    state.gas = phys.gas / 100;
    state.airborne = phys.airborne;
    state.drifting = phys.drifting;
    state.driftAngleDeg = Math.abs(tel.slip.betaDeg);
    state.onSurface = phys.surface;

    object.position.set(phys.x, phys.y, phys.z);
    object.rotation.set(0, -phys.heading, 0);
    model.root.rotation.set(phys.pitch, 0, phys.roll, 'YXZ');
    // wheels: proxies use rotation order YXZ → y = steer (left +), x = spin (forward = negative)
    const w = model.wheels;
    w.fl.rotation.y = w.fr.rotation.y = -phys.steerAngle;
    w.fl.rotation.x = w.fr.rotation.x = w.rl.rotation.x = w.rr.rotation.x = -tel.wheelSpin;
    // Suspension travel: wheels follow their spring (up when compressed, droop ≤ 8 cm in the air) so the
    // drawn tyre stays on the road while the body squats on landing (QA FEEL-05: body −0.12 m).
    const sag = (TUNING.massKg * TUNING.gravity) / (4 * TUNING.springK);
    for (let i = 0; i < 4; i++) wheelList[i].position.y = wheelRestY[i] + Math.max(-0.08, Math.min(0.3, phys.comp[i] - sag));
    // fans: idle spin + suction level
    fanAngle += (20 + 60 * tel.fans.level + 40 * tel.fans.spool) / 120;
    for (const f of model.fans) f.rotation.z = fanAngle;
    if (setAero) setAero(aero, tel.wingAngle);
    else if (wing) wing.rotation.x = tel.wingAngle;
  }

  const car: PhysicsCar = {
    object,
    state,
    physics: phys,
    telemetry: phys.tel,
    tuning: TUNING,
    lastImpact: null,
    get aeroDeploy() { return aero; },
    step(dt: number, input: InputState, track: Track) {
      phys.step(dt, input, track);
      const kmh = phys.speed * KMH;
      aeroUp = kmh > AERO.upKmh || (input.brake > AERO.brake && kmh > AERO.brakeMinKmh) || (aeroUp && kmh > AERO.downKmh);
      aero = Math.max(0, Math.min(1, aero + (aeroUp ? dt : -dt) / AERO.moveS));
      car.lastImpact = phys.lastImpact;
      sync();
    },
    reset(p: Pose) {
      phys.reset(p.x, p.y, p.z, p.heading);
      car.lastImpact = null;
      aero = 0; aeroUp = false;
      chase.snap();
      sync();
    },
    addGas(fraction: number) { phys.addGas(fraction * 100); },
    camera: { update: (dt, cam) => chase.update(dt, cam) },
    setShakeScale(k: number) { chase.shakeScale = k; },
    setRain(rain: number) { TUNING.rain = Math.max(0, Math.min(1, rain)); },
    qa: {
      // QA teleport(…, speedKmh): straight-line speed along the current heading (TEST-HOOKS, PHY-04).
      /** World y of each drawn tyre's lowest point (fl, fr, rl, rr) — QA wheel-vs-road checks. */
      wheelBottoms(): { x: number; y: number; z: number }[] {
        object.updateMatrixWorld(true);
        return wheelList.map((o, i) => { o.getWorldPosition(tmpV); return { x: tmpV.x, y: tmpV.y - wheelR[i], z: tmpV.z }; });
      },
      setSpeed(kmh: number) {
        const v = kmh / 3.6;
        phys.setPlanarVelocity(Math.sin(phys.heading) * v, -Math.cos(phys.heading) * v);
        sync();
      },
    },
  };
  sync();
  return car;
}
