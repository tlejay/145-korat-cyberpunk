// M2 landmarks: Thao Suranari monument + Ya Mo plaza, Chumphon Gate + city wall, the moat (water shader,
// stone banks, fountains), NW corner gate, Phon Saen colonial row, Chomsurang Hotel, Sa Kaeo pond,
// Wat Sutthachinda gate, Terminal 21 skyline. See docs/dev/REPORT-M2-landmarks-3d.md.
//
// Hook-up (streetscape owns src/track/index.ts):
//   const lm = buildLandmarks(raw, { surfaceAt });   // after decodeTrack/makeLookups
//   lm.landmarks.hideLegacy(built.root);            // hides M1 water/banks (+ old landmarks group if added)
//   built.root.add(lm);
//   in track.update(dt, camera): lm.landmarks.update(dt, camera, viewDist)
//   in the quality hook:          lm.landmarks.setQuality(q.tier)
//   skip OSM/synthetic buildings whose centroid is inside lm.landmarks.claimed[*].ring
import * as THREE from 'three';
import type { RawTrack } from '../data.js';
import type { Quality, Surface, Vec2 } from '../../types.js';
import { buildMoat } from './moat.js';
import { buildSignAtlas, createLandmarkMaterials, setWaterLights, type LandmarkMaterials } from './materials.js';
import { buildSecondary } from './sites.js';
import type { Site } from './site.js';
import { buildYamo } from './yamo.js';

export interface LandmarksHandle {
  monumentLight: THREE.PointLight;
  statue: THREE.Mesh;
  skyline: THREE.Group;              // re-projected inside the far plane by update()
  skylineAnchor: THREE.Vector3;
  water: THREE.Mesh[];               // moat + pond (M3: set materials.water.uniforms.uReflect / uReflectAmt)
  materials: LandmarkMaterials;
  claimed: { id: string; ring: Vec2[] }[];
  /** Buildings from track-A.json whose centroid is inside a claimed footprint should not be drawn. */
  claims(x: number, z: number): boolean;
  stats: { meshes: number; triangles: number; sites: Record<string, { meshes: number; triangles: number }> };
  setQuality(tier: Quality): void;
  update(dt: number, camera: THREE.Camera, viewDist?: number): void;
  hideLegacy(trackRoot: THREE.Object3D): void;
  dispose(): void;
}
export type LandmarksGroup = THREE.Group & { landmarks: LandmarksHandle };

