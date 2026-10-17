// Stand-in for the world pane's loadTrack() until src/track/ lands: OSM centerline of
// track A (research/osm/track-A.geojson) as a flat ribbon with neon walls on both sides.
import * as THREE from 'three';
import trackGeo from '../../research/osm/track-A.geojson?raw';
import type { Checkpoint, Track, Vec2 } from '../types.js';
import { LoopPath, fromLatLng } from './path.js';

const HALF_W = 8;       // half road width (m)
const WALL = HALF_W + 1.2;

export async function loadStubTrack(scene: THREE.Scene): Promise<Track> {
  const geo = JSON.parse(trackGeo) as { features: { geometry: { type: string; coordinates: number[][] } }[] };
  const line = geo.features.find((f) => f.geometry.type === 'LineString')!.geometry.coordinates;
  // OSM still has the old westward loop at the Ratchadamnoen head (track_m 520–600); reality is a
  // plain ~95° right turn (Street View round 2) — drop that excursion until the world pane's data lands.
  const pts = line.map(([lng, lat]) => fromLatLng(lat, lng)).filter((p) => !(p.x < -74 && p.z > -575 && p.z < -555));
  const path = new LoopPath(pts, 5);
  const root = new THREE.Group();
  root.name = 'stub-track';

  // Road ribbon + wall ribbons from offset polylines.
  const n = path.pts.length;
  const off = (i: number, d: number): Vec2 => {
    const p = path.pts[i], a = path.pts[(i - 1 + n) % n], b = path.pts[(i + 1) % n];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
    return { x: p.x - (dz / len) * d, z: p.z + (dx / len) * d }; // d > 0 = right side
  };
  const road: number[] = [], wallL: number[] = [], wallR: number[] = [];
  const barriers: Track['barriers'] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const l0 = off(i, -HALF_W), r0 = off(i, HALF_W), l1 = off(j, -HALF_W), r1 = off(j, HALF_W);
    road.push(l0.x, 0, l0.z, r0.x, 0, r0.z, r1.x, 0, r1.z, l0.x, 0, l0.z, r1.x, 0, r1.z, l1.x, 0, l1.z);
    for (const [d, arr] of [[-WALL, wallL], [WALL, wallR]] as const) {
      const a = off(i, d), b = off(j, d);
      arr.push(a.x, 0, a.z, b.x, 0, b.z, b.x, 1.1, b.z, a.x, 0, a.z, b.x, 1.1, b.z, a.x, 1.1, a.z);
      barriers.push({ a, b });
    }
  }
  const mk = (pos: number[], color: number, emissive = false) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const m = emissive
      ? new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
      : new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
    return new THREE.Mesh(g, m);
  };
  root.add(mk(road, 0x1b1a2a));
  root.add(mk(wallL, 0xff2fa8, true));
  root.add(mk(wallR, 0x22e6ff, true));

  // Lane dashes as one line segments object.
  const dash: number[] = [];
  for (let i = 0; i < n; i += 2) {
    const a = path.pts[i], b = path.pts[(i + 1) % n];
    dash.push(a.x, 0.02, a.z, b.x, 0.02, b.z);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.Float32BufferAttribute(dash, 3));
  root.add(new THREE.LineSegments(dg, new THREE.LineBasicMaterial({ color: 0xffc23d })));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: 0x0b0a16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  root.add(ground);

  // Monument placeholder: plaza block + golden pillar, lit, never collidable beyond plaza walls.
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 26), new THREE.MeshLambertMaterial({ color: 0x3a3550 }));
  plaza.position.y = 0.6;
  const statue = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, 9, 8), new THREE.MeshLambertMaterial({ color: 0xe8b84a, emissive: 0x4a3200 }));
  statue.position.y = 5.7;
  root.add(plaza, statue);

  // Simple skyline boxes along the outside, merged into one geometry.
  const boxes: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i += 6) {
    for (const side of [-1, 1]) {
      const p = off(i, side * (WALL + 9));
      const h = 6 + ((i * 7919) % 17);
      const b = new THREE.BoxGeometry(12, h, 12);
      b.translate(p.x, h / 2, p.z);
      boxes.push(b.toNonIndexed());
    }
  }
  root.add(new THREE.Mesh(mergeGeoms(boxes), new THREE.MeshLambertMaterial({ color: 0x1f1d38, emissive: 0x0a0820 })));

  scene.add(root);

  // Checkpoints every ~100 m across the road.
  const checkpoints: Checkpoint[] = [];
  const count = Math.round(path.length / 100);
  for (let k = 1; k <= count; k++) {
    const s = (path.length * k) / count;
    const p = path.at(s);
    const nx = Math.cos(p.heading), nz = Math.sin(p.heading); // right vector
    checkpoints.push({ id: k - 1, trackM: s, a: { x: p.x - nx * WALL, z: p.z - nz * WALL }, b: { x: p.x + nx * WALL, z: p.z + nz * WALL } });
  }
  const finish = checkpoints[checkpoints.length - 1];

  // Start grid: first point along the loop more than 45 m from the monument (outside the plaza zone).
  let gs = 0;
  while (gs < 400) {
    const p = path.at(gs);
    if (Math.hypot(p.x, p.z) > 45) break;
    gs += 2;
  }
  const g = path.at(gs);
  const zone: Vec2[] = Array.from({ length: 16 }, (_, i) => ({ x: Math.cos((i / 16) * Math.PI * 2) * 32, z: Math.sin((i / 16) * Math.PI * 2) * 32 }));

  let lastSeg = -1;
  const distToCenter = (x: number, z: number) => {
    const pr = path.project(x, z, lastSeg);
    lastSeg = pr.seg;
    return pr.dist;
  };
  const moatT = path.at(1170), moatL = path.at(1215);

  return {
    id: 'A',
    root,
    startGrid: { x: g.x, y: 0, z: g.z, heading: g.heading },
    finishLine: { a: finish.a, b: finish.b },
    checkpoints,
    barriers,
    heightAt: () => 0,
    surfaceAt: (x, z) => {
      const d = distToCenter(x, z);
      return d <= HALF_W ? 'road' : d <= WALL ? 'curb' : 'blocked';
    },
    zones: { noBoostNoJump: [zone] },
    moatJump: { takeoff: { x: moatT.x, z: moatT.z }, landing: { x: moatL.x, z: moatL.z }, widthM: 30 },
    centerline: path.pts,
    lengthM: path.length,
    altGroup: null,
  };
}

function mergeGeoms(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0;
  for (const g of list) total += g.getAttribute('position').count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of list) {
    const p = g.getAttribute('position'), nn = g.getAttribute('normal');
    pos.set(p.array as Float32Array, o * 3);
    nor.set(nn.array as Float32Array, o * 3);
    o += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
