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
}

export function createCar(model: CarModel): PhysicsCar {
  const phys = new CarPhysics();
  const chase = new ChaseCamera(phys);
  const object = new THREE.Group();
  object.name = 'player-car';
  object.add(model.root);
  const wing = (model as CarModel & { wing?: THREE.Object3D }).wing;
  let fanAngle = 0;

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
    // fans: idle spin + suction level
    fanAngle += (20 + 60 * tel.fans.level + 40 * tel.fans.spool) / 120;
    for (const f of model.fans) f.rotation.z = fanAngle;
    if (wing) wing.rotation.x = tel.wingAngle;
  }

  const car: PhysicsCar = {
    object,
    state,
    physics: phys,
    telemetry: phys.tel,
    tuning: TUNING,
    lastImpact: null,
    step(dt: number, input: InputState, track: Track) {
      phys.step(dt, input, track);
      car.lastImpact = phys.lastImpact;
      sync();
    },
    reset(p: Pose) {
      phys.reset(p.x, p.y, p.z, p.heading);
      car.lastImpact = null;
      chase.snap();
      sync();
    },
    addGas(fraction: number) { phys.addGas(fraction * 100); },
    camera: { update: (dt, cam) => chase.update(dt, cam) },
    setShakeScale(k: number) { chase.shakeScale = k; },
    setRain(rain: number) { TUNING.rain = Math.max(0, Math.min(1, rain)); },
  };
  sync();
  return car;
}
