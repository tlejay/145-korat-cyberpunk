// Tiny merged-geometry builder for the sponsor meshes (one BufferGeometry per material = one draw call).
import * as THREE from 'three';

export type V3 = [number, number, number];
export type Col = [number, number, number];
/** UV corners in order bottom-left, bottom-right, top-right, top-left. */
export type UV4 = [[number, number], [number, number], [number, number], [number, number]];

const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const Y: V3 = [0, 1, 0];

export const uvRect = (u0: number, v0: number, u1: number, v1: number): UV4 => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
/** Same rect turned 90° so text runs bottom → top on a tall panel (glyph tops point left). */
export const uvRot = (u0: number, v0: number, u1: number, v1: number): UV4 => [[u0, v1], [u0, v0], [u1, v0], [u1, v1]];

/** A ground-aligned frame: origin (x, z), facing direction n = (nx, nz). u = viewer's right when looking at the face. */
export interface Frame { x: number; z: number; nx: number; nz: number }
export const frame = (x: number, z: number, nx: number, nz: number): Frame => {
  const l = Math.hypot(nx, nz) || 1;
  return { x, z, nx: nx / l, nz: nz / l };
};
const U = (f: Frame): V3 => [f.nz, 0, -f.nx];
const N = (f: Frame): V3 => [f.nx, 0, f.nz];
/** local (u, y, v) → world; v = along the facing direction. */
export const at = (f: Frame, u: number, y: number, v: number): V3 => [f.x + f.nz * u + f.nx * v, y, f.z - f.nx * u + f.nz * v];

export class Geo {
  pos: number[] = []; nor: number[] = []; col: number[] = []; uv: number[] = []; led: number[] = []; idx: number[] = [];
  get vertexCount() { return this.pos.length / 3; }

  /** Quad centred at c spanned by R (right) and Up; front face normal = R × Up. */
  quad(c: V3, R: V3, Up: V3, hw: number, hh: number, color: Col, uv?: UV4, led: [number, number, number] = [0, 0, 0]) {
    const n = cross(R, Up), l = Math.hypot(...n) || 1;
    const corners = [add(add(c, R, -hw), Up, -hh), add(add(c, R, hw), Up, -hh), add(add(c, R, hw), Up, hh), add(add(c, R, -hw), Up, hh)];
    const b = this.vertexCount;
    corners.forEach((p, i) => {
      this.pos.push(...p);
      this.nor.push(n[0] / l, n[1] / l, n[2] / l);
      this.col.push(...color);
      const t = uv ? uv[i] : [0, 0];
      this.uv.push(t[0], t[1]);
      this.led.push(...led);
    });
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }

  /** Flat panel in frame f: u ∈ [u0, u1], y ∈ [y0, y1], at depth v, facing +n. */
  panel(f: Frame, u0: number, u1: number, y0: number, y1: number, v: number, color: Col, uv?: UV4, led?: [number, number, number]) {
    this.quad(at(f, (u0 + u1) / 2, (y0 + y1) / 2, v), U(f), Y, (u1 - u0) / 2, (y1 - y0) / 2, color, uv, led);
  }

  /** Box in frame f (u, y, v ranges). */
  box(f: Frame, u0: number, u1: number, y0: number, y1: number, v0: number, v1: number, color: Col, bottom = false) {
    const c = at(f, (u0 + u1) / 2, (y0 + y1) / 2, (v0 + v1) / 2);
    const hu = (u1 - u0) / 2, hy = (y1 - y0) / 2, hv = (v1 - v0) / 2;
    const u = U(f), n = N(f), mu: V3 = [-u[0], 0, -u[2]], mn: V3 = [-n[0], 0, -n[2]];
    this.quad(add(c, n, hv), u, Y, hu, hy, color);       // front
    this.quad(add(c, mn, hv), mu, Y, hu, hy, color);     // back
    this.quad(add(c, u, hu), mn, Y, hv, hy, color);      // right side
    this.quad(add(c, mu, hu), n, Y, hv, hy, color);      // left side
    this.quad(add(c, Y, hy), u, mn, hu, hv, color);      // top
    if (bottom) this.quad(add(c, Y, -hy), u, n, hu, hv, color);
  }

  build(withLed = false): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (withLed) g.setAttribute('aLed', new THREE.Float32BufferAttribute(this.led, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}
