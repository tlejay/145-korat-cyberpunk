// Night environment for Korat: gradient sky with city glow + stars, fog, moon/hemisphere light.
// M3: rainy purple-blue haze (no stars through the rain clouds) and an optional panorama from the art
// pane (setPanorama) blended over the gradient. Bloom / rain / wet road live in visuals.ts.
// Idempotent: calling it twice on the same scene reuses the first one.
import * as THREE from 'three';
import type { Quality } from '../types.js';

export interface NightTier { fogNear: number; fogFar: number; hemi: number; moon: number }
export const NIGHT_TIERS: Record<Quality, NightTier> = {
  low: { fogNear: 60, fogFar: 260, hemi: 1.15, moon: 0.55 },
  mid: { fogNear: 90, fogFar: 420, hemi: 1.0, moon: 0.6 },
  high: { fogNear: 120, fogFar: 650, hemi: 1.0, moon: 0.65 },
};

const FOG = 0x1a1534; // rain haze: purple with a little blue

export interface NightEnv {
  sky: THREE.Mesh;
  fog: THREE.Fog;
  setQuality(q: Quality): void;
  update(camera: THREE.Camera): void; // keeps the sky centred on the camera
  /** Equirect / wide panorama (art pane). `amount` 0..1 blends it over the gradient sky. */
  setPanorama(tex: THREE.Texture | null, amount?: number): void;
}

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // always at the far plane
  }`;
const SKY_FRAG = /* glsl */ `
  #include <common>
  varying vec3 vDir;
  uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGlow;
  uniform sampler2D uPano; uniform float uPanoAmt; uniform float uStars;
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  void main() {
    float h = clamp(vDir.y, -0.2, 1.0);
    vec3 c = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
    // sodium/neon city glow hugging the horizon, stronger toward the old town (south-east)
    float glow = exp(-max(h, 0.0) * 9.0) * (0.75 + 0.25 * dot(normalize(vDir.xz + 1e-4), normalize(vec2(0.6, 0.8))));
    c += uGlow * glow * 0.9;
    // sparse stars above 15°
    vec3 q = floor(vDir * 420.0);
    float s = step(0.9975, hash(q)) * smoothstep(0.25, 0.6, h);
    c += vec3(s) * 0.6 * uStars;
    if (uPanoAmt > 0.0 && h > -0.05) {
      // wide panorama: u = azimuth, v = elevation 0..~50° (the art is a horizon band, not a full sphere)
      vec2 uv = vec2(atan(vDir.x, -vDir.z) / 6.2831853 + 0.5, clamp(h / 0.75, 0.0, 1.0) * 0.92 + 0.04);
      vec3 p = texture2D(uPano, uv).rgb;
      c = mix(c, p, uPanoAmt * smoothstep(-0.05, 0.04, h));
    }
    if (h < 0.0) c = mix(uHorizon, vec3(0.03, 0.025, 0.05), smoothstep(0.0, -0.2, h));
    gl_FragColor = vec4(c, 1.0);
    // same output path as every other material: ACES + sRGB on screen (low), linear into the HDR target (post)
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function setupNight(scene: THREE.Scene, quality: Quality = 'mid'): NightEnv {
  const existing = scene.userData.night as NightEnv | undefined;
  if (existing) { existing.setQuality(quality); return existing; }

  // game-ui's placeholder lights are replaced by this environment
  scene.children.filter((o) => o.name === 'engine-fallback-light').forEach((o) => scene.remove(o));
  scene.background = new THREE.Color(FOG);
  const fog = new THREE.Fog(FOG, NIGHT_TIERS[quality].fogNear, NIGHT_TIERS[quality].fogFar);
  scene.fog = fog;

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 12),
    new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x05040d) },
        uHorizon: { value: new THREE.Color(FOG) },
        uGlow: { value: new THREE.Color(0x5a2a5e) },
        uPano: { value: null }, uPanoAmt: { value: 0 }, uStars: { value: 0 },
      },
    }),
  );
  sky.name = 'sky';
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  sky.scale.setScalar(100);
  scene.add(sky);

  // Cool moonlight from the west-north-west, purple sky fill, warm street-light bounce from below.
  const hemi = new THREE.HemisphereLight(0x8a86ff, 0x3a2418, 1.0);
  const moon = new THREE.DirectionalLight(0xb8c6ff, 0.6);
  moon.position.set(-300, 420, -160);
  const amb = new THREE.AmbientLight(0x40384f, 0.6);
  for (const l of [hemi, moon, amb]) { l.name = `night-${l.type}`; scene.add(l); }

  const env: NightEnv = {
    sky, fog,
    setQuality(q) {
      const t = NIGHT_TIERS[q];
      fog.near = t.fogNear; fog.far = t.fogFar;
      hemi.intensity = t.hemi; moon.intensity = t.moon;
    },
    update(camera) { sky.position.copy(camera.position); },
    setPanorama(tex, amount = 0.85) {
      const u = (sky.material as THREE.ShaderMaterial).uniforms;
      u.uPano.value = tex;
      u.uPanoAmt.value = tex ? amount : 0;
    },
  };
  scene.userData.night = env;
  return env;
}
