// Post-processing for the cyberpunk pass (BRIEF-visuals §1): HDR scene → soft-threshold bright pass →
// dual-filter bloom (down/up chain) → ACES tone mapping + sRGB + light vignette in one final pass.
// high: bloom from ½ res (3 down + 3 up) · mid: from ¼ res (2 + 2) · low: no post at all — the
// renderer draws straight to the screen with ACES in the materials.
// Draw calls per frame: high 8 · mid 6 (fullscreen triangles) on top of the scene.
import * as THREE from 'three';
import type { Quality } from '../types.js';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT = /* glsl */ `
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; uniform float uKnee;
  varying vec2 vUv;
  vec3 sampleKaris(vec2 uv) { vec3 c = texture2D(tSrc, uv).rgb; return c; }
  void main() {
    // 4-tap box downsample of the full-res scene, then a soft-knee threshold
    vec3 c = 0.25 * (sampleKaris(vUv + uTexel * vec2(-1.0, -1.0)) + sampleKaris(vUv + uTexel * vec2(1.0, -1.0))
                   + sampleKaris(vUv + uTexel * vec2(-1.0, 1.0)) + sampleKaris(vUv + uTexel * vec2(1.0, 1.0)));
    float br = max(c.r, max(c.g, c.b));
    float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    float w = max(soft, br - uThreshold) / max(br, 1e-4);
    c = min(c * w, vec3(24.0)); // clamp fireflies
    gl_FragColor = vec4(c, 1.0);
  }`;

// Dual-filter (Kawase) down / up samples.
const DOWN = /* glsl */ `
  uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
  void main() {
    vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
    s += texture2D(tSrc, vUv - uTexel).rgb;
    s += texture2D(tSrc, vUv + uTexel).rgb;
    s += texture2D(tSrc, vUv + vec2(uTexel.x, -uTexel.y)).rgb;
    s += texture2D(tSrc, vUv - vec2(uTexel.x, -uTexel.y)).rgb;
    gl_FragColor = vec4(s / 8.0, 1.0);
  }`;
const UP = /* glsl */ `
  uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
  void main() {
    vec2 o = uTexel;
    vec3 s = texture2D(tSrc, vUv + vec2(-o.x * 2.0, 0.0)).rgb;
    s += texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb * 2.0;
    s += texture2D(tSrc, vUv + vec2(0.0, o.y * 2.0)).rgb;
    s += texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb * 2.0;
    s += texture2D(tSrc, vUv + vec2(o.x * 2.0, 0.0)).rgb;
    s += texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb * 2.0;
    s += texture2D(tSrc, vUv + vec2(0.0, -o.y * 2.0)).rgb;
    s += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
    gl_FragColor = vec4(s / 12.0, 1.0);
  }`;

const FINAL = /* glsl */ `
  uniform sampler2D tScene; uniform sampler2D tBloom;
  uniform float uBloom; uniform float uExposure; uniform float uVignette; uniform vec2 uAspect;
  varying vec2 vUv;
  vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
  vec3 aces(vec3 c) { // same curve as three.js ACESFilmicToneMapping, so the low tier (no post) matches
    const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
    const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
    c *= uExposure / 0.6; c = I * c; c = RRTAndODTFit(c); c = O * c; return clamp(c, 0.0, 1.0);
  }
  vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  void main() {
    vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;
    c = toSRGB(aces(c));
    vec2 d = (vUv - 0.5) * uAspect;
    c *= 1.0 - uVignette * smoothstep(0.35, 0.95, length(d));
    gl_FragColor = vec4(c, 1.0);
  }`;

const COPY_FLIP = /* glsl */ `
  uniform sampler2D tSrc; varying vec2 vUv;
  void main() { gl_FragColor = texture2D(tSrc, vec2(vUv.x, 1.0 - vUv.y)); }`;

export interface PostTier { enabled: boolean; scale0: number; levels: number; strength: number; threshold: number; samples: number }
export const POST_TIERS: Record<Quality, PostTier> = {
  low: { enabled: false, scale0: 0, levels: 0, strength: 0, threshold: 1, samples: 0 },
  mid: { enabled: true, scale0: 0.25, levels: 2, strength: 0.75, threshold: 0.95, samples: 2 },
  high: { enabled: true, scale0: 0.5, levels: 3, strength: 0.85, threshold: 0.9, samples: 4 },
};
export const EXPOSURE = 1.15;

export class PostFX {
  private quad: THREE.Mesh;
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private scene = new THREE.Scene();
  private sceneRT: THREE.WebGLRenderTarget | null = null;
  private chain: THREE.WebGLRenderTarget[] = [];
  private mats: { bright: THREE.ShaderMaterial; down: THREE.ShaderMaterial; up: THREE.ShaderMaterial; final: THREE.ShaderMaterial; copy: THREE.ShaderMaterial };
  private tier: PostTier = POST_TIERS.mid;
  private w = 1;
  private h = 1;
  private type: THREE.TextureDataType;
  vignette = 0.32;

