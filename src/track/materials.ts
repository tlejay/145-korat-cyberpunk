// Shared materials for the track. Everything uses vertex colours so a whole chunk
// (road, kerbs, markings, rails…) is one draw call per material.
import * as THREE from 'three';

// Facade atlas: 8×8 window cells per tile. One cell = 3.0 m wide × 3.4 m (one floor).
export const WIN_CELL_W = 3.0, WIN_CELL_H = 3.4, WIN_CELLS = 8;

function canvasTex(draw: (g: CanvasRenderingContext2D, s: number) => void, size = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Deterministic PRNG so every player sees the same lit windows.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TrackMaterials {
  surface: THREE.MeshLambertMaterial;  // asphalt, kerbs, sidewalks, markings, rails (vertex colours)
  facade: THREE.MeshLambertMaterial;   // buildings + fences with window atlas
  neon: THREE.MeshBasicMaterial;       // emissive strips / barriers (unlit, bright)
  water: THREE.MeshPhongMaterial;
  ground: THREE.MeshLambertMaterial;
  landmark: THREE.MeshLambertMaterial; // gate / monument terrace / plaza, vertex colours, slightly self-lit
  bronze: THREE.MeshStandardMaterial;  // the statue only
  skyline: THREE.MeshBasicMaterial;    // far towers (Terminal 21) — no fog
  all: THREE.Material[];
}

export function createMaterials(): TrackMaterials {
  const r = rng(145);
  const cell = 256 / WIN_CELLS;
  const facadeMap = canvasTex((g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < WIN_CELLS; i++) for (let j = 0; j < WIN_CELLS; j++) {
      const x = i * cell, y = j * cell;
      g.fillStyle = '#2a2d3a';
      g.fillRect(x + cell * 0.18, y + cell * 0.22, cell * 0.64, cell * 0.5);
      g.fillStyle = '#d8d8d8'; // slab line
      g.fillRect(x, y + cell * 0.9, cell, cell * 0.1);
    }
  });
  const litMap = canvasTex((g, s) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    const tints = ['#ffcf8a', '#ffe2b0', '#ffd27a', '#bfe8ff', '#ff9ad5', '#9dfcff'];
    for (let i = 0; i < WIN_CELLS; i++) for (let j = 0; j < WIN_CELLS; j++) {
      if (r() > 0.38) continue;
      g.fillStyle = tints[r() < 0.75 ? Math.floor(r() * 3) : 3 + Math.floor(r() * 3)];
      g.globalAlpha = 0.55 + r() * 0.45;
      g.fillRect(i * cell + cell * 0.18, j * cell + cell * 0.22, cell * 0.64, cell * 0.5);
    }
    g.globalAlpha = 1;
  });

  const surface = new THREE.MeshLambertMaterial({ vertexColors: true });
  const facade = new THREE.MeshLambertMaterial({
    vertexColors: true, map: facadeMap, emissiveMap: litMap, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.85,
  });
  const neon = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const water = new THREE.MeshPhongMaterial({ color: 0x0a1426, specular: 0x6688cc, shininess: 90, emissive: 0x03060d });
  const ground = new THREE.MeshLambertMaterial({ color: 0x15141c });
  const landmark = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color(0x2a1d0c) });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x7a5a2e, metalness: 0.75, roughness: 0.35, emissive: 0x2a1a06 });
  const skyline = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, map: litMap });
  return { surface, facade, neon, water, ground, landmark, bronze, skyline, all: [surface, facade, neon, water, ground, landmark, bronze, skyline] };
}
