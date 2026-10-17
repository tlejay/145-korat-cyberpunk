// Dev-only harness (not imported by the game): renders the real track + M2 landmarks from fixed
// shots so they can be compared with reference photos. Opened from refs/m2/landmarks-preview.html
// (gitignored) as ?shot=<name>&quality=low|mid|high. Uses the landmarks loadTrack already added, if any.
import * as THREE from 'three';
import { buildCarModel } from '../../car/model.js';
import { getQuality } from '../../game/quality.js';
import { fetchTrackData, loadTrack } from '../index.js';
import { buildLandmarks, type LandmarksGroup } from './index.js';
import type { Track } from '../../types.js';

type Shot = { s?: number; eye?: [number, number, number]; look?: [number, number, number]; side?: number };
export const SHOTS: Record<string, Shot> = {
  'plaza-chase': { s: 3180 },                                  // chase cam passing the plaza, monument on the right
  'plaza-road': { eye: [-38, 1.6, -4], look: [0, 3.2, 0] },     // ≈ plaza-from-ratchadamnoen.png
  'gate-from-plaza': { eye: [6, 2.0, 0.5], look: [26, 6, -1] }, // ≈ trackA-37
  'statue-close': { eye: [-3.6, 5.0, 1.2], look: [0, 4.9, 0] }, // pose check
  'moat-ratchadamnoen': { s: 330 },                             // ≈ ratchadamnoen-05 (moat + fountains, NW gate ahead)
  'nw-gate': { s: 455 },                                        // ≈ trackA-00
  'nw-gate-224': { eye: [-48, 1.6, -583], look: [-32, 5.5, -522] }, // ≈ nw-corner-gate.png
  'phon-saen': { s: 1180 },                                     // ≈ trackA-12b
  'chomsurang': { eye: [600, 22, 112], look: [540, 14, 190] },                                    // ≈ trackA-20
  'sa-kaeo': { s: 2045 },                                       // ≈ trackA-23
  'sutthachinda': { s: 2745 },                                  // ≈ trackA-30
  'pond-side': { eye: [606, 3, 318], look: [565, 2, 395] },
  'moat-water': { eye: [-24, 8, 104], look: [8, -1, 150] },
  'overview': { eye: [-90, 70, 90], look: [10, 0, -20] },
};

export async function mountLandmarksPreview(canvas: HTMLCanvasElement) {
  const params = new URLSearchParams(location.search);
  const shotName = params.get('shot') ?? 'plaza-road';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x07060f);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight, false);
  const scene = new THREE.Scene();
  const q = getQuality();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, q.viewDistM + 50);

  const track = (await loadTrack('A', scene)) as Track & { centerline: { x: number; z: number }[] };
  const raw = await fetchTrackData('A');
  let lm = track.root.getObjectByName('landmarks-m2') as LandmarksGroup | undefined;
  if (!lm) {
    lm = buildLandmarks(raw, { surfaceAt: track.surfaceAt, quality: q.tier });
    lm.landmarks.hideLegacy(track.root);
    track.root.add(lm);
  }

  // QA: nothing solid of ours may stand on a drivable cell
  const bad: string[] = [];
  lm.updateMatrixWorld(true);
  lm.traverse((o: THREE.Object3D) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || /water|jets|halos|sign/.test(mesh.name) || o.parent?.name === 'skyline-t21') return;
    const pos = mesh.geometry.getAttribute('position');
    const e = mesh.matrixWorld.elements;
    for (let i = 0; i < pos.count; i += 3) {
      const x = pos.getX(i) + e[12], y = pos.getY(i) + e[13], z = pos.getZ(i) + e[14];
      if (y < 0.25 || y > 3) continue; // anything a car could hit
      const sfc = track.surfaceAt(x, z);
      if (sfc === 'road' || sfc === 'curb') bad.push(`${mesh.name}@${x.toFixed(1)},${z.toFixed(1)}:${sfc}`);
    }
  });

  const shot = SHOTS[shotName] ?? SHOTS['plaza-road'];
  const car = buildCarModel();
  const carObj = new THREE.Group();
  carObj.add(car.root);
  if (shot.s !== undefined) {
    const cl = track.centerline, n = cl.length, i = Math.round((shot.s / track.lengthM!) * n) % n;
    const a = cl[(i - 2 + n) % n], b = cl[(i + 2) % n], p = cl[i];
    const heading = Math.atan2(b.x - a.x, -(b.z - a.z));
    const fx = Math.sin(heading), fz = -Math.cos(heading);
    carObj.position.set(p.x, 0, p.z);
    carObj.rotation.set(0, -heading, 0);
    scene.add(carObj);
    camera.position.set(p.x - fx * 5.5, 2.0, p.z - fz * 5.5);
    camera.lookAt(p.x + fx * 3, 1.0, p.z + fz * 3);
  } else {
    camera.position.set(...shot.eye!);
    camera.lookAt(...shot.look!);
  }
  camera.updateMatrixWorld();
  // let fog/sky/LOD settle, then measure with and without the M2 landmarks
  track.update?.(0.016, camera);
  lm.landmarks.update(0.5, camera, q.viewDistM);
  renderer.render(scene, camera);
  const withInfo = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  lm.visible = false;
  renderer.render(scene, camera);
  const without = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  lm.visible = true;
  await document.fonts?.ready;
  await new Promise((r) => setTimeout(r, 300));
  renderer.render(scene, camera);
  (window as unknown as { __lm: unknown }).__lm = {
    shot: shotName, quality: q.tier, with: withInfo, without, delta: { calls: withInfo.calls - without.calls, tris: withInfo.tris - without.tris },
    total: lm.landmarks.stats, onDrivable: bad.length, onDrivableSample: [...new Set(bad.map((b) => b.replace(/(\d+)\.\d/g, '$1').replace(/(-?\d+),(-?\d+)/, (_m, a, c) => `${Math.round(+a / 5) * 5},${Math.round(+c / 5) * 5}`)))], ready: true,
  };
}
