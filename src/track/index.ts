// World pane entry: loadTrack('A', scene) — real roads/moat/buildings of the Korat moat loop
// built from public/data/track-A.json (scripts/build-track.mjs). See docs/dev/REPORT-M1-world.md.
import * as THREE from 'three';
import { getQuality, onQuality } from '../game/quality.js';
import { setupNight } from '../scene/night.js';
import type { Quality, Track, Vec2 } from '../types.js';
import { decodeTrack, makeLookups, toRing, type RawTrack, type TrackData, type Wall } from './data.js';
import { buildLandmarks } from './landmarks.js';
import { createMaterials } from './materials.js';
import { buildTrackMeshes } from './meshes.js';

// kind = what car-physics / QA expect (REPORT-M1-car-physics: 'monument' = soft bounce, no sparks/shake);
// style = what it looks like (conductor naming). h = collider height in metres (Infinity = never jumpable).
export type Barrier = {
  a: Vec2; b: Vec2; h: number;
  kind: 'wall' | 'barrier' | 'building' | 'monument';
  style: 'rail' | 'neon' | 'building' | 'invisible';
};

// Extra data for game-ui / QA / minimap beyond the shared Track contract.
export interface TrackExtras {
  data: TrackData;
  walls: Wall[];
  corners: RawTrack['corners'];
  roadNames: RawTrack['roadNames'];
  moatJumpLines: { takeoff: [Vec2, Vec2]; landing: [Vec2, Vec2]; landingPoly: Vec2[] };
  stats: { meshes: number; triangles: number };
  monument: { x: number; y: number; z: number };
  toLatLng(x: number, z: number): { lat: number; lng: number };
  fromLatLng(lat: number, lng: number): Vec2;
}

let lastExtras: TrackExtras | null = null;
export const getTrackExtras = () => lastExtras;

const cache = new Map<string, Promise<RawTrack>>();
export function fetchTrackData(id: 'A'): Promise<RawTrack> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/track-${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`track ${id}: HTTP ${r.status}`);
      return r.json() as Promise<RawTrack>;
    });
    p.catch(() => cache.delete(id)); // allow "ลองใหม่"
    cache.set(id, p);
  }
  return p;
}

const qTier = (): Quality => getQuality().tier;

export async function loadTrack(id: 'A', scene: THREE.Scene): Promise<Track> {
  const raw = await fetchTrackData(id);
  const data = decodeTrack(raw);
  const mats = createMaterials();
  const built = buildTrackMeshes(data, mats);
  const lm = buildLandmarks(raw, mats);
  built.root.add(lm.group);
  const night = setupNight(scene, qTier());
  scene.add(built.root);

  // Quality: fog/view distance + monument key light (mid/high only, low uses emissive).
  let viewDist = getQuality().viewDistM;
  const applyQ = () => {
    const q = getQuality();
    viewDist = q.viewDistM;
    night.setQuality(q.tier);
    lm.monumentLight.visible = q.tier !== 'low';
    mats.landmark.emissive.setHex(q.tier === 'low' ? 0x4a3418 : 0x2a1d0c);
  };
  applyQ();
  const offQ = onQuality(applyQ);
  built.root.userData.dispose = () => offQ();

  const { surfaceAt, heightAt } = makeLookups(data, raw.water.level);
  const v = (x: number, z: number): Vec2 => ({ x: x * 0.1, z: z * 0.1 });
  const cps = raw.checkpoints.map((c, i) => ({ id: i, a: v(c[0], c[1]), b: v(c[2], c[3]), trackM: c[4] }));
  const KIND = ['wall', 'barrier', 'wall', 'building', 'monument'] as const;
  const STYLE = ['rail', 'neon', 'rail', 'building', 'invisible'] as const;
  const barriers: Barrier[] = data.walls.map((w) => ({ a: w.a, b: w.b, h: w.h, kind: KIND[w.kind], style: STYLE[w.kind] }));

  const tmp = new THREE.Vector3();
  const skyFar = new THREE.Vector3();
  const update = (_dt: number, camera: THREE.Camera) => {
    night.update(camera);
    // chunk LOD: hide chunks entirely beyond the view distance
    for (const c of built.chunks) c.group.visible = camera.position.distanceTo(c.center) - c.radius < viewDist;
    // re-project the far skyline inside the far plane (same screen size, never clipped)
    const far = (camera as THREE.PerspectiveCamera).far ?? 1000;
    const dist = tmp.copy(lm.skylineAnchor).sub(camera.position).length();
    const k = Math.min(1, (far * 0.85) / dist);
    skyFar.copy(camera.position).addScaledVector(tmp.normalize(), dist * k);
    lm.skyline.position.copy(skyFar);
    lm.skyline.position.y = camera.position.y + (0 - camera.position.y) * k;
    lm.skyline.scale.setScalar(k);
  };

  const lat0 = 14.974731, lon0 = 102.098117;
  lastExtras = {
    data, walls: data.walls, corners: raw.corners, roadNames: raw.roadNames, stats: built.stats,
    moatJumpLines: {
      takeoff: toRing(raw.moatJump.takeoffLine) as [Vec2, Vec2], landing: toRing(raw.moatJump.landingLine) as [Vec2, Vec2],
      landingPoly: toRing(raw.moatJump.landingPoly),
    },
    monument: { x: raw.landmarks.monument.x, y: 0, z: raw.landmarks.monument.z },
    toLatLng: (x, z) => ({ lat: lat0 - z / 110574, lng: lon0 + x / 107550 }),
    fromLatLng: (lat, lng) => ({ x: (lng - lon0) * 107550, z: -(lat - lat0) * 110574 }),
  };

  const centerline = data.samples.map((s) => ({ x: s.x, z: s.z }));
  const last = cps[cps.length - 1];
  const track: Track & { extras: TrackExtras } = {
    id: 'A',
    root: built.root,
    startGrid: { x: raw.startGrid.x, y: 0, z: raw.startGrid.z, heading: raw.startGrid.heading },
    finishLine: { a: last.a, b: last.b },
    checkpoints: cps,
    barriers,
    heightAt,
    surfaceAt,
    zones: { noBoostNoJump: raw.zones.map(toRing) },
    moatJump: { takeoff: raw.moatJump.takeoff, landing: raw.moatJump.landing, widthM: raw.moatJump.widthM },
    update,
    centerline,
    lengthM: raw.lengthM,
    altGroup: raw.altGroup,
    extras: lastExtras,
  };
  return track;
}
