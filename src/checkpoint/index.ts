// Korat alcohol checkpoint (ด่านตรวจ) — BRIEF docs/dev/checkpoint/BRIEF-checkpoint.md, REPORT-checkpoint.md.
// createCheckpoint(scene, track, car) → { update(dt), events } for the M3 integrator. Jump it for style,
// or smash it: props fly (rigid bodies in sim.ts), the car loses ≤ 20 % speed, never stops.
// Draw calls: cones, batons, A-frames, sirens, barricades, pickups, light bars, glow pools = 8.
import * as THREE from 'three';
import type { Car, Track } from '../types.js';
import { CheckpointSim, type CarControl, type CarView, type CheckpointEventType } from './sim.js';
import {
  aframeGeometry, barricadeGeometry, batonGeometry, coneGeometry, glowGeometry, lightbarGeometry, makeAtlas, sirenGeometry, truckGeometry,
} from './meshes.js';

export { CP, SITES, TEXT } from './sim.js';
export type { CheckpointEventType } from './sim.js';

/**
 * Events (CustomEvent, `detail` fields):
 * - `approach` {site, name, distM, text}            → toast "ด่านข้างหน้า! กระโดดข้าม"
 * - `cue`      {site, jump: 'slow'|'early'|'now'|'late'|'none', speedKmh, windowM} → jump hint ('now' = press now,
 *               'slow' = too slow to clear the set, below ~50 km/h)
 * - `clear`    {site, name, pass, points, text, minClearanceM, voice: 'vo-great-jump'} → style "ข้ามด่าน +300"
 * - `smash`    {site, name, pass, items, points: 0, speedBeforeKmh, speedAfterKmh, lossPct, text, audio: 'crash'}
 * - `hit`      {site, kind: 'cone'|'aframe'|'barricade'|'truck', impulseNs, speedKmh} → crash-light sfx / haptics
 * - `blown`    {site, text}                         → thruster wind knocked cones over (bonus)
 * - `reset`    {site}                               → props restored (site out of view, or reset())
 */
export interface Checkpoint {
  update(dt: number): void;
  events: EventTarget;
  /** Restore every site (race restart). Sites also restore themselves once behind the car. */
  reset(): void;
  stats(): ReturnType<CheckpointSim['stats']> & { drawCalls: number };
  dispose(): void;
  readonly sim: CheckpointSim;
}

type PhysLike = {
  x: number; y: number; z: number; heading: number; vx: number; vy: number; vz: number; airborne: boolean;
  tel: { thrustN: { lift: number }; events: { jump: number } };
};

