// Jet cores: the straight, bright part of each cold-gas jet before it breaks into cloud (rear photo:
// four white cones from the side-down nozzles, then a billow on the road). One InstancedMesh for all
// nozzles = 1 draw call. Length/width come from the jet physics (jet.ts), not an artist's guess:
//   visible core ends where dilution D reaches CORE_D (cloud takes over), x = (D−1)·d_eq/0.32,
//   cut short by the road; radius at the end = d_eq/2 + 0.21·x (12° spread).
import * as THREE from 'three';

export const CORE_D = 8;

const VERT = /* glsl */ `
attribute vec2 iJet; // alpha, shock-cell count along the core
varying float vZ;
varying float vA;
varying float vCells;
varying float vFacing;
varying float vFogDepth;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * wp;
  vec3 n = normalize(mat3(viewMatrix) * mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vFacing = abs(dot(n, normalize(-mv.xyz)));
  vZ = position.z;
  vA = iJet.x;
  vCells = iJet.y;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying float vZ;
varying float vA;
varying float vCells;
varying float vFacing;
varying float vFogDepth;
void main() {
  // translucent at the nozzle (dry gas), densest in the middle, frays into the cloud at the end
  float along = smoothstep(0.0, 0.18, vZ) * (1.0 - smoothstep(0.6, 1.0, vZ));
  // under-expanded jet: faint shock cells near the nozzle, flicker from turbulence
  float cells = 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.5, vZ)) * (0.5 + 0.5 * cos(vZ * vCells * 6.2831));
  float flick = 0.88 + 0.12 * sin(uTime * 53.0 + vZ * 21.0);
  float a = vA * along * cells * flick * pow(vFacing, 1.4);
  a *= smoothstep(1.0, 4.5, vFogDepth);
  float fog = smoothstep(fogNear, fogFar, vFogDepth);
  gl_FragColor = vec4(mix(uColor, fogColor, fog), a * (1.0 - fog));
}`;

export class JetCores {
  readonly mesh: THREE.InstancedMesh;
  private jet: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private z = new THREE.Vector3(0, 0, 1);
  private d = new THREE.Vector3();
  readonly material: THREE.ShaderMaterial;

  constructor(n: number) {
    // unit cone along +z: radius 0.12 at the lip → 1 at z = 1 (scaled per instance)
    const g = new THREE.CylinderGeometry(1, 0.12, 1, 10, 6, true);
    g.rotateX(Math.PI / 2); // +y → +z, wide end at +z
    g.translate(0, 0, 0.5);
    this.jet = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
    this.jet.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iJet', this.jet);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(0.85, 0.87, 0.95) }, uTime: { value: 0 },
        fogColor: { value: new THREE.Color(0x0b0a18) }, fogNear: { value: 1e5 }, fogFar: { value: 2e5 },
      },
    });
    this.mesh = new THREE.InstancedMesh(g, this.material, n);
    this.mesh.name = 'fx-jet-cores';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
  }

  begin(time: number) { this.mesh.count = 0; this.material.uniforms.uTime.value = time; }

  /** One active nozzle: world position, exhaust axis (unit, already includes car velocity), physics sizes. */
  add(x: number, y: number, z: number, dx: number, dy: number, dz: number, dEq: number, groundDist: number, alpha: number) {
    const i = this.mesh.count;
    if (i >= this.jet.count) return;
    let L = ((CORE_D - 1) * dEq) / 0.32;
    if (groundDist < L) L = Math.max(0.05, groundDist + 0.05);
    const r = 0.5 * dEq + 0.21 * L * 0.6; // cone of the bright core is narrower than the full 12° mixing layer
    this.p.set(x, y, z);
    this.q.setFromUnitVectors(this.z, this.d.set(dx, dy, dz));
    this.s.set(r, r, L);
    this.mesh.setMatrixAt(i, this.m.compose(this.p, this.q, this.s));
    this.jet.setXY(i, alpha, Math.max(2, Math.min(9, L / (1.2 * dEq))));
    this.mesh.count = i + 1;
  }

  end() {
    if (!this.mesh.count) return;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.jet.needsUpdate = true;
  }

  setFog(u: { fogColor: { value: THREE.Color }; fogNear: { value: number }; fogFar: { value: number } }) {
    const m = this.material.uniforms;
    m.fogColor.value.copy(u.fogColor.value); m.fogNear.value = u.fogNear.value; m.fogFar.value = u.fogFar.value;
  }

  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); this.mesh.removeFromParent(); }
}
