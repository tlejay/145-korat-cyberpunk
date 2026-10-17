// Player settings (localStorage, per device). Defaults per GAMEPLAY §1 + Tle 18:44 (no auto-throttle).
export interface Settings {
  assist: 'off' | 'normal' | 'high';
  autoThrottle: boolean;
  haptics: boolean;
  reduceShake: boolean;
  reduceFlicker: boolean; // VIS-04: neon signs stop dimming/flickering
  music: number; // 0..1
  sfx: number;
  muted: boolean;
  tutorialSeen: boolean;
}

const KEY = 'settings.v1';
const DEFAULTS: Settings = { assist: 'normal', autoThrottle: false, haptics: true, reduceShake: false, reduceFlicker: false, music: 0.7, sfx: 0.9, muted: false, tutorialSeen: false };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = load();

export function saveSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage blocked */ }
}

let lastBuzz = 0;
// Android only (iOS Safari has no vibrate); ≤ 1 per 100 ms (GAMEPLAY §1.4).
export function buzz(pattern: number | number[]) {
  if (!settings.haptics || typeof navigator.vibrate !== 'function') return;
  const now = performance.now();
  if (now - lastBuzz < 100) return;
  lastBuzz = now;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}
