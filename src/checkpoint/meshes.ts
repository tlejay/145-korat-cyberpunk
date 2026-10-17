// Low-poly checkpoint props after refs/sponsors/checkpoint-*-ref.png: orange cones with glowing
// batons, white/red A-frame "หยุดตรวจ" signs with a red siren, steel "จุดสกัด" barricades and a
// generic patrol pickup (no agency name, no insignia — conductor rule). Thai text is drawn with the
// game font on a canvas atlas, never by imagegen. Every mesh is modelled around the prop's centre of
// mass so an instance matrix = rigid-body pose.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FONT } from '../track/facade-atlas.js';
import { PROPS } from './bodies.js';

const S = 512;
// atlas regions (px): A-frame face 256×320 · barricade panel 256×128 · stripe swatch 64×64 · glow 128×128
const RA = { x: 0, y: 0, w: 256, h: 320 };
const RB = { x: 256, y: 0, w: 256, h: 128 };
const RC = { x: 256, y: 128, w: 64, h: 64 };
const RG = { x: 384, y: 384, w: 128, h: 128 };

const RED = '#e3191f', WHITE = '#f4f4f0';

function stripeLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, seg: number) {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / seg));
  g.lineWidth = w; g.lineCap = 'butt';
  for (let i = 0; i < n; i++) {
    g.strokeStyle = i % 2 ? RED : WHITE;
    g.beginPath();
    g.moveTo(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n);
    g.lineTo(x0 + ((x1 - x0) * (i + 1)) / n, y0 + ((y1 - y0) * (i + 1)) / n);
    g.stroke();
  }
}

function drawAtlas(g: CanvasRenderingContext2D) {
  g.clearRect(0, 0, S, S);
  g.textAlign = 'center'; g.textBaseline = 'middle';

  // ── A-frame face: white A with red bands, red-ring "หยุดตรวจ" disc, "ดื่มไม่ขับ" crossbar ──
  {
    const { x, y } = RA;
    g.save(); g.translate(x, y);
    stripeLine(g, 22, 312, 98, 10, 22, 46);
    stripeLine(g, 234, 312, 158, 10, 22, 46);
    g.fillStyle = WHITE;
    g.fillRect(88, 2, 80, 22);                // top cap
    g.fillRect(36, 214, 184, 26);             // crossbar
    g.fillRect(14, 296, 228, 20);             // foot bar
    g.fillStyle = RED; g.font = `700 19px ${FONT}`;
    g.fillText('ดื่มไม่ขับ', 128, 228, 170);
    // disc
    g.beginPath(); g.arc(128, 136, 64, 0, Math.PI * 2); g.fillStyle = RED; g.fill();
    g.beginPath(); g.arc(128, 136, 52, 0, Math.PI * 2); g.fillStyle = WHITE; g.fill();
    g.fillStyle = '#111111'; g.font = `700 34px ${FONT}`;
    g.fillText('หยุด', 128, 114, 92);
    g.fillText('ตรวจ', 128, 158, 92);
    g.restore();
  }

  // ── barricade: striped steel frame, open bars, white "จุดสกัด" plate ──
  {
    const { x, y, w } = RB;
    g.save(); g.translate(x, y);
    g.fillStyle = '#b9bcc2';
    for (let bx = 14; bx < w - 10; bx += 15) g.fillRect(bx, 16, 4, 98);    // vertical bars
    stripeLine(g, 0, 8, w, 8, 14, 32);         // top rail
    stripeLine(g, 0, 118, w, 118, 12, 32);     // bottom rail
    stripeLine(g, 5, 0, 5, 128, 10, 32);       // posts
    stripeLine(g, w - 5, 0, w - 5, 128, 10, 32);
    g.fillStyle = WHITE; g.fillRect(58, 26, 140, 58);
    g.strokeStyle = RED; g.lineWidth = 5; g.strokeRect(61, 29, 134, 52);
    g.fillStyle = RED; g.font = `700 32px ${FONT}`;
    g.fillText('จุดสกัด', 128, 56, 124);
    g.restore();
  }

  // ── solid red/white swatch (feet, frame edges) ──
  {
    const { x, y, w, h } = RC;
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? RED : WHITE; g.fillRect(x, y + (i * h) / 4, w, h / 4); }
  }

  // ── soft round glow for the flashing-light pool on the road ──
  {
    const { x, y, w } = RG, r = w / 2;
    const grd = g.createRadialGradient(x + r, y + r, 0, x + r, y + r, r);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(x, y, w, w);
  }
}

export function makeAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d')!;
  drawAtlas(g);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (document.fonts) {
    Promise.all([document.fonts.load(`700 34px ${FONT}`, 'หยุดตรวจ'), document.fonts.load(`700 32px ${FONT}`, 'จุดสกัด')])
      .then(() => { drawAtlas(g); tex.needsUpdate = true; })
      .catch(() => { /* keep the fallback font */ });
  }
  return tex;
}

type Rgn = { x: number; y: number; w: number; h: number };
const uvOf = (r: Rgn, fx: number, fy: number): [number, number] => [(r.x + fx * r.w) / S, 1 - (r.y + fy * r.h) / S];

