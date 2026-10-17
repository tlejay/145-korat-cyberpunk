// Sponsor artwork, all drawn on canvas with the real fonts (no image-generated text):
//   MADEBYTLE — madebytle BRAND.md §3–4: #050505 field, gradient #818cf8 → #c084fc → #f472b6, "T" mark,
//               wordmark "made by tle" with "tle" in the gradient.
//   NDA       — สมาคมดิจิทัลนครราชสีมา: official logo converted for dark boards (scripts/sponsor-logos.py →
//               public/assets/sponsors/nda-h-dark.png). If that ONE file is missing, the board falls back
//               to the Thai name in Noto Sans Thai bold.
// Backgrounds come from the art pane (docs/dev/m3/art-manifest.json → public/assets/img/sponsor-bg-<id>-<slot>…
// .webp, ChatGPT art without any text). Every lockup sits on a dark plate so it reads over the busy art.
import * as THREE from 'three';

export type SponsorId = 'madebytle' | 'nda';
export const SPONSORS: SponsorId[] = ['madebytle', 'nda'];
type BgKind = 'billboard' | 'barrier' | 'gantry';
type BgKey = `${SponsorId | 'partners'}-${BgKind}`;

const ASSET = (f: string) => `${import.meta.env.BASE_URL}assets/sponsors/${f}`;
export const NDA_LOGO_URL = ASSET('nda-h-dark.png');        // white lettering — dark plates
const NDA_LOGO_COLOR_URL = ASSET('nda-h-color.png');        // official colours — light backgrounds only
const FONT = '"Noto Sans Thai", system-ui, sans-serif';
const NDA_TH = 'สมาคมดิจิทัลนครราชสีมา';
const MBT_GRAD = ['#818cf8', '#c084fc', '#f472b6'];
const NDA_ORANGE = '#f26b38';

