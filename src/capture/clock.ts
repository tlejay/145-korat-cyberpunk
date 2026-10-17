// Virtual clock for the demo/capture mode (?demo=1). Installed before boot():
// - performance.now() and the rAF timestamp advance exactly 1/60 s per frame (never wall time),
// - Math.random() becomes a seeded PRNG (rain, particles, flicker repeat run after run),
// - CSS animations/transitions are paused and scrubbed to the virtual time.
// Auto mode ticks once per real rAF; manual mode (fixedDt=1) ticks only when step() is called,
// so a recorder can screenshot every frame no matter how slow the machine is.

export const FRAME_MS = 1000 / 60;

const realRaf = window.requestAnimationFrame.bind(window);
const realNow = performance.now.bind(performance);

let vt = 0;
let nextId = 1;
let queue: { id: number; cb: FrameRequestCallback }[] = [];
let manual = false;
let beforeTick: (() => void) | null = null;
const anims = new WeakMap<Animation, number>();

export const clock = {
  get now() { return vt; },
  get frame() { return Math.round(vt / FRAME_MS); },
  realNow,
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function installClock(seed: number) {
  Math.random = mulberry32(seed || 1);
  performance.now = () => vt;
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    const id = nextId++;
    queue.push({ id, cb });
    return id;
  };
  window.cancelAnimationFrame = (id: number) => { queue = queue.filter((q) => q.id !== id); };
  const pump = () => {
    if (!manual) tick();
    realRaf(pump);
  };
  realRaf(pump);
}

/** Called at the start of every frame, before the game's rAF callbacks (sim + shot script). */
export function onBeforeTick(fn: () => void) { beforeTick = fn; }

export function setManual(on: boolean) { manual = on; }

/** Advance virtual time without drawing (pre-roll). The game loop does not see these frames. */
export function skipTime(ms: number) { vt += ms; }

export function tick() {
  vt += FRAME_MS;
  beforeTick?.();
  const q = queue;
  queue = [];
  for (const { cb } of q) cb(vt);
  scrubCss();
}

// CSS animations/transitions follow virtual time (toasts, countdown digits, result screen).
function scrubCss() {
  if (!document.getAnimations) return;
  for (const a of document.getAnimations()) {
    let t0 = anims.get(a);
    if (t0 === undefined) { t0 = vt; anims.set(a, t0); a.pause(); }
    a.currentTime = vt - t0;
  }
}

/** Resolves after the browser has presented at least one real frame (safe point for a screenshot). */
export const presented = () => new Promise<void>((r) => realRaf(() => realRaf(() => r())));
