// Art from the art pane (docs/dev/m3/art-manifest.json → public/assets/img/). Read at build time, so a
// missing manifest just means "no art yet" and every user falls back to procedural colours.
// The manifest schema is loose on purpose: each entry needs a file path and a role/use text; roles are
// matched by keywords (sky, cover, billboard, window, neon frame).

type Entry = Record<string, unknown>;
const mods = import.meta.glob<unknown>('../../docs/dev/m3/art-manifest.json', { eager: true, import: 'default' });
const manifest = Object.values(mods)[0] ?? null;

export interface ArtSet { sky: string | null; cover: string | null; billboards: string[]; windows: string[]; neonFrames: string[] }

function entries(m: unknown): Entry[] {
  if (!m || typeof m !== 'object') return [];
  if (Array.isArray(m)) return m.filter((e): e is Entry => !!e && typeof e === 'object');
  const o = m as Record<string, unknown>;
  for (const k of ['files', 'images', 'assets', 'entries', 'items']) if (Array.isArray(o[k])) return entries(o[k]);
  // { "path": { use… } } map
  return Object.entries(o).filter(([, v]) => v && typeof v === 'object').map(([k, v]) => ({ file: k, ...(v as Entry) }));
}

function urlOf(e: Entry): string | null {
  const f = [e.file, e.path, e.src, e.public, e.url, e.output].find((v) => typeof v === 'string') as string | undefined;
  if (!f) return null;
  if (/^https?:/.test(f)) return f;
  const rel = f.replace(/^\.?\//, '').replace(/^public\//, '');
  if (!/^assets\//.test(rel)) return null; // only files actually shipped in public/assets
  return `${import.meta.env.BASE_URL}${rel}`;
}

function roleOf(e: Entry): string {
  return [e.role, e.use, e.usage, e.kind, e.type, e.id, e.name, e.file, e.path, e.purpose].filter((v) => typeof v === 'string').join(' ').toLowerCase();
}

export function getArt(): ArtSet {
  const out: ArtSet = { sky: null, cover: null, billboards: [], windows: [], neonFrames: [] };
  for (const e of entries(manifest)) {
    const url = urlOf(e);
    if (!url) continue;
    const r = roleOf(e);
    if (/sky|pano|ฟ้า/.test(r) && !out.sky) out.sky = url;
    else if (/cover|loading|menu|og|ปก/.test(r) && !out.cover) out.cover = url;
    else if (/billboard|บิลบอร์ด|โฆษณา/.test(r)) out.billboards.push(url);
    else if (/window|หน้าต่าง/.test(r)) out.windows.push(url);
    else if (/neon|frame|ป้าย/.test(r)) out.neonFrames.push(url);
  }
  return out;
}

export function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}
