// M3 neon pass: shop-front neon boxes, vertical blade signs, red Chinese lanterns, rooftop
// billboards and gold-shop halos placed on the M2 streetscape anchors (REPORT-M2-streetscape §5).
// 5 draw calls in total. Thai text = canvas + Noto Sans Thai (atlas.ts).
//
// Never on sacred places: anchors near the monument, Chumphon Gate, temples or the royal
// portrait are dropped by `excluded` (CLAUDE.md §2 · BRIEF-visuals §3).
//
// Swinging (pane fx): blades and lanterns are InstancedMeshes with the pivot at the hinge.
//   const n = getNeon();  n.swing.set('lantern', i, rx, rz); …; n.swing.commit();
//   rx/rz = rotation (rad) about the local x / z axes at the hinge. Pivots: n.swing.pivots[kind][i].
import * as THREE from 'three';
import type { Quality, Vec2 } from '../types.js';
import { createBillboardAtlas, createSignAtlas, haloTexture, neonColor, type BillboardAtlas, type SignAtlas } from './atlas.js';
import { frameY, GeoBuilder, hash } from './geo.js';
import { BLADE_TEXTS, NEON_TEXTS } from './texts.js';

export type Anchor = { x: number; y: number; z: number; ang: number; w: number; h: number };
export type NeonAnchors = Record<'blade' | 'gold' | 'lantern' | 'neon' | 'billboard', Anchor[]>;

/** A light source the wet road / moat can reflect (world position, linear colour × intensity). */
export interface LightSrc { x: number; y: number; z: number; color: THREE.Color; kind: 'neon' | 'blade' | 'billboard' | 'gold' | 'lantern' | 'lamp' | 'signal' | 'monument' }

export type SwingKind = 'blade' | 'lantern';
export interface Pivot { x: number; y: number; z: number; ang: number; sy: number }

export interface NeonSystem {
  group: THREE.Group;
  lights: LightSrc[];
  swing: {
    meshes: Record<SwingKind, THREE.InstancedMesh>;
    pivots: Record<SwingKind, Pivot[]>;
    set(kind: SwingKind, i: number, rx: number, rz: number): void;
    commit(): void;
  };
  atlas: SignAtlas;
  billboards: BillboardAtlas;
  stats: { meshes: number; triangles: number; counts: Record<string, number> };
  setQuality(q: Quality): void;
  setReduceFlicker(on: boolean): void;
  update(dt: number): void;
  dispose(): void;
}

let current: NeonSystem | null = null;
export const getNeon = () => current;

const FLICKER_GLSL = /* glsl */ `
  attribute vec2 aFlick;
  uniform float uTime;
  uniform float uFlickAmt;
  float neonFlicker(vec2 f) {
    if (f.x < 0.5) return 1.0;
    float t = uTime + f.y * 17.0;
    if (f.x < 1.5) return 1.0 - uFlickAmt * 0.16 * (0.5 + 0.5 * sin(t * 2.6));
    // "tired tube": smooth dips, components ≤ 1.2 Hz → never more than ~2 dips a second (VIS-04 ≤ 3)
    float n = sin(t * 5.1) * sin(t * 2.3 + 1.7);
    return 1.0 - uFlickAmt * 0.55 * smoothstep(0.5, 0.9, n);
  }`;

function patchFlicker(mat: THREE.MeshBasicMaterial, time: { value: number }, amt: { value: number }, key: string, cell = false) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.uniforms.uFlickAmt = amt;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${FLICKER_GLSL}${cell ? '\nattribute vec4 aCell;' : ''}`)
      .replace('#include <color_vertex>', `#include <color_vertex>\n  vColor *= neonFlicker(aFlick);`);
    if (cell) sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n  vMapUv = mix(aCell.xy, aCell.zw, uv);');
  };
  mat.customProgramCacheKey = () => key;
}

export interface BuildNeonOpts {
  anchors: NeonAnchors;
  excluded: (x: number, z: number) => boolean;
  /** distance from a point to the track centreline — tells which side of a blade is the street */
  centerDist: (x: number, z: number) => number;
  quality: Quality;
}

