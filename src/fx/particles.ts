// Pooled camera-facing particles: one InstancedBufferGeometry quad per pool = 1 draw call.
// CPU owns the simulation (struct-of-arrays, no per-frame allocation); the GPU only billboards,
// lights and fogs. Two looks: 'soft' (alpha-blended puffs: plume, smoke, spray) and 'spark'
// (additive streaks stretched along velocity).
import * as THREE from 'three';

const VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iData;   // size (m), alpha, seed, stretch (s of velocity streak, sparks)
attribute vec3 iColor;
attribute vec3 iVel;
uniform vec3 uAmbient;
uniform vec3 uTailPos;
uniform vec3 uTailColor;
uniform vec3 uKeyColor;
uniform float uSpark;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vColor;
varying float vSeed;
varying float vFogDepth;
void main() {
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  vec2 c = position.xy;
  if (uSpark > 0.5) {
    // streak: long axis along the projected velocity
    vec3 vv = (viewMatrix * vec4(iVel, 0.0)).xyz;
    vec2 d = vv.xy; float l = length(d);
    vec2 ax = l > 1e-4 ? d / l : vec2(0.0, 1.0);
    vec2 ay = vec2(-ax.y, ax.x);
    float len = iData.x + l * iData.w;
    mv.xy += ax * c.y * len + ay * c.x * iData.x;
  } else {
    float a = iData.z * 6.2831;
    mat2 r = mat2(cos(a), -sin(a), sin(a), cos(a));
    mv.xy += r * c * iData.x;
  }
  gl_Position = projectionMatrix * mv;
  vUv = position.xy;
  vAlpha = iData.y;
  vSeed = iData.z;
  // cheap lighting: ambient (fog/sky) + key (street/neon average) + red tail-light bar falloff
  float dt = distance(iPos, uTailPos);
  vec3 light = uAmbient + uKeyColor + uTailColor * (1.6 / (1.0 + dt * dt * 0.35));
  vColor = uSpark > 0.5 ? iColor : iColor * light;
  vFogDepth = -mv.z;
}`;

const FRAG = /* glsl */ `
uniform float uSpark;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vColor;
varying float vSeed;
varying float vFogDepth;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float a;
  if (uSpark > 0.5) {
    a = (1.0 - r2) * vAlpha;
  } else {
    // lumpy puff: radial falloff modulated by a few seeded lobes (no texture fetch)
    float ang = atan(vUv.y, vUv.x);
    float lobes = 0.82 + 0.18 * sin(ang * 3.0 + vSeed * 40.0) * sin(ang * 5.0 - vSeed * 17.0);
    float edge = clamp(1.0 - r2 / (lobes * lobes), 0.0, 1.0);
    a = edge * edge * vAlpha;
  }
  float fog = smoothstep(fogNear, fogFar, vFogDepth);
  a *= smoothstep(1.0, 4.5, vFogDepth); // never a white sheet over the lens / HUD (VIS-01)
  vec3 col = mix(vColor, fogColor, fog);
  if (uSpark > 0.5) gl_FragColor = vec4(col * a * (1.0 - fog), 1.0);
  else gl_FragColor = vec4(col, a * (1.0 - fog * 0.7));
}`;

export type Look = 'soft' | 'spark';
export const A_STRIDE = 12;

/** Per-particle simulation state (SoA). `mode` tells the owner how to integrate it. */
export class ParticlePool {
  readonly cap: number;
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  // render attributes
  private iPos: Float32Array; private iData: Float32Array; private iColor: Float32Array; private iVel: Float32Array;
  private attrs: THREE.InstancedBufferAttribute[];
  // simulation
  readonly alive: Uint8Array;
  readonly mode: Uint8Array;
  readonly t: Float32Array; readonly life: Float32Array;
  readonly p: Float32Array; readonly v: Float32Array;   // ballistic pos/vel, or jet origin/axis
  readonly o: Float32Array;                             // jet: drift offset (wake/wind/sink)
  readonly a: Float32Array;                             // generic params (A_STRIDE per particle)
  readonly col: Float32Array;
  size: Float32Array; alpha: Float32Array; seed: Float32Array;
  private next = 0;
  count = 0;

  constructor(cap: number, look: Look) {
    this.cap = cap;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.iPos = new Float32Array(cap * 3); this.iData = new Float32Array(cap * 4);
    this.iColor = new Float32Array(cap * 3); this.iVel = new Float32Array(cap * 3);
    this.attrs = [
      new THREE.InstancedBufferAttribute(this.iPos, 3), new THREE.InstancedBufferAttribute(this.iData, 4),
      new THREE.InstancedBufferAttribute(this.iColor, 3), new THREE.InstancedBufferAttribute(this.iVel, 3),
    ];
    ['iPos', 'iData', 'iColor', 'iVel'].forEach((n, i) => { this.attrs[i].setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, this.attrs[i]); });
    g.instanceCount = 0;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6); // positions are world space, cull nothing
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: look === 'spark' ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uSpark: { value: look === 'spark' ? 1 : 0 },
        uAmbient: { value: new THREE.Color(0.5, 0.52, 0.62) },
        uKeyColor: { value: new THREE.Color(0.16, 0.12, 0.2) },
        uTailPos: { value: new THREE.Vector3(0, -1000, 0) },
        uTailColor: { value: new THREE.Color(1.0, 0.08, 0.06) },
        fogColor: { value: new THREE.Color(0x0b0a18) }, fogNear: { value: 1e5 }, fogFar: { value: 2e5 },
      },
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = look === 'spark' ? 11 : 10;
    this.mesh.name = look === 'spark' ? 'fx-sparks' : 'fx-particles';
    this.alive = new Uint8Array(cap); this.mode = new Uint8Array(cap);
    this.t = new Float32Array(cap); this.life = new Float32Array(cap);
    this.p = new Float32Array(cap * 3); this.v = new Float32Array(cap * 3); this.o = new Float32Array(cap * 3);
    this.a = new Float32Array(cap * A_STRIDE); this.col = new Float32Array(cap * 3);
    this.size = new Float32Array(cap); this.alpha = new Float32Array(cap); this.seed = new Float32Array(cap);
  }

  /** Ring allocation: when full, the oldest slot is recycled (bounded cost, never allocates). */
  spawn(mode: number, life: number, r: number, g: number, b: number): number {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    this.alive[i] = 1; this.mode[i] = mode; this.t[i] = 0; this.life[i] = life;
    this.o[i * 3] = this.o[i * 3 + 1] = this.o[i * 3 + 2] = 0;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.seed[i] = Math.random();
    this.size[i] = 0.1; this.alpha[i] = 0;
    return i;
  }

  /** Pack live particles (with alpha > 0) into the instance buffers. Call once per frame after simulating. */
  upload(sx = 0, sy = 0, sz = 0, stretchS = 0) {
    let n = 0;
    for (let i = 0; i < this.cap; i++) {
      if (!this.alive[i] || this.alpha[i] <= 0.003) continue;
      const k = n * 3, j = n * 4, q = i * 3;
      this.iPos[k] = this.p[q] + this.o[q] + sx; this.iPos[k + 1] = this.p[q + 1] + this.o[q + 1] + sy; this.iPos[k + 2] = this.p[q + 2] + this.o[q + 2] + sz;
      this.iData[j] = this.size[i]; this.iData[j + 1] = this.alpha[i]; this.iData[j + 2] = this.seed[i]; this.iData[j + 3] = stretchS;
      this.iColor[k] = this.col[q]; this.iColor[k + 1] = this.col[q + 1]; this.iColor[k + 2] = this.col[q + 2];
      this.iVel[k] = this.v[q]; this.iVel[k + 1] = this.v[q + 1]; this.iVel[k + 2] = this.v[q + 2];
      n++;
    }
    this.count = n;
    const g = this.mesh.geometry as THREE.InstancedBufferGeometry;
    g.instanceCount = n;
    if (n) for (const at of this.attrs) { at.clearUpdateRanges(); at.addUpdateRange(0, n * at.itemSize); at.needsUpdate = true; }
  }

  setFog(fog: THREE.Fog | THREE.FogExp2 | null) {
    const u = this.material.uniforms;
    if (fog && (fog as THREE.Fog).isFog) {
      const f = fog as THREE.Fog;
      u.fogColor.value.copy(f.color); u.fogNear.value = f.near; u.fogFar.value = f.far;
    } else if (fog) {
      u.fogColor.value.copy(fog.color); u.fogNear.value = 0; u.fogFar.value = 2.5 / (fog as THREE.FogExp2).density;
    } else { u.fogNear.value = 1e5; u.fogFar.value = 2e5; }
  }

  clear() { this.alive.fill(0); this.count = 0; (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = 0; }

  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); this.mesh.removeFromParent(); }
}
