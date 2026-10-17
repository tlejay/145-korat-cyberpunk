// Placeholder scene only — the real city/track is built by the scene pane.
import * as THREE from 'three';

export interface SceneHandle {
  renderer: THREE.WebGLRenderer;
  dispose(): void;
}

export function createScene(canvas: HTMLCanvasElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x07060f);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x07060f, 20, 140);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  camera.position.set(0, 6, 18);

  const grid = new THREE.GridHelper(400, 80, 0xff2fa8, 0x22e6ff);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  scene.add(grid);

  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  renderer.setAnimationLoop((t) => {
    grid.position.z = ((t / 1000) * 6) % 5;
    camera.lookAt(0, 2, 0);
    renderer.render(scene, camera);
  });

  return {
    renderer,
    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}

export function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}