export function buildNeon(o: BuildNeonOpts): NeonSystem {
  const atlas = createSignAtlas();
  const bb = createBillboardAtlas();
  const time = { value: 0 }, amt = { value: 1 };
  const group = new THREE.Group();
  group.name = 'neon-m3';
  const lights: LightSrc[] = [];
  const counts: Record<string, number> = {};
  const keep = (list: Anchor[], k: string) => {
    const out = list.filter((a) => !o.excluded(a.x, a.z));
    counts[k] = out.length;
    counts[`${k}Dropped`] = list.length - out.length;
    return out;
  };
  const anchors = {
    neon: keep(o.anchors.neon, 'neon'), blade: keep(o.anchors.blade, 'blade'), lantern: keep(o.anchors.lantern, 'lantern'),
    billboard: keep(o.anchors.billboard, 'billboard'), gold: keep(o.anchors.gold, 'gold'),
  };

  const DARK = [0.035, 0.032, 0.045];
  const GLOW = 2.3; // HDR multiplier — above the bloom threshold

  // ── 1. merged static mesh: neon boxes + blade brackets ──
  const sg = new GeoBuilder();
  anchors.neon.forEach((a, i) => {
    const h = hash(i * 7.3 + a.x), cell = Math.floor(h * NEON_TEXTS.length), c = atlas.neon[cell];
    const f = frameY(a.x, a.y, a.z, a.ang);
    const w = Math.max(1.6, a.w), hh = Math.max(0.7, a.h);
    const mode = hash(i * 3.1) < 0.07 ? 2 : hash(i * 5.7) < 0.35 ? 1 : 0;
    sg.box(f, -w / 2, w / 2, -hh / 2, hh / 2, 0, 0.16, atlas.dark, DARK, true);
    sg.quad(f, -w / 2, w / 2, -hh / 2, hh / 2, 0.165, c.rect, [GLOW, GLOW, GLOW], [mode, h * 10]);
    lights.push({ ...pt(f, 0, 0, 0.6), color: neonColor(c.color).multiplyScalar(1.0), kind: 'neon' });
  });

  // ── 2. blades: InstancedMesh, pivot at the top hinge, board hangs down (unit height × sy) ──
  const bladeGeo = (() => {
    const b = new GeoBuilder();
    const f = frameY(0, 0, 0, 0), full = { u0: 0, v0: 0, u1: 1, v1: 1 };
    b.box(f, -0.35, 0.35, -1, 0, -0.06, 0.06, { u0: -1, v0: -1, u1: -1, v1: -1 }, DARK, true);
    b.quad(f, -0.33, 0.33, -0.985, -0.015, 0.062, full, [GLOW, GLOW, GLOW]);
    // back face reads correctly from the other side (u mirrored)
    b.quad(f, -0.33, 0.33, -0.985, -0.015, -0.062, { u0: 1, v0: 0, u1: 0, v1: 1 }, [GLOW, GLOW, GLOW], [0, 0], true);
    return b.build(false);
  })();
  const bladeMat = new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, toneMapped: false, side: THREE.DoubleSide });
  patchFlicker(bladeMat, time, amt, 'neon-blade', true);
  const nb = anchors.blade.length;
  const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, Math.max(1, nb));
  blades.count = nb;
  blades.name = 'neon-blades';
  const aCell = new Float32Array(Math.max(1, nb) * 4), aFlick = new Float32Array(Math.max(1, nb) * 2);
  const bladePivots: Pivot[] = [];
  anchors.blade.forEach((a, i) => {
    // board centre is 0.75 m off the wall along local ±x — put the bracket on the wall side
    const lx = Math.cos(a.ang), lz = -Math.sin(a.ang);
    const wallOnPlus = o.centerDist(a.x + lx * 0.75, a.z + lz * 0.75) > o.centerDist(a.x - lx * 0.75, a.z - lz * 0.75);
    const ang = wallOnPlus ? a.ang + Math.PI : a.ang; // after this the wall is always on local −x
    const top = a.y + a.h / 2;
    bladePivots.push({ x: a.x, y: top, z: a.z, ang, sy: a.h });
    const h = hash(i * 11.7 + a.z), cell = Math.floor(h * BLADE_TEXTS.length), c = atlas.blade[cell];
    // atlas cell is vertical: map local v (board height) to the cell's long side
    aCell.set([c.rect.u0, c.rect.v0, c.rect.u1, c.rect.v1], i * 4);
    aFlick.set([hash(i * 2.9) < 0.08 ? 2 : hash(i * 4.3) < 0.3 ? 1 : 0, h * 10], i * 2);
    // fixed bracket from the wall to the hinge (in the static mesh)
    const f = frameY(a.x, top, a.z, ang);
    sg.box(f, -0.78, 0, 0.02, 0.09, -0.03, 0.03, atlas.dark, [0.08, 0.08, 0.09]);
    lights.push({ ...pt(f, 0, -a.h / 2, 0), color: neonColor(c.color).multiplyScalar(0.8), kind: 'blade' });
  });
  bladeGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 4));
  bladeGeo.setAttribute('aFlick', new THREE.InstancedBufferAttribute(aFlick, 2));

  const signMat = new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, toneMapped: false, side: THREE.DoubleSide });
  patchFlicker(signMat, time, amt, 'neon-signs');
  const signs = new THREE.Mesh(sg.build(), signMat);
  signs.name = 'neon-signs';

  // ── 3. lanterns: InstancedMesh, pivot at the cord top ──
  const CORD = 0.3;
  const lanternGeo = lanternGeometry(0.2, 0.5, CORD);
  const lanternMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const nl = anchors.lantern.length;
  const lanterns = new THREE.InstancedMesh(lanternGeo, lanternMat, Math.max(1, nl));
  lanterns.count = nl;
  lanterns.name = 'neon-lanterns';
  const lanternPivots: Pivot[] = [];
  anchors.lantern.forEach((a) => {
    const top = a.y + a.h / 2 + CORD;
    lanternPivots.push({ x: a.x, y: top, z: a.z, ang: 0, sy: 1 });
    lights.push({ x: a.x, y: a.y, z: a.z, color: new THREE.Color(1.0, 0.18, 0.08).multiplyScalar(0.55), kind: 'lantern' });
  });

  // ── 4. billboards (rooftop, 10 × 4 m) + gold-shop halos ──
  const bg = new GeoBuilder();
  const bbDark = { u0: 4 / 1024, u1: 6 / 1024, v0: 1 - 1010 / 1024, v1: 1 - 1008 / 1024 };
  anchors.billboard.forEach((a, i) => {
    const f = frameY(a.x, a.y, a.z, a.ang), w = a.w, h = a.h, c = bb.cells[i % bb.cells.length];
    bg.box(f, -w / 2 - 0.2, w / 2 + 0.2, 0.9, 0.9 + h + 0.3, -0.35, 0, bbDark, DARK, true);
    bg.quad(f, -w / 2, w / 2, 1.05, 1.05 + h, 0.01, c.rect, [1.6, 1.6, 1.6]);
    for (const u of [-w * 0.35, 0, w * 0.35]) bg.box(f, u - 0.08, u + 0.08, -0.6, 0.95, -0.25, -0.1, bbDark, [0.06, 0.06, 0.07]);
    // lamp bar along the top edge
    bg.box(f, -w / 2, w / 2, 1.2 + h, 1.3 + h, 0.05, 0.4, bbDark, [2.4, 2.2, 1.9]);
    lights.push({ ...pt(f, 0, 1 + h / 2, 0.5), color: neonColor(c.color).multiplyScalar(1.4), kind: 'billboard' });
  });
  const bbMat = new THREE.MeshBasicMaterial({ map: bb.texture, vertexColors: true, toneMapped: false, side: THREE.DoubleSide });
  const billboards = new THREE.Mesh(bg.build(false), bbMat);
  billboards.name = 'neon-billboards';

  const hg = new GeoBuilder();
  const full = { u0: 0, v0: 0, u1: 1, v1: 1 };
  anchors.gold.forEach((a) => {
    const f = frameY(a.x, a.y, a.z, a.ang);
    hg.quad(f, -a.w / 2 - 0.9, a.w / 2 + 0.9, -a.h / 2 - 0.8, a.h / 2 + 0.8, 0.06, full, [0.55, 0.32, 0.08]);
    lights.push({ ...pt(f, 0, 0, 0.5), color: new THREE.Color(1.0, 0.55, 0.15).multiplyScalar(0.7), kind: 'gold' });
  });
  const haloMat = new THREE.MeshBasicMaterial({
    map: haloTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const halos = new THREE.Mesh(hg.build(false), haloMat);
  halos.name = 'neon-gold-halos';

  for (const m of [signs, blades, lanterns, billboards, halos]) {
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    group.add(m);
  }
  // instanced meshes span the whole loop — culled as a whole would be pointless
  blades.frustumCulled = lanterns.frustumCulled = false;

  // instance matrices
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), P = new THREE.Vector3(), Sc = new THREE.Vector3();
  const pivots = { blade: bladePivots, lantern: lanternPivots };
  const meshes = { blade: blades, lantern: lanterns };
  const set = (kind: SwingKind, i: number, rx: number, rz: number) => {
    const p = pivots[kind][i];
    if (!p) return;
    E.set(rx, p.ang, rz);
    Q.setFromEuler(E);
    M.compose(P.set(p.x, p.y, p.z), Q, Sc.set(1, p.sy, 1));
    meshes[kind].setMatrixAt(i, M);
  };
  bladePivots.forEach((_, i) => set('blade', i, 0, 0));
  lanternPivots.forEach((_, i) => set('lantern', i, 0, 0));
  // warm colour variation per lantern
  lanternPivots.forEach((_, i) => lanterns.setColorAt(i, new THREE.Color().setScalar(0.85 + hash(i * 9.1) * 0.3)));
  blades.instanceMatrix.needsUpdate = lanterns.instanceMatrix.needsUpdate = true;

  let tris = 0;
  for (const m of [signs, billboards, halos]) tris += (m.geometry.index?.count ?? 0) / 3;
  tris += ((bladeGeo.index?.count ?? 0) / 3) * nb + ((lanternGeo.index?.count ?? 0) / 3) * nl;

  const sys: NeonSystem = {
    group, lights, atlas, billboards: bb,
    swing: {
      meshes, pivots, set,
      commit() { blades.instanceMatrix.needsUpdate = true; lanterns.instanceMatrix.needsUpdate = true; },
    },
    stats: { meshes: 5, triangles: Math.round(tris), counts },
    setQuality(q) {
      // without bloom (low) the HDR colours would clip to flat white — tone them down
      const k = q === 'low' ? 0.62 : 1;
      for (const m of [signMat, bladeMat, lanternMat, bbMat]) m.color.setScalar(k);
      haloMat.opacity = q === 'low' ? 0.7 : 1;
    },
    setReduceFlicker(on) { amt.value = on ? 0 : 1; },
    update(dt) { time.value += dt; },
    dispose() {
      for (const m of [signs, blades, lanterns, billboards, halos]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
      atlas.texture.dispose();
      bb.texture.dispose();
      haloMat.map?.dispose();
      if (current === sys) current = null;
    },
  };
  sys.setQuality(o.quality);
  current = sys;
  return sys;
}

function pt(f: ReturnType<typeof frameY>, u: number, v: number, w: number) {
  return {
    x: f.o[0] + f.x[0] * u + f.z[0] * w,
    y: f.o[1] + v,
    z: f.o[2] + f.x[2] * u + f.z[2] * w,
  };
}

// Paper lantern: red ribbed body (lathe), dark-gold caps, cord on top, tassel below. Origin = cord top.
function lanternGeometry(r: number, h: number, cord: number): THREE.BufferGeometry {
  const seg = 10, prof: [number, number, number][] = []; // [radius, y, colourIndex]
  const top = -cord;
  prof.push([0.012, 0, 2], [0.012, top, 2]);
  prof.push([r * 0.45, top, 1], [r * 0.5, top - 0.04, 1]);
  for (let k = 0; k <= 6; k++) {
    const t = k / 6, y = top - 0.04 - t * (h - 0.08);
    prof.push([r * (0.55 + 0.45 * Math.sin(Math.PI * t)), y, 0]);
  }
  prof.push([r * 0.5, top - h + 0.04, 1], [r * 0.45, top - h, 1], [0.03, top - h - 0.02, 3], [0.05, top - h - 0.22, 3], [0.001, top - h - 0.24, 3]);
  const cols = [
    (y: number) => { const t = Math.abs((y - (top - h / 2)) / (h / 2)); return [2.0 - t * 0.9, 0.28 - t * 0.12, 0.1]; }, // body glow
    () => [0.32, 0.2, 0.05], () => [0.05, 0.04, 0.03], () => [1.4, 0.2, 0.08],
  ];
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (let i = 0; i < prof.length; i++) {
    const [rr, y, ci] = prof[i];
    const c = cols[ci](y);
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      col.push(c[0], c[1], c[2]);
    }
  }
  for (let i = 0; i + 1 < prof.length; i++) {
    for (let s = 0; s < seg; s++) {
      const a = i * seg + s, b = i * seg + ((s + 1) % seg), c = a + seg, d = b + seg;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Sacred-place filter: monument / gate / temples / royal portrait (CLAUDE.md §2). */
export function sacredFilter(monument: Vec2, rings: { id: string; ring: Vec2[] }[], monumentR = 75, marginM = 18) {
  const SACRED = /yamo|chumphon|gate|wat|sutth|temple|shrine|portrait|lak-mueang|provincial/i;
  const zones = rings.filter((r) => SACRED.test(r.id)).map((r) => {
    let cx = 0, cz = 0;
    for (const p of r.ring) { cx += p.x; cz += p.z; }
    cx /= r.ring.length; cz /= r.ring.length;
    let rad = 0;
    for (const p of r.ring) rad = Math.max(rad, Math.hypot(p.x - cx, p.z - cz));
    return { cx, cz, r: rad + marginM };
  });
  return (x: number, z: number) =>
    Math.hypot(x - monument.x, z - monument.z) < monumentR || zones.some((zn) => Math.hypot(x - zn.cx, z - zn.cz) < zn.r);
}
