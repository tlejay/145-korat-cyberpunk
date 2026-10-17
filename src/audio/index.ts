// Game audio (M1-CONTRACTS createAudio). Web Audio only — no <audio> elements — so loops
// are sample-accurate and many sounds can overlap on iOS (research/audio/REPORT.md §4.2).
//
// Graph:  music → duck → musicVol ┐
//         amb   → duck → ambVol   ├→ compressor → master(mute) → destination
//         sfx (motor, tires, one-shots) → sfxVol ┤
//         voice (announcer)             → voiceVol┘
//
// Sound is never required: if the manifest or a file fails, the game keeps running silent.
import type { AudioEvent, CarState, GameAudio } from '../types.js';
import { AudioAssets } from './assets.js';
import { Motor } from './motor.js';

export type MusicName = 'menu' | 'race' | 'off';

export interface AudioDebug {
  contextState: 'suspended' | 'running' | 'closed' | 'none';
  unlocked: boolean; muted: boolean; musicVolume: number; sfxVolume: number;
  engineRate: number; playing: string[]; format: string; music: string | null;
}

/** GameAudio plus extras the game/QA may use; everything beyond the contract is optional to call. */
export interface KoratAudio extends GameAudio {
  setMuted(muted: boolean): void;
  readonly muted: boolean;
  readonly volumes: { music: number; sfx: number };
  /** Switch background music; race → final-lap version is done by play('finalLap'). */
  music(name: MusicName): void;
  /**
   * Schedule 3-2-1-GO on the audio clock. Returns AudioContext times of each beat
   * (index 3 = GO). Drive the on-screen digits from now() so picture and voice land together.
   */
  countdown(stepSec?: number): number[];
  /** Stop beats still scheduled by countdown() (restart / back to menu mid-countdown). */
  cancelCountdown(): void;
  now(): number;
  /** Pause/resume all sound (game pause menu). Tab hide/show is handled automatically. */
  pause(): void;
  resume(): void;
  debug(): AudioDebug;
}

const STORE_KEY = 'korat.audio.v1';
const POOL = 4;                                  // max overlapping voices per sound id
const DUCK_MUSIC = 0.4;                          // ≈ −8 dB under the announcer (REPORT §8.3)
const DUCK_AMB = 0.63;                           // ≈ −4 dB
const VOICE_COOLDOWN = 8;                        // s between "nice drift" / "great jump"

type VoiceId = 'vo-three' | 'vo-two' | 'vo-one' | 'vo-go' | 'vo-final-lap' | 'vo-new-record' | 'vo-finish'
  | 'vo-boost' | 'vo-nice-drift' | 'vo-great-jump';
const VOICE_PRIORITY: Record<VoiceId, number> = {
  'vo-three': 5, 'vo-two': 5, 'vo-one': 5, 'vo-go': 5, 'vo-final-lap': 4, 'vo-finish': 3,
  'vo-new-record': 2, 'vo-boost': 1, 'vo-nice-drift': 0, 'vo-great-jump': 0,
};

// Per-sound mix trims (linear). Tuned by ear on the ?qa=1&view=audio page.
const TRIM: Record<string, number> = {
  'ui-click': 0.6, 'ui-confirm': 0.6, 'ui-back': 0.6, beep: 0.35, 'beep-go': 0.45, checkpoint: 0.5,
  'jingle-finish': 0.7, 'jingle-lose': 0.7, 'crash-heavy': 0.9, 'crash-light': 0.7,
  'boost-blast': 0.8, 'boost-zap': 0.35, 'jump-air': 0.8, land: 0.9,
  rain: 0.45, city: 0.25, menu: 0.8, race: 0.8, 'race-final': 0.8,
};

interface Stored { music: number; sfx: number; muted: boolean }
function loadStored(): Stored {
  const d: Stored = { music: 0.6, sfx: 0.8, muted: false };
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<Stored> | null;
    if (s) {
      if (typeof s.music === 'number') d.music = clamp01(s.music);
      if (typeof s.sfx === 'number') d.sfx = clamp01(s.sfx);
      if (typeof s.muted === 'boolean') d.muted = s.muted;
    }
  } catch { /* private mode / blocked storage */ }
  return d;
}
function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}
const rand = (spread: number) => 1 + (Math.random() * 2 - 1) * spread;

