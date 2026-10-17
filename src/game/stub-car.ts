// Stand-in arcade car until src/car/ (car-physics + car-model panes) lands.
// Bicycle-ish model: forward drive + lateral grip, brake-tap drift, jump, boost, launch.
import * as THREE from 'three';
import type { Car, CarModel, CarState, InputState, Pose, Track } from '../types.js';
import { SegmentGrid } from './collide.js';
import { pointInPoly } from './path.js';

const G = 9.81;
const TOP = 210 / 3.6, TOP_BOOST = 265 / 3.6;

export function buildStubModel(): CarModel {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 4.45), new THREE.MeshLambertMaterial({ color: 0xf2f0ea }));
  body.position.y = 0.6;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 1.8), new THREE.MeshLambertMaterial({ color: 0xc9a14a }));
  cabin.position.set(0, 1.1, 0.3);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2040 }));
  tail.position.set(0, 0.8, 2.23);
  root.add(body, cabin, tail);
  const wheel = (x: number, z: number) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    root.add(w);
    return w;
  };
  return { root, wheels: { fl: wheel(-0.95, -1.4), fr: wheel(0.95, -1.4), rl: wheel(-0.95, 1.4), rr: wheel(0.95, 1.4) }, nozzles: [], tailLights: [tail], fans: [] };
}

