// Minimal global game state shared by UI and QA hooks. Gameplay panes extend this.
export type GameState = 'loading' | 'menu' | 'countdown' | 'racing' | 'paused' | 'finished' | 'error';
export type ErrorKind = 'webgl' | 'webgl_lost' | 'mapload' | 'asset' | 'portrait' | 'lowfps' | 'unknown';

type Listener = (e: unknown) => void;

export const game = {
  state: 'loading' as GameState,
  error: null as null | { code: ErrorKind; shownText: string },
  startedAt: performance.now(),
  listeners: new Map<string, Set<Listener>>(),
};

export function setState(s: GameState) {
  game.state = s;
  emit('state', s);
}

export function emit(event: string, e: unknown) {
  game.listeners.get(event)?.forEach((cb) => cb(e));
}

export function on(event: string, cb: Listener): () => void {
  let set = game.listeners.get(event);
  if (!set) game.listeners.set(event, (set = new Set()));
  set.add(cb);
  return () => set.delete(cb);
}
