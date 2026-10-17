// Sponsor artwork, all drawn on canvas with the real fonts (no image-generated text):
//   MADEBYTLE — madebytle BRAND.md §3–4: #050505 field, gradient #818cf8 → #c084fc → #f472b6, "T" mark,
//               wordmark "made by tle" with "tle" in the gradient.
//   NDA       — สมาคมดิจิทัลนครราชสีมา: official logo converted for dark boards (scripts/sponsor-logos.py →
//               public/assets/sponsors/nda-h-dark.png). If that ONE file is missing, the board falls back
//               to the Thai name in Noto Sans Thai bold.
// Billboard backgrounds come from the art pane (docs/dev/m3/art-manifest.json, roles containing "sponsor").
import * as THREE from 'three';

export type SponsorId = 'madebytle' | 'nda';
export const SPONSORS: SponsorId[] = ['madebytle', 'nda'];

export const NDA_LOGO_URL = `${import.meta.env.BASE_URL}assets/sponsors/nda-h-dark.png`;
const FONT = '"Noto Sans Thai", system-ui, sans-serif';
const NDA_TH = 'สมาคมดิจิทัลนครราชสีมา';
const MBT_GRAD = ['#818cf8', '#c084fc', '#f472b6'];
const NDA_ORANGE = '#f26b38';

