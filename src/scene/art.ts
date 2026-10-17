// Art from the art pane (docs/dev/m3/art-manifest.json → public/assets/img/). Read at build time, so a
// missing manifest just means "no art yet" and every user falls back to procedural colours.
// Every entry is { file, use, size, lo?: { file } , cells_px? }. Sponsor backgrounds (sponsor-bg-*) are
// consumed by src/sponsors itself; og-cover goes into index.html.
//
// GPU budget (QA ≤ 32 MB): windows, neon frames and billboard art are *drawn into canvases that already
// exist* (facade atlas, sign atlas, billboard atlas) → 0 MB extra. Only the sky is a new texture, and it
// always uses the -lo file (1024×512 ≈ 2.7 MB with mips).

type Entry = { file?: string; use?: string; lo?: { file?: string }; cells_px?: number[][] };
const mods = import.meta.glob<unknown>('../../docs/dev/m3/art-manifest.json', { eager: true, import: 'default' });
const manifest = (Object.values(mods)[0] ?? null) as { files?: Entry[] } | null;

export interface ArtFile { full: string; lo: string }
export interface ArtSet {
  sky: ArtFile | null;
  cover: string | null;       // 1920×1080 (desktop)
  coverSmall: string | null;  // 1280×720 (phones)
  billboards: ArtFile[];
  windows: ArtFile[];         // tileable bay × storey modules
  neonFrames: (ArtFile & { cells: number[][] }) | null; // cells in full-res px [x, y, w, h]
}

function url(f: string | undefined): string | null {
  if (!f) return null;
  const rel = f.replace(/^\.?\//, '').replace(/^public\//, '');
  return /^assets\//.test(rel) ? `${import.meta.env.BASE_URL}${rel}` : null;
}

let cached: ArtSet | null = null;
export function getArt(): ArtSet {
  if (cached) return cached;
  const out: ArtSet = { sky: null, cover: null, coverSmall: null, billboards: [], windows: [], neonFrames: null };
  for (const e of manifest?.files ?? []) {
    const full = url(e.file);
    if (!full) continue;
    const af: ArtFile = { full, lo: url(e.lo?.file) ?? full };
    const name = full.split('/').pop() ?? '';
    if (/^sky-/.test(name)) out.sky = af;
    else if (/^cover-1280/.test(name)) out.coverSmall = full;
    else if (/^cover-/.test(name)) out.cover = full;
    else if (/^billboard-/.test(name)) out.billboards.push(af);
    else if (/^window-/.test(name)) out.windows.push(af);
    else if (/^neon-frames/.test(name)) out.neonFrames = { ...af, cells: e.cells_px ?? [] };
  }
  out.billboards.sort((a, b) => a.full.localeCompare(b.full));
  out.windows.sort((a, b) => a.full.localeCompare(b.full));
  return (cached = out);
}

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}
