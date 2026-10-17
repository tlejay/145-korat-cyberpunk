// Canvas atlas for the wayfinding signs: Thai curve-warning style (yellow on black) drawn as LED/neon so it
// reads at night in the rain. Thai text uses the real font (Noto Sans Thai) — never imagegen.
//
// Layout (1024 × 1024 at scale 1, all art drawn for a RIGHT turn; left = mirrored UVs):
//   row 0  y   0–256 : FRAME1 [0,256] · FRAME2 [256,768] · CHEVRON [768,1024] (borderless, one chevron)
//   row 1  y 256–512 : FRAME3 [0,768] · DIAMOND [768,1024] (curved arrow)
//   rows 2–3 y 512–1024 : 8 text plates 512 × 128 — index plateIndex(dir, danger, dist)
import * as THREE from 'three';
import { FONT } from '../track/facade-atlas.js';

export type Rect = [number, number, number, number]; // u0, v0, u1, v1 (three.js UV, v up)

const W = 1024, H = 1024;
const px = (x0: number, y0: number, x1: number, y1: number): Rect => [x0 / W, 1 - y1 / H, x1 / W, 1 - y0 / H];

export const CELLS = {
  frame: [px(0, 0, 256, 256), px(256, 0, 768, 256), px(0, 256, 768, 512)] as Rect[],
  chevron: px(768, 0, 1024, 256),
  diamond: px(768, 256, 1024, 512),
};
export const PLATE_DISTS = [150, 70] as const;
export const plateIndex = (dir: 'left' | 'right', danger: boolean, dist: number) =>
  (dir === 'left' ? 4 : 0) + (danger ? 2 : 0) + (dist === PLATE_DISTS[0] ? 0 : 1);
export const plateRect = (i: number): Rect => {
  const c = i % 2, r = Math.floor(i / 2);
  return px(c * 512, 512 + r * 128, c * 512 + 512, 640 + r * 128);
};

export const YELLOW = '#ffd21a';
const BLACK = '#07060c';
const nf = new Intl.NumberFormat('th-TH');

export function plateText(dir: 'left' | 'right', danger: boolean, dist: number) {
  const turn = dir === 'right' ? 'เลี้ยวขวา' : 'เลี้ยวซ้าย';
  return danger ? { big: 'โค้งอันตราย', small: `${turn} ${nf.format(dist)} ม.` } : { big: turn, small: `${nf.format(dist)} ม.` };
}

let cache: { tex: THREE.CanvasTexture; scale: number } | null = null;

/** scale 0.5 on the low tier (512² atlas). Text plates need the font loaded — loadTrack already awaited it. */
export function getAtlas(scale = 1): THREE.CanvasTexture {
  if (cache && cache.scale === scale) return cache.tex;
  cache?.tex.dispose();
  const cv = document.createElement('canvas');
  cv.width = W * scale; cv.height = H * scale;
  const g = cv.getContext('2d')!;
  g.scale(scale, scale);
  g.fillStyle = BLACK;
  g.fillRect(0, 0, W, H);

  // frames: black board, glowing yellow rim (LED strip)
  const frame = (x: number, y: number, w: number, h: number) => {
    g.save();
    g.fillStyle = BLACK;
    g.fillRect(x, y, w, h);
    g.shadowColor = YELLOW; g.shadowBlur = 14;
    g.strokeStyle = YELLOW; g.lineWidth = 14;
    roundRect(g, x + 14, y + 14, w - 28, h - 28, 18);
    g.stroke();
    g.restore();
  };
  frame(0, 0, 256, 256);
  frame(256, 0, 512, 256);
  frame(0, 256, 768, 256);

  // chevron ">" (transparent-ish black around it so it can sit on top of a frame)
  g.save();
  g.translate(768, 0);
  g.shadowColor = YELLOW; g.shadowBlur = 22;
  g.fillStyle = YELLOW;
  g.beginPath();
  g.moveTo(70, 34); g.lineTo(150, 34); g.lineTo(206, 128); g.lineTo(150, 222); g.lineTo(70, 222); g.lineTo(126, 128);
  g.closePath();
  g.fill();
  g.restore();
  ledMask(g, 768, 0, 256, 256);

  // diamond warning sign with a curved right arrow (transparent corners → alphaTest cut-out)
  g.clearRect(768, 256, 256, 256);
  g.save();
  g.translate(768 + 128, 256 + 128);
  g.save();
  g.rotate(Math.PI / 4);
  g.fillStyle = BLACK;
  g.fillRect(-84, -84, 168, 168);
  g.shadowColor = YELLOW; g.shadowBlur = 14;
  g.strokeStyle = YELLOW; g.lineWidth = 12;
  roundRect(g, -78, -78, 156, 156, 14);
  g.stroke();
  g.restore();
  g.shadowColor = YELLOW; g.shadowBlur = 16;
  g.strokeStyle = YELLOW; g.lineWidth = 20; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-26, 66);
  g.lineTo(-26, 4);
  g.quadraticCurveTo(-26, -30, 10, -30);
  g.lineTo(26, -30);
  g.stroke();
  g.fillStyle = YELLOW;
  g.beginPath();
  g.moveTo(22, -62); g.lineTo(66, -30); g.lineTo(22, 2);
  g.closePath();
  g.fill();
  g.restore();
  ledMask(g, 768, 256, 256, 256);

  // text plates (Thai, real font)
  for (const dir of ['right', 'left'] as const) for (const danger of [false, true]) for (const d of PLATE_DISTS) {
    const i = plateIndex(dir, danger, d), c = i % 2, r = Math.floor(i / 2);
    const x = c * 512, y = 512 + r * 128;
    g.save();
    g.fillStyle = BLACK;
    g.fillRect(x, y, 512, 128);
    g.shadowColor = YELLOW; g.shadowBlur = 10;
    g.strokeStyle = YELLOW; g.lineWidth = 8;
    roundRect(g, x + 8, y + 8, 496, 112, 14);
    g.stroke();
    const t = plateText(dir, danger, d);
    g.fillStyle = YELLOW; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowBlur = 12;
    g.font = `700 ${danger ? 50 : 58}px ${FONT}`;
    g.fillText(t.big, x + 256, y + (danger ? 50 : 54), 470);
    g.font = `700 30px ${FONT}`;
    g.fillText(t.small, x + 256, y + (danger ? 98 : 102), 470);
    g.restore();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  cache = { tex, scale };
  return tex;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Dot-matrix look: thin dark grid over the lit art (reads as LED pixels up close, solid glow far away). */
function ledMask(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.save();
  g.globalCompositeOperation = 'source-atop'; // keep the diamond's transparent corners transparent
  g.fillStyle = 'rgba(7,6,12,0.55)';
  for (let i = 0; i < w; i += 10) g.fillRect(x + i, y, 2, h);
  for (let j = 0; j < h; j += 10) g.fillRect(x, y + j, w, 2);
  g.restore();
}