// art-pane backgrounds (optional, build-time manifest): file name sponsor-bg-<id>-<slot>-<ratio>.webp
type Entry = Record<string, unknown>;
const manifestMods = import.meta.glob<unknown>('../../docs/dev/m3/art-manifest.json', { eager: true, import: 'default' });
function sponsorBgUrls(): Partial<Record<BgKey, string>> {
  const m = Object.values(manifestMods)[0];
  if (!m || typeof m !== 'object') return {};
  const list: Entry[] = Array.isArray(m) ? m : (['files', 'images', 'assets', 'entries', 'items'].map((k) => (m as Record<string, unknown>)[k]).find(Array.isArray) as Entry[] | undefined)
    ?? Object.entries(m as Record<string, unknown>).filter(([, v]) => v && typeof v === 'object').map(([k, v]) => ({ file: k, ...(v as Entry) }));
  const out: Partial<Record<BgKey, string>> = {};
  for (const e of list) {
    const f = [e.file, e.path, e.src, e.public, e.output].find((v) => typeof v === 'string') as string | undefined;
    const hit = f && /sponsor-bg-(madebytle|nda|partners)-(billboard|barrier|gantry)-[0-9x]+\.(webp|png|jpg)$/.exec(f); // skip "-lo" copies
    if (!f || !hit) continue;
    const rel = f.replace(/^\.?\//, '').replace(/^public\//, '');
    if (/^assets\//.test(rel)) out[`${hit[1]}-${hit[2]}` as BgKey] = `${import.meta.env.BASE_URL}${rel}`;
  }
  return out;
}

// ── shared assets (logos, backgrounds, fonts) ──
let ndaLogo: HTMLImageElement | null = null;
let ndaLogoColor: HTMLImageElement | null = null;
let bgs: Partial<Record<BgKey, HTMLImageElement>> = {};
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
  const urls = Object.entries(sponsorBgUrls()) as [BgKey, string][];
  void Promise.all([fonts, loadImg(NDA_LOGO_URL), loadImg(NDA_LOGO_COLOR_URL), Promise.all(urls.map(([, u]) => loadImg(u)))]).then(([, logo, logoC, imgs]) => {
    ndaLogo = logo;
    ndaLogoColor = logoC;
    bgs = {};
    urls.forEach(([k], i) => { const im = imgs[i]; if (im) bgs[k] = im; });
    for (const r of redraws) r();
  });
}

/** Draw an art background with "cover" fit into a rect. */
function cover(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  g.drawImage(img, x + (w - img.naturalWidth * k) / 2, y + (h - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
}
/** Dark rounded plate behind a lockup (keeps logos legible over art). */
function plate(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, fill: string) {
  roundRect(g, cx - w / 2, cy - h / 2, w, h, Math.min(h * 0.18, 14));
  g.fillStyle = fill;
  g.fill();
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

/** NDA logo + optional Thai name; returns width used. `light` = official colour logo for light backgrounds. */
function drawNdaLockup(g: CanvasRenderingContext2D, cx: number, cy: number, h: number, thai: boolean, thaiPx = h * 0.42, light = false, measureOnly = false) {
  const logo = light ? ndaLogoColor ?? ndaLogo : ndaLogo;
  const lw = logo ? (h * logo.naturalWidth) / logo.naturalHeight : 0;
  g.font = `700 ${thaiPx}px ${FONT}`;
  const tw = thai || !logo ? g.measureText(NDA_TH).width : 0;
  const gap = logo && tw ? h * 0.45 : 0;
  const total = lw + gap + tw;
  if (measureOnly) return total;
  let x = cx - total / 2;
  if (logo) {
    g.drawImage(logo, x, cy - h / 2, lw, h); // aspect kept exactly (never stretched)
    x += lw + gap;
  }
  if (tw) {
    g.fillStyle = light && logo === ndaLogoColor ? '#1a0f0a' : '#ffffff';
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
  const bg = bgs[`${id}-barrier`];
  const cy = oy + STRIP_H * 0.47;
  if (id === 'madebytle') {
    g.fillStyle = '#050505';
    g.fillRect(ox, oy, STRIP_W, STRIP_H);
    if (bg) cover(g, bg, ox, oy, STRIP_W, STRIP_H);
    else for (const k of [0.25, 0.75]) { // soft brand glow behind each lockup
      const rg = g.createRadialGradient(ox + STRIP_W * k, oy + STRIP_H / 2, 4, ox + STRIP_W * k, oy + STRIP_H / 2, 260);
      rg.addColorStop(0, 'rgba(129,140,248,0.20)');
      rg.addColorStop(1, 'rgba(5,5,5,0)');
      g.fillStyle = rg;
      g.fillRect(ox, oy, STRIP_W, STRIP_H);
    }
    for (const k of [0.25, 0.75]) {
      if (bg) plate(g, ox + STRIP_W * k, cy, 400, 96, 'rgba(5,5,5,0.86)');
      drawMbtLockup(g, ox + STRIP_W * k, cy, 66);
    }
    g.fillStyle = grad(g, ox, ox + STRIP_W);
    g.fillRect(ox, oy + STRIP_H - 9, STRIP_W, 9);
  } else {
    g.fillStyle = '#0a0807';
    g.fillRect(ox, oy, STRIP_W, STRIP_H);
    if (bg) {
      cover(g, bg, ox, oy, STRIP_W, STRIP_H);
      plate(g, ox + STRIP_W / 2, cy, drawNdaLockup(g, 0, 0, 92, true, 46, false, true) + 56, 112, 'rgba(26,15,10,0.9)');
    }
    g.fillStyle = NDA_ORANGE;
    g.fillRect(ox, oy + STRIP_H - 9, STRIP_W, 9);
    drawNdaLockup(g, ox + STRIP_W / 2, cy, 92, true, 46);
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

type BillboardId = SponsorId | 'partners';

function drawMbtBillboard(g: CanvasRenderingContext2D, cx: number, cy: number, h: number) {
  drawMbtLockup(g, cx, cy, h);
  g.font = `700 ${Math.round(h * 0.36)}px ${FONT}`;
  g.fillStyle = '#c9cbe0';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('madebytle.com', cx, cy + h * 0.95);
}

function drawBillboard(g: CanvasRenderingContext2D, id: BillboardId) {
  const bg = bgs[`${id}-billboard`] ?? null;
  g.fillStyle = id === 'nda' ? '#140906' : '#050505';
  g.fillRect(0, 0, BB_W, BB_H);
  if (bg) {
    cover(g, bg, 0, 0, BB_W, BB_H);
    if (id === 'madebytle') {
      // calm dark zone centre-left of the art (manifest: x 0.10–0.55)
      drawMbtBillboard(g, BB_W * 0.33, BB_H * 0.42, 44);
    } else if (id === 'nda') {
      // light-orange calm zone → official colour logo (black lettering), as the brief allows
      drawNdaLockup(g, BB_W * 0.3, BB_H * 0.4, 78, false, 0, true);
      g.font = `700 24px ${FONT}`;
      g.fillStyle = '#1a0f0a';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (ndaLogo || ndaLogoColor) g.fillText(NDA_TH, BB_W * 0.3, BB_H * 0.78, BB_W * 0.52);
    } else {
      // two calm zones: madebytle on the dark half, NDA (on a charcoal plate) on the orange half
      plate(g, BB_W * 0.25, BB_H * 0.5, 232, 104, 'rgba(5,5,5,0.7)');
      drawMbtBillboard(g, BB_W * 0.25, BB_H * 0.44, 30);
      plate(g, BB_W * 0.75, BB_H * 0.5, 232, 104, 'rgba(26,15,10,0.88)');
      drawNdaLockup(g, BB_W * 0.75, BB_H * 0.5, 62, false);
    }
    return;
  }
  // procedural fallback (no art yet)
  if (id !== 'nda') {
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
    drawMbtBillboard(g, BB_W / 2, BB_H * 0.42, 62);
    g.fillStyle = grad(g, 0, BB_W);
    g.fillRect(0, BB_H - 6, BB_W, 6);
  } else {
    const lg = g.createLinearGradient(0, 0, BB_W, BB_H);
    lg.addColorStop(0, '#140906');
    lg.addColorStop(1, '#050505');
    g.fillStyle = lg;
    g.fillRect(0, 0, BB_W, BB_H);
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

/** Sponsor for slot index i (boards, banners): alternates madebytle / NDA. */
export const sponsorFor = (i: number): SponsorId => SPONSORS[((i % 2) + 2) % 2];
/** Rooftop billboards 0..4: madebytle, NDA, madebytle, NDA, both partners. */
const billboardFor = (i: number): BillboardId => (i % 5 === 4 ? 'partners' : sponsorFor(i));

export function getSponsorTexture(slot: 'billboard' | 'board' | 'gantry', i: number): THREE.Texture {
  const id = sponsorFor(i), bid = billboardFor(i);
  const key = slot === 'billboard' ? `bb:${bid}` : `strip:${id}`;
  let tex = texCache.get(key);
  if (tex) return tex;
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  let draw: () => void;
  if (slot === 'billboard') {
    c.width = BB_W; c.height = BB_H;
    draw = () => drawBillboard(g, bid);
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
