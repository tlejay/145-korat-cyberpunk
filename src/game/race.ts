// Race rules (GAMEPLAY §2.3, §3, §5.2): checkpoints, laps, timing, launch,
// respawn, style stats and the raw RunResult sent to the server (§6.1).
// Time is simulation time (sum of fixed steps) so pause never counts.
import type { Ghost } from '../net/ghost-format.js';
import { type RunResult, type TrackRule } from '../net/score.js';
import type { Car, InputState, Track, Vec2 } from '../types.js';
import { VERSION } from '../version.js';
import { GhostRecorder } from './ghost.js';
import { LoopPath, angleDiff, crosses, pointInPoly } from './path.js';

export const GAME = {
  // GAMEPLAY §8 "game.*" keys
  driftCountSlipDeg: 15, driftEnterKmh: 50,
  launchWindowS: 0.15, launchLateMaxS: 0.5, falseStartSpinS: 0.5,
  stuckPromptMs: 2000, stuckAutoMs: 3000, respawnBackM: 10,
  wrongWayS: 5, landingBonus: 0.05, refillGate: 0.35, refillGateM: 1250,
  countdownStepS: 0.8, turnLeadS: 2.5, shortcutHintM: 150,
};

export type RaceEvent =
  | { type: 'checkpoint'; id: number; lap: number; deltaMs: number | null }
  | { type: 'lap'; lap: number; lapMs: number; best: boolean }
  | { type: 'finalLap' }
  | { type: 'finalStretch' } // last 25 % of the last lap → faster BGM (1-lap race, Tle 21:14)
  | { type: 'finish' }
  | { type: 'respawn'; reason: string }
  | { type: 'jump' } | { type: 'land'; clean: boolean; shortcut: boolean }
  | { type: 'boost' } | { type: 'collision'; impulse: number; kind: string }
  | { type: 'toast'; text: string } | { type: 'combo'; text: string }
  | { type: 'launch'; result: 'perfect' | 'spin' | 'late' | 'none'; g: number }
  | { type: 'refill' };

export interface RaceOptions { laps: number; rule: TrackRule; refGhost: Ghost | null; onEvent: (e: RaceEvent) => void }

export class Race {
  readonly path: LoopPath;
  lap = 1;
  timeMs = 0;              // since GO
  lapStartMs = 0;
  lapTimes: number[] = [];
  bestLapMs: number | null = null;
  progressM = 0;           // metres along the loop (0 = finish line)
  lapProgressM = 0;        // metres driven this lap (monotonic-ish)
  nextCp = 0;
  missed = 0;
  respawns = 0;
  outOfBounds = 0;
  stuckMs = 0;
  offTrack = false;
  distFromCenter = 0;
  wrongWayS = 0;
  finished = false;
  started = false;
  invulnS = 0;
  fade = 0;                // 0..1 respawn fade overlay
  splits: number[] = [];   // cumulative ms at each rule checkpoint (rule.checkpoints per lap)
  lapGhost: Ghost | null = null; // best lap ghost of this run
  stats = { driftMs: 0, driftChains: 0, jumps: 0, cleanLandings: 0, moatCrossings: 0, boostMs: 0, refills: 0, cleanLaps: 0, maxG: 0, launchPerfect: 0, launchTotal: 0, checkpointClears: 0 };
  private finalStretchSent = false;
  driftChainMs = 0;
  driftChainM = 0;
  lastDrift = { angle: 0, metres: 0 };
  launch = { armed: false, releasedAt: null as number | null, holdUntil: 0, result: 'none' as 'perfect' | 'spin' | 'late' | 'none' };