/** Quad a→b→c→d (counter-clockwise seen from the front) with UVs over a region (fx/fy 0..1, y down). */
function quad(p: number[][], r: Rgn, flipU = false): THREE.BufferGeometry {
  const f = [[0, 1], [1, 1], [1, 0], [0, 0]];
  const pos: number[] = [], uv: number[] = [];
  for (let i = 0; i < 4; i++) {
    pos.push(...p[i]);
    uv.push(...uvOf(r, flipU ? 1 - f[i][0] : f[i][0], f[i][1]));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  return geo;
}

/** Box with every face mapped to one atlas region. */
function swatchBox(w: number, h: number, d: number, x: number, y: number, z: number, r: Rgn) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) { const [u, v] = uvOf(r, uv.getX(i), 1 - uv.getY(i)); uv.setXY(i, u, v); }
  geo.translate(x, y, z);
  return geo;
}

function colored(geo: THREE.BufferGeometry, hex: number) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.getAttribute('position').count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

export function coneGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const ORANGE = 0xff5a12, BAND = 0xf2f2ea;
  parts.push(colored(new THREE.BoxGeometry(0.38, 0.04, 0.38).translate(0, 0.02, 0), 0xd2400c));
  const r = (y: number) => 0.165 - ((0.165 - 0.03) * (y - 0.04)) / 0.66;
  const bands: [number, number, number][] = [[0.04, 0.3, ORANGE], [0.3, 0.4, BAND], [0.4, 0.47, ORANGE], [0.47, 0.54, BAND], [0.54, 0.7, ORANGE]];
  for (const [y0, y1, c] of bands) parts.push(colored(new THREE.CylinderGeometry(r(y1), r(y0), y1 - y0, 10, 1, true).translate(0, (y0 + y1) / 2, 0), c));
  const geo = mergeGeometries(parts)!;
  geo.translate(0, -PROPS.cone.comY, 0);
  return geo;
}

/** Glowing baton strapped to the cone front (faces the oncoming car, +z). */
export function batonGeometry() {
  const geo = new THREE.CylinderGeometry(0.024, 0.024, 0.46, 8, 1);
  geo.rotateX(-0.12);
  geo.translate(0, 0.34 - PROPS.cone.comY, 0.17);
  return geo;
}

export function aframeGeometry() {
  const y1 = 1.25, parts: THREE.BufferGeometry[] = [];
  parts.push(quad([[-0.55, 0, 0.32], [0.55, 0, 0.32], [0.55, y1, 0.05], [-0.55, y1, 0.05]], RA));
  parts.push(quad([[0.55, 0, -0.32], [-0.55, 0, -0.32], [-0.55, y1, -0.05], [0.55, y1, -0.05]], RA));
  parts.push(swatchBox(0.2, 0.05, 0.14, 0, y1 + 0.02, 0, RC)); // siren base
  const geo = mergeGeometries(parts)!;
  geo.translate(0, -PROPS.aframe.comY, 0);
  return geo;
}

export function sirenGeometry() {
  const geo = new THREE.CylinderGeometry(0.065, 0.075, 0.15, 10, 1);
  geo.translate(0, 1.35 - PROPS.aframe.comY, 0);
  return geo;
}

export function barricadeGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(quad([[-1, 0.1, 0.012], [1, 0.1, 0.012], [1, 1.1, 0.012], [-1, 1.1, 0.012]], RB));
  parts.push(quad([[1, 0.1, -0.012], [-1, 0.1, -0.012], [-1, 1.1, -0.012], [1, 1.1, -0.012]], RB)); // readable from behind too
  for (const x of [-0.95, 0.95]) {
    parts.push(swatchBox(0.06, 0.06, 0.5, x, 0.06, 0, RC));
    parts.push(swatchBox(0.05, 0.1, 0.05, x, 0.11, 0.2, RC), swatchBox(0.05, 0.1, 0.05, x, 0.11, -0.2, RC)); // castors
  }
  const geo = mergeGeometries(parts)!;
  geo.translate(0, -PROPS.barricade.comY, 0);
  return geo;
}

/** Generic patrol pickup, 5.3 × 1.9 × 1.85 m, front toward +z. Vertex colours only. */
export function truckGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: number) => parts.push(colored(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c));
  const BODY = 0x16181d, DOOR = 0xe9e9e4, GLASS = 0x0b1118, TYRE = 0x0a0a0a;
  box(1.9, 0.5, 5.3, 0, 0.62, 0, BODY);                // lower body + hood + bed floor
  box(1.84, 0.36, 1.9, 0, 1.05, 0.75, DOOR);           // white doors
  box(1.76, 0.42, 1.7, 0, 1.44, 0.7, GLASS);           // cab glass house
  box(1.8, 0.05, 1.75, 0, 1.67, 0.7, DOOR);            // roof
  box(0.08, 0.42, 2.25, 0.91, 1.08, -1.5, BODY);       // bed walls
  box(0.08, 0.42, 2.25, -0.91, 1.08, -1.5, BODY);
  box(1.9, 0.42, 0.08, 0, 1.08, -2.61, BODY);          // tailgate
  box(1.7, 0.12, 0.06, 0, 0.72, 2.66, 0x30343c);       // grille
  for (const x of [-0.82, 0.82]) for (const z of [1.65, -1.65]) parts.push(colored(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12).rotateZ(Math.PI / 2).translate(x, 0.38, z), TYRE));
  return mergeGeometries(parts)!;
}

/** Light-bar halves (left red / right blue) on the cab roof, one instance each. */
export function lightbarGeometry() {
  return new THREE.BoxGeometry(0.58, 0.13, 0.3).translate(0, 1.76, 0.75);
}

/** Flat glow pool on the road under the flashing lights (additive). */
export function glowGeometry() {
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) { const [u, v] = uvOf(RG, uv.getX(i), 1 - uv.getY(i)); uv.setXY(i, u, v); }
  return geo;
}
