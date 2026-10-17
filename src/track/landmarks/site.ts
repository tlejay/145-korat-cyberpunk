// A "site" = one landmark cluster built into one group with at most one mesh per material,
// so the whole cluster costs a handful of draw calls and is culled as a unit.
import * as THREE from 'three';
import { GeoBuilder } from './kit.js';
import type { LandmarkMaterials } from './materials.js';

export class Site {
  stone = new GeoBuilder();
  lit = new GeoBuilder();
  glow = new GeoBuilder();
  jet = new GeoBuilder();
  sign = new GeoBuilder();
  water = new GeoBuilder();
  halos: number[] = [];
  haloCols: number[] = [];
  extra: THREE.Object3D[] = [];
  constructor(public name: string) {}

  halo(x: number, y: number, z: number, c: THREE.Color, k = 1) {
    this.halos.push(x, y, z);
    this.haloCols.push(c.r * k, c.g * k, c.b * k);
  }

  build(m: LandmarkMaterials): { group: THREE.Group; center: THREE.Vector3; radius: number; tris: number; meshes: number; water: THREE.Mesh | null; halo: THREE.Points | null; jets: THREE.Mesh | null } {
    const group = new THREE.Group();
    group.name = `landmark-${this.name}`;
    const box = new THREE.Box3();
    let tris = 0, meshes = 0;
    let water: THREE.Mesh | null = null, jets: THREE.Mesh | null = null, halo: THREE.Points | null = null;
    const add = (g: GeoBuilder, mat: THREE.Material, tag: string) => {
      if (g.empty) return null;
      const mesh = new THREE.Mesh(g.build(), mat);
      mesh.name = `${this.name}-${tag}`;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      box.union(mesh.geometry.boundingBox!);
      tris += g.pos.length / 9;
      meshes++;
      return mesh;
    };
    add(this.stone, m.stone, 'stone');
    add(this.lit, m.lit, 'lit');
    add(this.glow, m.glow, 'glow');
    add(this.sign, m.sign, 'sign');
    water = add(this.water, m.water, 'water');
    jets = add(this.jet, m.jet, 'jets');
    if (jets) jets.renderOrder = 2;
    if (this.halos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.halos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.haloCols, 3));
      g.computeBoundingSphere();
      halo = new THREE.Points(g, m.halo);
      halo.name = `${this.name}-halos`;
      halo.matrixAutoUpdate = false;
      halo.renderOrder = 3;
      group.add(halo);
      meshes++;
    }
    for (const o of this.extra) {
      group.add(o);
      o.traverse((c) => {
        const mesh = c as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.computeBoundingBox();
        box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld.copy(mesh.matrix)));
        const gg = mesh.geometry;
        tris += (gg.index ? gg.index.count : gg.getAttribute('position').count) / 3;
        meshes++;
      });
    }
    const sphere = box.isEmpty() ? new THREE.Sphere() : box.getBoundingSphere(new THREE.Sphere());
    return { group, center: sphere.center, radius: sphere.radius, tris, meshes, water, halo, jets };
  }
}