function pointIn(x: number, z: number, ring: Vec2[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function buildLandmarks(raw: RawTrack, opts: { surfaceAt?: (x: number, z: number) => Surface; quality?: Quality } = {}): LandmarksGroup {
  const m = createLandmarkMaterials();
  const signRow = buildSignAtlas(m.sign, [
    { text: 'โรงแรมจอมสุรางค์', fg: '#ffffff', bg: '#111114' },
    { text: 'ประตูชุมพล', fg: '#3a1c08', bg: '#f2c94c', border: '#7a4a12' },
  ]);
  const root = new THREE.Group() as LandmarksGroup;
  root.name = 'landmarks-m2';

  const free = (x: number, z: number) => !opts.surfaceAt || opts.surfaceAt(x, z) === 'blocked';
  const yamo = buildYamo(raw, m, signRow, free);
  const moat = buildMoat(raw);
  const sec = buildSecondary(raw, opts.surfaceAt ?? null, signRow);

  const built: { name: string; group: THREE.Group; center: THREE.Vector3; radius: number; halo: THREE.Points | null; jets: THREE.Mesh | null }[] = [];
  const water: THREE.Mesh[] = [];
  const stats = { meshes: 0, triangles: 0, sites: {} as Record<string, { meshes: number; triangles: number }> };
  const addSite = (s: Site, parent: THREE.Object3D) => {
    const b = s.build(m);
    parent.add(b.group);
    if (b.water) water.push(b.water);
    built.push({ name: s.name, group: b.group, center: b.center, radius: b.radius, halo: b.halo, jets: b.jets });
    stats.meshes += b.meshes;
    stats.triangles += b.tris;
    stats.sites[s.name] = { meshes: b.meshes, triangles: Math.round(b.tris) };
  };
  addSite(yamo.site, root);
  addSite(moat.site, root);
  for (const s of sec.sites) addSite(s, root);

  // Terminal 21: drawn without fog and re-projected inside the far plane (same as M1 world)
  const skyline = new THREE.Group();
  skyline.name = 'skyline-t21';
  const anchor = sec.skyline.anchor;
  {
    const b = sec.skyline.site.build(m);
    for (const child of [...b.group.children]) {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) continue;
      mesh.material = mesh.name.endsWith('glow') ? m.skyGlow : m.skyline;
      mesh.geometry.translate(-anchor.x, 0, -anchor.z);
      mesh.geometry.computeBoundingSphere();
      mesh.matrixAutoUpdate = true;
      skyline.add(mesh);
    }
    stats.meshes += b.meshes;
    stats.triangles += b.tris;
    stats.sites.t21 = { meshes: b.meshes, triangles: Math.round(b.tris) };
  }
  skyline.position.copy(anchor);
  root.add(skyline);

  setWaterLights(m, [
    { pos: new THREE.Vector3(raw.landmarks.monument.x - 2, 5.5, raw.landmarks.monument.z), color: new THREE.Color(0xffd29a) },
    { pos: yamo.gateCenter, color: new THREE.Color(0xffc46b).multiplyScalar(0.8) },
    ...sec.waterLights,
  ]);

  const claimed = [
    { id: 'yamo-plaza', ring: yamo.claimed[0] }, { id: 'chumphon-gate', ring: yamo.claimed[1] },
    ...sec.claimed,
  ];

  let tier: Quality = opts.quality ?? 'mid';
  let time = 0;
  const tmp = new THREE.Vector3();
  const handle: LandmarksHandle = {
    monumentLight: yamo.monumentLight,
    statue: yamo.statue,
    skyline, skylineAnchor: anchor, water, materials: m, claimed, stats,
    claims: (x, z) => claimed.some((c) => pointIn(x, z, c.ring)),
    setQuality(q) {
      tier = q;
      const low = q === 'low';
      yamo.monumentLight.visible = !low;
      m.bronze.emissive.setHex(low ? 0x3a2410 : 0x160c04);
      m.flood.value = low ? 0.55 : 0.42;
      m.water.uniforms.uDetail.value = q === 'high' ? 1 : low ? 0 : 0.6;
      for (const b of built) { if (b.halo) b.halo.visible = !low; }
    },
    update(dt, camera, viewDist) {
      time += dt;
      m.water.uniforms.uTime.value = time;
      const vd = viewDist ?? (tier === 'low' ? 260 : tier === 'mid' ? 420 : 650);
      for (const b of built) b.group.visible = camera.position.distanceTo(b.center) - b.radius < vd;
      // fountains shimmer
      for (const b of built) if (b.jets) b.jets.scale.y = 1 + Math.sin(time * 3.1 + b.center.x) * 0.04;
      // re-project the far skyline inside the far plane (never clipped, same screen size)
      const far = (camera as THREE.PerspectiveCamera).far ?? 1000;
      const dist = tmp.copy(anchor).sub(camera.position).length();
      const k = Math.min(1, (far * 0.85) / dist);
      skyline.position.copy(camera.position).addScaledVector(tmp.normalize(), dist * k);
      skyline.position.y = camera.position.y + (0 - camera.position.y) * k;
      skyline.scale.setScalar(k);
    },
    hideLegacy(trackRoot) {
      trackRoot.traverse((o) => {
        if (o === root || !o.parent) return;
        let p: THREE.Object3D | null = o;
        while (p) { if (p === root) return; p = p.parent; }
        if (o.name === 'water' || o.name === 'moat-banks' || o.name === 'landmarks' || o.name === 'skyline') o.visible = false;
      });
    },
    dispose() {
      root.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.geometry) mesh.geometry.dispose(); });
      for (const mat of m.all) { const mm = mat as THREE.MeshBasicMaterial; mm.map?.dispose(); mat.dispose(); }
    },
  };
  handle.setQuality(tier);
  root.landmarks = handle;
  return root;
}
