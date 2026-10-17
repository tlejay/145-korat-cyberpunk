// Wet road (BRIEF-visuals §4): cheap fake reflections instead of a second render.
// - The track's asphalt material gets a shader patch: darker wet tone, sky sheen at grazing angles and
//   long vertical light streaks from the K lights nearest the camera (mirror point under the road,
//   stretched along the view direction — how neon really smears on wet asphalt).
// - Puddles: a few mirror-like ellipses (one mesh) with rain ripples. `puddleAt` is what car-physics
//   reads for hydroplaning (PHYSICS §5.2) — attached to the Track by visuals.ts.
import * as THREE from 'three';
import type { Quality, Surface, Vec2 } from '../types.js';
import type { LightSrc } from '../neon/index.js';

export const MAX_LIGHTS = 8;
export const LIGHTS_PER_TIER: Record<Quality, number> = { low: 3, mid: 6, high: 8 };

/** Shared uniforms (road + puddles). */
export function createWetUniforms() {
  return {
    uLP: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(0, -999, 0)) },
    uLC: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Color(0, 0, 0)) },
    uLN: { value: 0 },
    uWet: { value: 1 },
    uWetTime: { value: 0 },
    uWetSky: { value: new THREE.Color(0x2a2350) },
  };
}
export type WetUniforms = ReturnType<typeof createWetUniforms>;

const STREAKS = /* glsl */ `
  uniform vec3 uLP[${MAX_LIGHTS}];
  uniform vec3 uLC[${MAX_LIGHTS}];
  uniform int uLN;
  uniform float uWet;
  uniform float uWetTime;
  uniform vec3 uWetSky;
  float wetHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wetNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wetHash(i), wetHash(i + vec2(1.0, 0.0)), f.x), mix(wetHash(i + vec2(0.0, 1.0)), wetHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // sharp: lateral width multiplier · len: how much longer the streak is along the view direction
  vec3 wetStreaks(vec3 P, float sharp, float len) {
    vec3 C = cameraPosition;
    vec3 d = normalize(P - C);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      if (i >= uLN) break;
      vec3 M = vec3(uLP[i].x, 2.0 * P.y - uLP[i].y, uLP[i].z);
      vec3 mv = M - C;
      float dist = length(mv);
      vec3 m = mv / dist;
      vec3 side = normalize(cross(m, vec3(0.0, 1.0, 0.0)));
      vec3 diff = d - m;
      float dh = dot(diff, side);
      float dv = dot(diff, cross(side, m));
      float w = 0.22 / dist + 0.003;
      float s = exp(-(dh * dh) / (w * w * sharp) - (dv * dv) / (w * w * len));
      acc += uLC[i] * s * (10.0 / (10.0 + dist * 0.12));
    }
    return acc;
  }`;

/** Patches the track's asphalt/kerb material (MeshLambert, vertex colours) in place. */
export function patchWetSurface(mat: THREE.MeshLambertMaterial, u: WetUniforms) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWetPos;\nvarying vec3 vWetN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vWetPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWetN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWetPos;\nvarying vec3 vWetN;\n${STREAKS}`)
      .replace('#include <opaque_fragment>', `
        float wetMask = uWet * smoothstep(0.7, 0.95, vWetN.y) * (1.0 - smoothstep(0.3, 0.7, vWetPos.y));
        if (wetMask > 0.0) {
          vec3 Vw = normalize(cameraPosition - vWetPos);
          float fres = pow(1.0 - clamp(Vw.y, 0.0, 1.0), 5.0);
          outgoingLight *= mix(1.0, 0.68, wetMask);
          outgoingLight += uWetSky * fres * 0.35 * wetMask;
          float shimmer = 0.55 + 0.45 * wetNoise(vWetPos.xz * 1.9 + vec2(0.0, uWetTime * 0.7));
          outgoingLight += wetStreaks(vWetPos, 1.0, 140.0) * shimmer * wetMask * 0.55;
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'wet-road-m3';
  mat.needsUpdate = true;
}

