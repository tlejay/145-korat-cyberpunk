// City moat (คูเมือง): water surface (night shader), stone bank walls with a coping lip, fountains.
// Geometry = the OSM moat polygons already in track-A.json (raw.water.rings). Water level stays at
// raw.water.level so physics (heightAt) and visuals agree.
import * as THREE from 'three';
import { toRing, type RawTrack } from '../data.js';
import type { Vec2 } from '../../types.js';
import { col, pcaFrame, P, pip, prism, ringArea, type GeoBuilder } from './kit.js';
import { Site } from './site.js';

const BANK = col(0x6a6258), BANK_DARK = col(0x2a2c28), COPING = col(0xa9a397);
const JET = col(0xbfe9ff), JET2 = col(0x7fd6ff);

// Bank walls on every edge that borders land (edges shared by two moat polygons are skipped).
export function moatBanks(g: GeoBuilder, ring: Vec2[], others: Vec2[][], level: number, lip = 0.18) {
  const sgn = ringArea(ring) >= 0 ? 1 : -1;
  let acc = 0;
  for (let k = 0; k < ring.length; k++) {
    const p = ring[k], q = ring[(k + 1) % ring.length], ex = q.x - p.x, ez = q.z - p.z, el = Math.hypot(ex, ez);
    if (el < 0.05) continue;
    // inward normal (toward water)
    const ix = (-sgn * ez) / el, iz = (sgn * ex) / el;
    const mx = (p.x + q.x) / 2 - ix * 1.0, mz = (p.z + q.z) / 2 - iz * 1.0;
    if (others.some((o) => pip(mx, mz, o))) { acc += el; continue; }
    const d = 0.38; // wall face set back into the water so nothing intrudes on sidewalks
    const a = { x: p.x + ix * d, z: p.z + iz * d }, b = { x: q.x + ix * d, z: q.z + iz * d };
    const uv = (u0: number, u1: number, y0: number, y1: number): [number, number][] => [[u0 / 1.6, y0 / 0.8], [u1 / 1.6, y0 / 0.8], [u1 / 1.6, y1 / 0.8], [u0 / 1.6, y1 / 0.8]];
    const inward: [number, number, number] = [ix, 0, iz];
    g.quadN([a.x, level + 0.3, a.z], [b.x, level + 0.3, b.z], [b.x, lip - 0.06, b.z], [a.x, lip - 0.06, a.z], BANK, inward, uv(acc, acc + el, level + 0.3, lip));
    g.quadN([a.x, level - 0.5, a.z], [b.x, level - 0.5, b.z], [b.x, level + 0.3, b.z], [a.x, level + 0.3, a.z], BANK_DARK, inward);
    // coping lip: top + front edge
    g.quadN([p.x, lip, p.z], [q.x, lip, q.z], [b.x + ix * 0.06, lip, b.z + iz * 0.06], [a.x + ix * 0.06, lip, a.z + iz * 0.06], COPING, [0, 1, 0]);
    g.quadN([a.x + ix * 0.06, lip - 0.1, a.z + iz * 0.06], [b.x + ix * 0.06, lip - 0.1, b.z + iz * 0.06], [b.x + ix * 0.06, lip, b.z + iz * 0.06], [a.x + ix * 0.06, lip, a.z + iz * 0.06], COPING, inward);
    g.quadN([p.x, -0.03, p.z], [q.x, -0.03, q.z], [q.x, lip, q.z], [p.x, lip, p.z], COPING, [-ix, 0, -iz]);
    acc += el;
  }
}

export function waterSurface(g: GeoBuilder, ring: Vec2[], y: number) {
  for (const t of THREE.ShapeUtils.triangulateShape(ring.map((p) => new THREE.Vector2(p.x, p.z)), [])) {
    const [a, b, c] = t.map((i) => ring[i]);
    g.triUp([a.x, y, a.z], [b.x, y, b.z], [c.x, y, c.z], col(0xffffff));
  }
}

// Fountain: tall centre jet + ring of smaller jets, foam disc, halo sprites.
export function fountain(s: Site, x: number, z: number, y: number, h: number, ring = 6, r = 1.2) {
  prism(s.jet, x, z, 0.32, 0.05, y, y + h, 6, JET, 0, false);
  prism(s.jet, x, z, 0.12, 0.02, y, y + h * 1.12, 5, JET, 0.4, false);
  for (let k = 0; k < ring; k++) {
    const a = (k / ring) * Math.PI * 2, jx = x + Math.cos(a) * r, jz = z + Math.sin(a) * r;
    prism(s.jet, jx, jz, 0.12, 0.03, y, y + h * 0.45, 5, JET2, a, false);
  }
  prism(s.jet, x, z, r + 0.8, r + 1.1, y + 0.01, y + 0.05, 10, col(0x1e3a48), 0, true); // faint foam ring
  s.halo(x, y + h, z, JET, 0.45);
  s.halo(x, y + 0.3, z, JET2, 0.6);
}

export function buildMoat(raw: RawTrack): { site: Site; rings: Vec2[][] } {
  const s = new Site('moat');
  const rings = raw.water.rings.map(toRing);
  const lvl = raw.water.level;
  rings.forEach((r, i) => {
    waterSurface(s.water, r, lvl);
    moatBanks(s.stone, r, rings.filter((_, j) => j !== i), lvl);
  });
  // fountains in the west moat (Street View ratchadamnoen-05: fountains along the moat by the road)
  for (const r of rings) {
    const { f, len, wid } = pcaFrame(r);
    const cx = r.reduce((a, p) => a + p.x, 0) / r.length;
    if (cx > 80 || len < 60 || wid < 14) continue; // west moat only, wide enough
    const n = Math.max(1, Math.floor(len / 70));
    for (let k = 0; k < n; k++) {
      const u = -len / 2 + (len * (k + 0.5)) / n;
      const [x, , z] = P(f, u, 0, 0);
      if (pip(x, z, r)) fountain(s, x, z, lvl, 3.4);
    }
  }
  return { site: s, rings };
}
