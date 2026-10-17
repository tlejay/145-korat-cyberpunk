// 🔰 Wayfinding (BRIEF-wayfinding, Tle 21:14): roadside turn warnings so first-time players know where
// the road goes — Thai yellow/black curve-chevron boards (LED/neon style) on the outside of every corner,
// plus advance diamond + Thai text plates ~150 m and ~70 m before the turn-in. Corners are found from the
// centreline at load (src/wayfinding/turns.ts) — nothing is hard-coded, so a moved finish line still works.
//
// Integrator (🌃 visuals / game-ui):
//   scene.add(buildWayfinding(track));        // after buildSponsors(track) so the signs dodge the boards
//   getUpcomingTurn(race.progressM)           // → { dir, distM, severity } | null  (HUD arrow, ≤ 200 m)
//   createTurnHud(hudRoot) (./hud.ts)         // optional ready-made HUD badge + uiTap tick
//
// Budget: 2 draw calls (LED faces · posts/backs), one 1024² canvas atlas (512² on the low tier).
// Nothing is placed in the Ya Mo plaza zone, on/near the Chumphon gate, temples or the royal-portrait arch.
import * as THREE from 'three';
import { getQuality } from '../game/quality.js';
import { sacredFilter } from '../neon/index.js';
import { getTrackExtras } from '../track/index.js';
import { WALL_BUILDING, WALL_PLAZA, WALL_PROP } from '../track/data.js';
import type { LandmarksHandle } from '../track/landmarks/index.js';
import type { Track, Vec2 } from '../types.js';
import { settings } from '../ui/settings.js';
import { CELLS, getAtlas, plateIndex, plateRect, PLATE_DISTS, type Rect } from './textures.js';
import { findTurns, upcomingTurn, WF, type Severity, type Turn, type TurnDir } from './turns.js';

export { findTurns, WF, type Turn, type TurnDir, type Severity } from './turns.js';

type SiteDef = { at: Vec2 };
const cpMods = import.meta.glob<{ SITES?: SiteDef[] }>('../checkpoint/sim.ts', { eager: true });
const CHECKPOINT_SITES: SiteDef[] = Object.values(cpMods)[0]?.SITES ?? [];

export const SIGN = {
  advance: PLATE_DISTS,       // metres before the turn-in
  // game-sized (≈ 2× the real DOH boards) so they read from 150 m on a phone screen at night in the rain
  chevronH: 1.7, chevronY0: 1.2, chevronCellW: 1.1,   // board height / bottom edge / width per chevron
  boardsBySeverity: [0, 3, 4, 5] as const,            // chevron boards along the outside of the corner
  diamond: 3.0, diamondY0: 3.15, plateW: 3.4, plateH: 0.85, plateY0: 2.2,
  behindRailM: 0.7,           // behind a rail / neon barrier / moat balustrade (unreachable → no collider)
  sidewalkInsetM: 0.45,       // on the pavement just inside a building front / blocked edge (prop collider)
  maxRayM: 32,
  chaseHz: 1.5,               // each chevron lights 1.5×/s (VIS-04 / BRIEF: ≤ 3 flashes per second)
  avoidSponsorM: 5, avoidPropM: 1.4, avoidStreetSignM: 2.5, avoidCheckpointM: 35, zoneMarginM: 12,
};

export interface WayfindingStats {
  turns: Turn[];
  signs: { kind: 'chevron' | 'advance'; turn: number; s: number; x: number; z: number; mount: 'rail' | 'pavement'; text?: string }[];
  skipped: { turn: number; kind: string; s: number; why: string }[];
  colliders: number; drawCalls: number; triangles: number; textureBytes: number;
}

// ── module state: getUpcomingTurn works off the turns of the last built/initialised track ──
let current: { turns: Turn[]; L: number } | null = null;

/** Turns only (no meshes) — for tests / HUD-only use. buildWayfinding calls it too. */
export function initWayfinding(track: Track): Turn[] {
  const center = track.centerline ?? [];
  if (center.length < 8) { current = { turns: [], L: track.lengthM ?? 1 }; return []; }
  const samples = getTrackExtras()?.data.samples;
  const widthAt = samples && samples.length === center.length ? (i: number) => samples[i].w : undefined;
  const r = findTurns(center, widthAt);
  current = { turns: r.turns, L: r.lengthM };
  return r.turns;
}

