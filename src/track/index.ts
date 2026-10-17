// World pane entry: loadTrack('A', scene) — real roads/moat/buildings of the Korat moat loop
// built from public/data/track-A.json (scripts/build-track.mjs). See docs/dev/REPORT-M1-world.md.
import * as THREE from 'three';
import { getQuality, onQuality } from '../game/quality.js';
import { setupNight } from '../scene/night.js';
import type { Quality, Track, Vec2 } from '../types.js';
import { decodeAnchors, decodeTrack, makeLookups, toRing, type RawTrack, type TrackData, type Wall } from './data.js';
import { FONT } from './facade-atlas.js';
import { buildLandmarks } from './landmarks/index.js';
import { createMaterials } from './materials.js';
import { anchorClaimed, buildTrackMeshes } from './meshes.js';

// kind = what car-physics / QA expect (REPORT-M1-car-physics: 'monument' = soft bounce, no sparks/shake);
// style = what it looks like (conductor naming). h = collider height in metres (Infinity = never jumpable).
export type Barrier = {
  a: Vec2; b: Vec2; h: number;
  kind: 'wall' | 'barrier' | 'building' | 'monument' | 'prop';
  style: 'rail' | 'neon' | 'building' | 'invisible';
};

export type Anchor = { x: number; y: number; z: number; ang: number; w: number; h: number };
export type CableSpanM = { ax: number; ay: number; az: number; bx: number; by: number; bz: number; sag: number };

// Extra data for game-ui / QA / minimap beyond the shared Track contract.
export interface TrackExtras {
  data: TrackData;
  walls: Wall[];
  corners: RawTrack['corners'];
  roadNames: RawTrack['roadNames'];
  moatJumpLines: { takeoff: [Vec2, Vec2]; landing: [Vec2, Vec2]; landingPoly: Vec2[] };
  stats: { meshes: number; triangles: number };
  // M2 streetscape → M3: cable spans (physics-cables CableSpan), sign/lantern anchors, street-name plates
  cableSpans: CableSpanM[];
  anchors: Record<'blade' | 'gold' | 'lantern' | 'neon' | 'billboard', Anchor[]>;
  streetSigns: { x: number; z: number; text: string }[];
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
const DETAIL_DIST = { low: 0, mid: 200, high: 320 } as const;

// Street-name plates and gold-shop letters are drawn on canvas with the real Thai font.
async function fontsReady() {
  if (typeof document === 'undefined' || !document.fonts) return;
  const t = new Promise((r) => setTimeout(r, 2500));
  await Promise.race([Promise.all([document.fonts.load(`700 40px ${FONT}`, 'ถนนทอง'), document.fonts.load(`400 20px ${FONT}`, 'ถนน')]), t]).catch(() => undefined);
}

export async function loadTrack(id: 'A', scene: THREE.Scene): Promise<Track> {
  const raw = await fetchTrackData(id);
  const data = decodeTrack(raw);
  await fontsReady();
  const mats = createMaterials(raw.streetscape.signNames, raw.streetscape.signGreen);
  const { surfaceAt, heightAt } = makeLookups(data, raw.water.level);
  // landmarks-3d (src/track/landmarks): monument, plaza, gate, moat water, hotels, pond… — buildings and
  // props inside the footprints it claims are not drawn here (REPORT-M2-landmarks-3d hook-up)
  const lm = buildLandmarks(raw, { surfaceAt, quality: qTier() });
  const built = buildTrackMeshes(data, mats, (x, z) => lm.landmarks.claims(x, z));
  lm.landmarks.hideLegacy(built.root);
  built.root.add(lm);
  const night = setupNight(scene, qTier());
  scene.add(built.root);

  // Quality: fog / view distance, street detail distance, light pools, landmark tiers.
  let viewDist = getQuality().viewDistM, detailDist = DETAIL_DIST[qTier()];
  const applyQ = () => {
    const q = getQuality();
    viewDist = q.viewDistM;
    detailDist = DETAIL_DIST[q.tier];
    built.globals.pools.visible = q.tier !== 'low';
    night.setQuality(q.tier);
    lm.landmarks.setQuality(q.tier);
  };
  applyQ();
  const offQ = onQuality(applyQ);
  built.root.userData.dispose = () => { offQ(); lm.landmarks.dispose(); };

  const v = (x: number, z: number): Vec2 => ({ x: x * 0.1, z: z * 0.1 });
  const cps = raw.checkpoints.map((c, i) => ({ id: i, a: v(c[0], c[1]), b: v(c[2], c[3]), trackM: c[4] }));
  const KIND = ['wall', 'barrier', 'wall', 'building', 'monument', 'prop'] as const;
  const STYLE = ['rail', 'neon', 'rail', 'building', 'invisible', 'invisible'] as const;
  const barriers: Barrier[] = data.walls.map((w) => ({ a: w.a, b: w.b, h: w.h, kind: KIND[w.kind], style: STYLE[w.kind] }));

  const update = (dt: number, camera: THREE.Camera) => {
    night.update(camera);
    // chunk LOD: hide chunks entirely beyond the view distance
    for (const c of built.chunks) {
      const d = camera.position.distanceTo(c.center) - c.radius;
      c.group.visible = d < viewDist;
      if (c.detail) c.detail.visible = d < detailDist; // balconies, roof tanks, parked cars, coils
    }
    lm.landmarks.update(dt, camera, viewDist);
  };

  const lat0 = 14.974731, lon0 = 102.098117;
  lastExtras = {
    data, walls: data.walls, corners: raw.corners, roadNames: raw.roadNames, stats: { meshes: built.stats.meshes + lm.landmarks.stats.meshes, triangles: built.stats.triangles + lm.landmarks.stats.triangles },
    cableSpans: built.cableSpans,
    // anchors on buildings that landmarks-3d replaced are dropped (blade signs use the edge direction,
    // so test both sides of the anchor)
    anchors: Object.fromEntries(Object.entries(raw.anchors).map(([k, v]) => [k, decodeAnchors(v).filter((a) =>
      !anchorClaimed(a, lm.landmarks.claims) && !anchorClaimed({ ...a, ang: a.ang + Math.PI / 2 }, lm.landmarks.claims)
      && !anchorClaimed({ ...a, ang: a.ang - Math.PI / 2 }, lm.landmarks.claims))])) as TrackExtras['anchors'],
    streetSigns: (() => {
      const ss = raw.streetscape, out: TrackExtras['streetSigns'] = [];
      for (let i = 0; i + 3 < ss.signs.length; i += 4) out.push({ x: ss.signs[i] * 0.1, z: ss.signs[i + 1] * 0.1, text: `ถ.${ss.signNames[ss.signs[i + 3]]}` });
      return out;
    })(),
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
    // kind 'prop' (pole / lamp / trunk colliders) is understood by car-physics (WallKind) but not yet
    // listed in src/types.ts (game-ui) — see REPORT-M2-streetscape §ขอให้ pane อื่นทำ
    barriers: barriers as Track['barriers'],
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
