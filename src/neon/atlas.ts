// Canvas atlases for the neon signs and rooftop billboards. All Thai text is drawn with the
// real game font (Noto Sans Thai) — imagegen art only ever provides text-free backgrounds.
import * as THREE from 'three';
import { FONT } from '../track/facade-atlas.js';
import { BILLBOARD_TEXTS, BLADE_TEXTS, NEON_COLORS, NEON_TEXTS } from './texts.js';

export type Rect = { u0: number; v0: number; u1: number; v1: number };

const S = 1024;
// sign atlas layout: horizontal cells 512×96 (2 × 7) on top, vertical blade cells 64×352 (16) below
const NW = 512, NH = 96, BW = 64, BH = 352, BY = 7 * NH;

const rect = (x: number, y: number, w: number, h: number, pad = 0): Rect => ({
  u0: (x + pad) / S, u1: (x + w - pad) / S, v0: 1 - (y + h - pad) / S, v1: 1 - (y + pad) / S,
});

export interface SignAtlas {
  texture: THREE.CanvasTexture;
  neon: { rect: Rect; color: number }[];   // per NEON_TEXTS entry
  blade: { rect: Rect; color: number }[];  // per BLADE_TEXTS entry
  dark: Rect;                              // solid dark cell for frames / backs
  redraw(): void;
  /** Art-pane neon frame sheet (6 blank frames, black background) drawn under the Thai text. */
  setFrames(img: CanvasImageSource, cells: number[][]): void;
}

// Art frame order (art-manifest neon-frames-atlas): pink · cyan · amber · lime · purple+red · white-blue
// → NEON_COLORS index, so the text and the wet-road light match the frame tube.
const FRAME_COLOR = [1, 0, 4, 3, 2, 6];

function glowText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, color: string) {
  g.shadowColor = color;
  g.shadowBlur = 16;
  g.fillStyle = color;
  g.fillText(text, x, y, maxW);
  g.shadowBlur = 6;
  g.fillText(text, x, y, maxW);
  // whitish tube core
  g.shadowBlur = 0;
  g.globalAlpha = 0.55;
  g.fillStyle = '#ffffff';
  g.fillText(text, x, y, maxW);
  g.globalAlpha = 1;
}

function tube(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  g.shadowColor = color;
  g.shadowBlur = 12;
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.stroke();
  g.shadowBlur = 0;
  g.globalAlpha = 0.5;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.2;
  g.stroke();
  g.globalAlpha = 1;
}

export function createSignAtlas(): SignAtlas {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const frameOf = (k: number) => k % FRAME_COLOR.length;
  const neon = NEON_TEXTS.map((_, i) => ({ rect: rect((i % 2) * NW, Math.floor(i / 2) * NH, NW, NH, 2), color: FRAME_COLOR[frameOf(i)] }));
  const blade = BLADE_TEXTS.map((_, i) => ({ rect: rect(i * BW, BY, BW, BH, 2), color: FRAME_COLOR[frameOf(i + 2)] }));
  let frames: { img: CanvasImageSource; cells: number[][] } | null = null;

  const redraw = () => {
    g.fillStyle = '#06060b';
    g.fillRect(0, 0, S, S);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    NEON_TEXTS.forEach((t, i) => {
      const x = (i % 2) * NW, y = Math.floor(i / 2) * NH, col = NEON_COLORS[neon[i].color];
      g.fillStyle = '#0b0912';
      g.fillRect(x + 2, y + 2, NW - 4, NH - 4);
      const fc = frames?.cells[frameOf(i)];
      if (frames && fc) g.drawImage(frames.img, fc[0], fc[1], fc[2], fc[3], x + 2, y + 2, NW - 4, NH - 4);
      else tube(g, x + 10, y + 10, NW - 20, NH - 20, 14, col);
      g.font = `700 ${frames ? 44 : 50}px ${FONT}`;
      glowText(g, t, x + NW / 2, y + NH * 0.54, NW - (frames ? 110 : 60), col);
    });
    BLADE_TEXTS.forEach((t, i) => {
      const x = i * BW, y = BY, col = NEON_COLORS[blade[i].color];
      g.fillStyle = '#0b0912';
      g.fillRect(x + 2, y + 2, BW - 4, BH - 4);
      const fc = frames?.cells[frameOf(i + 2)];
      if (!(frames && fc)) tube(g, x + 7, y + 7, BW - 14, BH - 14, 8, col);
      g.save();
      g.translate(x + BW / 2, y + BH / 2);
      g.rotate(-Math.PI / 2);
      if (frames && fc) g.drawImage(frames.img, fc[0], fc[1], fc[2], fc[3], -BH / 2 + 2, -BW / 2 + 2, BH - 4, BW - 4);
      g.font = `700 ${frames ? 30 : 36}px ${FONT}`;
      glowText(g, t, 0, 3, BH - (frames ? 70 : 44), col);
      g.restore();
    });
    texture.needsUpdate = true;
  };
  redraw();
  return {
    texture, neon, blade, dark: rect(4, 4, 2, 2), redraw,
    setFrames(img, cells) { frames = { img, cells }; redraw(); },
  };
}

