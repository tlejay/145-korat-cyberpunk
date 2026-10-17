// Chinese lanterns + blade signs swinging in the car's wind / storm (PHYSICS §5.4).
//   lantern: spherical pendulum, L 0.6 m, 1 kg, Ø 0.4 m, Cd 0.5, ζ 0.05 → period 1.55 s, cap 60°
//   blade:   rigid plate hinged at its top bracket, L_eff = ⅔h, 12 kg/m² light box, Cd 1.2 on the face,
//            bracket stiffness ×3 of gravity (real ones are braced) → a few degrees on a close pass
// Meshes: visuals (src/neon) owns the look. fx finds InstancedMesh named `neon-lanterns` / `neon-blades`
// (instance origin = hinge point) and rotates each instance about its hinge. Until those exist fx shows
// its own placeholders under the same names, removed the moment the real ones appear.
import * as THREE from 'three';
import type { WindField, V3 } from './wind.js';

const G = 9.81, RHO = 1.2;
export type SwingAnchor = { x: number; y: number; z: number; ang: number; w: number; h: number };

const LANTERN = { L: 0.6, m: 1, area: Math.PI * 0.2 * 0.2, cd: 0.5, zeta: 0.05, cap: 1.05 };
const BLADE = { kgPerM2: 12, cd: 1.2, zeta: 0.08, stiff: 3, cap: (12 * Math.PI) / 180 };
const CANYON = 0.5; // street canyon shelters hanging things from half the storm (PHYSICS §5.4)

export const SWING_NAMES = { lantern: 'neon-lanterns', blade: 'neon-blades' } as const;

interface Set {
  kind: 'lantern' | 'blade';
  n: number;
  hx: Float32Array; hy: Float32Array; hz: Float32Array; // hinge (world)
  // lantern: 2 angles (toward +x, toward +z) · blade: 1 angle about the hinge axis (ux, uz) — face normal (nx, nz)
  th: Float32Array; om: Float32Array;
  ux: Float32Array; uz: Float32Array;
  w0: Float32Array; kF: Float32Array; // natural freq, wind force → angular accel factor
  moving: Uint8Array;
  mesh: THREE.InstancedMesh | null; own: boolean;
  base: THREE.Matrix4[]; map: Int32Array; // instance → anchor index
  piv: Float32Array; // per instance hinge = the instance origin (contract with src/neon)
}

const tmpM = new THREE.Matrix4(), tmpR = new THREE.Matrix4(), tmpT = new THREE.Matrix4(), tmpTi = new THREE.Matrix4();
const ax = new THREE.Vector3(), wv: V3 = { x: 0, y: 0, z: 0 };

export class SwingSystem {
  simRadius = 120;
  simulated = 0;
  private sets: Set[];
  private lookT = 0;

  constructor(private scene: THREE.Object3D, lanterns: SwingAnchor[], blades: SwingAnchor[], placeholders: boolean) {
    this.sets = [this.make('lantern', lanterns), this.make('blade', blades)];
    if (placeholders) for (const s of this.sets) if (s.n) this.placeholder(s, s.kind === 'lantern' ? lanterns : blades);
    this.discover();
  }

  private make(kind: Set['kind'], an: SwingAnchor[]): Set {
    const n = an.length, f = () => new Float32Array(n);
    const s: Set = {
      kind, n, hx: f(), hy: f(), hz: f(), th: new Float32Array(n * 2), om: new Float32Array(n * 2), ux: f(), uz: f(), w0: f(), kF: f(),
      moving: new Uint8Array(n), mesh: null, own: false, base: [], map: new Int32Array(0), piv: new Float32Array(0),
    };
    an.forEach((a, i) => {
      s.hx[i] = a.x; s.hz[i] = a.z;
      if (kind === 'lantern') {
        s.hy[i] = a.y + LANTERN.L; // anchor y = lantern centre; string hangs from 0.6 m above it
        s.w0[i] = Math.sqrt(G / LANTERN.L);
        s.kF[i] = (0.5 * RHO * LANTERN.cd * LANTERN.area) / (LANTERN.m * LANTERN.L);
      } else {
        s.hy[i] = a.y + a.h / 2; // anchor y = sign centre; bracket at the top edge
        // hinge axis runs out from the wall (⟂ to `ang`, the wall direction); the face normal is the wall direction
        s.ux[i] = Math.cos(a.ang); s.uz[i] = -Math.sin(a.ang);
        const area = a.w * a.h, m = BLADE.kgPerM2 * area, Le = (2 / 3) * a.h;
        s.w0[i] = Math.sqrt((G * (1 + BLADE.stiff)) / Le);
        // torque = F·h/2, inertia ≈ m·Le²  → α = F·(h/2)/(m·Le²)
        s.kF[i] = (0.5 * RHO * BLADE.cd * area * (a.h / 2)) / (m * Le * Le);
      }
    });
    return s;
  }

