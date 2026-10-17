// Loads public/assets/audio/manifest.json (written by scripts/build-audio.sh) and
// decodes buffers on demand. Picks Opus (.ogg) where the browser can decode it,
// otherwise AAC (.m4a) — and falls back per file if a decode fails (older iOS).
// Audio is optional: every failure resolves to null and only logs to console.

export interface SoundEntry {
  path: string;
  kind: 'sfx' | 'amb' | 'music' | 'voice';
  duration: number;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  preload: boolean;
  bytes: { ogg: number; m4a: number };
}

export interface Manifest {
  version: number;
  music: Record<string, { bpm: number }>;
  sounds: Record<string, SoundEntry>;
}

const BASE = `${import.meta.env.BASE_URL}assets/audio/`;

function prefersOpus(): boolean {
  try {
    const a = document.createElement('audio');
    return a.canPlayType('audio/ogg; codecs="opus"') !== '';
  } catch {
    return false;
  }
}

export class AudioAssets {
  manifest: Manifest | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer | null>>();
  // Compressed bytes of large music files, kept so a released buffer can be re-decoded
  // without refetching (decodeAudioData detaches the ArrayBuffer, so we decode a copy).
  private compressed = new Map<string, { bytes: ArrayBuffer; ext: string }>();
  private ext = prefersOpus() ? 'ogg' : 'm4a';
  readonly ready: Promise<void>;

  constructor(private ctx: BaseAudioContext) {
    this.ready = fetch(`${BASE}manifest.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`manifest ${r.status}`))))
      .then((m: Manifest) => {
        this.manifest = m;
      })
      .catch((e) => console.warn('[audio] manifest unavailable, running silent', e));
  }

  get format() {
    return this.ext;
  }

  entry(id: string): SoundEntry | undefined {
    return this.manifest?.sounds[id];
  }

  get(id: string): AudioBuffer | null {
    return this.buffers.get(id) ?? null;
  }

  /** Load every preload:true sound (first-load budget, REPORT §4.4 steps 1–2). */
  async preloadAll(): Promise<void> {
    await this.ready;
    if (!this.manifest) return;
    const ids = Object.entries(this.manifest.sounds).filter(([, e]) => e.preload).map(([id]) => id);
    await Promise.all(ids.map((id) => this.load(id)));
  }

  load(id: string): Promise<AudioBuffer | null> {
    const have = this.buffers.get(id);
    if (have) return Promise.resolve(have);
    const inflight = this.pending.get(id);
    if (inflight) return inflight;
    const p = this.ready
      .then(() => this.fetchDecode(id))
      .then((buf) => {
        if (buf) this.buffers.set(id, buf);
        return buf;
      })
      .finally(() => this.pending.delete(id));
    this.pending.set(id, p);
    return p;
  }

  /** Drop a decoded music buffer (~35 MB each when decoded) but keep the compressed bytes. */
  release(id: string) {
    this.buffers.delete(id);
  }

  private async fetchDecode(id: string): Promise<AudioBuffer | null> {
    const e = this.entry(id);
    if (!e) return null;
    const keep = e.kind === 'music';
    const cached = this.compressed.get(id);
    if (cached) {
      try {
        return await this.ctx.decodeAudioData(cached.bytes.slice(0));
      } catch {
        this.compressed.delete(id);
      }
    }
    const order = this.ext === 'ogg' ? ['ogg', 'm4a'] : ['m4a'];
    for (const ext of order) {
      try {
        const r = await fetch(`${BASE}${e.path}.${ext}`);
        if (!r.ok) throw new Error(`${r.status}`);
        const bytes = await r.arrayBuffer();
        if (keep) this.compressed.set(id, { bytes, ext });
        const buf = await this.ctx.decodeAudioData(keep ? bytes.slice(0) : bytes);
        if (ext !== this.ext) this.ext = ext; // Opus decode failed once → stay on AAC
        return buf;
      } catch (err) {
        if (keep) this.compressed.delete(id);
        console.warn(`[audio] ${id}.${ext} failed`, err);
      }
    }
    return null;
  }
}