  private seg = -1;
  private prevPos: Vec2 = { x: 0, z: 0 };
  private recorder = new GhostRecorder();
  private lapHits = 0;
  private wasAirborne = false;
  private overWater = false;
  private moatLandMs = -1e9;
  private landedAt = -1;
  private lastImpactSeq = 0;
  private refillTaken = false;
  private respawnTimer = -1;
  private respawnS = 0;
  private placed = false;
  private refSplits: number[] | null = null;
  private lapSplitIdx = 0;
  private gridS = 0;
  private seenToasts = new Set<string>();
  private prevBoost = false;

  constructor(readonly track: Track, readonly car: Car, readonly opt: RaceOptions) {
    const cl = track.centerline ?? track.checkpoints.map((c) => ({ x: (c.a.x + c.b.x) / 2, z: (c.a.z + c.b.z) / 2 }));
    this.path = new LoopPath(rotateToFinish(cl, track.finishLine), 5);
    this.setRefGhost(opt.refGhost);
  }

  setRefGhost(g: Ghost | null) {
    this.refSplits = g ? ghostSplits(g, this.path, this.opt.rule.checkpoints) : null;
  }

  // Place the car on the grid (countdown begins outside).
  reset() {
    const g = this.track.startGrid;
    this.car.reset(g);
    const pr = this.path.project(g.x, g.z);
    this.seg = pr.seg;
    this.gridS = pr.s > this.path.length / 2 ? pr.s - this.path.length : pr.s;
    this.progressM = pr.s;
    this.lapProgressM = this.gridS;
    this.prevPos = { x: g.x, z: g.z };
    this.lapSplitIdx = 0;
    while (this.lapSplitIdx < this.opt.rule.checkpoints - 1 && this.cpMetre(this.lapSplitIdx) <= this.gridS) {
      this.splits.push(0); // checkpoints behind the grid on lap 1 (GAMEPLAY §2.5)
      this.lapSplitIdx++;
    }
    this.nextCp = this.track.checkpoints.findIndex((c) => (c.trackM % this.path.length) > this.gridS + 1);
    if (this.nextCp < 0) this.nextCp = 0;
  }

  private cpMetre(i: number) { return (this.path.length * (i + 1)) / this.opt.rule.checkpoints; }

  // Countdown: car is held; track whether BOOST was held for a launch (GAMEPLAY §3.2).
  countdownInput(raw: InputState, remainingS: number): InputState {
    if (raw.boost) { this.launch.armed = true; this.launch.releasedAt = null; }
    else if (this.launch.armed && this.launch.releasedAt === null) this.launch.releasedAt = -remainingS;
    // Keep the car "armed" (boost held, no throttle) until GO even if released early.
    return { steer: 0, throttle: 0, brake: 0, jump: false, boost: this.launch.armed };
  }

  go() {
    this.started = true;
    this.recorder.reset();
    const l = this.launch;
    if (!l.armed) { l.result = 'none'; return; }
    this.stats.launchTotal = 1;
    const rel = l.releasedAt;
    if (rel !== null && rel < -GAME.launchWindowS) {
      l.result = 'spin';
      l.holdUntil = GAME.falseStartSpinS * 1000; // keep boost held → launch fires late
    } else if (rel !== null) {
      l.result = 'perfect';
      l.holdUntil = 0;
    } else {
      l.result = 'late'; // still holding at GO; resolved on release below
      l.holdUntil = Infinity;
    }
  }

  // Input filter while racing: finish launch resolution.
  racingInput(raw: InputState): InputState {
    const l = this.launch;
    if (l.armed) {
      if (l.holdUntil === Infinity) {
        if (!raw.boost) {
          const late = this.timeMs / 1000;
          l.result = late <= GAME.launchWindowS ? 'perfect' : 'late';
          l.armed = false;
          this.reportLaunch();
          return { ...raw, throttle: 1, boost: false };
        }
        if (this.timeMs > GAME.launchLateMaxS * 1000 * 4) { l.armed = false; l.result = 'late'; this.reportLaunch(); }
        return { ...raw, throttle: 0, boost: true };
      }
      if (this.timeMs < l.holdUntil) return { ...raw, throttle: 0, boost: true };
      l.armed = false;
      this.reportLaunch();
      return { ...raw, throttle: Math.max(raw.throttle, 1), boost: false };
    }
    return raw;
  }