// ── billboards: 5 cells of 512×205 (2.5 : 1, the 10 × 4 m rooftop board) ──
const BBW = 512, BBH = 205;
export interface BillboardAtlas {
  texture: THREE.CanvasTexture;
  cells: { rect: Rect; color: number }[];
  /** Backgrounds per cell. `plain` cells (sponsors) are drawn as-is: no product text, no tube frame. */
  setArt(images: (CanvasImageSource | null)[], plain?: boolean[]): void;
}

const BB_THEMES = [
  { a: '#2a0838', b: '#0b2b4a', accent: 3 },
  { a: '#3a0612', b: '#2a0a3a', accent: 4 },
  { a: '#08202e', b: '#30083a', accent: 1 },
  { a: '#1e0a3a', b: '#06302a', accent: 0 },
  { a: '#0a1236', b: '#3a1a06', accent: 2 },
];

export function createBillboardAtlas(): BillboardAtlas {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  let art: (CanvasImageSource | null)[] = [];
  let plainCells: boolean[] = [];
  const cells = BILLBOARD_TEXTS.map((_, i) => ({ rect: rect((i % 2) * BBW, Math.floor(i / 2) * BBH, BBW, BBH, 2), color: BB_THEMES[i].accent }));

  const draw = () => {
    g.fillStyle = '#05050a';
    g.fillRect(0, 0, S, S);
    BILLBOARD_TEXTS.forEach((t, i) => {
      const x = (i % 2) * BBW, y = Math.floor(i / 2) * BBH, th = BB_THEMES[i], col = NEON_COLORS[th.accent];
      g.save();
      g.beginPath();
      g.rect(x + 2, y + 2, BBW - 4, BBH - 4);
      g.clip();
      const img = art[i];
      if (img && plainCells[i]) {
        g.drawImage(img, x, y, BBW, BBH); // sponsor artwork is authored for the 2.5 : 1 board
        g.restore();
        return;
      }
      if (img) {
        const iw = (img as HTMLImageElement).width || BBW, ih = (img as HTMLImageElement).height || BBH;
        const k = Math.max(BBW / iw, BBH / ih);
        g.drawImage(img, x + (BBW - iw * k) / 2, y + (BBH - ih * k) / 2, iw * k, ih * k);
      } else {
        const grd = g.createLinearGradient(x, y, x + BBW, y + BBH);
        grd.addColorStop(0, th.a);
        grd.addColorStop(1, th.b);
        g.fillStyle = grd;
        g.fillRect(x, y, BBW, BBH);
        // abstract "product" glyph: glowing rings + scan lines (no letters)
        g.shadowColor = col;
        g.shadowBlur = 20;
        g.strokeStyle = col;
        g.lineWidth = 6;
        for (let r = 0; r < 3; r++) { g.beginPath(); g.arc(x + BBW * 0.8, y + BBH * 0.5, 30 + r * 22, 0, Math.PI * 2); g.stroke(); }
        g.shadowBlur = 0;
        g.globalAlpha = 0.12;
        g.fillStyle = '#ffffff';
        for (let yy = y; yy < y + BBH; yy += 6) g.fillRect(x, yy, BBW, 2);
        g.globalAlpha = 1;
      }
      // dark band under the text so it stays readable over any art
      const band = g.createLinearGradient(x, 0, x + BBW * 0.75, 0);
      band.addColorStop(0, 'rgba(4,3,10,0.82)');
      band.addColorStop(1, 'rgba(4,3,10,0)');
      g.fillStyle = band;
      g.fillRect(x, y, BBW, BBH);
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.font = `800 50px ${FONT}`;
      glowText(g, t.head, x + 26, y + BBH * 0.42, BBW - 52, col);
      g.font = `600 26px ${FONT}`;
      g.fillStyle = '#e8ecff';
      g.fillText(t.sub, x + 28, y + BBH * 0.74, BBW - 56);
      g.restore();
      tube(g, x + 6, y + 6, BBW - 12, BBH - 12, 6, col);
    });
    texture.needsUpdate = true;
  };
  draw();
  return {
    texture, cells,
    setArt(images, plain = []) { art = images; plainCells = plain; draw(); },
  };
}

// Soft radial glow (gold-shop halos).
export function haloTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const neonColor = (i: number) => new THREE.Color(NEON_COLORS[i % NEON_COLORS.length]);
