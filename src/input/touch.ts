// On-screen controls, layout per GAMEPLAY §1.2. Pointer Events with per-pointer
// tracking so several thumbs work at once (MOB-03). Sliding a finger off a
// button releases it; the steer pad lets a thumb slide between left and right.
import { ICONS } from '../ui/icons.js';
import { inputInfo, markEvent, touchInput } from './index.js';

type Btn = 'throttle' | 'brake' | 'jump' | 'boost';

export interface TouchControls {
  el: HTMLElement;
  setLocked(btn: 'jump' | 'boost', locked: boolean): void;
  setJumpHint(state: 'none' | 'ok' | 'short'): void;
  releaseAll(): void;
}

export function createTouchControls(root: HTMLElement): TouchControls {
  const el = document.createElement('div');
  el.className = 'controls';
  el.innerHTML = `
    <div class="steer-pad" data-qa="steer-pad">
      <div class="tbtn steer" data-qa="steer-left" aria-label="เลี้ยวซ้าย" role="button">${ICONS.chevronLeft}</div>
      <div class="tbtn steer" data-qa="steer-right" aria-label="เลี้ยวขวา" role="button">${ICONS.chevronRight}</div>
    </div>
    <div class="tbtn act jump" data-qa="btn-jump" data-btn="jump" aria-label="กระโดด" role="button">${ICONS.arrowUpCircle}<span class="lock">${ICONS.lock}</span></div>
    <div class="tbtn act boost" data-qa="btn-boost" data-btn="boost" aria-label="เร่งพิเศษ" role="button">${ICONS.bolt}<span class="lock">${ICONS.lock}</span></div>
    <div class="tbtn act brake" data-qa="btn-brake" data-btn="brake" aria-label="เบรกและถอย" role="button">${ICONS.chevronDoubleDown}</div>
    <div class="tbtn act throttle" data-qa="btn-throttle" data-btn="throttle" aria-label="เร่ง" role="button">${ICONS.chevronDoubleUp}</div>`;
  root.append(el);

  const pad = el.querySelector<HTMLElement>('.steer-pad')!;
  const leftBtn = el.querySelector<HTMLElement>('[data-qa=steer-left]')!;
  const rightBtn = el.querySelector<HTMLElement>('[data-qa=steer-right]')!;
  const active = new Map<number, Btn | 'steer'>();
  const steerPointers = new Map<number, number>(); // pointerId -> clientX

  const refresh = (ts: number) => {
    const held = new Set(active.values());
    touchInput.throttle = held.has('throttle') ? 1 : 0;
    touchInput.brake = held.has('brake') ? 1 : 0;
    touchInput.jump = held.has('jump');
    touchInput.boost = held.has('boost');
    // Steer: the latest steer pointer wins; side from x vs midline between the two buttons.
    let dir = 0;
    if (steerPointers.size) {
      const x = [...steerPointers.values()].pop()!;
      const l = leftBtn.getBoundingClientRect(), r = rightBtn.getBoundingClientRect();
      const mid = (l.right + r.left) / 2;
      dir = x < mid ? -1 : 1;
    }
    touchInput.left = dir < 0;
    touchInput.right = dir > 0;
    leftBtn.classList.toggle('on', dir < 0);
    rightBtn.classList.toggle('on', dir > 0);
    el.querySelectorAll<HTMLElement>('[data-btn]').forEach((b) => b.classList.toggle('on', held.has(b.dataset.btn as Btn)));
    inputInfo.activePointers = active.size;
    markEvent('touch', ts);
  };

  const release = (e: PointerEvent) => {
    if (!active.has(e.pointerId)) return;
    active.delete(e.pointerId);
    steerPointers.delete(e.pointerId);
    refresh(e.timeStamp);
  };

  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pad.setPointerCapture(e.pointerId); // keep tracking while sliding across the pad
    active.set(e.pointerId, 'steer');
    steerPointers.set(e.pointerId, e.clientX);
    refresh(e.timeStamp);
  });
  pad.addEventListener('pointermove', (e) => {
    if (!steerPointers.has(e.pointerId)) return;
    const r = pad.getBoundingClientRect();
    if (e.clientX < r.left - 30 || e.clientX > r.right + 30 || e.clientY < r.top - 30) return release(e);
    steerPointers.set(e.pointerId, e.clientX);
    refresh(e.timeStamp);
  });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) pad.addEventListener(t, release);

  el.querySelectorAll<HTMLElement>('[data-btn]').forEach((b) => {
    const name = b.dataset.btn as Btn;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // Release capture so pointerleave fires when the finger slides off (MOB-03).
      if (b.hasPointerCapture(e.pointerId)) b.releasePointerCapture(e.pointerId);
      active.set(e.pointerId, name);
      refresh(e.timeStamp);
    });
    for (const t of ['pointerup', 'pointercancel', 'pointerleave'] as const) b.addEventListener(t, release);
  });

  el.addEventListener('contextmenu', (e) => e.preventDefault());

  // Desktop: hidden until the first touch (GAMEPLAY §1.5).
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (!coarse) el.classList.add('hidden');
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') el.classList.remove('hidden'); }, { capture: true });

  return {
    el,
    setLocked(btn, locked) {
      el.querySelector(`[data-btn=${btn}]`)!.classList.toggle('locked', locked);
    },
    setJumpHint(state) {
      const j = el.querySelector('[data-btn=jump]')!;
      j.classList.toggle('hint-ok', state === 'ok');
      j.classList.toggle('hint-short', state === 'short');
    },
    releaseAll() {
      active.clear();
      steerPointers.clear();
      refresh(performance.now());
    },
  };
}