  private reportLaunch() {
    if (this.launch.result === 'perfect') this.stats.launchPerfect = 1;
    this.opt.onEvent({ type: 'launch', result: this.launch.result, g: 4.6 });
  }

  // One fixed step while racing. Returns false once finished.
  step(dt: number, input: InputState) {
    if (this.finished) return;
    const s = this.car.state;
    if (this.respawnTimer >= 0) return this.stepRespawn(dt);

    this.car.step(dt, input, this.track);
    this.timeMs += dt * 1000;
    if (this.invulnS > 0) this.invulnS -= dt;

    const pos = { x: s.pose.x, z: s.pose.z };
    const pr = this.path.project(pos.x, pos.z, this.seg);
    let ds = pr.s - this.progressM;
    if (ds < -this.path.length / 2) ds += this.path.length;
    if (ds > this.path.length / 2) ds -= this.path.length;
    if (Math.abs(ds) < 60) this.lapProgressM += ds; // ignore jumps from teleports
    if (!this.finalStretchSent && this.lap === this.opt.laps && this.lapProgressM >= this.path.length * 0.75) {
      this.finalStretchSent = true;
      this.opt.onEvent({ type: 'finalStretch' });
    }
    this.seg = pr.seg; this.progressM = pr.s; this.distFromCenter = pr.dist;
    this.offTrack = s.onSurface === 'blocked' || pr.dist > 20;

    // Checkpoints crossing (track lines) — order + missed detection.
    const cps = this.track.checkpoints;
    for (let k = 0; k < cps.length; k++) {
      const c = cps[k];
      if (!crosses(this.prevPos, pos, c.a, c.b)) continue;
      if (k === this.nextCp) this.passCheckpoint(k);
      else if (this.isAhead(k)) {
        const alt = this.track.altGroup;
        const skipped = this.cpSkipped(k);
        const afterMoat = this.timeMs - this.moatLandMs < 3000 && skipped.length <= 3; // corner cut by the moat jump
        if (afterMoat || (alt && skipped.every((i) => i >= alt[0] && i <= alt[1]))) this.passCheckpoint(k);
        else { this.missed++; this.toast('พลาดจุดตรวจ — กลับเข้าเส้นทาง'); }
      }
    }
    const fl = this.track.finishLine;
    if (crosses(this.prevPos, pos, fl.a, fl.b) && this.lapProgressM > this.path.length * 0.5) {
      if (this.nextCp === 0) this.completeLap();
      else { this.missed++; this.toast('พลาดจุดตรวจ — กลับเข้าเส้นทาง'); }
    }
    this.prevPos = pos;

    // Server splits at evenly spaced virtual checkpoints along lap progress.
    while (this.lapSplitIdx < this.opt.rule.checkpoints - 1 && this.lapProgressM >= this.cpMetre(this.lapSplitIdx)) {
      this.splits.push(Math.round(this.timeMs));
      this.lapSplitIdx++;
    }

    this.styleStats(dt, input);
    this.recorder.record(dt, s, input.boost);
    this.checkRespawnTriggers(dt, input);

    // Air-tank refill gate once per lap (GAMEPLAY §2.4).
    if (!this.refillTaken && this.lapProgressM >= GAME.refillGateM && this.lapProgressM < GAME.refillGateM + 80) {
      this.refillTaken = true;
      this.stats.refills++;
      this.car.addGas?.(GAME.refillGate);
      this.opt.onEvent({ type: 'refill' });
    }
  }

  private isAhead(k: number) {
    const n = this.track.checkpoints.length;
    const d = (k - this.nextCp + n) % n;
    return d > 0 && d < n / 2;
  }
  private cpSkipped(k: number) {
    const out: number[] = [], n = this.track.checkpoints.length;
    for (let i = this.nextCp; i !== k; i = (i + 1) % n) out.push(i);
    return out;
  }