  /** Simple stand-in meshes (1 draw call per kind) until visuals ships its own. */
  private placeholder(s: Set, an: SwingAnchor[]) {
    let geo: THREE.BufferGeometry, mat: THREE.Material;
    if (s.kind === 'lantern') {
      geo = new THREE.CylinderGeometry(0.2, 0.2, 0.42, 8, 1).translate(0, -LANTERN.L, 0);
      const cap = new THREE.CylinderGeometry(0.008, 0.008, LANTERN.L - 0.21, 3).translate(0, -(LANTERN.L - 0.21) / 2, 0);
      geo = mergeTwo(geo, cap);
      mat = new THREE.MeshBasicMaterial({ color: 0xff2a3a });
    } else {
      geo = new THREE.BoxGeometry(1, 1, 0.12).translate(0, -0.5, 0); // scaled per instance; origin = top edge
      mat = new THREE.MeshStandardMaterial({ color: 0x15121f, emissive: 0x29e0ff, emissiveIntensity: 0.6, roughness: 0.6 });
    }
    const mesh = new THREE.InstancedMesh(geo, mat, s.n);
    mesh.name = SWING_NAMES[s.kind];
    mesh.userData.fxPlaceholder = true;
    const q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    an.forEach((a, i) => {
      p.set(s.hx[i], s.hy[i], s.hz[i]);
      // blade: local x = width along the hinge axis (out from the wall), local z = face normal (wall direction)
      if (s.kind === 'blade') { q.setFromAxisAngle(ax.set(0, 1, 0), a.ang); sc.set(a.w, a.h, 1); } else { q.identity(); sc.set(1, 1, 1); }
      mesh.setMatrixAt(i, tmpM.compose(p, q, sc));
    });
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.computeBoundingSphere();
    this.scene.add(mesh);
    this.attach(s, mesh, true);
  }

