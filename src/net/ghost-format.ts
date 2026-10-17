// Ghost binary format v2 (GAMEPLAY §5.3), shared by client and server.
// Compression (deflate-raw) and base64 live in the platform-specific callers:
// client = src/net/ghost.ts (CompressionStream), server = api/_lib/ghost.ts (zlib).
//
// Layout (little endian):
//   0  'G' '2'       magic (v1 'G1' had no track version — rejected: recorded on an older layout)
//   2  u8 hz         sample rate (10)
//   3  u8 reserved
//   4  u32 lapMs     the lap this ghost covers (= best lap of the run)
//   8  u16 count
//  10  u32 track     TRACK_VERSION it was driven on (src/net/track-version.ts) — fix #11
//  14  count × { i16 x, i16 y, i16 z, i16 yaw, u8 flags } — x/y/z/yaw are deltas
//      from the previous sample (first sample absolute), wrapping at 16 bits.
// Units: x/y/z = 5 cm (±1,638 m around the monument origin), yaw = 1/32768 of 180°.
import type { ErrorCode } from './codes.js';
import { TRACK_VERSION } from './track-version.js';
export { TRACK_VERSION };

export const GHOST_HZ = 10;
export const GHOST_UNIT_M = 0.05;
export const GHOST_MAX_POINTS = 1800; // 3 min lap at 10 Hz
export const GHOST_MAX_B64 = 12_000; // compressed + base64 upload cap
export const GHOST_HEADER = 14;
const HEADER = GHOST_HEADER;
const STRIDE = 9;

export const GHOST_FLAG = { drift: 1, boost: 2, airborne: 4 } as const;

export interface GhostSample {
  x: number; // metres, east
  y: number; // metres, up
  z: number; // metres, south
  yawDeg: number;
  flags: number;
}

export interface Ghost {
  hz: number;
  lapMs: number;
  trackVersion: number; // TRACK_VERSION at record time; a mismatch = never replayed
  samples: GhostSample[];
}

const q = (m: number) => Math.max(-32768, Math.min(32767, Math.round(m / GHOST_UNIT_M)));
const qYaw = (deg: number) => {
  const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180;
  return Math.max(-32768, Math.min(32767, Math.round((wrapped / 180) * 32768)));
};
const wrap16 = (v: number) => ((v + 32768) & 0xffff) - 32768;

export function packGhost(g: Ghost): Uint8Array {
  const n = Math.min(g.samples.length, GHOST_MAX_POINTS);
  const buf = new Uint8Array(HEADER + n * STRIDE);
  const dv = new DataView(buf.buffer);
  buf[0] = 0x47;
  buf[1] = 0x32;
  buf[2] = g.hz;
  dv.setUint32(4, g.lapMs, true);
  dv.setUint16(8, n, true);
  dv.setUint32(10, g.trackVersion >>> 0, true);
  let px = 0, py = 0, pz = 0, pyaw = 0;
  for (let i = 0; i < n; i++) {
    const s = g.samples[i];
    const x = q(s.x), y = q(s.y), z = q(s.z), yaw = qYaw(s.yawDeg);
    const o = HEADER + i * STRIDE;
    dv.setInt16(o, wrap16(x - px), true);
    dv.setInt16(o + 2, wrap16(y - py), true);
    dv.setInt16(o + 4, wrap16(z - pz), true);
    dv.setInt16(o + 6, wrap16(yaw - pyaw), true);
    buf[o + 8] = s.flags & 0xff;
    px = x; py = y; pz = z; pyaw = yaw;
  }
  return buf;
}

export function unpackGhost(buf: Uint8Array): Ghost | null {
  if (buf.length < HEADER || buf[0] !== 0x47 || buf[1] !== 0x32) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const n = dv.getUint16(8, true);
  if (n > GHOST_MAX_POINTS || buf.length !== HEADER + n * STRIDE) return null;
  const samples: GhostSample[] = [];
  let x = 0, y = 0, z = 0, yaw = 0;
  for (let i = 0; i < n; i++) {
    const o = HEADER + i * STRIDE;
    x = wrap16(x + dv.getInt16(o, true));
    y = wrap16(y + dv.getInt16(o + 2, true));
    z = wrap16(z + dv.getInt16(o + 4, true));
    yaw = wrap16(yaw + dv.getInt16(o + 6, true));
    samples.push({ x: x * GHOST_UNIT_M, y: y * GHOST_UNIT_M, z: z * GHOST_UNIT_M, yawDeg: (yaw / 32768) * 180, flags: buf[o + 8] });
  }
  return { hz: buf[2], lapMs: dv.getUint32(4, true), trackVersion: dv.getUint32(10, true), samples };
}

// Server-side sanity check of a ghost against the run it came with.
export function checkGhost(g: Ghost, bestLapMs: number, trackLengthM: number): ErrorCode | null {
  if (g.hz !== GHOST_HZ || g.lapMs !== bestLapMs || g.trackVersion !== TRACK_VERSION) return 'BAD_GHOST';
  const expected = Math.floor(bestLapMs / (1000 / GHOST_HZ));
  if (Math.abs(g.samples.length - expected) > 3) return 'BAD_GHOST';
  let path = 0;
  for (let i = 0; i < g.samples.length; i++) {
    const s = g.samples[i];
    if (Math.abs(s.x) > 1600 || Math.abs(s.z) > 1600 || s.y < -20 || s.y > 80) return 'BAD_GHOST';
    if (i === 0) continue;
    const p = g.samples[i - 1];
    const step = Math.hypot(s.x - p.x, s.z - p.z);
    if (step > 15) return 'BAD_GHOST'; // > 540 km/h between samples
    path += step;
  }
  const first = g.samples[0], last = g.samples[g.samples.length - 1];
  if (!first || Math.hypot(first.x - last.x, first.z - last.z) > 60) return 'BAD_GHOST'; // a lap is a loop
  // Shortcuts make the driven path shorter than the centerline, but not by much.
  if (path < trackLengthM * 0.6 || path > trackLengthM * 1.5) return 'BAD_GHOST';
  return null;
}

/** Ghost recorded on the current track layout (fix #11) — anything else is not replayed. */
export const ghostMatchesTrack = (g: Ghost | null): g is Ghost => !!g && g.trackVersion === TRACK_VERSION;

// Style "ข้ามด่าน" evidence (fix #11): how many checkpoint sites the ghost passes while airborne.
// A clear needs ≥ 2 airborne samples within `radiusM` of the site (10 Hz, car is over the props ~1.3 s).
export function ghostCheckpointClears(g: Ghost, sites: { at: { x: number; z: number } }[], radiusM = 14): number {
  let n = 0;
  for (const s of sites) {
    let air = 0;
    for (const p of g.samples) if (p.flags & GHOST_FLAG.airborne && Math.hypot(p.x - s.at.x, p.z - s.at.z) < radiusM) air++;
    if (air >= 2) n++;
  }
  return n;
}