// ── light picker (no per-frame allocation — PERF-14) ──
export class LightPicker {
  private bi = new Int32Array(MAX_LIGHTS);
  private bs = new Float32Array(MAX_LIGHTS);
  constructor(private u: WetUniforms) {}
  /** Picks up to `k` sources nearest the camera (sources behind the camera count 3× farther). */
  pick(sources: LightSrc[], camera: THREE.Camera, k: number) {
    k = Math.min(k, MAX_LIGHTS);
    const cp = camera.position, e = camera.matrixWorld.elements;
    const fx = -e[8], fz = -e[10];
    const bi = this.bi, bs = this.bs;
    let n = 0;
    for (let i = 0; i < sources.length; i++) {
      const l = sources[i], dx = l.x - cp.x, dz = l.z - cp.z;
      let s = Math.hypot(dx, dz);
      if (s > 160) continue;
      if (dx * fx + dz * fz < 0 && s > 8) s *= 3;
      if (n === k && s >= bs[n - 1]) continue;
      // insertion into the sorted top-k
      let j = n < k ? n++ : n - 1;
      while (j > 0 && bs[j - 1] > s) { bs[j] = bs[j - 1]; bi[j] = bi[j - 1]; j--; }
      bs[j] = s; bi[j] = i;
    }
    const P = this.u.uLP.value, C = this.u.uLC.value;
    for (let j = 0; j < n; j++) { const l = sources[bi[j]]; P[j].set(l.x, l.y, l.z); C[j].copy(l.color); }
    this.u.uLN.value = n;
  }
}

// ── puddles ──
export interface Puddle { x: number; z: number; a: number; b: number; ang: number; s: number }

