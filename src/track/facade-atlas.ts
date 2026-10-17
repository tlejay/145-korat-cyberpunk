// Procedural facade atlas (canvas, no external images — GPT textures come in M3).
// One cell = one bay (~3.6 m) × one floor. Rows = building style (scripts/streetscape.mjs ST),
// columns = ground floor A/B, upper floor A–E, side wall. The bottom strip holds the gold-shop
// fascia signs and a few solid-colour swatches for awnings / roofs / glowing bands.
// A second, half-resolution canvas holds the emissive map (lit windows, shop interiors, signs).
import * as THREE from 'three';

export const ST = { SHOP: 0, OLD: 1, HOTEL: 2, MALL: 3, MESH: 4, CIVIC: 5, HOUSE: 6, THAI: 7 } as const;
export const ATLAS = 1024, CELL_W = 128, CELL_H = 112, STRIP_Y = 896;
export const COL_GROUND = 0, COL_UPPER = 2, UPPER_VARIANTS = 5, COL_SIDE = 7;
export const GOLD_TEXTS = ['ห้างทอง', 'ทองรูปพรรณ', 'ทองคำแท้', 'รับซื้อทอง'];
export const FONT = '"Noto Sans Thai", "Sukhumvit Set", "Thonburi", sans-serif';

export type UVRect = { u0: number; v0: number; u1: number; v1: number }; // v0 = bottom
const rect = (x: number, y: number, w: number, h: number, inset = 1.5): UVRect => ({
  u0: (x + inset) / ATLAS, u1: (x + w - inset) / ATLAS, v0: 1 - (y + h - inset) / ATLAS, v1: 1 - (y + inset) / ATLAS,
});
export const cellUV = (row: number, col: number) => rect(col * CELL_W, row * CELL_H, CELL_W, CELL_H);
export const goldUV = (k: number) => rect((k % 4) * 256, STRIP_Y, 256, 64, 3);
// Solid swatches: matte white (no glow), red glow, warm glow, cyan glow
export const SOLID = { matte: 0, red: 1, warm: 2, cyan: 3 } as const;
export const solidUV = (k: number) => { const r = rect(k * 64, STRIP_Y + 64, 64, 64, 16); return { u: (r.u0 + r.u1) / 2, v: (r.v0 + r.v1) / 2 }; };

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;
const LIT = ['#ffcf8a', '#ffe2b0', '#ffd27a', '#ffb870', '#bfe8ff', '#9dd8ff', '#ff9ad5'];

