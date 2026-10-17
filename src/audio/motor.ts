// Electric motor voice: a synthesized whine whose pitch follows road speed (single-speed
// gearbox → motor rpm ∝ wheel speed), plus a thin Kenney "space engine" loop for grit.
// research/audio/REPORT.md §4.3 option C. No gear shifts, no exhaust — AUD-09.

const TOP_KMH = 280;          // speed that maps to full pitch (track A tops out around here)
const F_IDLE = 55;            // Hz at standstill (inverter hum)
const F_SPAN = 1100;          // Hz added at TOP_KMH
const SLEW_PER_S = 2.6;       // max pitch ratio change per second → ≤ 1.6 % per 60 fps frame (AUD-02)

export interface MotorInput {
  speedKmh: number;
  accelKmhS: number;          // smoothed d(speed)/dt — positive = load, negative = regen
  airborne: boolean;
  boost: number;              // 0..1 envelope after a boost/launch
  enabled: boolean;           // false when the game stops driving update() (menu, results)
}

export class Motor {
  private osc: OscillatorNode[] = [];
  private muls: number[] = [];
  private filter: BiquadFilterNode;
  private out: GainNode;
  private layer: AudioBufferSourceNode | null = null;
  private layerGain: GainNode;
  private freq = F_IDLE;
  private started = false;

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.out = new GainNode(ctx, { gain: 0 });
    this.filter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 800, Q: 0.9 });
    this.filter.connect(this.out).connect(dest);
    // Fundamental (saw for body) + 2nd harmonic + a non-integer partial that gives the
    // characteristic EV "sing", + a faint high inverter tone.
    const parts: [OscillatorType, number, number][] = [
      ['sawtooth', 1, 0.22],
      ['sine', 2, 0.35],
      ['triangle', 4.5, 0.12],
      ['sine', 9, 0.04],
    ];
    for (const [type, mul, g] of parts) {
      const o = new OscillatorNode(ctx, { type, frequency: F_IDLE * mul });
      const gn = new GainNode(ctx, { gain: g });
      o.connect(gn).connect(this.filter);
      this.osc.push(o);
      this.muls.push(mul);
    }
    this.layerGain = new GainNode(ctx, { gain: 0 });
    this.layerGain.connect(dest);
  }

  /** Current fundamental in Hz — exposed to QA as engineRate. */
  get rate() {
    return this.freq;
  }

  start() {
    if (this.started) return;
    for (const o of this.osc) o.start();
    this.started = true;
  }

  get hasLayer() {
    return this.layer !== null;
  }

  /** Attach the looping sample layer (a source already set up with loop points). */
  attachLayer(src: AudioBufferSourceNode) {
    if (this.layer) return;
    src.connect(this.layerGain);
    src.start();
    this.layer = src;
  }

  update(i: MotorInput, dt: number) {
    const t = this.ctx.currentTime;
    const frac = Math.min(Math.max(i.speedKmh, 0) / TOP_KMH, 1.2);
    let target = F_IDLE + F_SPAN * Math.pow(frac, 0.9);
    if (i.airborne) target *= 1.12;               // wheels unloaded → spin up a touch
    target *= 1 + 0.08 * i.boost;

    const step = Math.pow(SLEW_PER_S, Math.min(dt, 0.1));
    this.freq = Math.min(Math.max(target, this.freq / step), this.freq * step);

    const load = Math.max(-1, Math.min(1, i.accelKmhS / 40));
    const pos = Math.max(load, 0);
    let vol = 0.1 + 0.32 * Math.pow(frac, 0.6) + 0.18 * pos + 0.15 * i.boost;
    if (load < 0) vol *= 1 + 0.25 * load;          // regen: quieter, darker
    if (!i.enabled) vol = 0;
    const cutoff = this.freq * 3 + 500 + 2600 * pos + 3000 * i.boost + (load < 0 ? 0 : 400);

    this.osc.forEach((o, k) => o.frequency.setTargetAtTime(this.freq * this.muls[k], t, 0.02));
    this.filter.frequency.setTargetAtTime(Math.min(cutoff, 12000), t, 0.05);
    this.out.gain.setTargetAtTime(Math.min(vol, 0.7), t, i.enabled ? 0.06 : 0.25);

    if (this.layer) {
      this.layer.playbackRate.setTargetAtTime(Math.min(0.55 + 1.3 * frac, 2.0), t, 0.05);
      this.layerGain.gain.setTargetAtTime(i.enabled ? 0.05 + 0.08 * frac + 0.05 * pos : 0, t, 0.08);
    }
  }
}
