// Graphics quality tiers (M1-CONTRACTS "งบมือถือ"). Physics never depends on quality.
// URL ?quality=low|medium|high (TEST-HOOKS H-03) overrides; otherwise a cheap device guess.
import type { Quality } from '../types.js';

export interface QualitySettings {
  tier: Quality;
  maxDpr: number;        // MOB-14: ≤ 2, low ≤ 1.25
  viewDistM: number;     // camera far plane / fog end
  shadows: boolean;
  antialias: boolean;
  rain: 0 | 1 | 2;       // GAMEPLAY §3.4 — low = wet road only
  minimap: boolean;
}

export const QUALITY: Record<Quality, QualitySettings> = {
  low: { tier: 'low', maxDpr: 1.25, viewDistM: 260, shadows: false, antialias: false, rain: 0, minimap: true },
  mid: { tier: 'mid', maxDpr: 1.75, viewDistM: 420, shadows: false, antialias: true, rain: 1, minimap: true },
  high: { tier: 'high', maxDpr: 2, viewDistM: 650, shadows: true, antialias: true, rain: 2, minimap: true },
};

type Listener = (q: QualitySettings) => void;
const listeners = new Set<Listener>();

export const toQaName = (q: Quality): 'low' | 'medium' | 'high' => (q === 'mid' ? 'medium' : q);
export const fromQaName = (q: string): Quality | null =>
  q === 'medium' || q === 'mid' ? 'mid' : q === 'low' || q === 'high' ? q : null;

function guess(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mobile = matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  if ((nav.deviceMemory ?? 8) <= 3 || cores <= 4) return 'low';
  return mobile ? 'mid' : 'high';
}

function initial(): Quality {
  const url = fromQaName(new URLSearchParams(location.search).get('quality') ?? '');
  if (url) return url;
  try {
    const saved = fromQaName(localStorage.getItem('quality.v1') ?? '');
    if (saved) return saved;
  } catch { /* storage blocked */ }
  return guess();
}

let current: QualitySettings = QUALITY[initial()];

export const getQuality = () => current;

export function setQuality(q: Quality, persist = true) {
  current = QUALITY[q];
  if (persist) {
    try { localStorage.setItem('quality.v1', q); } catch { /* ignore */ }
  }
  listeners.forEach((cb) => cb(current));
}

export function lowerQuality(): boolean {
  if (current.tier === 'low') return false;
  setQuality(current.tier === 'high' ? 'mid' : 'low');
  return true;
}

export function onQuality(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