const PUDDLE_VERT = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  attribute vec2 aLocal;
  varying vec2 vLocal;
  varying vec3 vWetPos;
  void main() {
    vLocal = aLocal;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWetPos = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const PUDDLE_FRAG = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  ${STREAKS}
  uniform float uRipples;
  varying vec2 vLocal;
  varying vec3 vWetPos;
  float ring(vec2 p, float t) {
    vec2 cell = floor(p / 0.7);
    vec2 c = (cell + vec2(wetHash(cell), wetHash(cell + 7.1))) * 0.7;
    float ph = fract(t * 0.9 + wetHash(cell + 3.3));
    float r = length(p - c);
    return smoothstep(0.03, 0.0, abs(r - ph * 0.32)) * (1.0 - ph);
  }
  void main() {
    float e = length(vLocal);
    float alpha = smoothstep(1.0, 0.75, e);
    vec3 V = normalize(cameraPosition - vWetPos);
    float fres = 0.15 + 0.85 * pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
    vec3 col = vec3(0.012, 0.014, 0.025) + uWetSky * fres * 0.9;
    float rip = uRipples > 0.0 ? ring(vWetPos.xz, uWetTime) + ring(vWetPos.xz + 0.35, uWetTime + 0.5) : 0.0;
    col += wetStreaks(vWetPos, 0.06 * (1.0 + rip * 6.0), 2.5) * 1.1;
    col += vec3(0.25, 0.3, 0.4) * rip * 0.35;
    gl_FragColor = vec4(col, alpha * 0.92);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

export interface PuddleSet {
  mesh: THREE.Mesh;
  list: Puddle[];
  at(x: number, z: number): boolean;
  setQuality(q: Quality): void;
}

export function buildPuddles(
  centerline: Vec2[], widthAt: (i: number) => number, surfaceAt: (x: number, z: number) => Surface,
  corners: { s: number }[], avoid: Vec2[], u: WetUniforms,
): PuddleSet {
  // cumulative distance along the centreline
  const n = centerline.length, cum = new Float32Array(n + 1);
  for (let i = 1; i <= n; i++) {
    const a = centerline[i - 1], b = centerline[i % n];
    cum[i] = cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z);
  }
  const L = cum[n];
  const idxAt = (s: number) => {
    s = ((s % L) + L) % L;
    let lo = 0, hi = n;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < s) lo = m + 1; else hi = m; }
    return Math.min(n - 1, lo);
  };
  const hash = (k: number) => { const v = Math.sin(k * 91.7 + 13.1) * 43758.5453; return v - Math.floor(v); };
  // braking zones before each corner + two long straights
  const wanted: number[] = corners.map((c) => c.s - 28);
  const sorted = [...corners.map((c) => c.s)].sort((a, b) => a - b);
  let gapS = 0, gap = 0;
  for (let i = 0; i < sorted.length; i++) {
    const g = (sorted[(i + 1) % sorted.length] - sorted[i] + L) % L;
    if (g > gap) { gap = g; gapS = sorted[i] + g / 2; }
  }
  wanted.push(gapS, gapS + gap * 0.3);
  const list: Puddle[] = [];
  wanted.forEach((s, k) => {
    for (let tryN = 0; tryN < 6 && list.length < 10; tryN++) {
      const ss = s + tryN * 9;
      const i = idxAt(ss), p = centerline[i], q = centerline[(i + 1) % n];
      let tx = q.x - p.x, tz = q.z - p.z;
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl; tz /= tl;
      const side = hash(k * 3 + tryN) < 0.5 ? -1 : 1, half = widthAt(i) / 2;
      const off = side * Math.max(0, half - 1.9 - hash(k + 0.5) * 1.2);
      const x = p.x - tz * off, z = p.z + tx * off;
      const a = 2.4 + hash(k * 7.7) * 2.2, b = 1.1 + hash(k * 5.3) * 0.8, ang = Math.atan2(tx, tz);
      if (avoid.some((v) => Math.hypot(v.x - x, v.z - z) < 70)) continue;
      const pts = [[0, 0], [a, 0], [-a, 0], [0, b], [0, -b]];
      const ok = pts.every(([u, v]) => surfaceAt(x + tx * u - tz * v, z + tz * u + tx * v) === 'road');
      if (ok) { list.push({ x, z, a, b, ang, s: ss }); break; }
    }
  });

  // geometry: 16-gon fan per puddle, aLocal = ellipse-space coords (|aLocal| = 1 on the rim)
  const pos: number[] = [], loc: number[] = [], idx: number[] = [];
  const SEG = 16, Y = 0.045;
  for (const pd of list) {
    const base = pos.length / 3, tx = Math.sin(pd.ang), tz = Math.cos(pd.ang);
    pos.push(pd.x, Y, pd.z);
    loc.push(0, 0);
    for (let k = 0; k < SEG; k++) {
      const t = (k / SEG) * Math.PI * 2, wob = 1 + 0.12 * Math.sin(t * 3 + pd.x);
      const uu = Math.cos(t) * pd.a * wob, vv = Math.sin(t) * pd.b * wob;
      pos.push(pd.x + tx * uu - tz * vv, Y, pd.z + tz * uu + tx * vv);
      loc.push(Math.cos(t), Math.sin(t));
      idx.push(base, base + 1 + ((k + 1) % SEG), base + 1 + k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aLocal', new THREE.Float32BufferAttribute(loc, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    vertexShader: PUDDLE_VERT, fragmentShader: PUDDLE_FRAG, fog: true, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), ...u, uRipples: { value: 1 } },
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'puddles';
  mesh.renderOrder = 2;

  const at = (x: number, z: number) => {
    for (const pd of list) {
      const dx = x - pd.x, dz = z - pd.z;
      if (dx * dx + dz * dz > pd.a * pd.a) continue;
      const tx = Math.sin(pd.ang), tz = Math.cos(pd.ang);
      const uu = (dx * tx + dz * tz) / pd.a, vv = (-dx * tz + dz * tx) / pd.b;
      if (uu * uu + vv * vv <= 1) return true;
    }
    return false;
  };
  return {
    mesh, list, at,
    setQuality(q) { mat.uniforms.uRipples.value = q === 'low' ? 0 : 1; },
  };
}