// art-pane backgrounds for the billboards (optional, build-time manifest)
type Entry = Record<string, unknown>;
const manifestMods = import.meta.glob<unknown>('../../docs/dev/m3/art-manifest.json', { eager: true, import: 'default' });
function sponsorBgUrls(): string[] {
  const m = Object.values(manifestMods)[0];
  if (!m || typeof m !== 'object') return [];
  const list: Entry[] = Array.isArray(m) ? m : (['files', 'images', 'assets', 'entries', 'items'].map((k) => (m as Record<string, unknown>)[k]).find(Array.isArray) as Entry[] | undefined)
    ?? Object.entries(m as Record<string, unknown>).filter(([, v]) => v && typeof v === 'object').map(([k, v]) => ({ file: k, ...(v as Entry) }));
  const out: string[] = [];
  for (const e of list) {
    const f = [e.file, e.path, e.src, e.public, e.output].find((v) => typeof v === 'string') as string | undefined;
    if (!f || !/sponsor/i.test(JSON.stringify(e))) continue;
    const rel = f.replace(/^\.?\//, '').replace(/^public\//, '');
    if (/^assets\//.test(rel)) out.push(`${import.meta.env.BASE_URL}${rel}`);
  }
  return out;
}

// ── shared assets (logo image, fonts) ──
let ndaLogo: HTMLImageElement | null = null;
let bgImgs: HTMLImageElement[] = [];
const redraws: (() => void)[] = [];
let assetsStarted = false;

function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}

function startAssets() {
  if (assetsStarted || typeof document === 'undefined') return;
  assetsStarted = true;
  const fonts = document.fonts
    ? Promise.race([
      Promise.all([document.fonts.load(`700 60px ${FONT}`, NDA_TH), document.fonts.load(`700 60px ${FONT}`, 'made by tle')]),
      new Promise((r) => setTimeout(r, 3000)),
    ]).catch(() => undefined)
    : Promise.resolve();
  const urls = sponsorBgUrls();
  void Promise.all([fonts, loadImg(NDA_LOGO_URL), Promise.all(urls.map(loadImg))]).then(([, logo, bgs]) => {
    ndaLogo = logo;
    bgImgs = bgs.filter((b): b is HTMLImageElement => !!b);
    for (const r of redraws) r();
  });
}

// ── drawing primitives ──
function grad(g: CanvasRenderingContext2D, x0: number, x1: number, y0 = 0, y1 = 0) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  MBT_GRAD.forEach((c, i) => gr.addColorStop(i / 2, c));
  return gr;
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

/** madebytle "T" mark: #050505 rounded square (rx = 8/32 of the side), gradient T, gradient hairline. */
function drawMark(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  roundRect(g, x, y, s, s, s * 0.25);
  g.fillStyle = '#050505';
  g.fill();
  g.lineWidth = Math.max(2, s * 0.04);
  g.strokeStyle = grad(g, x, x + s, y, y + s);
  g.stroke();
  // T as two bars (weight-800 look without depending on an 800 font file)
  g.fillStyle = grad(g, x, x + s, y, y + s);
  const bar = s * 0.16;
  g.fillRect(x + s * 0.22, y + s * 0.22, s * 0.56, bar);
  g.fillRect(x + s * 0.5 - bar / 2, y + s * 0.22, bar, s * 0.58);
}

/** wordmark "made by tle" ("tle" gradient). Returns drawn width. size = font px. */
function drawWordmark(g: CanvasRenderingContext2D, x: number, cy: number, size: number, measureOnly = false) {
  g.font = `700 ${size}px ${FONT}`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  const a = 'made by ', b = 'tle';
  const wa = g.measureText(a).width, wb = g.measureText(b).width;
  if (!measureOnly) {
    g.fillStyle = '#f2f2f6';
    g.fillText(a, x, cy);
    g.fillStyle = grad(g, x + wa, x + wa + wb);
    g.fillText(b, x + wa, cy);
  }
  return wa + wb;
}

/** mark + wordmark centred in a box. */
function drawMbtLockup(g: CanvasRenderingContext2D, cx: number, cy: number, h: number) {
  const s = h, size = h * 0.86, gap = h * 0.32;
  const w = s + gap + drawWordmark(g, 0, 0, size, true);
  const x = cx - w / 2;
  drawMark(g, x, cy - s / 2, s);
  drawWordmark(g, x + s + gap, cy + size * 0.02, size);
  return w;
}

/** NDA logo (dark version) + optional Thai name; returns width used. */
function drawNdaLockup(g: CanvasRenderingContext2D, cx: number, cy: number, h: number, thai: boolean, thaiPx = h * 0.42) {
  const logo = ndaLogo;
  const lw = logo ? (h * logo.naturalWidth) / logo.naturalHeight : 0;
  g.font = `700 ${thaiPx}px ${FONT}`;
  const tw = thai || !logo ? g.measureText(NDA_TH).width : 0;
  const gap = logo && tw ? h * 0.45 : 0;
  const total = lw + gap + tw;
  let x = cx - total / 2;
  if (logo) {
    g.drawImage(logo, x, cy - h / 2, lw, h); // aspect kept exactly (never stretched)
    x += lw + gap;
  }
  if (tw) {
    g.fillStyle = '#ffffff';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(NDA_TH, x, cy);
  }
  return total;
}

// ── perimeter board / gantry strip: 1024 × 128 (8 : 1) ──
export const STRIP_W = 1024, STRIP_H = 128;

function drawStrip(g: CanvasRenderingContext2D, id: SponsorId, ox: number, oy: number) {
  g.save();
  g.beginPath();
  g.rect(ox, oy, STRIP_W, STRIP_H);
  g.clip();
  if (id === 'madebytle') {
    g.fillStyle = '#050505';
    g.fillRect(ox, oy, STRIP_W, STRIP_H);
    // soft brand glow behind each lockup
    for (const k of [0.25, 0.75]) {
      const rg = g.createRadialGradient(ox + STRIP_W * k, oy + STRIP_H / 2, 4, ox + STRIP_W * k, oy + STRIP_H / 2, 260);
      rg.addColorStop(0, 'rgba(129,140,248,0.20)');
      rg.addColorStop(1, 'rgba(5,5,5,0)');
      g.fillStyle = rg;
      g.fillRect(ox, oy, STRIP_W, STRIP_H);
    }
    for (const k of [0.25, 0.75]) drawMbtLockup(g, ox + STRIP_W * k, oy + STRIP_H * 0.47, 66);
    g.fillStyle = grad(g, ox, ox + STRIP_W);
    g.fillRect(ox, oy + STRIP_H - 9, STRIP_W, 9);
  } else {
    g.fillStyle = '#0a0807';
    g.fillRect(ox, oy, STRIP_W, STRIP_H);
    g.fillStyle = NDA_ORANGE;
    g.fillRect(ox, oy + STRIP_H - 9, STRIP_W, 9);
    drawNdaLockup(g, ox + STRIP_W / 2, oy + STRIP_H * 0.47, 92, true, 46);
  }
  g.restore();
}

// Shared atlas for every sponsor mesh: row 0 = madebytle, row 1 = NDA (1024 × 256 → 1.3 MB GPU with mips).
let atlas: THREE.CanvasTexture | null = null;
export function getAtlas(): THREE.CanvasTexture {
  if (atlas) return atlas;
  const c = document.createElement('canvas');
  c.width = STRIP_W;
  c.height = STRIP_H * 2;
  const g = c.getContext('2d')!;
  const draw = () => { drawStrip(g, 'madebytle', 0, 0); drawStrip(g, 'nda', 0, STRIP_H); };
  draw();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  redraws.push(() => { draw(); tex.needsUpdate = true; });
  startAssets();
  atlas = tex;
  return tex;
}
/** v-range of a sponsor row in the atlas (flipY: canvas top = v 1). */
export const atlasRow = (id: SponsorId): [number, number] => (id === 'madebytle' ? [0.5, 1] : [0, 0.5]);

// ── rooftop billboard: 512 × 205 (2.5 : 1, the 10 × 4 m board of the neon pane) ──
const BB_W = 512, BB_H = 205;

function drawBillboard(g: CanvasRenderingContext2D, id: SponsorId, variant: number) {
  const bg = bgImgs.length ? bgImgs[variant % bgImgs.length] : null;
  g.fillStyle = '#050505';
  g.fillRect(0, 0, BB_W, BB_H);
  if (bg) {
    const k = Math.max(BB_W / bg.naturalWidth, BB_H / bg.naturalHeight);
    g.drawImage(bg, (BB_W - bg.naturalWidth * k) / 2, (BB_H - bg.naturalHeight * k) / 2, bg.naturalWidth * k, bg.naturalHeight * k);
    g.fillStyle = 'rgba(4,3,8,0.55)'; // keep the lockup readable over any artwork
    g.fillRect(0, 0, BB_W, BB_H);
  } else if (id === 'madebytle') {
    const lg = g.createLinearGradient(0, 0, BB_W, BB_H);
    lg.addColorStop(0, '#0b0a1f');
    lg.addColorStop(1, '#050505');
    g.fillStyle = lg;
    g.fillRect(0, 0, BB_W, BB_H);
    // diagonal brand sweep (ref-1 style)
    g.save();
    g.globalAlpha = 0.55;
    g.fillStyle = grad(g, BB_W * 0.55, BB_W, 0, BB_H);
    g.beginPath();
    g.moveTo(BB_W * 0.72, 0); g.lineTo(BB_W, 0); g.lineTo(BB_W, BB_H); g.lineTo(BB_W * 0.5, BB_H);
    g.closePath();
    g.fill();
    g.restore();
  } else {
    const lg = g.createLinearGradient(0, 0, BB_W, BB_H);
    lg.addColorStop(0, '#140906');
    lg.addColorStop(1, '#050505');
    g.fillStyle = lg;
    g.fillRect(0, 0, BB_W, BB_H);
    // the logo's pixel-grid idea as a quiet backdrop (brand orange tints, not a new mark)
    g.globalAlpha = 0.22;
    const tints = ['#f26b38', '#f7926a', '#f9a98a', '#fcd2c2'];
    for (let i = 0; i < 9; i++) {
      g.fillStyle = tints[i % tints.length];
      g.fillRect(BB_W - 34 - (i % 3) * 30 - (i > 5 ? 30 : 0), 14 + Math.floor(i / 3) * 30, 28, 28);
    }
    g.globalAlpha = 1;
  }
  if (id === 'madebytle') {
    drawMbtLockup(g, BB_W / 2, BB_H * 0.42, 62);
    g.font = `700 22px ${FONT}`;
    g.fillStyle = '#c9cbe0';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('madebytle.com', BB_W / 2, BB_H * 0.76);
    g.fillStyle = grad(g, 0, BB_W);
    g.fillRect(0, BB_H - 6, BB_W, 6);
  } else {
    drawNdaLockup(g, BB_W / 2, BB_H * 0.4, 92, false);
    g.font = `700 30px ${FONT}`;
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (ndaLogo) g.fillText(NDA_TH, BB_W / 2, BB_H * 0.8, BB_W - 40);
    g.fillStyle = NDA_ORANGE;
    g.fillRect(0, BB_H - 6, BB_W, 6);
  }
}

// ── public texture API (src/scene/visuals.ts reads .image of the billboard ones) ──
const texCache = new Map<string, THREE.CanvasTexture>();

/** Sponsor for slot index i: billboards alternate madebytle / NDA (3 + 2 over the 5 anchors). */
export const sponsorFor = (i: number): SponsorId => SPONSORS[((i % 2) + 2) % 2];

export function getSponsorTexture(slot: 'billboard' | 'board' | 'gantry', i: number): THREE.Texture {
  const id = sponsorFor(i);
  const key = slot === 'billboard' ? `bb:${id}:${i}` : `strip:${id}`;
  let tex = texCache.get(key);
  if (tex) return tex;
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  let draw: () => void;
  if (slot === 'billboard') {
    c.width = BB_W; c.height = BB_H;
    draw = () => drawBillboard(g, id, Math.floor(i / 2));
  } else {
    c.width = STRIP_W; c.height = STRIP_H;
    draw = () => drawStrip(g, id, 0, 0);
  }
  draw();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  redraws.push(() => { draw(); t.needsUpdate = true; });
  startAssets();
  texCache.set(key, t);
  tex = t;
  return tex;
}
