// Tiny geometry builder for the neon pass: boxes/quads with per-vertex uv rect + colour + flicker,
// merged into one BufferGeometry per material (one draw call).
import * as THREE from 'three';
import type { Rect } from './atlas.js';

export type V3 = [number, number, number];
export type Frame = { o: V3; x: V3; y: V3; z: V3 }; // origin + unit axes (local → world)

export const frameY = (x: number, y: number, z: number, ang: number): Frame => ({
  o: [x, y, z],
  x: [Math.cos(ang), 0, -Math.sin(ang)],
  y: [0, 1, 0],
  z: [Math.sin(ang), 0, Math.cos(ang)],
});

export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export class GeoBuilder {
  pos: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  flick: number[] = [];
  idx: number[] = [];

  private at(f: Frame, u: number, v: number, w: number): V3 {
    return [
      f.o[0] + f.x[0] * u + f.y[0] * v + f.z[0] * w,
      f.o[1] + f.x[1] * u + f.y[1] * v + f.z[1] * w,
      f.o[2] + f.x[2] * u + f.y[2] * v + f.z[2] * w,
    ];
  }

  /** Quad in the local plane w = const, spanning u0..u1 × v0..v1, facing +w (or −w when back). */
  quad(f: Frame, u0: number, u1: number, v0: number, v1: number, w: number, r: Rect, c: THREE.Color | number[], fl: [number, number] = [0, 0], back = false) {
    const base = this.pos.length / 3;
    const pts = back
      ? [this.at(f, u1, v0, w), this.at(f, u0, v0, w), this.at(f, u0, v1, w), this.at(f, u1, v1, w)]
      : [this.at(f, u0, v0, w), this.at(f, u1, v0, w), this.at(f, u1, v1, w), this.at(f, u0, v1, w)];
    const uvs = [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]];
    const cc = Array.isArray(c) ? c : [c.r, c.g, c.b];
    for (let i = 0; i < 4; i++) {
      this.pos.push(...pts[i]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(cc[0], cc[1], cc[2]);
      this.flick.push(fl[0], fl[1]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Axis-aligned box in a local frame: u0..u1, v0..v1, w0..w1. One rect/colour for all faces. */
  box(f: Frame, u0: number, u1: number, v0: number, v1: number, w0: number, w1: number, r: Rect, c: THREE.Color | number[], skipFront = false) {
    if (!skipFront) this.quad(f, u0, u1, v0, v1, w1, r, c);
    this.quad(f, u0, u1, v0, v1, w0, r, c, [0, 0], true);
    // sides: build with rotated frames
    const side = (o: V3, x: V3, y: V3, z: V3, a0: number, a1: number, b0: number, b1: number, d: number) =>
      this.quad({ o, x, y, z }, a0, a1, b0, b1, d, r, c);
    const { x, y, z } = f;
    const nx: V3 = [-x[0], -x[1], -x[2]], nz: V3 = [-z[0], -z[1], -z[2]], ny: V3 = [-y[0], -y[1], -y[2]];
    side(f.o, nz, y, x, -w1, -w0, v0, v1, u1);       // +u side
    side(f.o, z, y, nx, w0, w1, v0, v1, -u0);        // −u side
    side(f.o, x, nz, y, u0, u1, -w1, -w0, v1);       // top
    side(f.o, x, z, ny, u0, u1, w0, w1, -v0);        // bottom
  }

  build(withFlicker = true): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (withFlicker) g.setAttribute('aFlick', new THREE.Float32BufferAttribute(this.flick, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }

  get triangles() { return this.idx.length / 3; }
}