  private attach(s: Set, mesh: THREE.InstancedMesh, own: boolean) {
    if (s.mesh && s.own && !own) { s.mesh.geometry.dispose(); (s.mesh.material as THREE.Material).dispose(); s.mesh.removeFromParent(); }
    s.mesh = mesh; s.own = own;
    s.base = [];
    s.map = new Int32Array(mesh.count);
    s.piv = new Float32Array(mesh.count * 3);
    const p = new THREE.Vector3();
    for (let i = 0; i < mesh.count; i++) {
      const m = new THREE.Matrix4();
      mesh.getMatrixAt(i, m);
      s.base.push(m);
      // map by nearest hinge (horizontal) so the instance order of the real mesh does not matter
      p.setFromMatrixPosition(m);
      s.piv[i * 3] = p.x; s.piv[i * 3 + 1] = p.y; s.piv[i * 3 + 2] = p.z;
      let best = -1, bd = 4; // within 2 m
      for (let k = 0; k < s.n; k++) {
        const d = (s.hx[k] - p.x) ** 2 + (s.hz[k] - p.z) ** 2;
        if (d < bd) { bd = d; best = k; }
      }
      s.map[i] = best;
    }
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  /** Look for visuals' meshes (by name). Cheap enough once a second. */
  private discover() {
    for (const s of this.sets) {
      if (s.mesh && !s.own) continue;
      let found: THREE.InstancedMesh | null = null;
      this.scene.traverse((o) => {
        const m = o as THREE.InstancedMesh;
        if (!found && m.isInstancedMesh && m.name === SWING_NAMES[s.kind] && !m.userData.fxPlaceholder) found = m;
      });
      if (found) this.attach(s, found, false);
    }
  }

  step(dt: number, wind: WindField, cx: number, cz: number) {
    this.lookT += dt;
    if (this.lookT > 1) { this.lookT = 0; this.discover(); }
    const R2 = this.simRadius * this.simRadius;
    const storm = wind.stormNow() * CANYON;
    let sim = 0;
    for (const s of this.sets) {
      for (let i = 0; i < s.n; i++) {
        const near = (s.hx[i] - cx) ** 2 + (s.hz[i] - cz) ** 2 < R2;
        if (!near && !s.moving[i]) continue;
        sim++;
        const w0 = s.w0[i], c = 2 * (s.kind === 'lantern' ? LANTERN.zeta : BLADE.zeta) * w0;
        if (near) wind.field(s.hx[i], s.hy[i] - (s.kind === 'lantern' ? LANTERN.L : 0.5), s.hz[i], wv);
        else wv.x = wv.y = wv.z = 0;
        let energy = 0;
        if (s.kind === 'lantern') {
          for (let k = 0; k < 2; k++) {
            const u = (k === 0 ? wv.x : wv.z) + storm * (k === 0 ? wind.dirX : wind.dirZ);
            const j = i * 2 + k, th = s.th[j];
            const a = -w0 * w0 * Math.sin(th) - c * s.om[j] + s.kF[i] * u * Math.abs(u) * Math.cos(th);
            s.om[j] += a * dt;
            s.th[j] = Math.max(-LANTERN.cap, Math.min(LANTERN.cap, th + s.om[j] * dt));
            energy += Math.abs(s.th[j]) + Math.abs(s.om[j]);
          }
        } else {
          // wind through the face (normal = wall direction = (−uz, ux) rotated) drives the swing
          const nx = -s.uz[i], nz = s.ux[i];
          const u = wv.x * nx + wv.z * nz + storm * (wind.dirX * nx + wind.dirZ * nz);
          const j = i * 2, th = s.th[j];
          const a = -w0 * w0 * th - c * s.om[j] + s.kF[i] * u * Math.abs(u);
          s.om[j] += a * dt;
          s.th[j] = Math.max(-BLADE.cap, Math.min(BLADE.cap, th + s.om[j] * dt));
          energy = Math.abs(s.th[j]) + Math.abs(s.om[j]);
        }
        s.moving[i] = energy > 2e-4 ? 1 : 0;
        if (!s.moving[i]) { s.th[i * 2] = s.th[i * 2 + 1] = s.om[i * 2] = s.om[i * 2 + 1] = 0; }
      }
      this.write(s);
    }
    this.simulated = sim;
  }

  private write(s: Set) {
    const mesh = s.mesh;
    if (!mesh) return;
    let dirty = false;
    for (let i = 0; i < mesh.count; i++) {
      const k = s.map[i];
      if (k < 0) continue;
      const th0 = s.th[k * 2], th1 = s.th[k * 2 + 1];
      const was = mesh.userData.swingDirty?.[i];
      if (!s.moving[k] && !was) continue;
      const b = s.base[i];
      // world rotation about the hinge: M = T·R·T⁻¹·Base
      if (s.kind === 'lantern') tmpR.makeRotationZ(th0).multiply(tmpM.makeRotationX(-th1));
      else tmpR.makeRotationAxis(ax.set(s.ux[k], 0, s.uz[k]), -th0); // −θ: positive θ = board pushed along +n
      const px = s.piv[i * 3], py = s.piv[i * 3 + 1], pz = s.piv[i * 3 + 2];
      tmpT.makeTranslation(px, py, pz);
      tmpTi.makeTranslation(-px, -py, -pz);
      tmpM.copy(tmpT).multiply(tmpR).multiply(tmpTi).multiply(b);
      mesh.setMatrixAt(i, tmpM);
      (mesh.userData.swingDirty ??= new Uint8Array(mesh.count))[i] = s.moving[k];
      dirty = true;
    }
    if (dirty) mesh.instanceMatrix.needsUpdate = true;
  }

  /** QA/report: max angle in degrees across all lanterns / blades. */
  maxDeg(kind: Set['kind']) {
    const s = this.sets[kind === 'lantern' ? 0 : 1];
    let m = 0;
    for (let i = 0; i < s.th.length; i++) m = Math.max(m, Math.abs(s.th[i]));
    return (m * 180) / Math.PI;
  }

  dispose() {
    for (const s of this.sets) {
      if (!s.mesh) continue;
      if (s.own) { s.mesh.geometry.dispose(); (s.mesh.material as THREE.Material).dispose(); s.mesh.removeFromParent(); }
      else { for (let i = 0; i < s.mesh.count; i++) s.mesh.setMatrixAt(i, s.base[i]); s.mesh.instanceMatrix.needsUpdate = true; }
      s.mesh = null;
    }
  }
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const A = a.toNonIndexed(), B = b.toNonIndexed();
  const pos = new Float32Array(A.attributes.position.array.length + B.attributes.position.array.length);
  pos.set(A.attributes.position.array as Float32Array); pos.set(B.attributes.position.array as Float32Array, A.attributes.position.array.length);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  [a, b, A, B].forEach((x) => x.dispose());
  return g;
}
