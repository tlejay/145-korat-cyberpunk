// Loads the other panes' modules when their files exist, otherwise falls back to
// game-ui stubs. import.meta.glob resolves at build time, so a missing file is
// simply an empty map — no build error while panes are still working.
import type * as THREE from 'three';
import type { BuildCarModel, CreateAudio, CreateCar, GameAudio, LoadTrack, Track } from '../types.js';

const trackMods = import.meta.glob<{ loadTrack?: LoadTrack }>('../track/index.ts');
const modelMods = import.meta.glob<{ buildCarModel?: BuildCarModel }>('../car/model.ts');
const carMods = import.meta.glob<{ createCar?: CreateCar }>('../car/index.ts');
const audioMods = import.meta.glob<{ createAudio?: CreateAudio }>('../audio/index.ts');

export interface Sources { track: 'real' | 'stub'; model: 'real' | 'stub'; physics: 'real' | 'stub'; audio: 'real' | 'stub' }
export const sources: Sources = { track: 'stub', model: 'stub', physics: 'stub', audio: 'stub' };

const first = async <T>(mods: Record<string, () => Promise<T>>): Promise<T | null> => {
  const load = Object.values(mods)[0];
  return load ? load() : null;
};

// ?stub=track,car forces stubs (handy when a pane's file is half-written).
const forced = new Set((new URLSearchParams(location.search).get('stub') ?? '').split(','));

export async function loadTrackModule(scene: THREE.Scene): Promise<Track> {
  const m = forced.has('track') ? null : await first(trackMods);
  if (m?.loadTrack) {
    sources.track = 'real';
    return m.loadTrack('A', scene);
  }
  const { loadStubTrack } = await import('./stub-track.js');
  return loadStubTrack(scene);
}

export async function loadCarModule() {
  const [model, phys] = forced.has('car') ? [null, null] : await Promise.all([first(modelMods), first(carMods)]);
  // The real mesh works with the stub physics (and vice versa) while panes finish.
  const stub = !model?.buildCarModel || !phys?.createCar ? await import('./stub-car.js') : null;
  const build = model?.buildCarModel ?? stub!.buildStubModel;
  const create = phys?.createCar ?? stub!.createStubCar;
  sources.model = model?.buildCarModel ? 'real' : 'stub';
  sources.physics = phys?.createCar ? 'real' : 'stub';
  return create(build());
}

const silent: GameAudio = { unlock: async () => {}, update() {}, play() {}, setVolumes() {} };

export async function loadAudioModule(): Promise<GameAudio> {
  try {
    const m = forced.has('audio') ? null : await first(audioMods);
    if (m?.createAudio) {
      sources.audio = 'real';
      return m.createAudio();
    }
  } catch {
    // ERR-06: audio failing must never block the game.
  }
  return silent;
}