export function createStubCar(model: CarModel): Car {
  const obj = new THREE.Group();
  obj.add(model.root);
  let x = 0, y = 0, z = 0, heading = 0, vx = 0, vz = 0, vy = 0, yawRate = 0;
  let gas = 1, drifting = false, regenDelay = 0, launchArm = 0, prevV = 0, smoothG = 0;
  let grid: SegmentGrid | null = null, gridFor: Track | null = null;
  const state: CarState = {
    pose: { x: 0, y: 0, z: 0, heading: 0 }, speedKmh: 0, velocity: { x: 0, y: 0, z: 0 },
    gForce: 0, gas: 1, airborne: false, drifting: false, driftAngleDeg: 0, onSurface: 'road',
  };
  // Camera spring state.
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let camInit = false;

  const car: Car = {
    object: obj,
    lastImpact: null,
    qa: {
      setTank(units: number) { gas = Math.max(0, Math.min(1, units / 100)); state.gas = gas; },
      setSpeed(kmh: number) { const v = kmh / 3.6; vx = Math.sin(heading) * v; vz = -Math.cos(heading) * v; prevV = v; sync(v); },
    },
    state,
    reset(p: Pose) {
      x = p.x; y = p.y; z = p.z; heading = p.heading; vx = vz = vy = 0; yawRate = 0; drifting = false; launchArm = 0;
      camInit = false;
      sync(0);
    },
    step(dt: number, inp: InputState, track: Track) {
      if (gridFor !== track) { grid = new SegmentGrid(track.barriers); gridFor = track; }
      const fx = Math.sin(heading), fz = -Math.cos(heading); // forward
      const rx = Math.cos(heading), rz = Math.sin(heading);  // right
      let vf = vx * fx + vz * fz, vr = vx * rx + vz * rz;
      const speed = Math.hypot(vf, vr);
      const airborne = y > 0.05;
      const inZone = track.zones.noBoostNoJump.some((poly) => pointInPoly(x, z, poly));

      // Launch: hold boost at standstill, release = 4.6 g burst.
      let launchAcc = 0;
      if (speed < 1.5 && inp.boost && !inZone) launchArm += dt;
      else if (launchArm > 0.3 && !inp.boost) { launchAcc = 1; launchArm = -0.6; }
      else if (launchArm > 0 && !inp.boost) launchArm = 0;
      if (launchArm < 0) { launchArm = Math.min(0, launchArm + dt); launchAcc = 1; }

      const boosting = inp.boost && !inZone && gas > 0.02 && speed > 1.5 && launchArm <= 0;
      if (!airborne) {
        let acc = 0;
        if (launchAcc) acc = 4.6 * G * Math.max(0.2, 1 - vf / TOP);
        else if (inp.throttle > 0) acc = inp.throttle * 9.5 * Math.max(0, 1 - Math.max(0, vf) / TOP) + 1;
        if (boosting) acc += 12 * Math.max(0, 1 - vf / TOP_BOOST);
        if (vf > TOP && !boosting) acc -= (vf - TOP) * 0.8;
        if (inp.brake > 0) acc -= vf > 0.5 ? inp.brake * 14 : inp.brake * 4; // brake, then reverse
        acc -= vf * 0.04 + Math.sign(vf) * 0.4; // drag + rolling
        vf += acc * dt;
        if (inp.throttle === 0 && inp.brake === 0 && Math.abs(vf) < 0.4) vf = 0;
        vf = Math.max(-8, vf);

        // Drift entry: brake tap while steering hard at speed. Exit: release steer.
        if (!drifting && inp.brake > 0 && Math.abs(inp.steer) >= 0.5 && vf > 14) drifting = true;
        if (drifting && (Math.abs(inp.steer) < 0.2 || vf < 9)) drifting = false;

        // Steering: yaw rate target shrinks with speed.
        const steerGain = 2.1 / (1 + Math.abs(vf) / 22);
        const target = inp.steer * steerGain * Math.min(1, Math.abs(vf) / 4) * Math.sign(vf || 1) * (drifting ? 1.45 : 1);
        yawRate += (target - yawRate) * Math.min(1, dt * 8);
        heading += yawRate * dt;

        // Lateral grip: kill sideways speed quickly unless drifting.
        const grip = drifting ? 1.6 : 9;
        vr *= Math.exp(-grip * dt);
        if (drifting) vr += -inp.steer * Math.abs(vf) * 0.9 * dt; // tail swings out
      } else {
        heading += yawRate * dt * 0.3;
      }

      // Jump (rising edge only) and hover.
      if (inp.jump && !airborne && gas >= 0.33 && !inZone && !jumpHeld) { vy = 7.2; gas -= 0.33; regenDelay = 1.5; }
      jumpHeld = inp.jump;
      if (airborne || vy > 0) {
        vy -= G * (inp.jump && gas > 0 ? 0.55 : 1) * dt;
        if (inp.jump && gas > 0) { gas -= 0.12 * dt; regenDelay = 1.5; }
      }
      if (boosting) { gas -= 0.2 * dt; regenDelay = 1.5; }

      // Rebuild world velocity from the new heading.
      const nfx = Math.sin(heading), nfz = -Math.cos(heading), nrx = Math.cos(heading), nrz = Math.sin(heading);
      vx = nfx * vf + nrx * vr; vz = nfz * vf + nrz * vr;
      x += vx * dt; z += vz * dt; y += vy * dt;
      const ground = track.heightAt(x, z);
      if (y <= ground) { y = ground; vy = 0; }

      // Walls.
      const hit = grid!.resolve(x, z, 1.1);
      if (hit) {
        x += hit.nx * hit.depth; z += hit.nz * hit.depth;
        const vn = vx * hit.nx + vz * hit.nz;
        if (vn < 0) { vx -= vn * 1.3 * hit.nx; vz -= vn * 1.3 * hit.nz; vx *= 0.9; vz *= 0.9; drifting = false; }
        if (vn < -1) car.lastImpact = { impulse: Math.abs(vn) * 1500, kind: 'barrier', seq: (car.lastImpact?.seq ?? 0) + 1 };
      }

      // Gas economy (GAMEPLAY §2.4 game side).
      regenDelay -= dt;
      const sp = Math.hypot(vx, vz);
      const slip = sp > 1 ? Math.abs(Math.atan2(vx * nrx + vz * nrz, vx * nfx + vz * nfz)) : 0;
      const counted = drifting && slip > (15 * Math.PI) / 180 && sp > 50 / 3.6;
      if (counted) gas += 0.1 * dt;
      else if (regenDelay <= 0) gas += 0.03 * dt;
      gas = Math.max(0, Math.min(1, gas));

      const vfNow = vx * nfx + vz * nfz;
      const longG = (vfNow - prevV) / dt / G;
      prevV = vfNow;
      smoothG += (Math.abs(longG) - smoothG) * Math.min(1, dt * 10);
      state.drifting = counted;
      state.driftAngleDeg = (slip * 180) / Math.PI;
      state.onSurface = track.surfaceAt(x, z);
      state.gForce = smoothG;
      state.gas = gas;
      state.airborne = y > ground + 0.05;
      sync(sp);
    },
    camera: {
      update(dt: number, cam: THREE.PerspectiveCamera) {
        const fx = Math.sin(heading), fz = -Math.cos(heading);
        const sp = Math.hypot(vx, vz);
        const dist = 5.5 + Math.min(0.8, sp / TOP * 0.8) + Math.min(1.2, smoothG * 0.25);
        const want = new THREE.Vector3(x - fx * dist, y + 2.0, z - fz * dist);
        const look = new THREE.Vector3(x + fx * 3, y + 1.0, z + fz * 3);
        if (!camInit) { camPos.copy(want); camLook.copy(look); camInit = true; }
        const k = 1 - Math.exp(-8 * dt), ky = 1 - Math.exp(-4 * dt);
        camPos.x += (want.x - camPos.x) * k; camPos.z += (want.z - camPos.z) * k; camPos.y += (want.y - camPos.y) * ky;
        camLook.lerp(look, k);
        cam.position.copy(camPos);
        cam.lookAt(camLook);
        const fov = Math.min(72, 55 + (sp / TOP) * 7 + smoothG * 2.5);
        if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 6); cam.updateProjectionMatrix(); }
      },
    },
  };
  let jumpHeld = false;

  function sync(sp: number) {
    state.pose.x = x; state.pose.y = y; state.pose.z = z; state.pose.heading = heading;
    state.velocity.x = vx; state.velocity.y = vy; state.velocity.z = vz;
    state.speedKmh = sp * 3.6;
    obj.position.set(x, y, z);
    obj.rotation.set(0, -heading, 0);
  }
  return car;
}