  private passCheckpoint(k: number) {
    const n = this.track.checkpoints.length;
    this.nextCp = (k + 1) % n;
    let delta: number | null = null;
    if (this.refSplits) {
      const frac = Math.min(1, Math.max(0, this.lapProgressM / this.path.length));
      const idx = Math.min(this.refSplits.length - 1, Math.max(0, Math.round(frac * this.refSplits.length) - 1));
      const ref = this.refSplits[idx];
      if (ref > 0 && this.lap > 1) delta = this.timeMs - this.lapStartMs - ref;
      else if (ref > 0) delta = null;
    }
    this.opt.onEvent({ type: 'checkpoint', id: k, lap: this.lap, deltaMs: delta });
  }

  private completeLap() {
    // Lap must have covered most of the loop, otherwise it is a reverse/short crossing.
    if (this.lapProgressM < this.path.length * 0.8) return;
    while (this.lapSplitIdx < this.opt.rule.checkpoints - 1) { this.splits.push(Math.round(this.timeMs)); this.lapSplitIdx++; }
    const t = Math.round(this.timeMs);
    this.splits.push(t);
    const lapMs = t - this.lapStartMs;
    this.lapTimes.push(lapMs);
    const best = this.bestLapMs === null || lapMs < this.bestLapMs;
    if (best) { this.bestLapMs = lapMs; this.lapGhost = this.recorder.finish(lapMs); }
    if (this.lapHits === 0) this.stats.cleanLaps++;
    this.opt.onEvent({ type: 'lap', lap: this.lap, lapMs, best });
    this.lapHits = 0;
    this.lapStartMs = t;
    this.lapProgressM = 0;
    this.lapSplitIdx = 0;
    this.refillTaken = false;
    this.recorder.reset();
    if (this.lap >= this.opt.laps) {
      this.finished = true;
      this.opt.onEvent({ type: 'finish' });
      return;
    }
    this.lap++;
    if (this.lap === this.opt.laps) this.opt.onEvent({ type: 'finalLap' });
  }

  private styleStats(dt: number, input: InputState) {
    const s = this.car.state;
    this.stats.maxG = Math.max(this.stats.maxG, s.gForce);
    const counted = s.drifting && s.driftAngleDeg >= GAME.driftCountSlipDeg && s.speedKmh >= GAME.driftEnterKmh;
    if (counted) {
      this.stats.driftMs += dt * 1000;
      this.driftChainMs += dt * 1000;
      this.driftChainM += (s.speedKmh / 3.6) * dt;
      this.lastDrift = { angle: s.driftAngleDeg, metres: this.driftChainM };
    } else if (this.driftChainMs > 0) {
      if (this.driftChainMs >= 1000) {
        this.stats.driftChains++;
        this.opt.onEvent({ type: 'combo', text: `ดริฟต์ ${Math.round(this.driftChainM).toLocaleString('th-TH')} ม. +${Math.round((this.driftChainMs / 1000) * 120 + 150).toLocaleString('th-TH')}` });
      }
      this.driftChainMs = 0;
      this.driftChainM = 0;
    }
    if (input.boost && !s.airborne && s.speedKmh > 5) this.stats.boostMs += dt * 1000;
    if (input.boost && !this.prevBoost) this.opt.onEvent({ type: 'boost' });
    this.prevBoost = input.boost;

    // Jumps / landings / shortcut detection (landing past the moat).
    // Moat crossing (PHYSICS §2 — a style move "ข้ามคูเมือง", not a shortcut): flew over water, landed on land.
    if (s.airborne && !this.wasAirborne) {
      this.stats.jumps++;
      this.overWater = false;
      this.opt.onEvent({ type: 'jump' });
    } else if (s.airborne && !this.overWater && this.track.surfaceAt(s.pose.x, s.pose.z) === 'water') {
      this.overWater = true;
    } else if (!s.airborne && this.wasAirborne) {
      const shortcut = this.overWater && s.onSurface !== 'water';
      if (shortcut) { this.stats.moatCrossings++; this.moatLandMs = this.timeMs; this.opt.onEvent({ type: 'combo', text: 'ข้ามคูเมือง +500' }); }
      this.landedAt = this.timeMs;
      this.opt.onEvent({ type: 'land', clean: true, shortcut });
    }
    if (this.landedAt >= 0 && this.timeMs - this.landedAt > 500) {
      this.stats.cleanLandings++;
      this.car.addGas?.(GAME.landingBonus);
      this.landedAt = -1;
    }
    this.wasAirborne = s.airborne;

    const imp = this.car.lastImpact;
    if (imp && imp.seq !== this.lastImpactSeq) {
      this.lastImpactSeq = imp.seq;
      if (this.landedAt >= 0) this.landedAt = -1; // landing not clean
      if (this.driftChainMs > 0) { this.driftChainMs = 0; this.driftChainM = 0; this.opt.onEvent({ type: 'combo', text: 'หลุด!' }); }
      if (imp.kind !== 'monument') this.lapHits++;
      this.opt.onEvent({ type: 'collision', impulse: imp.impulse, kind: imp.kind });
    }
  }