export function createFacadeAtlas(): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const c = document.createElement('canvas'), e = document.createElement('canvas');
  c.width = c.height = ATLAS;
  e.width = e.height = ATLAS / 2;
  const g = c.getContext('2d')!, ge = e.getContext('2d')!;
  ge.scale(0.5, 0.5);
  g.fillStyle = '#eeeeee'; g.fillRect(0, 0, ATLAS, ATLAS);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, ATLAS, ATLAS);
  const r = rng(2026);

  // ── primitives (cell-local coordinates, 128 × 112) ──
  const wall = (x: number, y: number, base = '#efefef') => {
    g.fillStyle = base; g.fillRect(x, y, CELL_W, CELL_H);
    for (let k = 0; k < 18; k++) { // grime streaks
      g.fillStyle = `rgba(60,55,50,${0.03 + r() * 0.05})`;
      g.fillRect(x + r() * CELL_W, y + r() * 30, 2 + r() * 5, 20 + r() * 80);
    }
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y + CELL_H - 4, CELL_W, 4); // floor slab line
  };
  const glass = (x: number, y: number, w: number, h: number, lit: string | null, frame = '#5a5a60') => {
    g.fillStyle = frame; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle = '#2a3140'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(160,190,220,0.18)'; g.fillRect(x, y, w * 0.45, h);
    if (lit) { ge.fillStyle = lit; ge.globalAlpha = 0.6 + r() * 0.4; ge.fillRect(x, y, w, h); ge.globalAlpha = 1; }
  };
  const louvres = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = 'rgba(200,205,210,0.5)';
    for (let k = 4; k < h; k += 6) g.fillRect(x, y + k, w, 2);
  };
  const grille = (x: number, y: number, w: number, h: number) => {
    g.strokeStyle = 'rgba(40,40,44,0.85)'; g.lineWidth = 1.5;
    g.beginPath();
    for (let k = -h; k < w; k += 10) { g.moveTo(x + k, y + h); g.lineTo(x + k + h, y); g.moveTo(x + k, y); g.lineTo(x + k + h, y + h); }
    g.save(); g.rect(x, y, w, h); g.clip(); g.stroke(); g.restore();
  };
  const rail = (x: number, y: number, w: number) => {
    g.fillStyle = '#3a3a40'; g.fillRect(x, y, w, 3);
    for (let k = 0; k <= w; k += 7) g.fillRect(x + k, y, 2, 22);
    g.fillRect(x, y + 20, w, 2);
  };
  const shutter = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = '#8c9096'; g.fillRect(x, y, w, h);
    for (let k = 0; k < h; k += 4) { g.fillStyle = k % 8 ? '#a4a8ae' : '#787c82'; g.fillRect(x, y + k, w, 2); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y, w, 5);
  };
  // open shop: warm interior with shelves / goods silhouettes cut into the glow
  const shopFront = (x: number, y: number) => {
    glass(x + 8, y + 34, 112, 78, null, '#4a4a50');
    const grad = ge.createLinearGradient(0, y + 34, 0, y + 112);
    const tint = LIT[Math.floor(r() * 4)];
    grad.addColorStop(0, tint); grad.addColorStop(1, '#3a2410');
    ge.globalAlpha = 0.55; ge.fillStyle = grad; ge.fillRect(x + 8, y + 34, 112, 78); ge.globalAlpha = 1;
    ge.fillStyle = '#000'; g.fillStyle = '#1a1612';
    for (let k = 0; k < 4; k++) { const sy = y + 50 + k * 15; ge.fillRect(x + 10, sy, 108, 3); g.fillRect(x + 10, sy, 108, 3); }
    for (let k = 0; k < 6; k++) { const bx = x + 14 + r() * 96, bh = 10 + r() * 22; ge.fillRect(bx, y + 112 - bh, 6 + r() * 10, bh); }
  };
  const ac = (x: number, y: number) => { g.fillStyle = '#d8d8d4'; g.fillRect(x, y, 22, 14); g.fillStyle = '#7a7a7a'; for (let k = 2; k < 14; k += 3) g.fillRect(x + 3, y + k, 16, 1); };
  const litOr = (p: number) => (r() < p ? LIT[Math.floor(r() * (r() < 0.8 ? 4 : LIT.length))] : null);

  // lit probability per upper variant (A dark … E busy) — chosen per bay by hash in buildings.ts
  const PROB = [0.05, 0.3, 0.5, 0.75, 0.4];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const x = col * CELL_W, y = row * CELL_H, v = col - COL_UPPER, p = PROB[Math.max(0, Math.min(4, v))];
      const ground = col < COL_UPPER, side = col === COL_SIDE;
      if (row === ST.OLD) {
        // weathered timber row house: plank walls, louvred wooden shutters, folding doors
        g.fillStyle = '#d8c8b0'; g.fillRect(x, y, CELL_W, CELL_H);
        for (let k = 0; k < CELL_W; k += 8) { g.fillStyle = `rgba(70,45,25,${0.15 + r() * 0.15})`; g.fillRect(x + k, y, 1.5, CELL_H); }
        if (side) continue;
        if (ground) {
          for (let k = 8; k < 120; k += 14) { g.fillStyle = col ? '#6a4a30' : '#7a5838'; g.fillRect(x + k, y + 22, 12, 86); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + k + 11, y + 22, 1, 86); }
          if (col === 1) { glass(x + 36, y + 30, 56, 74, LIT[0], '#4a3020'); }
        } else {
          for (const wx of [18, 74]) { glass(x + wx, y + 22, 36, 56, litOr(p), '#5a3a22'); g.fillStyle = '#7a5434'; g.fillRect(x + wx - 12, y + 20, 10, 60); g.fillRect(x + wx + 38, y + 20, 10, 60); louvres(x + wx - 12, y + 20, 10, 60); louvres(x + wx + 38, y + 20, 10, 60); }
        }
        continue;
      }
      wall(x, y);
      if (side) { if (row !== ST.SHOP && row !== ST.HOUSE && r() < 0.8) glass(x + 54, y + 40, 20, 26, litOr(0.25)); continue; }
      switch (row) {
        case ST.SHOP:
          if (ground) {
            if (col === 0) shutter(x + 6, y + 20, 116, 92);
            else { shopFront(x, y); shutter(x + 6, y + 20, 116, 14); }
          } else {
            if (v === 1) { glass(x + 14, y + 18, 100, 58, litOr(p)); grille(x + 14, y + 18, 100, 58); }
            else { glass(x + 14, y + 16, 40, 62, litOr(p)); glass(x + 74, y + 16, 40, 62, litOr(p)); louvres(x + 14, y + 16, 40, 62); louvres(x + 74, y + 16, 40, 62); }
            if (v === 2 || v === 4) ac(x + 96, y + 82);
            if (v !== 1) rail(x + 4, y + 84, 120);
          }
          break;
        case ST.HOTEL:
          if (ground) { g.fillStyle = '#44444a'; g.fillRect(x, y + 14, CELL_W, 10); if (col) shopFront(x, y); else { glass(x + 8, y + 34, 112, 78, null, '#303034'); } }
          else {
            for (const wx of [6, 45, 84]) glass(x + wx, y + 24, 37, 46, litOr(p), '#55555c');
            g.fillStyle = 'rgba(120,110,95,0.9)'; for (const fx of [0, 42, 82, 124]) g.fillRect(x + fx, y, 4, CELL_H); // vertical fins
            g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x, y + 74, CELL_W, 10);
          }
          break;
        case ST.MALL:
          if (ground) { g.fillStyle = '#3a3a40'; g.fillRect(x, y + 18, CELL_W, 12); shopFront(x, y); for (const mx of [40, 84]) { g.fillStyle = '#2a2a2e'; g.fillRect(x + mx, y + 34, 3, 78); ge.fillStyle = '#000'; ge.fillRect(x + mx, y + 34, 3, 78); } }
          else {
            g.fillStyle = 'rgba(0,0,0,0.08)'; for (let k = 10; k < CELL_H; k += 18) g.fillRect(x, y + k, CELL_W, 3);
            if (v === 2 || v === 4) glass(x + 20, y + 30, 88, 30, litOr(p));
            if (v === 3) { g.fillStyle = 'rgba(200,160,60,0.8)'; g.fillRect(x, y + 50, CELL_W, 6); } // gold zigzag band (A-15)
          }
          break;
        case ST.MESH:
          if (ground) shutter(x + 6, y + 20, 116, 92);
          else { glass(x + 14, y + 18, 100, 60, litOr(p)); }
          g.strokeStyle = 'rgba(150,155,160,0.95)'; g.lineWidth = 3; g.beginPath();
          for (let k = -CELL_H; k < CELL_W; k += 16) { g.moveTo(x + k, y + CELL_H); g.lineTo(x + k + CELL_H, y); }
          g.save(); g.rect(x, y + (ground ? 0 : 0), CELL_W, ground ? 18 : CELL_H); g.clip(); g.stroke(); g.restore();
          break;
        case ST.CIVIC:
          g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y, 8, CELL_H); g.fillRect(x + 120, y, 8, CELL_H); // columns
          if (ground) { g.fillStyle = '#3a3a3e'; g.fillRect(x + 12, y + 30, 104, 82); if (col) glass(x + 30, y + 40, 68, 60, LIT[1]); }
          else { glass(x + 14, y + 18, 100, 48, litOr(p * 0.6)); louvres(x + 14, y + 18, 100, 48); g.fillStyle = '#d8d8d0'; g.fillRect(x + 8, y + 76, 112, 26); g.fillStyle = 'rgba(0,0,0,.15)'; for (let k = 12; k < 120; k += 10) g.fillRect(x + k, y + 80, 4, 18); }
          break;
        case ST.HOUSE:
          if (ground) { g.fillStyle = '#4a4a50'; for (let k = 6; k < 122; k += 6) g.fillRect(x + k, y + 46, 2, 66); g.fillRect(x + 4, y + 46, 120, 3); glass(x + 40, y + 24, 48, 40, col ? LIT[0] : null); }
          else { glass(x + 30, y + 24, 68, 48, litOr(p * 0.7)); grille(x + 30, y + 24, 68, 48); if (v === 2) ac(x + 100, y + 80); }
          break;
        case ST.THAI:
          if (ground) { for (const dx of [16, 72]) { g.fillStyle = '#6a2a1a'; g.fillRect(x + dx, y + 30, 40, 82); g.fillStyle = '#c8a040'; g.fillRect(x + dx, y + 28, 40, 3); } }
          else {
            for (const wx of [20, 76]) {
              g.fillStyle = '#7a3420'; g.beginPath(); g.moveTo(x + wx - 3, y + 86); g.lineTo(x + wx - 3, y + 30); g.quadraticCurveTo(x + wx + 16, y + 6, x + wx + 35, y + 30); g.lineTo(x + wx + 35, y + 86); g.fill();
              glass(x + wx, y + 32, 32, 52, litOr(p * 0.5), '#7a3420');
            }
          }
          break;
      }
    }
  }

  // ── bottom strip: gold-shop fascias (red board, gold Thai letters — real font, never imagegen) ──
  for (let k = 0; k < 4; k++) {
    const x = k * 256, y = STRIP_Y;
    for (const [ctx, glow] of [[g, false], [ge, true]] as [Ctx, boolean][]) {
      ctx.fillStyle = glow ? '#5a0a08' : '#b0161a'; ctx.fillRect(x, y, 256, 64);
      ctx.strokeStyle = glow ? '#c08a20' : '#e8b840'; ctx.lineWidth = 4; ctx.strokeRect(x + 4, y + 4, 248, 56);
      ctx.fillStyle = glow ? '#ffd060' : '#f4c84a';
      ctx.font = `700 ${k === 1 ? 34 : 40}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(GOLD_TEXTS[k], x + 128, y + 33, 236);
    }
  }
  // solid swatches
  const sw: [string, string][] = [['#ffffff', '#000000'], ['#ffffff', '#ff2a20'], ['#ffffff', '#ffc070'], ['#ffffff', '#30f0ff']];
  sw.forEach(([cc, ec], k) => { g.fillStyle = cc; g.fillRect(k * 64, STRIP_Y + 64, 64, 64); ge.fillStyle = ec; ge.fillRect(k * 64, STRIP_Y + 64, 64, 64); });

  const mk = (cv: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  return { map: mk(c), emissive: mk(e) };
}

// Street-name plates (Thai only, real font). 2 columns × 8 rows of 512 × 64.
export function createSignAtlas(names: string[], green: number[]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d')!;
  names.forEach((n, k) => {
    const x = (k % 2) * 512, y = Math.floor(k / 2) * 64;
    g.fillStyle = green[k] ? '#1f6b3a' : '#1d4f9c';
    g.fillRect(x, y, 512, 64);
    g.strokeStyle = '#f2f2f2'; g.lineWidth = 4; g.strokeRect(x + 5, y + 5, 502, 54);
    g.fillStyle = '#ffffff'; g.font = `700 36px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`ถ.${n}`, x + 256, y + 34, 480);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export const signUV = (k: number) => {
  const x = (k % 2) * 512, y = Math.floor(k / 2) * 64;
  return { u0: (x + 2) / 1024, u1: (x + 510) / 1024, v0: 1 - (y + 62) / 512, v1: 1 - (y + 2) / 512 };
};

// Soft radial pool for street-light spill on the asphalt (additive).
export function createPoolTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
