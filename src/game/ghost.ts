// Ghost recording (10 Hz, GAMEPLAY §5.3) + playback as a translucent wireframe car.
import * as THREE from 'three';
import { GHOST_FLAG, GHOST_HZ, TRACK_VERSION, type Ghost, type GhostSample } from '../net/ghost-format.js';
import type { CarState } from '../types.js';

export class GhostRecorder {
  samples: GhostSample[] = [];
  private acc = 0;
  record(dt: number, s: CarState, boost: boolean) {
    this.acc -= dt;
    if (this.acc > 0) return;
    this.acc += 1 / GHOST_HZ;
    const flags = (s.drifting ? GHOST_FLAG.drift : 0) | (boost ? GHOST_FLAG.boost : 0) | (s.airborne ? GHOST_FLAG.airborne : 0);
    this.samples.push({ x: s.pose.x, y: s.pose.y, z: s.pose.z, yawDeg: (s.pose.heading * 180) / Math.PI, flags });
  }
  reset() { this.samples = []; this.acc = 0; }
  finish(lapMs: number): Ghost { return { hz: GHOST_HZ, lapMs, trackVersion: TRACK_VERSION, samples: this.samples.slice() }; }
}

export class GhostCar {
  readonly object: THREE.Group;
  ghost: Ghost | null = null;
  constructor(color: number) {
    this.object = new THREE.Group();
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 1.1, 4.45));
    const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 }));
    line.position.y = 0.65;
    const fill = new THREE.Mesh(new THREE.BoxGeometry(2, 1.1, 4.45), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false }));
    fill.position.y = 0.65;
    this.object.add(line, fill);
    this.object.visible = false;
  }
  // t = ms since the start of the ghost's lap.
  update(t: number, cam: THREE.Camera) {
    const g = this.ghost;
    if (!g || g.samples.length < 2) { this.object.visible = false; return; }
    const f = (t / 1000) * g.hz;
    const i = Math.floor(f);
    if (i < 0 || i >= g.samples.length - 1) { this.object.visible = false; return; }
    const a = g.samples[i], b = g.samples[i + 1], k = f - i;
    const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k, z = a.z + (b.z - a.z) * k;
    let dy = b.yawDeg - a.yawDeg;
    if (dy > 180) dy -= 360; else if (dy < -180) dy += 360;
    const yaw = ((a.yawDeg + dy * k) * Math.PI) / 180;
    this.object.position.set(x, y, z);
    this.object.rotation.set(0, -yaw, 0);
    this.object.visible = cam.position.distanceTo(this.object.position) > 4;
  }
}
