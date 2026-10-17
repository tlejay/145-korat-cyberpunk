// Rear number plate "MADEBYTLE" (sponsor plate, BRIEF-sponsors §1) drawn on a canvas with the real
// Noto Sans Thai font (never image-generated text). White field + black letters = readable from the
// chase camera under any light; a thin madebytle gradient bar is the only brand accent.
import * as THREE from 'three';

export const PLATE_TEXT = { top: 'MADEBYTLE', bottom: '' };

const W = 512;
const H = 226; // 34 × 15 cm aspect

const FONT = '"Noto Sans Thai", system-ui, sans-serif';

function draw(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  // brand bar: #818cf8 → #c084fc → #f472b6 (madebytle BRAND.md §4)
  const g = ctx.createLinearGradient(40, 0, W - 40, 0);
  g.addColorStop(0, '#818cf8');
  g.addColorStop(0.5, '#c084fc');
  g.addColorStop(1, '#f472b6');
  ctx.fillStyle = g;
  ctx.fillRect(40, H - 52, W - 80, 14);
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 104px ${FONT}`;
  ctx.fillText(PLATE_TEXT.top, W / 2, 96, W - 56);
}

export function createPlateTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // Redraw once the webfont is actually available (first draw may use a fallback).
  if (typeof document !== 'undefined' && document.fonts) {
    document.fonts.load(`700 104px ${FONT}`, PLATE_TEXT.top).then(() => {
      draw(ctx);
      tex.needsUpdate = true;
    }).catch(() => { /* keep fallback rendering */ });
  }
  return tex;
}
