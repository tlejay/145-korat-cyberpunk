// Thao Suranari (ย่าโม) — bronze statue, 1.85 m, smooth low-poly.
// Pose from research/landmarks/img/monument-01..03: standing upright in full court dress
// (jongkraben to the ankles, sabai over the LEFT shoulder hanging down her left side),
// RIGHT hand lowered holding a sword whose tip rests on the base, LEFT hand on the hip.
// Modelled facing −x (west, toward Bangkok); her right = −z (north), left = +z (south).
// Respect rules (CLAUDE.md §2): no stylisation, no cyberpunk props, never animated.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Sec = { y: number; rx: number; rz: number; cx?: number };

// Lofted elliptical body: smooth normals, closed bottom.
function loft(secs: Sec[], n = 18): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  secs.forEach((s, i) => {
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * Math.PI * 2;
      pos.push((s.cx ?? 0) + Math.cos(a) * s.rx, s.y, Math.sin(a) * s.rz);
      uv.push(k / n, i / (secs.length - 1));
    }
  });
  for (let i = 0; i + 1 < secs.length; i++) for (let k = 0; k < n; k++) {
    const a = i * (n + 1) + k, b = a + 1, c = a + n + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const base = pos.length / 3;
  pos.push(secs[0].cx ?? 0, secs[0].y, 0); uv.push(0.5, 0);
  for (let k = 0; k < n; k++) idx.push(base, k, k + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// Tapered limb between two points (cylinder) + a joint sphere at `a`.
function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, joint = true): THREE.BufferGeometry[] {
  const d = b.clone().sub(a), len = d.length();
  const cyl = new THREE.CylinderGeometry(r1, r0, len, 10, 1, true);
  cyl.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), d.normalize()));
  cyl.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  const out: THREE.BufferGeometry[] = [cyl];
  if (joint) { const s = new THREE.SphereGeometry(r0 * 1.02, 10, 8); s.translate(a.x, a.y, a.z); out.push(s); }
  return out;
}

function ellipsoid(c: THREE.Vector3, rx: number, ry: number, rz: number, w = 16, h = 12, thetaLen = Math.PI): THREE.BufferGeometry {
  const s = new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, thetaLen);
  s.scale(rx, ry, rz);
  s.translate(c.x, c.y, c.z);
  return s;
}

