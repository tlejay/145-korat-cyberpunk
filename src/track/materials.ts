// Shared materials for the track. Everything uses vertex colours so a whole chunk
// (road, kerbs, markings, rails…) is one draw call per material. Landmarks have their own
// (src/track/landmarks/materials.ts).
import * as THREE from 'three';
import { createFacadeAtlas, createPoolTexture, createSignAtlas } from './facade-atlas.js';

export interface TrackMaterials {
  surface: THREE.MeshLambertMaterial;  // asphalt, kerbs, sidewalks, markings, rails (vertex colours)
  facade: THREE.MeshLambertMaterial;   // buildings + fences: procedural facade atlas (facade-atlas.ts)
  cable: THREE.LineBasicMaterial;      // static power cables (M3: physics-cables)
  pool: THREE.MeshBasicMaterial;       // additive street-light spill on the road
  plate: THREE.MeshLambertMaterial;    // street-name plates (Thai, real font)
  neon: THREE.MeshBasicMaterial;       // emissive strips / barriers (unlit, bright)
  water: THREE.MeshPhongMaterial;
  ground: THREE.MeshLambertMaterial;
  all: THREE.Material[];
}

export function createMaterials(signNames: string[] = [], signGreen: number[] = []): TrackMaterials {
  const surface = new THREE.MeshLambertMaterial({ vertexColors: true });
  const atlas = createFacadeAtlas();
  const facade = new THREE.MeshLambertMaterial({
    vertexColors: true, map: atlas.map, emissiveMap: atlas.emissive, emissive: new THREE.Color(0xffffff), emissiveIntensity: 1.0,
  });
  const cable = new THREE.LineBasicMaterial({ color: 0x15151c });
  const pool = new THREE.MeshBasicMaterial({
    map: createPoolTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const signTex = createSignAtlas(signNames, signGreen);
  const plate = new THREE.MeshLambertMaterial({ map: signTex, emissiveMap: signTex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.35 });
  const neon = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const water = new THREE.MeshPhongMaterial({ color: 0x0a1426, specular: 0x6688cc, shininess: 90, emissive: 0x03060d });
  const ground = new THREE.MeshLambertMaterial({ color: 0x15141c });
  return {
    surface, facade, neon, water, ground, cable, pool, plate,
    all: [surface, facade, neon, water, ground, cable, pool, plate],
  };
}
