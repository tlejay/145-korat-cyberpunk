// World scene module (owner: world pane). The game engine (src/game/engine.ts) owns the
// renderer/camera/loop; this folder provides the night environment and the QA top view.
export { setupNight, NIGHT_TIERS, type NightEnv } from './night.js';

export function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

// ?qa=1&view=top — lazy so it never ships in the game chunk.
export const startTopView = (canvas: HTMLCanvasElement, ui?: HTMLElement) =>
  import('./top-view.js').then((m) => m.startTopView(canvas, ui));
