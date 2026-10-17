// GPU rain (BRIEF-visuals §4): one LineSegments of streaks that wrap inside a box around the camera.
// All motion is in the vertex shader (no per-frame CPU work besides 4 uniforms). Streaks lean with
// the wind and stretch with the camera's own speed so driving fast feels like driving into the rain.
import * as THREE from 'three';
import type { Quality } from '../types.js';

const VERT = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  attribute vec4 aSeed;          // xyz = position in box (0..1), w = 0 head / 1 tail
  uniform vec3 uCam; uniform vec3 uBox; uniform float uTime; uniform float uFall;
  uniform vec2 uWind; uniform vec3 uVel; uniform float uLen;
  varying float vAlpha;
  void main() {
    vec3 p = aSeed.xyz * uBox;
    float speedVar = 0.8 + 0.4 * fract(aSeed.x * 37.0 + aSeed.z * 11.0);
    p.y -= uTime * uFall * speedVar;
    p.xz += uWind * uTime;
    p = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5;   // relative to camera, wrapped
    vec3 rel = vec3(uWind.x, -uFall * speedVar, uWind.y) - uVel;  // drop velocity seen from the camera
    float len = uLen * (1.0 + length(uVel) * 0.025);
    p -= aSeed.w * normalize(rel) * len;
    vec3 world = p + uCam;
    vec4 mvPosition = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float d = length(p);
    vAlpha = smoothstep(0.6, 2.5, d) * (1.0 - smoothstep(uBox.x * 0.32, uBox.x * 0.5, d)) * (1.0 - aSeed.w * 0.85);
    #include <fog_vertex>
  }`;

const FRAG = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uColor; uniform float uOpacity;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity * vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

const COUNT: Record<Quality, number> = { low: 2200, mid: 4500, high: 9000 };

export class Rain {
  readonly mesh: THREE.LineSegments;
  private mat: THREE.ShaderMaterial;
  private max = COUNT.high;
  private t = 0;
  private last = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  intensity = 1;

  constructor() {
    const n = this.max, seed = new Float32Array(n * 8);
    let s = 1234567;
    const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let i = 0; i < n; i++) {
      const x = rnd(), y = rnd(), z = rnd();
      seed.set([x, y, z, 0, x, y, z, 1], i * 8);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    // dummy position attribute (three.js needs it for bounds); real positions come from the shader
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, fog: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(44, 26, 44) }, uTime: { value: 0 },
        uFall: { value: 11 }, uWind: { value: new THREE.Vector2(1.6, 0.9) }, uVel: { value: new THREE.Vector3() },
        uLen: { value: 0.55 }, uColor: { value: new THREE.Color(0.55, 0.62, 0.8) }, uOpacity: { value: 0.26 },
      }]),
    });
    this.mesh = new THREE.LineSegments(g, this.mat);
    this.mesh.name = 'rain';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  setQuality(q: Quality) {
    const n = COUNT[q];
    this.mesh.geometry.setDrawRange(0, n * 2);
    this.mat.uniforms.uOpacity.value = q === 'low' ? 0.5 : 0.26;
  }

  setWind(x: number, z: number) { (this.mat.uniforms.uWind.value as THREE.Vector2).set(x, z); }

  update(dt: number, camera: THREE.Camera) {
    this.t += dt;
    const u = this.mat.uniforms;
    const cp = camera.position;
    if (dt > 0) {
      // camera velocity (smoothed) — the streak tilt
      this.vel.lerp(this.tmp.subVectors(cp, this.last).divideScalar(dt).clampLength(0, 80), Math.min(1, dt * 8));
    }
    this.last.copy(cp);
    (u.uCam.value as THREE.Vector3).copy(cp);
    (u.uVel.value as THREE.Vector3).copy(this.vel);
    u.uTime.value = this.t;
    this.mesh.visible = this.intensity > 0;
  }

  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); }
}
