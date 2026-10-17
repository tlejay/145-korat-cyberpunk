// Materials owned by the landmarks module (independent of src/track/materials.ts).
// Everything is vertex-coloured so one site = one draw call per material.
import * as THREE from 'three';

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat = true): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Stone/plaster detail texture. Texel (0,0) must stay white: GeoBuilder's default uv is (0.001, 0.001),
// so faces without uv get a flat colour. Grout lines therefore sit in the middle of the tile.
function stoneTexture() {
  return canvasTex(128, (g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    // faint marble mottling
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(150,150,160,${0.03 + r() * 0.05})`;
      g.fillRect(8 + r() * (s - 16), 8 + r() * (s - 16), 2 + r() * 10, 1 + r() * 3);
    }
    g.fillStyle = 'rgba(70,70,80,0.55)';
    g.fillRect(s / 2 - 1, 4, 2, s - 8);
    g.fillRect(4, s / 2 - 1, s - 8, 2);
  });
}

// Soft round glow for lamp halos (Points sprites).
function haloTexture() {
  return canvasTex(64, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.75)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.18)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  }, false);
}

// Floodlit stone: Lambert + warm self-light that is strongest at the foot of the wall
// (night uplights on the gate / monument plinth / temple gates).
function floodlit(mat: THREE.MeshLambertMaterial, strength: number, height: number) {
  const uFlood = { value: strength };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uFlood = uFlood;
    sh.uniforms.uFloodH = { value: height };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vFloodY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvFloodY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFloodY;\nuniform float uFlood;\nuniform float uFloodH;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float fl = 0.35 + 0.65 * (1.0 - smoothstep(0.0, uFloodH, vFloodY));
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.78, 0.5) * uFlood * fl;`);
  };
  mat.customProgramCacheKey = () => `floodlit-${height}`;
  return uFlood;
}

const WATER_VERT = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

// Simple night water: procedural ripples, fresnel toward the city-glow sky, sharp specular
// streaks from up to 6 point lights. uReflect/uReflectAmt are the M3 hook for a planar reflection.
const WATER_FRAG = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uSky;
  uniform vec3 uLightPos[6];
  uniform vec3 uLightCol[6];
  uniform float uDetail;
  uniform sampler2D uReflect;
  uniform float uReflectAmt;
  uniform vec2 uResolution;
  varying vec3 vWorld;
  vec2 waves(vec2 p, float t) {
    vec2 d = vec2(0.0);
    d += vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6)) * 0.9 + t * 1.1) * 0.05;
    d += vec2(-0.5, 0.86) * cos(dot(p, vec2(-0.5, 0.86)) * 1.7 + t * 1.6) * 0.035;
    d += vec2(0.2, -0.98) * cos(dot(p, vec2(0.2, -0.98)) * 3.1 + t * 2.3) * 0.02 * uDetail;
    d += vec2(0.95, 0.3) * cos(dot(p, vec2(0.95, 0.3)) * 5.3 + t * 3.0) * 0.012 * uDetail;
    return d;
  }
  void main() {
    vec2 w = waves(vWorld.xz, uTime);
    vec3 n = normalize(vec3(-w.x, 1.0, -w.y));
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 4.0);
    vec3 col = mix(uDeep, uSky, fres);
    for (int i = 0; i < 6; i++) {
      vec3 Lv = uLightPos[i] - vWorld;
      float d = length(Lv);
      vec3 H = normalize(Lv / d + V);
      float s = pow(max(dot(n, H), 0.0), 90.0);
      col += uLightCol[i] * s * (6.0 / (1.0 + d * 0.06));
    }
    if (uReflectAmt > 0.0) {
      vec2 suv = gl_FragCoord.xy / uResolution + n.xz * 0.04;
      col = mix(col, texture2D(uReflect, suv).rgb, uReflectAmt * fres);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }`;

export interface LandmarkMaterials {
  stone: THREE.MeshLambertMaterial;     // plaster, brick, roofs, foliage (vertex colours + stone texture)
  lit: THREE.MeshLambertMaterial;       // floodlit sacred stone (gate, plinth, temple gates)
  bronze: THREE.MeshStandardMaterial;   // the statue only
  glow: THREE.MeshBasicMaterial;        // lamps, lit windows, garlands (unlit, toneMapped off)
  halo: THREE.PointsMaterial;           // soft lamp halos
  jet: THREE.MeshBasicMaterial;         // fountain jets (additive)
  water: THREE.ShaderMaterial;
  sign: THREE.MeshBasicMaterial;        // Thai text signs (canvas, real font)
  skyline: THREE.MeshBasicMaterial;     // Terminal 21, no fog
  skyGlow: THREE.MeshBasicMaterial;
  flood: { value: number };
  rim: { value: THREE.Color };
  all: THREE.Material[];
}

export function createLandmarkMaterials(): LandmarkMaterials {
  const tex = stoneTexture();
  const stone = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex, emissive: new THREE.Color(0x1a1610) });
  const lit = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex, emissive: new THREE.Color(0x000000) });
  const flood = floodlit(lit, 0.42, 14);

  // Bronze: dark gold-brown metal, warm key light + soft warm rim so the silhouette reads at night.
  const bronze = new THREE.MeshStandardMaterial({ color: 0x5a3c22, metalness: 0.6, roughness: 0.42, emissive: 0x160c04 });
  const rim = { value: new THREE.Color(0xffc070).multiplyScalar(0.32) };
  bronze.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = rim;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
      .replace('#include <opaque_fragment>', `
        float rimF = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.2);
        outgoingLight += uRim * rimF;
        #include <opaque_fragment>`);
  };
  bronze.customProgramCacheKey = () => 'bronze-rim';

  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const halo = new THREE.PointsMaterial({
    size: 2.4, map: haloTexture(), vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true,
  });
  const jet = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });

  const lightPos = Array.from({ length: 6 }, () => new THREE.Vector3(0, -1000, 0));
  const lightCol = Array.from({ length: 6 }, () => new THREE.Color(0, 0, 0));
  const water = new THREE.ShaderMaterial({
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uDeep: { value: new THREE.Color(0x08111f) }, uSky: { value: new THREE.Color(0x3a2c5c) },
      uLightPos: { value: lightPos }, uLightCol: { value: lightCol }, uDetail: { value: 1 },
      uReflect: { value: null }, uReflectAmt: { value: 0 }, uResolution: { value: new THREE.Vector2(1, 1) },
    }]),
  });
  const sign = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true });
  const skyline = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const skyGlow = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false });
  return {
    stone, lit, bronze, glow, halo, jet, water, sign, skyline, skyGlow, flood, rim,
    all: [stone, lit, bronze, glow, halo, jet, water, sign, skyline, skyGlow],
  };
}