export function createCheckpoint(scene: THREE.Scene, track: Track, car: Car): Checkpoint {
  const events = new EventTarget();
  const emit = (type: CheckpointEventType, detail: Record<string, unknown>) => events.dispatchEvent(new CustomEvent(type, { detail }));
  const sim = new CheckpointSim({ centerline: track.centerline ?? [], heightAt: track.heightAt, barriers: track.barriers }, emit);

  // ── car adapter: real physics when present (src/car), read-only for the stub car ──
  const phys = (car as Car & { physics?: PhysLike }).physics;
  const view: CarView = { x: 0, y: 0, z: 0, heading: 0, vx: 0, vy: 0, vz: 0, airborne: false, liftN: 0, jumpSeq: 0 };
  const ctl: CarControl | null = phys
    ? {
        // Only touches CarPhysics' public velocity/position fields — no change inside src/car needed.
        slow(f) { phys.vx *= f; phys.vz *= f; },
        push(dx, dz, vx, vz) { phys.x += dx; phys.z += dz; phys.vx = vx; phys.vz = vz; },
      }
    : null;
  let stubJumps = 0, stubAir = false;
  const read = () => {
    if (phys) {
      view.x = phys.x; view.y = phys.y; view.z = phys.z; view.heading = phys.heading;
      view.vx = phys.vx; view.vy = phys.vy; view.vz = phys.vz; view.airborne = phys.airborne;
      view.liftN = phys.tel.thrustN.lift; view.jumpSeq = phys.tel.events.jump;
    } else {
      const s = car.state;
      view.x = s.pose.x; view.y = s.pose.y; view.z = s.pose.z; view.heading = s.pose.heading;
      view.vx = s.velocity.x; view.vy = s.velocity.y; view.vz = s.velocity.z;
      if (s.airborne && !stubAir) stubJumps++;
      stubAir = view.airborne = s.airborne; view.liftN = 0; view.jumpSeq = stubJumps;
    }
  };

  // ── meshes (instanced, one per prop kind) ──
  const group = new THREE.Group();
  group.name = 'checkpoint';
  scene.add(group);
  const atlas = makeAtlas();
  const signMat = new THREE.MeshStandardMaterial({
    map: atlas, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55,
    emissive: 0xffffff, emissiveMap: atlas, emissiveIntensity: 0.4, // retroreflective sheeting reads at night
  });
  const coneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: 0x2a0c00 });
  const glowMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const truckMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3 });
  const poolMat = new THREE.MeshBasicMaterial({ map: atlas, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

  const byKind = (k: string) => sim.bodies.filter((b) => b.def.kind === k);
  const cones = byKind('cone'), aframes = byKind('aframe'), barricades = byKind('barricade');
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number, name: string) => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    m.name = name; m.count = n; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(m);
    return m;
  };
  const coneMesh = mk(coneGeometry(), coneMat, cones.length, 'checkpoint-cones');
  const batonMesh = mk(batonGeometry(), glowMat, cones.length, 'checkpoint-batons');
  const aframeMesh = mk(aframeGeometry(), signMat, aframes.length, 'checkpoint-aframes');
  const sirenMesh = mk(sirenGeometry(), glowMat, aframes.length, 'checkpoint-sirens');
  const barricadeMesh = mk(barricadeGeometry(), signMat, barricades.length, 'checkpoint-barricades');
  const truckMesh = mk(truckGeometry(), truckMat, sim.sites.length, 'checkpoint-pickups');
  const barMesh = mk(lightbarGeometry(), glowMat, sim.sites.length * 2, 'checkpoint-lightbars');
  const poolMesh = mk(glowGeometry(), poolMat, sim.sites.length * 2, 'checkpoint-glow');
  poolMesh.renderOrder = 2;

  // batons: mostly cold blue-white like the reference photo, every other one red
  const BLUE = new THREE.Color(0.55, 0.85, 3.2), REDB = new THREE.Color(3.2, 0.32, 0.22);
  {
    let i = 0;
    for (const site of sim.sites) for (let k = 0; k < site.slots.length; k++) {
      const sl = site.slots[k];
      if (sl.kind !== 'cone') continue;
      batonMesh.setColorAt(i++, sl.batonHot ? REDB : BLUE);
    }
  }

  // static pickups + light bars + glow pools
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), SC = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);
  sim.sites.forEach((site, i) => {
    const yaw = Math.atan2(-site.tx, -site.tz);
    Q.setFromAxisAngle(UP, yaw);
    P.set(site.truck.x, site.ground, site.truck.z);
    truckMesh.setMatrixAt(i, M.compose(P, Q, SC));
    // light-bar halves sit across the cab (local ±x)
    for (let h = 0; h < 2; h++) {
      const off = (h ? 0.3 : -0.3);
      // truck local +x = (cos yaw, −sin yaw) = (−tz, tx) = site +n
      P.set(site.truck.x + site.nx * off, site.ground, site.truck.z + site.nz * off);
      barMesh.setMatrixAt(i * 2 + h, M.compose(P, Q, SC));
      // glow pool on the road beside the truck, toward the lane
      P.set(site.truck.x + site.nx * (1.9 + h * 0.4) + site.tx * (h ? -1.6 : 1.6), site.ground + 0.04, site.truck.z + site.nz * (1.9 + h * 0.4) + site.tz * (h ? -1.6 : 1.6));
      poolMesh.setMatrixAt(i * 2 + h, M.compose(P, Q, new THREE.Vector3(7, 1, 7)));
    }
  });
  truckMesh.instanceMatrix.needsUpdate = true;

  const flash = new THREE.Color();
  const sirenOn = new THREE.Color(4, 0.25, 0.15), sirenOff = new THREE.Color(0.35, 0.03, 0.02);
  const barRed = new THREE.Color(4, 0.2, 0.15), barBlue = new THREE.Color(0.25, 0.5, 4.5), barOff = new THREE.Color(0.06, 0.06, 0.08);
  const poolRed = new THREE.Color(0.55, 0.04, 0.03), poolBlue = new THREE.Color(0.04, 0.1, 0.6);
  let t = 0;

  const writeBodies = () => {
    const put = (mesh: THREE.InstancedMesh, list: typeof cones, mesh2?: THREE.InstancedMesh) => {
      list.forEach((b, i) => {
        P.set(b.px, b.py, b.pz); Q.set(b.qx, b.qy, b.qz, b.qw);
        M.compose(P, Q, SC);
        mesh.setMatrixAt(i, M);
        mesh2?.setMatrixAt(i, M);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh2) mesh2.instanceMatrix.needsUpdate = true;
    };
    put(coneMesh, cones, batonMesh);
    put(aframeMesh, aframes, sirenMesh);
    put(barricadeMesh, barricades);
  };
  writeBodies();
  if (batonMesh.instanceColor) batonMesh.instanceColor.needsUpdate = true;

  let dirtyMatrices = true;
  const cp: Checkpoint = {
    events,
    sim,
    update(dt: number) {
      t += dt;
      read();
      sim.update(dt, view, ctl);
      // whole group off when both sites are far (8 tiny draws saved)
      let near = Infinity;
      for (const s of sim.sites) near = Math.min(near, Math.hypot(view.x - s.ox, view.z - s.oz));
      group.visible = near < 520;
      if (!group.visible) return;
      let awake = false;
      for (const b of sim.bodies) if (b.awake) { awake = true; break; }
      if (awake || dirtyMatrices) { writeBodies(); dirtyMatrices = awake; }
      // flashing: sirens 2 Hz, light-bar halves alternate at 1.5 Hz each (≤ 3 flashes/s — photosensitivity)
      const sOn = (t * 2) % 1 < 0.5;
      for (let i = 0; i < aframes.length; i++) sirenMesh.setColorAt(i, sOn ? sirenOn : sirenOff);
      const red = (t * 1.5) % 1 < 0.5;
      for (let i = 0; i < sim.sites.length; i++) {
        barMesh.setColorAt(i * 2, red ? barRed : barOff);
        barMesh.setColorAt(i * 2 + 1, red ? barOff : barBlue);
        poolMesh.setColorAt(i * 2, flash.copy(red ? poolRed : poolBlue));
        poolMesh.setColorAt(i * 2 + 1, flash.copy(red ? poolBlue : poolRed).multiplyScalar(0.6));
      }
      for (const m of [sirenMesh, barMesh, poolMesh]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    },
    reset() { sim.reset(); dirtyMatrices = true; writeBodies(); },
    stats() { return { ...sim.stats(), drawCalls: group.visible ? 8 : 0 }; },
    dispose() {
      scene.remove(group);
      group.traverse((o) => { if (o instanceof THREE.InstancedMesh) { o.geometry.dispose(); o.dispose(); } });
      for (const m of [signMat, coneMat, glowMat, truckMat, poolMat]) m.dispose();
      atlas.dispose();
    },
  };
  events.addEventListener('reset', () => { dirtyMatrices = true; });
  return cp;
}