  private checkRespawnTriggers(dt: number, input: InputState) {
    const s = this.car.state;
    if (input.throttle > 0.5 && s.speedKmh < 3) this.stuckMs += dt * 1000; else this.stuckMs = 0;
    if (s.onSurface === 'water' && !s.airborne) return this.respawn('water');
    if (this.distFromCenter > 60) { this.outOfBounds++; return this.respawn('bounds'); }
    if (this.stuckMs > GAME.stuckAutoMs) return this.respawn('stuck');
    // Wrong way: heading vs path direction > 120° while moving.
    const dir = this.path.at(this.progressM).heading;
    const wrong = Math.abs(angleDiff(s.pose.heading, dir)) > (120 * Math.PI) / 180 && s.speedKmh > 10;
    this.wrongWayS = wrong ? this.wrongWayS + dt : 0;
    if (this.wrongWayS > GAME.wrongWayS) { this.toast('ผิดทาง'); this.wrongWayS = 0; }
  }

  // Fade 0.25 s → place 10 m back on the centerline → fade back 0.25 s (≤ 0.6 s, FEEL-15).
  respawn(reason: string) {
    if (this.respawnTimer >= 0 || this.finished) return;
    this.respawnTimer = 0;
    this.placed = false;
    this.respawnS = this.progressM;
    if (reason === 'water') {
      // Moat fall: back to the take-off bank.
      const mj = this.track.moatJump;
      this.respawnS = this.path.project(mj.takeoff.x, mj.takeoff.z).s + GAME.respawnBackM;
    }
    this.respawns++;
    this.opt.onEvent({ type: 'respawn', reason });
  }

  private stepRespawn(dt: number) {
    this.respawnTimer += dt;
    this.timeMs += dt * 1000;
    const t = this.respawnTimer;
    this.fade = t < 0.25 ? t / 0.25 : Math.max(0, 1 - (t - 0.25) / 0.25);
    if (t >= 0.25 && !this.placed) {
      const p = this.path.at(this.respawnS - GAME.respawnBackM);
      this.car.reset({ x: p.x, y: this.track.heightAt(p.x, p.z), z: p.z, heading: p.heading });
      this.prevPos = { x: p.x, z: p.z };
      const pr = this.path.project(p.x, p.z);
      let ds = pr.s - this.progressM;
      if (ds < -this.path.length / 2) ds += this.path.length;
      if (ds > this.path.length / 2) ds -= this.path.length;
      this.lapProgressM += ds;
      this.progressM = pr.s; this.seg = pr.seg;
      this.placed = true;
      this.stuckMs = 0;
      this.invulnS = 1.5;
    }
    if (t >= 0.5) { this.respawnTimer = -1; this.fade = 0; }
  }

