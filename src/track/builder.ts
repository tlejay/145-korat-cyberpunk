// Tiny non-indexed geometry accumulator: everything of one material in one chunk
// goes into one BufferGeometry (= one draw call).
import * as THREE from 'three';

export type V3 = [number, number, number];

export class GeoBuilder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  uv: number[] = [];

  get empty() { return this.pos.length === 0; }

  tri(a: V3, b: V3, c: V3, color: THREE.Color, uvs?: [number, number][], n?: V3) {
    let nx: number, ny: number, nz: number;
    if (n) [nx, ny, nz] = n;
    else {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
    }
    for (const [k, p] of [a, b, c].entries()) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.col.push(color.r, color.g, color.b);
      const t = uvs?.[k] ?? [0.001, 0.001];
      this.uv.push(t[0], t[1]);
    }
  }

  // Quad a-b-c-d, counter-clockwise seen from the side the normal points to.
  quad(a: V3, b: V3, c: V3, d: V3, color: THREE.Color, uvs?: [number, number][], n?: V3) {
    this.tri(a, b, c, color, uvs && [uvs[0], uvs[1], uvs[2]], n);
    this.tri(a, c, d, color, uvs && [uvs[0], uvs[2], uvs[3]], n);
  }

  // Quad whose front face points along `want` (flips the winding if needed).
  quadN(a: V3, b: V3, c: V3, d: V3, color: THREE.Color, want: V3, uvs?: [number, number][]) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * want[0] + ny * want[1] + nz * want[2] >= 0) this.quad(a, b, c, d, color, uvs);
    else this.quad(d, c, b, a, color, uvs && [uvs[3], uvs[2], uvs[1], uvs[0]]);
  }

  // Triangle forced to face up (+y) — roofs, pads, water.
  triUp(a: V3, b: V3, c: V3, color: THREE.Color, uvs?: [number, number][]) {
    const cr = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (cr >= 0) this.tri(a, b, c, color, uvs, [0, 1, 0]);
    else this.tri(a, c, b, color, uvs && [uvs[0], uvs[2], uvs[1]], [0, 1, 0]);
  }

  // Axis-free box between two ground points (a→b), thickness t, from y0 to y1.
  wallBox(ax: number, az: number, bx: number, bz: number, t: number, y0: number, y1: number, color: THREE.Color, top?: THREE.Color) {
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1;
    const nx = (dz / l) * (t / 2), nz = (-dx / l) * (t / 2);
    const p = (x: number, z: number, y: number): V3 => [x, y, z];
    const a0 = p(ax + nx, az + nz, y0), b0 = p(bx + nx, bz + nz, y0), a1 = p(ax + nx, az + nz, y1), b1 = p(bx + nx, bz + nz, y1);
    const c0 = p(ax - nx, az - nz, y0), d0 = p(bx - nx, bz - nz, y0), c1 = p(ax - nx, az - nz, y1), d1 = p(bx - nx, bz - nz, y1);
    this.quad(a0, a1, b1, b0, color);
    this.quad(d0, d1, c1, c0, color);
    this.quad(a1, c1, d1, b1, top ?? color);
    this.quad(c0, c1, a1, a0, color);
    this.quad(b0, b1, d1, d0, color);
  }

  // Oriented box centred at (cx, cy, cz) with yaw (rad, rotation about +y).
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, yaw: number, color: THREE.Color, top?: THREE.Color) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const hx = sx / 2;
    const ax = cx - c * hx, az = cz + s * hx, bx = cx + c * hx, bz = cz - s * hx;
    this.wallBox(ax, az, bx, bz, sz, cy - sy / 2, cy + sy / 2, color, top);
  }

  // Tapered n-gon prism (poles, trunks, tanks) from y0 to y1, radius r0 at the bottom, r1 at the top.
  prism(cx: number, cz: number, y0: number, y1: number, r0: number, r1: number, sides: number, color: THREE.Color, caps = false) {
    for (let k = 0; k < sides; k++) {
      const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      this.quadN([cx + c0 * r0, y0, cz + s0 * r0], [cx + c1 * r0, y0, cz + s1 * r0], [cx + c1 * r1, y1, cz + s1 * r1], [cx + c0 * r1, y1, cz + s0 * r1],
        color, [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)]);
      if (caps) this.triUp([cx, y1, cz], [cx + c0 * r1, y1, cz + s0 * r1], [cx + c1 * r1, y1, cz + s1 * r1], color);
    }
  }

  // Low-poly octahedron-ish blob (tree canopies, bushes, coils): 8 faces, scaled per axis.
  blob(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: THREE.Color, rot = 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const pt = (x: number, y: number, z: number): V3 => [cx + (x * c + z * s) * sx, cy + y * sy, cz + (-x * s + z * c) * sz];
    const top = pt(0, 1, 0), bot = pt(0, -1, 0);
    const ring = [pt(1, 0.15, 0), pt(0.7, -0.1, 0.7), pt(0, 0.2, 1), pt(-0.7, -0.05, 0.7), pt(-1, 0.1, 0), pt(-0.7, 0.15, -0.7), pt(0, -0.1, -1), pt(0.7, 0.05, -0.7)];
    const dark = color.clone().multiplyScalar(0.7);
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length];
      this.tri(a, top, b, color);
      this.tri(a, b, bot, dark);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

export const col = (hex: number) => new THREE.Color(hex);