interface Voice { id: string; src: AudioBufferSourceNode; gain: GainNode; endsAt: number }
interface MusicVoice { id: string; src: AudioBufferSourceNode; gain: GainNode; t0: number; loopLen: number; bpm: number }

export function createAudio(): KoratAudio {
  const Ctx: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return silentAudio();
  let ctx: AudioContext;
  try {
    ctx = new Ctx({ latencyHint: 'interactive' });
  } catch (e) {
    console.warn('[audio] AudioContext unavailable', e);
    return silentAudio();
  }

  const stored = loadStored();
  const assets = new AudioAssets(ctx);
  void assets.preloadAll();

  // --- mixer ---
  const comp = new DynamicsCompressorNode(ctx, { threshold: -10, knee: 6, ratio: 8, attack: 0.003, release: 0.2 });
  const master = new GainNode(ctx, { gain: stored.muted ? 0 : 1 });
  comp.connect(master).connect(ctx.destination);
  const musicVol = new GainNode(ctx, { gain: stored.music });
  const sfxVol = new GainNode(ctx, { gain: stored.sfx });
  const ambVol = new GainNode(ctx, { gain: stored.sfx });     // ambience follows the effects slider (REPORT §4.5)
  const voiceVol = new GainNode(ctx, { gain: stored.sfx });
  const musicDuck = new GainNode(ctx, { gain: 1 });
  const ambDuck = new GainNode(ctx, { gain: 1 });
  musicDuck.connect(musicVol).connect(comp);
  ambDuck.connect(ambVol).connect(comp);
  sfxVol.connect(comp);
  voiceVol.connect(comp);

  const motor = new Motor(ctx, sfxVol);
  const tireGain = new GainNode(ctx, { gain: 0 });
  tireGain.connect(sfxVol);
  let tireSrc: AudioBufferSourceNode | null = null;

  let unlocked = false;
  let paused = false;
  let muted = stored.muted;
  let volumes = { music: stored.music, sfx: stored.sfx };

  // --- one-shots with per-id voice pools ---
  const active = new Map<string, Voice[]>();
  function oneShot(id: string, opts: { gain?: number; rate?: number; when?: number; dest?: AudioNode } = {}): Voice | null {
    const buf = assets.get(id);
    if (!buf) {
      void assets.load(id);                        // late arrival: next trigger will have it
      return null;
    }
    const list = active.get(id) ?? [];
    while (list.length >= POOL) {
      const old = list.shift()!;
      try { old.src.stop(); } catch { /* already stopped */ }
    }
    const when = Math.max(opts.when ?? 0, ctx.currentTime);
    const rate = opts.rate ?? 1;
    const gain = new GainNode(ctx, { gain: (opts.gain ?? 1) * (TRIM[id] ?? 1) });
    const src = new AudioBufferSourceNode(ctx, { buffer: buf, playbackRate: rate });
    src.connect(gain).connect(opts.dest ?? sfxVol);
    src.start(when);
    const v: Voice = { id, src, gain, endsAt: when + buf.duration / rate };
    list.push(v);
    active.set(id, list);
    src.onended = () => {
      const l = active.get(id);
      const i = l ? l.indexOf(v) : -1;
      if (i >= 0) l!.splice(i, 1);
      gain.disconnect();
    };
    return v;
  }
  const sfx = (id: string, gain = 1, spread = 0.05) => oneShot(id, { gain, rate: rand(spread) });

  /** Looping source bounded by the manifest loop points — AAC adds a few ms of tail padding. */
  function loopSource(id: string, buf: AudioBuffer) {
    const e = assets.entry(id);
    const src = new AudioBufferSourceNode(ctx, { buffer: buf, loop: true });
    src.loopStart = e?.loopStart ?? 0;
    src.loopEnd = Math.min(e?.loopEnd ?? buf.duration, buf.duration);
    return src;
  }

  // --- ducking (music −8 dB, ambience −4 dB while the announcer talks) ---
  let duckHold = false;
  let duckUntil = 0;
  function duck(until: number) {
    const t = ctx.currentTime;
    duckUntil = Math.max(duckUntil, until);
    for (const [node, level] of [[musicDuck, DUCK_MUSIC], [ambDuck, DUCK_AMB]] as const) {
      node.gain.cancelScheduledValues(t);
      node.gain.setTargetAtTime(level, t, 0.03);
      if (!duckHold) node.gain.setTargetAtTime(1, duckUntil + 0.15, 0.15);
    }
  }
  function releaseDuck(at: number) {
    duckHold = false;
    for (const node of [musicDuck, ambDuck]) {
      node.gain.cancelScheduledValues(ctx.currentTime);
      node.gain.setTargetAtTime(1, Math.max(at, duckUntil + 0.15), 0.15);
    }
  }

  // --- announcer queue: one line at a time, higher priority cuts lower (REPORT §8.2) ---
  let currentVoice: (Voice & { prio: number }) | null = null;
  const lastSaid = new Map<string, number>();
  function say(id: VoiceId, when?: number) {
    const t = Math.max(when ?? 0, ctx.currentTime);
    const prio = VOICE_PRIORITY[id];
    if (currentVoice && currentVoice.endsAt > t) {
      if (prio > currentVoice.prio) {
        try { currentVoice.src.stop(t); } catch { /* ignore */ }
      } else if (prio >= 2 || currentVoice.endsAt - t <= 0.5) {
        return say(id, currentVoice.endsAt + 0.05);  // race-critical lines (or a short wait): queue right after
      } else {
        return;                                      // flavour line while busy: drop
      }
    }
    const v = oneShot(id, { when: t, dest: voiceVol });
    if (!v) return;
    currentVoice = { ...v, prio };
    lastSaid.set(id, t);
    duck(v.endsAt);
  }
  function sayCooled(id: VoiceId) {
    const last = lastSaid.get(id);
    if (last !== undefined && ctx.currentTime - last < VOICE_COOLDOWN) return;
    say(id);
  }

  // --- music: seamless buffer loops, final-lap switch on the next bar ---
  let music: MusicVoice | null = null;
  let musicWanted: MusicName = 'off';
  function startMusic(id: 'menu' | 'race' | 'race-final', at: number, fade: number) {
    const buf = assets.get(id);
    const e = assets.entry(id);
    if (!buf || !e) return null;
    const gain = new GainNode(ctx, { gain: 0 });
    const src = loopSource(id, buf);
    src.connect(gain).connect(musicDuck);
    const target = TRIM[id] ?? 1;
    src.start(at);
    if (fade > 0) {
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(target, at + fade);
    } else {
      gain.gain.setValueAtTime(target, at);
    }
    const bpm = assets.manifest?.music[id]?.bpm ?? 120;
    return { id, src, gain, t0: at, loopLen: src.loopEnd - src.loopStart, bpm };
  }
  function stopMusic(m: MusicVoice, at: number, fade: number, release = false) {
    m.gain.gain.cancelScheduledValues(at);
    m.gain.gain.setValueAtTime(m.gain.gain.value, at);
    m.gain.gain.linearRampToValueAtTime(0, at + fade);
    try { m.src.stop(at + fade + 0.05); } catch { /* ignore */ }
    m.src.onended = () => {
      m.gain.disconnect();
      if (release && music?.id !== m.id) assets.release(m.id);   // free ~35 MB decoded PCM
    };
  }
  function setMusic(name: MusicName) {
    musicWanted = name;
    const want = name === 'off' ? null : name;
    if (music && (music.id === want || (want === 'race' && music.id === 'race-final'))) return;
    if (!want) {
      if (music) stopMusic(music, ctx.currentTime, 1.2, true);
      music = null;
      return;
    }
    void assets.load(want).then(() => {
      if (musicWanted !== name || (music && music.id === want)) return;
      const t = ctx.currentTime + 0.02;
      if (music) stopMusic(music, t, 0.8, true);
      music = startMusic(want, t, want === 'race' ? 0.3 : 1.0);
    });
  }
  function switchToFinal() {
    void assets.load('race-final').then((buf) => {
      if (!buf || !music || music.id !== 'race') return;
      const bar = 240 / music.bpm;
      const now = ctx.currentTime;
      const elapsed = now - music.t0;
      const next = music.t0 + Math.ceil((elapsed + 0.08) / bar) * bar;  // next downbeat of the current track
      const old = music;
      music = startMusic('race-final', next, bar);
      stopMusic(old, next, bar, true);
    });
  }

  // --- ambience loops ---
  let ambStarted = false;
  function startAmbience() {
    if (ambStarted) return;
    ambStarted = true;
    for (const id of ['rain', 'city']) {
      void assets.load(id).then((buf) => {
        if (!buf) return;
        const g = new GainNode(ctx, { gain: 0 });
        const s = loopSource(id, buf);
        s.connect(g).connect(ambDuck);
        s.start(ctx.currentTime, Math.random() * s.loopEnd);   // desync the two loops
        g.gain.setTargetAtTime(TRIM[id] ?? 1, ctx.currentTime, 0.8);
      });
    }
  }

  // --- procedural air whoosh for boost (sweeps up; complements the fixed-length file) ---
  let noise: AudioBuffer | null = null;
  function whoosh(dur = 0.7) {
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime;
    const src = new AudioBufferSourceNode(ctx, { buffer: noise, loop: true });
    const bp = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 500, Q: 1.2 });
    const g = new GainNode(ctx, { gain: 0 });
    src.connect(bp).connect(g).connect(sfxVol);
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(3200, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.start(t);
    src.stop(t + dur + 0.05);
    src.onended = () => g.disconnect();
  }

  // --- car-driven state ---
  let lastSpeed = 0;
  let accel = 0;
  let wasAirborne = false;
  let airStart = 0;
  let minVy = 0;
  let landVy = 0;
  let airtime = 0;
  let boostEnv = 0;
  let boostSaid = false;
  let lastUpdate = -1;
  let motorOn = false;
  let ambBoostDucked = false;

  function update(car: CarState, dt: number) {
    if (!unlocked || dt <= 0) return;
    const t = ctx.currentTime;
    lastUpdate = performance.now();
    const speed = Math.abs(car.speedKmh);
    const a = (speed - lastSpeed) / Math.min(dt, 0.1);
    accel += (a - accel) * Math.min(1, dt * 6);
    lastSpeed = speed;

    if (car.airborne) {
      if (!wasAirborne) { airStart = t; minVy = 0; }
      minVy = Math.min(minVy, car.velocity.y);
    } else if (wasAirborne) {
      landVy = minVy;
      airtime = t - airStart;
    }
    wasAirborne = car.airborne;

    boostEnv = Math.max(0, boostEnv - dt / 1.6);
    if (boostEnv > 0.3 !== ambBoostDucked) {
      ambBoostDucked = boostEnv > 0.3;                // rain steps back while boosting (GAMEPLAY §3.4)
      ambVol.gain.setTargetAtTime(volumes.sfx * (ambBoostDucked ? 0.55 : 1), t, 0.1);
    }

    const layer = assets.get('motor-layer');
    if (!motorOn) { motor.start(); motorOn = true; }
    if (layer && !motor.hasLayer) motor.attachLayer(loopSource('motor-layer', layer));
    motor.update({ speedKmh: speed, accelKmhS: accel, airborne: car.airborne, boost: boostEnv, enabled: true }, dt);

    // Tire squeal follows slip angle; silent in the air or on water.
    const slip = Math.abs(car.driftAngleDeg);
    let tire = 0;
    if (!car.airborne && car.onSurface !== 'water' && speed > 20) {
      tire = clamp01((slip - 6) / 25) * Math.min(1, speed / 60) * (car.drifting ? 0.55 : 0.3);
    }
    if (tire > 0 && !tireSrc) {
      const buf = assets.get('tire-loop');
      if (buf) {
        tireSrc = loopSource('tire-loop', buf);
        tireSrc.connect(tireGain);
        tireSrc.start();
      }
    }
    if (tireSrc) {
      tireSrc.playbackRate.setTargetAtTime(0.85 + 0.25 * Math.min(1, speed / 150), t, 0.1);
      tireGain.gain.setTargetAtTime(tire, t, tire > tireGain.gain.value ? 0.04 : 0.12);
    }
  }

  // Fade the motor/tires out when the game stops calling update() (menu, results, pause).
  setInterval(() => {
    if (!motorOn || lastUpdate < 0 || performance.now() - lastUpdate < 300) return;
    lastUpdate = -1;
    motor.update({ speedKmh: 0, accelKmhS: 0, airborne: false, boost: 0, enabled: false }, 0.1);
    tireGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  }, 250);

  function play(event: AudioEvent) {
    if (!unlocked) return;
    const t = ctx.currentTime;
    switch (event) {
      case 'countdown3':
      case 'countdown2':
      case 'countdown1': {
        if (event === 'countdown3') { duckHold = true; boostSaid = false; setMusic('race'); }
        say(event === 'countdown3' ? 'vo-three' : event === 'countdown2' ? 'vo-two' : 'vo-one');
        oneShot('beep', { gain: 0.25 });             // −12 dB under the voice
        break;
      }
      case 'go':
        say('vo-go');
        oneShot('beep-go', { gain: 0.4 });
        setMusic('race');
        releaseDuck(t + 0.5);
        break;
      case 'finalLap':
        say('vo-final-lap');
        switchToFinal();
        break;
      case 'finalStretch':
        switchToFinal(); // 1-lap race: faster BGM for the last 25 %, no "Final lap!" line
        break;
      case 'newRecord':
        say('vo-new-record');
        break;
      case 'finish': {
        say('vo-finish');
        oneShot('jingle-finish', { when: t + 0.2 });
        if (music) { stopMusic(music, t + 0.3, 1.5, true); music = null; }
        musicWanted = 'off';
        window.setTimeout(() => { if (musicWanted === 'off') setMusic('menu'); }, 3500);
        break;
      }
      case 'boost':
        sfx('boost-blast');
        sfx('boost-zap', 1, 0.03);
        whoosh();
        boostEnv = 1;
        if (!boostSaid) { boostSaid = true; say('vo-boost'); }   // only the first boost of a race teaches the button
        break;
      case 'jump':
        sfx('jump-air');
        break;
      case 'land': {
        const hit = clamp01(Math.abs(landVy) / 12);   // m/s down at touchdown
        sfx('land', 0.35 + 0.65 * hit);
        if (airtime > 1.0) sayCooled('vo-great-jump');
        landVy = 0;
        airtime = 0;
        break;
      }
      case 'crash': {
        const hard = lastSpeed > 50 || accel < -80;
        if (hard) sfx('crash-heavy', 0.6 + 0.4 * clamp01(lastSpeed / 150));
        else sfx('crash-light', 0.5 + 0.5 * clamp01(lastSpeed / 50), 0.1);
        break;
      }
      case 'checkpoint':
        sfx('checkpoint', 1, 0);
        break;
      case 'drift':
        sayCooled('vo-nice-drift');
        break;
      case 'uiTap':
        sfx('ui-click', 1, 0.08);
        break;
    }
  }

  let countdownVoices: Voice[] = [];
  function cancelCountdown() {
    for (const v of countdownVoices) {
      try { v.src.stop(); } catch { /* not started / already stopped */ }
      if (currentVoice?.src === v.src) currentVoice = null;
    }
    countdownVoices = [];
  }

  function countdown(stepSec = 0.8): number[] {
    cancelCountdown();
    if (!unlocked) return [];
    const t0 = ctx.currentTime + 0.05;
    const times = [0, 1, 2, 3].map((k) => t0 + k * stepSec);
    duckHold = true;
    boostSaid = false;
    setMusic('race');
    const words: VoiceId[] = ['vo-three', 'vo-two', 'vo-one', 'vo-go'];
    times.forEach((at, k) => {
      const v = oneShot(words[k], { when: at, dest: voiceVol });
      if (v) { currentVoice = { ...v, prio: 5 }; duck(v.endsAt); countdownVoices.push(v); }
      const b = oneShot(k === 3 ? 'beep-go' : 'beep', { when: at, gain: k === 3 ? 0.4 : 0.25 });
      if (b) countdownVoices.push(b);
    });
    releaseDuck(times[3] + 0.5);
    return times;
  }

  // --- tab hide/show: stop within one event (AUD-07 ≤ 200 ms) ---
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void ctx.suspend().catch(() => {});
    else if (unlocked && !paused) void ctx.resume().catch(() => {});
  });

  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ music: volumes.music, sfx: volumes.sfx, muted }));
    } catch { /* ignore */ }
  }

  const api: KoratAudio = {
    async unlock() {
      // Must run inside the first tap handler (iOS). Let sound play even with the silent switch on (Safari 17+).
      try {
        const nav = navigator as Navigator & { audioSession?: { type: string } };
        if (nav.audioSession) nav.audioSession.type = 'playback';
      } catch { /* not supported */ }
      try {
        const blip = ctx.createBuffer(1, 1, ctx.sampleRate);
        const s = new AudioBufferSourceNode(ctx, { buffer: blip });
        s.connect(ctx.destination);
        s.start();
        await ctx.resume();
      } catch (e) {
        console.warn('[audio] unlock failed', e);
      }
      if (!unlocked && ctx.state === 'running') {
        unlocked = true;
        startAmbience();
        void assets.load('race');                      // stream the race track while the menu is up (§4.4 step 3)
      }
    },
    update,
    play,
    setVolumes(m: number, s: number) {
      volumes = { music: clamp01(m), sfx: clamp01(s) };
      const t = ctx.currentTime;
      musicVol.gain.setTargetAtTime(volumes.music, t, 0.03);
      sfxVol.gain.setTargetAtTime(volumes.sfx, t, 0.03);
      voiceVol.gain.setTargetAtTime(volumes.sfx, t, 0.03);
      ambVol.gain.setTargetAtTime(volumes.sfx * (ambBoostDucked ? 0.55 : 1), t, 0.03);
      persist();
    },
    setMuted(m: boolean) {
      muted = m;
      master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.015);   // ≤ 100 ms (AUD-04)
      persist();
    },
    get muted() { return muted; },
    get volumes() { return { ...volumes }; },
    music: setMusic,
    countdown,
    cancelCountdown,
    now: () => ctx.currentTime,
    pause() {
      paused = true;
      void ctx.suspend().catch(() => {});
    },
    resume() {
      paused = false;
      if (unlocked && !document.hidden) void ctx.resume().catch(() => {});
    },
    debug() {
      const playing: string[] = [];
      for (const [id, l] of active) if (l.some((v) => v.endsAt > ctx.currentTime)) playing.push(id);
      if (music) playing.push(`music:${music.id}`);
      if (motorOn && lastUpdate >= 0) playing.push('motor');
      if (tireSrc && tireGain.gain.value > 0.01) playing.push('tire-loop');
      if (ambStarted) playing.push('rain', 'city');
      return {
        contextState: ctx.state as AudioDebug['contextState'],
        unlocked, muted, musicVolume: volumes.music, sfxVolume: volumes.sfx,
        engineRate: motor.rate, playing, format: assets.format, music: music?.id ?? null,
      };
    },
  };
  return api;
}

/** Fallback when the browser has no Web Audio: the game runs without sound. */
function silentAudio(): KoratAudio {
  const vol = { music: 0, sfx: 0 };
  return {
    unlock: async () => {},
    update() {},
    play() {},
    setVolumes() {},
    setMuted() {},
    muted: true,
    volumes: vol,
    music() {},
    countdown: () => [],
    cancelCountdown() {},
    now: () => performance.now() / 1000,
    pause() {},
    resume() {},
    debug: () => ({ contextState: 'none', unlocked: false, muted: true, musicVolume: 0, sfxVolume: 0, engineRate: 0, playing: [], format: 'none', music: null }),
  };
}