  // QA teleport: re-project without counting the jump as lap progress or checkpoint crossings.
  syncAfterTeleport() {
    const p = this.car.state.pose;
    const pr = this.path.project(p.x, p.z);
    let ds = pr.s - this.progressM;
    if (ds < -this.path.length / 2) ds += this.path.length;
    if (ds > this.path.length / 2) ds -= this.path.length;
    this.lapProgressM += ds;
    this.progressM = pr.s; this.seg = pr.seg; this.prevPos = { x: p.x, z: p.z };
    const n = this.track.checkpoints.length;
    let k = this.track.checkpoints.findIndex((c) => c.trackM > pr.s);
    if (k < 0) k = n - 1;
    this.nextCp = k;
  }

  get respawning() { return this.respawnTimer >= 0; }

  toast(text: string, once = false) {
    if (once) { if (this.seenToasts.has(text)) return; this.seenToasts.add(text); }
    this.opt.onEvent({ type: 'toast', text });
  }

  inZone(): boolean {
    const p = this.car.state.pose;
    return this.track.zones.noBoostNoJump.some((poly) => pointInPoly(p.x, p.z, poly));
  }

  lapTimeMs() { return this.timeMs - this.lapStartMs; }

  result(): RunResult {
    const st = this.stats;
    return {
      trackId: this.track.id, build: VERSION, laps: this.lapTimes.length,
      totalMs: this.lapTimes.reduce((a, b) => a + b, 0),
      lapMs: this.lapTimes.slice(), splitsMs: this.splits.slice(),
      shortcuts: Math.min(st.moatCrossings, this.opt.laps) /* server field name; scored as style 'ข้ามคูเมือง' */, driftMs: Math.round(st.driftMs), driftChains: st.driftChains,
      jumps: st.jumps, cleanLandings: Math.min(st.cleanLandings, st.jumps),
      launches: { perfect: st.launchPerfect, total: st.launchTotal }, boostMs: Math.round(st.boostMs),
      refills: Math.min(st.refills, this.opt.laps), cleanLaps: st.cleanLaps, respawns: this.respawns,
      checkpointClears: st.checkpointClears, // ด่านตรวจ jumped clean (style, server re-checks against the ghost)
      maxG: Math.round(st.maxG * 10) / 10,
    };
  }
}

// Rotate a closed polyline so it starts at the point nearest the finish line.
function rotateToFinish(pts: Vec2[], fl: { a: Vec2; b: Vec2 }): Vec2[] {
  const m = { x: (fl.a.x + fl.b.x) / 2, z: (fl.a.z + fl.b.z) / 2 };
  let bi = 0, bd = Infinity;
  pts.forEach((p, i) => { const d = Math.hypot(p.x - m.x, p.z - m.z); if (d < bd) { bd = d; bi = i; } });
  return [m, ...pts.slice(bi + 1), ...pts.slice(0, bi)];
}

// Reference split times (ms from lap start) at evenly spaced fractions of the lap.
function ghostSplits(g: Ghost, path: LoopPath, n: number): number[] {
  const out = new Array(n).fill(0);
  let prev = path.project(g.samples[0]?.x ?? 0, g.samples[0]?.z ?? 0);
  let run = 0, k = 0;
  for (let i = 1; i < g.samples.length && k < n; i++) {
    const p = path.project(g.samples[i].x, g.samples[i].z, prev.seg);
    let ds = p.s - prev.s;
    if (ds < -path.length / 2) ds += path.length;
    if (ds > path.length / 2) ds -= path.length;
    run += ds;
    prev = p;
    while (k < n && run >= (path.length * (k + 1)) / n) out[k++] = (i * 1000) / g.hz;
  }
  return out;
}
