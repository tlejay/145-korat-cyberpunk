// Moat reflections (BRIEF-visuals §5) through the landmarks-3d water hook (uReflect / uReflectAmt):
// - all tiers: the water's 6 specular light slots follow the camera (2 fixed: monument + Chumphon
//   Gate, 4 = nearest neon/lamps by the water) — free, just uniforms.
// - high: a ¼-res planar reflection of the *glowing* things only (layer GLOW: neon, lamps, sky,
//   the floodlit statue). Rendered from the mirrored camera, flipped back to screen space.
import * as THREE from 'three';
import type { LandmarksHandle } from '../track/landmarks/index.js';
import type { LightSrc } from '../neon/index.js';
import type { Quality, Surface } from '../types.js';
import type { PostFX } from './post.js';

export const GLOW_LAYER = 3;

export class MoatReflection {
  private rtA: THREE.WebGLRenderTarget | null = null;
  private rtB: THREE.WebGLRenderTarget | null = null;
  private vcam = new THREE.PerspectiveCamera();
  private R = new THREE.Matrix4();
  private S = new THREE.Matrix4().makeScale(1, -1, 1);
  private fixed: { pos: THREE.Vector3; color: THREE.Color }[] = [];
  private nearWater: LightSrc[] = [];
  private bi = new Int32Array(4);
  private bd = new Float64Array(4);
  private tier: Quality = 'mid';
  private size = new THREE.Vector2(1, 1);
  private type: THREE.TextureDataType;

  constructor(private renderer: THREE.WebGLRenderer, private post: PostFX, private lm: LandmarksHandle, private level: number) {
    this.vcam.layers.set(GLOW_LAYER);
    this.vcam.matrixAutoUpdate = false;
    this.vcam.matrixWorldAutoUpdate = false;
    this.R.set(1, 0, 0, 0, 0, -1, 0, 2 * level, 0, 0, 1, 0, 0, 0, 0, 1);
    const u = lm.materials.water.uniforms;
    const P = u.uLightPos.value as THREE.Vector3[], C = u.uLightCol.value as THREE.Color[];
    for (let i = 0; i < 2; i++) this.fixed.push({ pos: P[i].clone(), color: C[i].clone() });
    this.type = post.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  }

  /** Remember which light sources are close enough to the water to show in it. */
  setSources(src: LightSrc[], surfaceAt: (x: number, z: number) => Surface) {
    const near = (l: LightSrc) => {
      for (let r = 4; r <= 22; r += 6) for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        if (surfaceAt(l.x + Math.cos(a) * r, l.z + Math.sin(a) * r) === 'water') return true;
      }
      return false;
    };
    this.nearWater = src.filter(near);
  }

  get nearWaterCount() { return this.nearWater.length; }

  setQuality(q: Quality) {
    this.tier = q;
    this.alloc();
  }

  setSize(w: number, h: number) {
    this.size.set(w, h);
    this.alloc();
  }

  private alloc() {
    this.rtA?.dispose();
    this.rtB?.dispose();
    this.rtA = this.rtB = null;
    const u = this.lm.materials.water.uniforms;
    if (this.tier !== 'high' || !this.post.enabled) { u.uReflectAmt.value = 0; u.uReflect.value = null; return; }
    const w = Math.max(64, Math.round(this.size.x / 4)), h = Math.max(36, Math.round(this.size.y / 4));
    const o = { type: this.type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false };
    this.rtA = new THREE.WebGLRenderTarget(w, h, { ...o, depthBuffer: true });
    this.rtB = new THREE.WebGLRenderTarget(w, h, { ...o, depthBuffer: false });
    u.uReflect.value = this.rtB.texture;
    u.uReflectAmt.value = 0.8;
    (u.uResolution.value as THREE.Vector2).copy(this.size);
  }

  update(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    // dynamic specular slots: 2 fixed + 4 nearest-to-camera sources by the water
    const u = this.lm.materials.water.uniforms;
    const P = u.uLightPos.value as THREE.Vector3[], C = u.uLightCol.value as THREE.Color[];
    for (let i = 0; i < 2; i++) { P[i].copy(this.fixed[i].pos); C[i].copy(this.fixed[i].color); }
    const cp = camera.position, bi = this.bi, bd = this.bd;
    let n = 0;
    for (let i = 0; i < this.nearWater.length; i++) {
      const l = this.nearWater[i], d = (l.x - cp.x) ** 2 + (l.z - cp.z) ** 2;
      if (n < 4) { bi[n] = i; bd[n++] = d; continue; }
      let w = 0;
      for (let k = 1; k < 4; k++) if (bd[k] > bd[w]) w = k;
      if (d < bd[w]) { bi[w] = i; bd[w] = d; }
    }
    for (let i = 2; i < 6; i++) {
      const j = i - 2;
      if (j < n) { const l = this.nearWater[bi[j]]; P[i].set(l.x, l.y, l.z); C[i].copy(l.color).multiplyScalar(0.8); } else { P[i].set(0, -1000, 0); C[i].setRGB(0, 0, 0); }
    }

    if (!this.rtA || !this.rtB) return;
    // skip when the camera is far above / no water is in view — moat is around the whole loop, so
    // just require the camera to be above the water surface
    if (cp.y < this.level + 0.2) return;
    const vc = this.vcam;
    vc.projectionMatrix.copy(camera.projectionMatrix);
    vc.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    vc.matrixWorld.multiplyMatrices(this.R, camera.matrixWorld).multiply(this.S);
    vc.matrixWorldInverse.copy(vc.matrixWorld).invert();
    const r = this.renderer, prev = r.getRenderTarget();
    r.setRenderTarget(this.rtA);
    r.render(scene, vc);
    this.post.copyFlip(this.rtA.texture, this.rtB);
    r.setRenderTarget(prev);
  }

  dispose() {
    this.rtA?.dispose();
    this.rtB?.dispose();
  }
}

/** Puts everything that glows on the reflection layer (and all lights, so lit statues still light up). */
export function tagGlowLayer(root: THREE.Object3D, lm: LandmarksHandle | null) {
  let n = 0;
  root.traverse((o) => {
    const light = (o as THREE.Light).isLight;
    const mesh = o as THREE.Mesh;
    const mat = mesh.material as THREE.Material | undefined;
    const glowMat = !!mat && !Array.isArray(mat) && (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial && mat.toneMapped === false;
    const named = /^neon|^sky$/.test(o.name);
    if (light || glowMat || named) { o.layers.enable(GLOW_LAYER); if (!light) n++; }
  });
  lm?.statue.layers.enable(GLOW_LAYER);
  return n;
}
