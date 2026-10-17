// Thai-style rear number plate drawn on a canvas with the real Noto Sans Thai font
// (never image-generated text).
import * as THREE from 'three';

export const PLATE_TEXT = { top: 'ไซเบอร์ 1', bottom: 'นครราชสีมา' };

const W = 512;
const H = 226; // 34 × 15 cm aspect

const FONT = '"Noto Sans Thai", system-ui, sans-serif';

function draw(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  // Plate: white field, thin black border (Thai private-car plate).
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 92px ${FONT}`;
  ctx.fillText(PLATE_TEXT.top, W / 2, 84, W - 48);
  ctx.font = `400 52px ${FONT}`;
  ctx.fillText(PLATE_TEXT.bottom, W / 2, 172, W - 80);
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
    Promise.all([
      document.fonts.load(`700 92px ${FONT}`, PLATE_TEXT.top),
      document.fonts.load(`400 52px ${FONT}`, PLATE_TEXT.bottom),
    ]).then(() => {
      draw(ctx);
      tex.needsUpdate = true;
    }).catch(() => { /* keep fallback rendering */ });
  }
  return tex;
}