// Thin oriented slab from a to b (width w along `side`, thickness t).
function slab(a: THREE.Vector3, b: THREE.Vector3, w: number, t: number, side: THREE.Vector3): THREE.BufferGeometry {
  const d = b.clone().sub(a), len = d.length();
  const g = new THREE.BoxGeometry(w, len, t);
  const yAxis = d.clone().normalize();
  const xAxis = side.clone().sub(yAxis.clone().multiplyScalar(side.dot(yAxis))).normalize();
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

export function buildStatueGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Small bronze base plate the figure stands on
  const plate = new THREE.BoxGeometry(0.62, 0.05, 0.56);
  plate.translate(-0.02, 0.025, 0);
  parts.push(plate);
  const y0 = 0.05;

  // Feet peeking out under the hem
  for (const z of [-0.075, 0.075]) { const f = new THREE.BoxGeometry(0.14, 0.06, 0.075); f.translate(-0.15, y0 + 0.03, z); parts.push(f); }

  // Body: jongkraben (ankle-length), hips, waist, bust, shoulders, neck
  parts.push(loft([
    { y: y0 + 0.02, rx: 0.155, rz: 0.19, cx: -0.01 },
    { y: y0 + 0.16, rx: 0.145, rz: 0.18, cx: -0.01 },
    { y: y0 + 0.45, rx: 0.135, rz: 0.172 },
    { y: y0 + 0.75, rx: 0.138, rz: 0.183 },
    { y: y0 + 0.9, rx: 0.146, rz: 0.198 },
    { y: y0 + 1.0, rx: 0.124, rz: 0.163 },
    { y: y0 + 1.1, rx: 0.116, rz: 0.152 },
    { y: y0 + 1.21, rx: 0.128, rz: 0.168, cx: -0.008 },
    { y: y0 + 1.31, rx: 0.118, rz: 0.182 },
    { y: y0 + 1.38, rx: 0.104, rz: 0.2 },
    { y: y0 + 1.43, rx: 0.075, rz: 0.15 },
    { y: y0 + 1.47, rx: 0.05, rz: 0.054 },
    { y: y0 + 1.55, rx: 0.048, rz: 0.05, cx: -0.008 },
  ]));
  // Front fold of the jongkraben (centre pleat) and the waist sash knot
  parts.push(slab(v3(-0.142, y0 + 0.06, 0.015), v3(-0.152, y0 + 0.97, 0.01), 0.075, 0.03, v3(0, 0, 1)));
  const belt = new THREE.CylinderGeometry(1, 1, 0.07, 18, 1, true);
  belt.scale(0.13, 1, 0.17);
  belt.translate(0, y0 + 0.99, 0);
  parts.push(belt);

  // Head (slightly forward on the neck) + short traditional hair, chin up, looking west
  parts.push(ellipsoid(v3(-0.012, y0 + 1.655, 0), 0.098, 0.118, 0.08));
  parts.push(ellipsoid(v3(0.005, y0 + 1.685, 0), 0.101, 0.11, 0.084, 16, 8, Math.PI * 0.55));
  const nose = new THREE.ConeGeometry(0.016, 0.04, 4);
  nose.rotateZ(Math.PI / 2);
  nose.translate(-0.11, y0 + 1.645, 0);
  parts.push(nose);

  // Sabai: band across the chest from the LEFT shoulder to the RIGHT waist + flap down her left side
  parts.push(slab(v3(-0.085, y0 + 1.42, 0.13), v3(-0.142, y0 + 1.06, -0.1), 0.15, 0.03, v3(0, 0.3, 1)));
  parts.push(slab(v3(0.0, y0 + 1.42, 0.2), v3(-0.035, y0 + 0.86, 0.235), 0.2, 0.035, v3(-1, 0, 0)));
  parts.push(slab(v3(0.07, y0 + 1.4, 0.06), v3(0.12, y0 + 1.02, -0.05), 0.15, 0.03, v3(0, 0.3, 1))); // back of the band

  // RIGHT arm (−z): lowered, slightly forward, hand on the sword grip
  const rS = v3(0, y0 + 1.38, -0.205), rE = v3(-0.025, y0 + 1.1, -0.24), rW = v3(-0.075, y0 + 0.86, -0.25);
  parts.push(...limb(rS, rE, 0.05, 0.042), ...limb(rE, rW, 0.041, 0.033));
  parts.push(ellipsoid(v3(-0.083, y0 + 0.82, -0.25), 0.045, 0.055, 0.035, 10, 8));
  // Sword (ดาบ): grip in the hand, guard, slightly curved blade, tip resting on the base by the right foot
  parts.push(slab(v3(-0.083, y0 + 0.9, -0.25), v3(-0.087, y0 + 0.74, -0.252), 0.028, 0.028, v3(0, 0, 1)));
  const guard = new THREE.BoxGeometry(0.03, 0.02, 0.09);
  guard.translate(-0.088, y0 + 0.73, -0.252);
  parts.push(guard);
  const b0 = v3(-0.09, y0 + 0.72, -0.253), b1 = v3(-0.125, y0 + 0.36, -0.268), b2 = v3(-0.175, y0 + 0.0, -0.285);
  parts.push(slab(b0, b1, 0.042, 0.012, v3(-1, 0, 0)), slab(b1, b2, 0.034, 0.011, v3(-1, 0, 0)));

  // LEFT arm (+z): akimbo, elbow out to the side, hand resting on the hip
  const lS = v3(0, y0 + 1.38, 0.205), lE = v3(0.055, y0 + 1.13, 0.36), lW = v3(0.005, y0 + 0.99, 0.225);
  parts.push(...limb(lS, lE, 0.05, 0.042), ...limb(lE, lW, 0.041, 0.034));
  parts.push(ellipsoid(v3(-0.005, y0 + 0.965, 0.205), 0.055, 0.04, 0.03, 10, 8));

  const flat = parts.map((p) => {
    const q = p.index ? p.toNonIndexed() : p;
    q.deleteAttribute('uv');
    if (!q.getAttribute('normal')) q.computeVertexNormals();
    return q;
  });
  const merged = mergeGeometries(flat, false)!;
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}
