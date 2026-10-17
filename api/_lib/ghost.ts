import { inflateRawSync } from 'node:zlib';
import { GHOST_HEADER, GHOST_MAX_B64, GHOST_MAX_POINTS, unpackGhost, type Ghost } from '../../src/net/ghost-format.js';

export function decodeGhostB64(b64: unknown): Ghost | null {
  if (typeof b64 !== 'string' || b64.length > GHOST_MAX_B64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  try {
    const raw = inflateRawSync(Buffer.from(b64, 'base64'), { maxOutputLength: GHOST_HEADER + 9 * GHOST_MAX_POINTS });
    return unpackGhost(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
  } catch {
    return null;
  }
}