// Sets the water's specular light list (max 6). M3 can call this again with neon sources.
export function setWaterLights(m: LandmarkMaterials, lights: { pos: THREE.Vector3; color: THREE.Color }[]) {
  const P = m.water.uniforms.uLightPos.value as THREE.Vector3[];
  const C = m.water.uniforms.uLightCol.value as THREE.Color[];
  for (let i = 0; i < 6; i++) {
    const l = lights[i];
    if (l) { P[i].copy(l.pos); C[i].copy(l.color); } else { P[i].set(0, -1000, 0); C[i].setRGB(0, 0, 0); }
  }
}

// Thai text signs drawn with the real game font (CLAUDE.md: never let imagegen write Thai).
// One atlas texture, rows of 1024×128; redrawn once Noto Sans Thai has loaded.
export interface SignRow { text: string; fg: string; bg: string; border?: string }
export function buildSignAtlas(mat: THREE.MeshBasicMaterial, rows: SignRow[]) {
  const W = 1024, H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H * rows.length;
  const g = c.getContext('2d')!;
  const draw = () => {
    g.clearRect(0, 0, W, c.height);
    rows.forEach((r, i) => {
      const y = i * H;
      g.fillStyle = r.bg;
      g.fillRect(0, y, W, H);
      if (r.border) { g.strokeStyle = r.border; g.lineWidth = 10; g.strokeRect(6, y + 6, W - 12, H - 12); }
      g.fillStyle = r.fg;
      g.font = '700 80px "Noto Sans Thai", "Thonburi", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(r.text, W / 2, y + H * 0.54, W - 60);
    });
    tex.needsUpdate = true;
  };
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  mat.map = tex;
  draw();
  document.fonts?.load('700 80px "Noto Sans Thai"').then(draw).catch(() => { /* keep fallback font */ });
  // uv rectangle of row i
  return (i: number) => ({ u0: 0, u1: 1, v0: 1 - (i + 1) / rows.length, v1: 1 - i / rows.length });
}
