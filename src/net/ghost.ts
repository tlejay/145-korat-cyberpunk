// Browser-side ghost encode/decode (deflate-raw + base64) and API fetch.
import { ghostMatchesTrack, packGhost, unpackGhost, type Ghost } from './ghost-format.js';

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([data as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// Returns null when the browser cannot compress (old iOS) — the run is still sent without a ghost.
export async function encodeGhost(g: Ghost): Promise<string | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    return toB64(await pipe(packGhost(g), new CompressionStream('deflate-raw')));
  } catch {
    return null;
  }
}

export async function decodeGhost(b64: string): Promise<Ghost | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const g = unpackGhost(await pipe(fromB64(b64), new DecompressionStream('deflate-raw')));
    return ghostMatchesTrack(g) ? g : null; // older track layout (or v1 format) → don't replay (fix #11)
  } catch {
    return null;
  }
}