/** The corner to warn about at `trackM` (metres from the finish line, same as Race.progressM). */
export function getUpcomingTurn(trackM: number, maxM = WF.hudShowM): { dir: TurnDir; distM: number; severity: Severity; deg: number; id: number } | null {
  if (!current) return null;
  const u = upcomingTurn(current.turns, current.L, trackM, maxM);
  return u ? { dir: u.turn.dir, distM: u.distM, severity: u.turn.severity, deg: u.turn.deg, id: u.turn.id } : null;
}
export const getTurns = () => current?.turns ?? [];

// ───────────────────────── geometry ─────────────────────────
class Geo {
  pos: number[] = []; nor: number[] = []; col: number[] = []; uv: number[] = []; anim: number[] = []; idx: number[] = [];
  quad(c: THREE.Vector3, R: THREE.Vector3, U: THREE.Vector3, hw: number, hh: number, col: [number, number, number], uv: Rect = [0, 0, 0, 0], anim: [number, number] = [0, 0]) {
    const n = new THREE.Vector3().crossVectors(R, U).normalize();
    const b = this.pos.length / 3;
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const uvs = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]];
    pts.forEach(([a, e], i) => {
      this.pos.push(c.x + R.x * hw * a + U.x * hh * e, c.y + R.y * hw * a + U.y * hh * e, c.z + R.z * hw * a + U.z * hh * e);
      this.nor.push(n.x, n.y, n.z);
      this.col.push(...col);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.anim.push(...anim);
    });
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  /** Axis box in a frame: centre c, right R, facing N (horizontal unit vectors), half sizes. */
  box(c: THREE.Vector3, R: THREE.Vector3, N: THREE.Vector3, hu: number, hy: number, hn: number, col: [number, number, number]) {
    const Y = new THREE.Vector3(0, 1, 0), mR = R.clone().negate(), mN = N.clone().negate();
    const at = (u: number, y: number, n: number) => c.clone().addScaledVector(R, u).addScaledVector(Y, y).addScaledVector(N, n);
    this.quad(at(0, 0, hn), R, Y, hu, hy, col);
    this.quad(at(0, 0, -hn), mR, Y, hu, hy, col);
    this.quad(at(hu, 0, 0), mN, Y, hn, hy, col);
    this.quad(at(-hu, 0, 0), N, Y, hn, hy, col);
    this.quad(at(0, hy, 0), R, mN, hu, hn, col);
  }
  build(withAnim: boolean) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (withAnim) g.setAttribute('aAnim', new THREE.Float32BufferAttribute(this.anim, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

const mirror = (r: Rect): Rect => [r[2], r[1], r[0], r[3]];

export function buildWayfinding(track: Track): THREE.Group {
  const group = new THREE.Group();
  group.name = 'wayfinding';
  const turns = initWayfinding(track);
  const center = track.centerline ?? [];
  const stats: WayfindingStats = { turns, signs: [], skipped: [], colliders: 0, drawCalls: 0, triangles: 0, textureBytes: 0 };
  group.userData.stats = stats;
  if (!turns.length) return group;

  const L = current!.L, n = center.length;
  const cum: number[] = [0];
  for (let i = 0; i < n; i++) { const a = center[i], b = center[(i + 1) % n]; cum.push(cum[i] + Math.hypot(b.x - a.x, b.z - a.z)); }
  const at = (s: number) => {
    s = ((s % L) + L) % L;
    let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const a = center[lo], b = center[(lo + 1) % n], seg = cum[lo + 1] - cum[lo] || 1, t = (s - cum[lo]) / seg;
    const tx = (b.x - a.x) / seg, tz = (b.z - a.z) / seg;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, tx, tz, rx: -tz, rz: tx }; // r = right of travel
  };

  // ── exclusions ──
  const extras = getTrackExtras();
  let lmh: LandmarksHandle | null = null;
  track.root.traverse((o) => { const h = (o as THREE.Object3D & { landmarks?: LandmarksHandle }).landmarks; if (h) lmh = h; });
  const mon = extras?.monument ?? { x: 0, z: 0 };
  const sacred = sacredFilter({ x: mon.x, z: mon.z }, (lmh as LandmarksHandle | null)?.claimed ?? []);
  const zones = track.zones.noBoostNoJump;
  const nearZone = (x: number, z: number) => zones.some((p) => inPoly(x, z, p) || polyDist(x, z, p) < SIGN.zoneMarginM);
  const sponsorPts: Vec2[] = ((track.root.parent?.getObjectByName('sponsors')?.userData.stats?.placements ?? []) as Vec2[]).map((p) => ({ x: p.x, z: p.z }));
  const streetSigns: Vec2[] = extras?.streetSigns ?? [];
  const walls = (extras?.walls ?? []).map((w) => ({ a: w.a, b: w.b, kind: w.kind }));
  const propPts = walls.filter((w) => w.kind === WALL_PROP).map((w) => ({ x: (w.a.x + w.b.x) / 2, z: (w.a.z + w.b.z) / 2 }));
  const solid = walls.filter((w) => w.kind !== WALL_PROP);
  const near = (p: Vec2, list: Vec2[], m: number) => list.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < m);
  const blockedWhy = (p: Vec2): string | null => {
    if (sacred(p.x, p.z)) return 'sacred';
    if (nearZone(p.x, p.z)) return 'plaza-zone';
    if (near(p, sponsorPts, SIGN.avoidSponsorM)) return 'sponsor';
    if (near(p, propPts, SIGN.avoidPropM)) return 'prop';
    if (near(p, streetSigns, SIGN.avoidStreetSignM)) return 'street-sign';
    if (near(p, CHECKPOINT_SITES.map((c) => c.at), SIGN.avoidCheckpointM)) return 'checkpoint';
    return null;
  };
  const drivable = (x: number, z: number) => { const k = track.surfaceAt(x, z); return k === 'road' || k === 'curb'; };

  /** Ray from the centreline at s to one side → mounting spot behind a rail, or on the pavement. */
  const mountAt = (s: number, side: 1 | -1): { x: number; z: number; mount: 'rail' | 'pavement' } | null => {
    const p = at(s), dx = p.rx * side, dz = p.rz * side;
    let edge = SIGN.maxRayM;
    for (let d = 0.5; d < SIGN.maxRayM; d += 0.25) if (!drivable(p.x + dx * d, p.z + dz * d)) { edge = d; break; }
    let hit = Infinity, hitKind = -1;
    for (const w of solid) {
      const t = raySeg(p.x, p.z, dx, dz, w.a, w.b);
      if (t > 0.5 && t < hit) { hit = t; hitKind = w.kind; }
    }
    if (hit < SIGN.maxRayM && hitKind !== WALL_BUILDING && hitKind !== WALL_PLAZA && hit <= edge + 1.5) {
      const d = hit + SIGN.behindRailM; // behind a rail / neon barrier / moat balustrade
      return { x: p.x + dx * d, z: p.z + dz * d, mount: 'rail' };
    }
    const lim = Math.min(edge, hit);
    if (lim >= SIGN.maxRayM) return null;
    const d = lim - SIGN.sidewalkInsetM;
    return { x: p.x + dx * d, z: p.z + dz * d, mount: 'pavement' };
  };
  /** Try s, then nudge along the road until the spot is allowed. */
  const place = (s: number, side: 1 | -1, nudges: number[]) => {
    let why = 'no-edge';
    for (const ds of nudges) {
      const m = mountAt(s + ds, side);
      if (!m) continue;
      const w = blockedWhy(m);
      if (!w) return { ...m, s: (((s + ds) % L) + L) % L };
      why = w;
    }
    return { why };
  };

  const tier = getQuality().tier;
  const atlas = getAtlas(tier === 'low' ? 0.5 : 1);
  const led = new Geo(), struct = new Geo();
  const POST: [number, number, number] = [0.16, 0.16, 0.18], BACK: [number, number, number] = [0.1, 0.1, 0.11];
  const Y = new THREE.Vector3(0, 1, 0);
  const colliders: { a: Vec2; b: Vec2; h: number; kind: 'prop'; style: 'invisible' }[] = [];
  const addPost = (x: number, z: number, y0: number, top: number, mount: 'rail' | 'pavement', R: THREE.Vector3, N: THREE.Vector3) => {
    struct.box(new THREE.Vector3(x, y0 + top / 2, z), R, N, 0.05, top / 2, 0.05, POST);
    if (mount === 'pavement') {
      const r = 0.15, c = [[-r, -r], [r, -r], [r, r], [-r, r]].map(([u, v]) => ({ x: x + u, z: z + v }));
      for (let i = 0; i < 4; i++) colliders.push({ a: c[i], b: c[(i + 1) % 4], h: Infinity, kind: 'prop', style: 'invisible' });
    }
  };

  for (let ti = 0; ti < turns.length; ti++) {
    const t = turns[ti], prev = turns[(ti - 1 + turns.length) % turns.length];
    const outer: 1 | -1 = t.dir === 'right' ? -1 : 1;   // outside of the corner
    const danger = t.severity === 3;

    // ── chevron boards along the outside of the corner, all facing the approaching driver ──
    const nb = SIGN.boardsBySeverity[t.severity], k = t.severity + 1; // 2 / 3 / 4 chevrons per board
    const sA = t.s0 - 6, sB = t.s1 + 6;
    const view = at(t.s0 - 35);
    for (let j = 0; j < nb; j++) {
      const s = sA + ((sB - sA) * j) / Math.max(1, nb - 1);
      const m = place(s, outer, [0, 2, -2, 4, -4]);
      if (!('x' in m)) { stats.skipped.push({ turn: t.id, kind: 'chevron', s: Math.round(s), why: m.why }); continue; }
      // boards far across an open junction (224) are scaled up so they read as big as the kerb-side ones
      const sc = Math.max(1, Math.min(1.6, Math.hypot(m.x - at(s).x, m.z - at(s).z) / 15));
      const cw = SIGN.chevronCellW * sc, bw = cw * k + 0.2 * sc, hh = (SIGN.chevronH * sc) / 2;
      const N = new THREE.Vector3(view.x - m.x, 0, view.z - m.z).normalize();
      const R = new THREE.Vector3(N.z, 0, -N.x);              // viewer's right when looking at the face
      const y0 = track.heightAt(m.x, m.z);
      const c = new THREE.Vector3(m.x, y0 + SIGN.chevronY0 * sc + hh, m.z);
      struct.box(c.clone().addScaledVector(N, -0.04), R, N, bw / 2 + 0.04, hh + 0.04, 0.03, BACK);
      led.quad(c.clone().addScaledVector(N, -0.005), R, Y, bw / 2, hh, [1.15, 1.15, 1.15], CELLS.frame[Math.min(3, k) - 1]);
      for (let q = 0; q < k; q++) {
        const u = -bw / 2 + 0.1 * sc + cw * (q + 0.5);
        // chase runs in the turn direction across the whole row: phase grows board by board, chevron by chevron
        const order = t.dir === 'right' ? j * k + q : (nb - 1 - j) * k + (k - 1 - q);
        const phase = (order / (nb * k)) * 0.65;
        const cc = c.clone().addScaledVector(R, u).addScaledVector(N, 0.004);
        led.quad(cc, R, Y, (cw / 2) * 0.92, hh * 0.86, [1.7, 1.7, 1.7], t.dir === 'right' ? CELLS.chevron : mirror(CELLS.chevron), [phase, 1]);
      }
      addPost(m.x, m.z, y0, SIGN.chevronY0 * sc + 0.05, m.mount, R, N);
      stats.signs.push({ kind: 'chevron', turn: t.id, s: Math.round(m.s), x: +m.x.toFixed(1), z: +m.z.toFixed(1), mount: m.mount });
    }

    // ── advance warnings ~150 m / ~70 m before the turn-in, on the left kerb (Thai left-hand traffic) ──
    const gapBack = ((t.s0 - prev.s1) % L + L) % L;
    for (const d of SIGN.advance) {
      if (d > gapBack - 15) { stats.skipped.push({ turn: t.id, kind: `advance-${d}`, s: Math.round(t.s0 - d), why: 'inside-previous-corner' }); continue; }
      const m = place(t.s0 - d, -1, [0, 3, -3, 6, -6, 10, -10]);
      if (!('x' in m)) { stats.skipped.push({ turn: t.id, kind: `advance-${d}`, s: Math.round(t.s0 - d), why: m.why }); continue; }
      const p = at(m.s);
      // face the oncoming car, turned 12° towards the road so it reads from the lane
      const N = new THREE.Vector3(-p.tx, 0, -p.tz).addScaledVector(new THREE.Vector3(p.rx, 0, p.rz), 0.21).normalize();
      const R = new THREE.Vector3(N.z, 0, -N.x);
      const y0 = track.heightAt(m.x, m.z);
      const dh = SIGN.diamond / 2;
      const cd = new THREE.Vector3(m.x, y0 + SIGN.diamondY0 + dh, m.z);
      struct.box(cd.clone().addScaledVector(N, -0.04), R, N, dh * 0.45, dh * 0.45, 0.025, BACK);
      led.quad(cd, R, Y, dh, dh, [1.35, 1.35, 1.35], t.dir === 'right' ? CELLS.diamond : mirror(CELLS.diamond));
      const pc = new THREE.Vector3(m.x, y0 + SIGN.plateY0 + SIGN.plateH / 2, m.z);
      struct.box(pc.clone().addScaledVector(N, -0.04), R, N, SIGN.plateW / 2 + 0.03, SIGN.plateH / 2 + 0.03, 0.025, BACK);
      const pi = plateIndex(t.dir, danger, d);
      led.quad(pc, R, Y, SIGN.plateW / 2, SIGN.plateH / 2, [1.25, 1.25, 1.25], plateRect(pi));
      addPost(m.x, m.z, y0, SIGN.diamondY0 + 0.1, m.mount, R, N);
      stats.signs.push({ kind: 'advance', turn: t.id, s: Math.round(m.s), x: +m.x.toFixed(1), z: +m.z.toFixed(1), mount: m.mount, text: `${danger ? 'โค้งอันตราย ' : ''}${t.dir === 'right' ? 'เลี้ยวขวา' : 'เลี้ยวซ้าย'} ${d} ม.` });
    }
  }

  // ── materials ──
  const uTime = { value: 0 }, uChase = { value: 1 };
  const ledMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, toneMapped: false, alphaTest: 0.5 });
  ledMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.uniforms.uChase = uChase;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aAnim;\nuniform float uTime;\nuniform float uChase;\nvarying float vLit;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
  // running chevrons: each one is bright for 35 % of a ${SIGN.chaseHz} Hz cycle, dimmed (never off) otherwise
  float ph = fract(uTime * ${SIGN.chaseHz.toFixed(2)} - aAnim.x);
  float on = smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(0.29, 0.35, ph));
  vLit = mix(1.0, mix(0.42, 1.25, on), aAnim.y * uChase);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLit;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb *= vLit;');
  };
  ledMat.customProgramCacheKey = () => 'wayfinding-led';
  const ledMesh = new THREE.Mesh(led.build(true), ledMat);
  ledMesh.name = 'wayfinding-led';
  ledMesh.onBeforeRender = () => {
    uTime.value = (performance.now() / 1000) % 600;
    uChase.value = settings.reduceFlicker ? 0 : 1; // VIS-04 setting: steady glow, no chase
  };
  const structMesh = new THREE.Mesh(struct.build(false), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.5 }));
  structMesh.name = 'wayfinding-structure';
  group.add(ledMesh, structMesh);

  // light prop colliders for posts standing on the pavement (signs behind rails need none)
  if (colliders.length) {
    track.barriers = [...track.barriers, ...colliders] as Track['barriers']; // new array → physics rebuilds its grid
    stats.colliders = colliders.length / 4;
  }
  stats.drawCalls = 2;
  stats.triangles = [ledMesh, structMesh].reduce((a, m) => a + (m.geometry.index?.count ?? 0) / 3, 0);
  stats.textureBytes = Math.round(atlas.image.width * atlas.image.height * 4 * 4 / 3);
  if (typeof location !== 'undefined' && /[?&]qa=1/.test(location.search)) (window as unknown as { __wayfinding: unknown }).__wayfinding = { stats, group, getUpcomingTurn };
  group.userData.dispose = () => {
    for (const m of [ledMesh, structMesh]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
  };
  return group;
}

/** Ray (origin, unit dir) vs segment → distance along the ray, or Infinity. */
function raySeg(ox: number, oz: number, dx: number, dz: number, a: Vec2, b: Vec2) {
  const ex = b.x - a.x, ez = b.z - a.z;
  const den = dx * ez - dz * ex;
  if (Math.abs(den) < 1e-9) return Infinity;
  const fx = a.x - ox, fz = a.z - oz;
  const t = (fx * ez - fz * ex) / den, u = (fx * dz - fz * dx) / den;
  return t >= 0 && u >= 0 && u <= 1 ? t : Infinity;
}
function inPoly(x: number, z: number, poly: Vec2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
function polyDist(x: number, z: number, poly: Vec2[]) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}
