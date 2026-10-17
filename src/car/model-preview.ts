// Turntable preview for the car model (QA: ?qa=1&view=car). Self-contained:
// own renderer, lights and bloom; drag to orbit, wheels and fans spin.
// Wire-up (main.ts, game-ui):  if (qa && view === 'car') import('./car/model-preview.js').then(m => m.mountCarPreview(canvas))
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildCarModel, carModelStats } from './model.js';

export interface CarPreview {
  /** Orbit angle in degrees (0 = straight behind, 90 = right side), elevation in degrees. */
  setView(azimuthDeg: number, elevationDeg?: number, distance?: number): void;
  setAutoRotate(on: boolean): void;
  stats(): { triangles: number; drawCalls: number; rendererCalls: number; rendererTriangles: number };
  dispose(): void;
}

declare global {
  interface Window { __carPreview?: CarPreview }
}

export function mountCarPreview(canvas: HTMLCanvasElement): CarPreview {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#07070d');
  scene.fog = new THREE.Fog('#07070d', 12, 40);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight('#9aa6ff', '#2a1d32', 1.4));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(-4, 7, 5);
  key.shadow.camera.left = key.shadow.camera.bottom = -4;
  key.shadow.camera.right = key.shadow.camera.top = 4;
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const rimPink = new THREE.PointLight('#ff2fa8', 4, 10);
  rimPink.position.set(4, 2, -3);
  scene.add(rimPink);
  const rimCyan = new THREE.PointLight('#22e6ff', 3, 10);
  rimCyan.position.set(-5, 1.5, -2);
  scene.add(rimCyan);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(14, 48),
    new THREE.MeshStandardMaterial({ color: '#15151c', roughness: 0.35, metalness: 0.2 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const model = buildCarModel();
  scene.add(model.root);
  const modelStats = carModelStats(model);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.5, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let az = 30, el = 14, dist = 7.5, auto = true;
  const target = new THREE.Vector3(0, 0.6, 0);
  const place = () => {
    // az 0 = behind the car (+z, since forward is −z).
    const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
    camera.position.set(Math.sin(a) * Math.cos(e) * dist, target.y + Math.sin(e) * dist, Math.cos(a) * Math.cos(e) * dist);
    camera.lookAt(target);
  };

  const resize = () => {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; auto = false; lx = e.clientX; ly = e.clientY; });
  addEventListener('pointerup', () => { dragging = false; });
  addEventListener('pointermove', (e) => {
    if (!dragging) return;
    az -= (e.clientX - lx) * 0.4;
    el = THREE.MathUtils.clamp(el + (e.clientY - ly) * 0.3, -5, 80);
    lx = e.clientX; ly = e.clientY;
  });
  canvas.addEventListener('wheel', (e) => { dist = THREE.MathUtils.clamp(dist + e.deltaY * 0.01, 3, 20); }, { passive: true });

  const clock = new THREE.Clock();
  let raf = 0;
  let rendererCalls = 0, rendererTriangles = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (auto) az += dt * 12;
    for (const w of Object.values(model.wheels)) w.rotation.x -= dt * 4;
    for (const f of model.fans) f.rotation.z += dt * 18;
    place();
    // Count the car pass alone (composer adds full-screen passes on top).
    renderer.info.autoReset = false;
    renderer.info.reset();
    composer.render();
    rendererCalls = renderer.info.render.calls;
    rendererTriangles = renderer.info.render.triangles;
  };
  loop();

  const api: CarPreview = {
    setView(a, e = el, d = dist) { az = a; el = e; dist = d; auto = false; },
    setAutoRotate(on) { auto = on; },
    stats: () => ({ ...modelStats, rendererCalls, rendererTriangles }),
    dispose() { cancelAnimationFrame(raf); removeEventListener('resize', resize); renderer.dispose(); },
  };
  window.__carPreview = api;
  return api;
}