  constructor(private renderer: THREE.WebGLRenderer) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.mats = {
      bright: mk(BRIGHT, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 }, uKnee: { value: 0.5 } }),
      down: mk(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }),
      up: mk(UP, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }),
      final: mk(FINAL, {
        tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.8 }, uExposure: { value: EXPOSURE },
        uVignette: { value: 0.32 }, uAspect: { value: new THREE.Vector2(1, 1) },
      }),
      copy: mk(COPY_FLIP, { tSrc: { value: null } }),
    };
    this.mats.up.blending = THREE.AdditiveBlending; // up-sample adds onto the next larger level
    this.quad = new THREE.Mesh(geo, this.mats.final);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    // HDR targets need float colour buffers; fall back to 8-bit (bloom still works, softer)
    const ext = renderer.extensions;
    this.type = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
  }

  get enabled() { return this.tier.enabled; }
  get hdr() { return this.type === THREE.HalfFloatType; }

  setQuality(q: Quality) {
    this.tier = POST_TIERS[q];
    this.renderer.toneMapping = this.tier.enabled ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = EXPOSURE;
    this.alloc();
  }

  setSize(w: number, h: number) {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    this.alloc();
  }

  private disposeTargets() {
    this.sceneRT?.dispose();
    this.sceneRT = null;
    for (const t of this.chain) t.dispose();
    this.chain = [];
  }

  private alloc() {
    this.disposeTargets();
    if (!this.tier.enabled) return;
    const opts = { type: this.type, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false };
    // phones: MSAA ×2 max on the HDR target (×4 at DPR 2 costs ~100 MB of VRAM — PERF-09)
    const samples = matchMedia('(pointer: coarse)').matches ? Math.min(2, this.tier.samples) : this.tier.samples;
    this.sceneRT = new THREE.WebGLRenderTarget(this.w, this.h, { ...opts, depthBuffer: true, samples });
    let s = this.tier.scale0;
    for (let i = 0; i <= this.tier.levels; i++) {
      this.chain.push(new THREE.WebGLRenderTarget(Math.max(1, Math.round(this.w * s)), Math.max(1, Math.round(this.h * s)), opts));
      s *= 0.5;
    }
    (this.mats.final.uniforms.uAspect.value as THREE.Vector2).set(this.w / this.h, 1);
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null, clear = true) {
    this.quad.material = mat;
    const r = this.renderer;
    r.setRenderTarget(target);
    if (clear) r.clear(true, false, false);
    r.render(this.scene, this.cam);
  }

  /** Renders the frame. Returns the scene target size used (for screen-space effects). */
  render(scene: THREE.Scene, camera: THREE.Camera) {
    const r = this.renderer;
    if (!this.tier.enabled || !this.sceneRT) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera);
    const autoClear = r.autoClear;
    r.autoClear = false;
    const m = this.mats, c = this.chain;
    m.bright.uniforms.tSrc.value = this.sceneRT.texture;
    // tap offset so the 4 bilinear taps cover the whole footprint of one target pixel
    const off = (1 / this.tier.scale0 - 1) * 0.5;
    (m.bright.uniforms.uTexel.value as THREE.Vector2).set(off / this.w, off / this.h);
    m.bright.uniforms.uThreshold.value = this.tier.threshold;
    this.pass(m.bright, c[0]);
    for (let i = 1; i < c.length; i++) {
      m.down.uniforms.tSrc.value = c[i - 1].texture;
      (m.down.uniforms.uTexel.value as THREE.Vector2).set(1 / c[i - 1].width, 1 / c[i - 1].height);
      this.pass(m.down, c[i]);
    }
    for (let i = c.length - 1; i > 0; i--) {
      m.up.uniforms.tSrc.value = c[i].texture;
      (m.up.uniforms.uTexel.value as THREE.Vector2).set(0.5 / c[i].width, 0.5 / c[i].height);
      this.pass(m.up, c[i - 1], false);
    }
    m.final.uniforms.tScene.value = this.sceneRT.texture;
    m.final.uniforms.tBloom.value = c[0].texture;
    m.final.uniforms.uBloom.value = this.tier.strength / Math.max(1, c.length - 1);
    m.final.uniforms.uVignette.value = this.vignette;
    this.pass(m.final, null);
    r.autoClear = autoClear;
  }

  /** Copies `src` into `dst` flipped vertically (moat reflection helper). */
  copyFlip(src: THREE.Texture, dst: THREE.WebGLRenderTarget) {
    this.mats.copy.uniforms.tSrc.value = src;
    const prev = this.renderer.getRenderTarget();
    this.pass(this.mats.copy, dst);
    this.renderer.setRenderTarget(prev);
  }

  dispose() {
    this.disposeTargets();
    for (const m of Object.values(this.mats)) m.dispose();
    this.quad.geometry.dispose();
  }
}
