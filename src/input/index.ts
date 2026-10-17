// Unified input pipeline (GAMEPLAY §1): touch buttons, keyboard, gamepad and QA
// all write raw intents here; sample() applies the steering ramp and returns the
// InputState fed to car.step(). No debouncing — handlers store state immediately.
import type { InputState } from '../types.js';

export type Source = 'touch' | 'keyboard' | 'gamepad' | 'qa';

export const ASSIST = {
  rampLowS: 0.10, rampHighS: 0.22, returnS: 0.08, // GAMEPLAY §1.3 layer 1
  laneAlignRad: 0.5, laneAlignMaxDeg: 15,          // layer 3 (applied by the game, see engine.ts assist())
  laneAlignSpanM: [10, 60] as [number, number],     // road heading = chord over this window ahead (5 m path steps are jagged)
  laneAlignKp: 3.5,                                  // steer per rad of heading error (× strength k)
  laneAlignKd: 0.05,                                 // s, yaw-rate damping so the assist never rocks the car
};

/** Layer 3 law: steer toward the road heading (P) minus yaw rate (D), k = assist strength. */
export function laneAlignSteer(errRad: number, yawRate: number, k: number) {
  return Math.max(-0.35, Math.min(0.35, (errRad - yawRate * ASSIST.laneAlignKd) * k * ASSIST.laneAlignKp));
}

interface Raw { left: boolean; right: boolean; throttle: number; brake: number; jump: boolean; boost: boolean; axis: number | null }

const touch: Raw = { left: false, right: false, throttle: 0, brake: 0, jump: false, boost: false, axis: null };
const keys: Raw = { left: false, right: false, throttle: 0, brake: 0, jump: false, boost: false, axis: null };
const pad: Raw = { left: false, right: false, throttle: 0, brake: 0, jump: false, boost: false, axis: null };
let qa: Partial<InputState> | null = null;

export const inputInfo = {
  source: 'keyboard' as Source,
  activePointers: 0,
  lastEventTs: 0,      // event.timeStamp of the latest change
  lastLatencyMs: 0,    // event → first physics step that consumed it
  pendingTs: 0,
  locked: { jump: false, boost: false }, // set by the game (plaza zone / low gas)
};

const out: InputState = { steer: 0, throttle: 0, brake: 0, jump: false, boost: false };
let steer = 0;

export function markEvent(src: Source, ts: number) {
  inputInfo.source = src;
  inputInfo.lastEventTs = ts;
  if (!inputInfo.pendingTs) inputInfo.pendingTs = ts;
}

// --- touch (buttons call these) ---
export const touchInput = touch;

// --- keyboard ---
const KEYMAP: Record<string, keyof Raw> = {
  KeyW: 'throttle', ArrowUp: 'throttle', KeyS: 'brake', ArrowDown: 'brake',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'jump', ShiftLeft: 'boost', ShiftRight: 'boost',
};

export function installKeyboard(onAction: (a: 'pause' | 'respawn' | 'mute') => void) {
  const set = (e: KeyboardEvent, down: boolean) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const k = KEYMAP[e.code];
    if (k) {
      e.preventDefault();
      if (k === 'throttle' || k === 'brake') keys[k] = down ? 1 : 0;
      else if (k !== 'axis') (keys[k] as boolean) = down;
      markEvent('keyboard', e.timeStamp);
      return;
    }
    if (!down || e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP') onAction('pause');
    else if (e.code === 'KeyR') onAction('respawn');
    else if (e.code === 'KeyM') onAction('mute');
  };
  addEventListener('keydown', (e) => set(e, true));
  addEventListener('keyup', (e) => set(e, false));
  addEventListener('blur', () => {
    Object.assign(keys, { left: false, right: false, throttle: 0, brake: 0, jump: false, boost: false });
  });
}

// --- gamepad (polled each frame) ---
let padButtons = { start: false, y: false };
export function pollGamepad(onAction: (a: 'pause' | 'respawn') => void) {
  const gp = navigator.getGamepads?.().find((g) => g && g.connected);
  if (!gp) return;
  const ax = gp.axes[0] ?? 0;
  const b = (i: number) => gp.buttons[i]?.value ?? 0;
  const next = {
    axis: Math.abs(ax) > 0.12 ? ax : 0,
    throttle: b(7), brake: b(6),
    jump: b(0) > 0.5, boost: b(5) > 0.5 || b(2) > 0.5,
  };
  const changed = next.axis !== (pad.axis ?? 0) || next.throttle !== pad.throttle || next.brake !== pad.brake || next.jump !== pad.jump || next.boost !== pad.boost;
  Object.assign(pad, next);
  if (changed) markEvent('gamepad', performance.now());
  const start = b(9) > 0.5, y = b(3) > 0.5;
  if (start && !padButtons.start) onAction('pause');
  if (y && !padButtons.y) onAction('respawn');
  padButtons = { start, y };
}

// --- QA (TEST-HOOKS: setInput goes through the same pipeline) ---
export function setQaInput(i: Partial<InputState>) {
  qa = { ...(qa ?? {}), ...i };
  markEvent('qa', performance.now());
}
export function clearQaInput() {
  qa = null;
  markEvent('qa', performance.now());
}

export function resetInput() {
  Object.assign(touch, { left: false, right: false, throttle: 0, brake: 0, jump: false, boost: false, axis: null });
  Object.assign(keys, { left: false, right: false, throttle: 0, brake: 0, jump: false, boost: false });
  qa = null;
  steer = 0;
}

// Called once per physics step. speedFrac = speed / top speed (for the ramp).
export function sample(dt: number, speedFrac: number, autopilot: Partial<InputState> | null): InputState {
  const left = touch.left || keys.left || pad.left;
  const right = touch.right || keys.right || pad.right;
  let digital = (right ? 1 : 0) - (left ? 1 : 0);
  const analog = qa?.steer ?? autopilot?.steer ?? (pad.axis ? pad.axis : null);

  if (analog !== null && analog !== undefined && digital === 0) {
    steer = Math.max(-1, Math.min(1, analog));
  } else {
    if (digital !== 0 && Math.sign(steer) !== digital && steer !== 0) steer = 0; // flip through zero
    const rampS = ASSIST.rampLowS + (ASSIST.rampHighS - ASSIST.rampLowS) * Math.min(1, speedFrac);
    if (digital !== 0) steer += (digital * dt) / rampS;
    else steer -= Math.sign(steer) * Math.min(Math.abs(steer), dt / ASSIST.returnS);
    steer = Math.max(-1, Math.min(1, steer));
    if (digital === 0 && Math.abs(steer) < 1e-3) steer = 0;
  }
  digital = 0;

  const ap = autopilot ?? {};
  out.steer = steer;
  out.throttle = Math.max(touch.throttle, keys.throttle, pad.throttle, qa?.throttle ?? 0, ap.throttle ?? 0);
  out.brake = Math.max(touch.brake, keys.brake, pad.brake, qa?.brake ?? 0, ap.brake ?? 0);
  out.jump = !inputInfo.locked.jump && (touch.jump || keys.jump || pad.jump || !!qa?.jump || !!ap.jump);
  out.boost = !inputInfo.locked.boost && (touch.boost || keys.boost || pad.boost || !!qa?.boost || !!ap.boost);

  if (inputInfo.pendingTs) {
    inputInfo.lastLatencyMs = Math.max(0, performance.now() - inputInfo.pendingTs);
    inputInfo.pendingTs = 0;
  }
  return out;
}

export const lastInput = () => out;
