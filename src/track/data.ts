// Decoder for public/data/track-<id>.json written by scripts/build-track.mjs.
// The file stores coordinates in decimetres (ints) to stay small; everything here is metres.
import type { Surface, Vec2 } from '../types.js';

export interface RawTrack {
  v: 1; id: 'A'; lengthM: number; step: number; researchOffsetM: number;
  center: number[]; widths: number[]; lanes: number[];
  pads: { kind: string; cls: number; ring: number[] }[];
  grid: { x0: number; z0: number; res: number; w: number; h: number; rle: string };
  walls: number[]; fences: number[]; cones: number[];
  water: { level: number; rings: number[][]; window: number[] };
  buildings: number[][];
  checkpoints: number[][];
  altGroup: [number, number] | null;
  startGrid: { x: number; y: number; z: number; heading: number; s: number };
  zones: number[][];
  moatJump: {
    takeoff: Vec2; landing: Vec2; widthM: number; takeoffLine: number[]; landingLine: number[];
    landingPoly: number[]; sTakeoff: number; sJoin: number;
  };
  corners: { s: number; deg: number; dir: 'L' | 'R' }[];
  roadNames: { s0: number; s1: number; name: string; osm: string }[];
  landmarks: {
    monument: { x: number; z: number; terrace: number[]; facingDeg: number; h: number };
    plaza: number[];
    gate: { ring: number[]; x: number; z: number; w: number; d: number; h: number };
    t21: { ring: number[]; h: number };
  };
  researchMap: [number, number][];
}

export const WALL_RAIL = 0, WALL_NEON = 1, WALL_MOAT = 2, WALL_BUILDING = 3, WALL_PLAZA = 4;
// h = collider height in metres (Infinity = can never be jumped; 1.0 = moat rail, PHYSICS §1.6)
export interface Wall { a: Vec2; b: Vec2; h: number; kind: number; /* +1 = track on the left of a→b */ side: 1 | -1 }

export interface Sample {
  x: number; z: number; tx: number; tz: number; // position + unit tangent
  w: number; med: number; w2: number; wl: number; wr: number; lanes: number; twoWay: boolean;
}

export interface TrackData {
  raw: RawTrack;
  samples: Sample[];
  lengthM: number;
  walls: Wall[];
  grid: Uint8Array; gx0: number; gz0: number; res: number; gw: number; gh: number;
  ring(arr: number[]): Vec2[];
}

const M = 0.1;
export const toRing = (arr: number[]): Vec2[] => {
  const out: Vec2[] = [];
  for (let i = 0; i + 1 < arr.length; i += 2) out.push({ x: arr[i] * M, z: arr[i + 1] * M });
  return out;
};

function decodeRle(b64: string, size: number): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(size);
  let o = 0, v = 0, shift = 0;
  for (let i = 0; i < bin.length; i++) {
    const byte = bin.charCodeAt(i);
    v |= (byte & 127) << shift;
    if (byte & 128) { shift += 7; continue; }
    const cls = v & 3, run = v >>> 2;
    out.fill(cls, o, o + run);
    o += run; v = 0; shift = 0;
  }
  return out;
}

export function decodeTrack(raw: RawTrack): TrackData {
  const n = raw.center.length / 2;
  const samples: Sample[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n, b = (i + 1) % n;
    const tx = (raw.center[b * 2] - raw.center[a * 2]) * M, tz = (raw.center[b * 2 + 1] - raw.center[a * 2 + 1]) * M;
    const l = Math.hypot(tx, tz) || 1;
    const w = raw.widths.slice(i * 5, i * 5 + 5).map((v) => v * M);
    samples.push({
      x: raw.center[i * 2] * M, z: raw.center[i * 2 + 1] * M, tx: tx / l, tz: tz / l,
      w: w[0], med: w[1], w2: w[2], wl: w[3], wr: w[4], lanes: Math.abs(raw.lanes[i]), twoWay: raw.lanes[i] < 0,
    });
  }
  const walls: Wall[] = [];
  for (let i = 0; i < raw.walls.length; i += 6) {
    const k = raw.walls[i + 4];
    walls.push({
      a: { x: raw.walls[i] * M, z: raw.walls[i + 1] * M }, b: { x: raw.walls[i + 2] * M, z: raw.walls[i + 3] * M },
      h: raw.walls[i + 5] ? raw.walls[i + 5] * M : Infinity, kind: k >> 1, side: k & 1 ? 1 : -1,
    });
  }
  const g = raw.grid;
  return {
    raw, samples, lengthM: raw.lengthM, walls,
    grid: decodeRle(g.rle, g.w * g.h), gx0: g.x0, gz0: g.z0, res: g.res, gw: g.w, gh: g.h,
    ring: toRing,
  };
}

const SURF: Surface[] = ['blocked', 'road', 'curb', 'water'];

// O(1) grid lookups used by physics every step.
export function makeLookups(d: TrackData, waterLevel: number) {
  const { grid, gx0, gz0, res, gw, gh } = d;
  const inv = 1 / res;
  const cls = (x: number, z: number) => {
    const c = Math.floor((x - gx0) * inv), r = Math.floor((z - gz0) * inv);
    return c < 0 || r < 0 || c >= gw || r >= gh ? 0 : grid[r * gw + c];
  };
  return {
    surfaceAt: (x: number, z: number): Surface => SURF[cls(x, z)],
    heightAt: (x: number, z: number): number => (cls(x, z) === 3 ? waterLevel : 0),
  };
}
