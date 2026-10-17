// In-race HUD (GAMEPLAY §7). Thai only, th-TH numbers, Heroicons, no emoji.
// Updates write textContent/style only when values change (no per-frame allocation churn).
import type { LoopPath } from '../game/path.js';
import { formatLapMs } from './format.js';
import { ICONS } from './icons.js';

const nf1 = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('th-TH');
const nf2 = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface HudFrame {
  speedKmh: number; g: number; gas: number; jumpCost: number; moatCost: number;
  lap: number; laps: number; lapMs: number; bestMs: number | null;
  turn: { deg: number; inM: number } | null;
  drift: { angle: number; metres: number } | null;
  car: { x: number; z: number; heading: number };
  ghosts: { x: number; z: number }[];
}

export interface Hud {
  el: HTMLElement;
  update(f: HudFrame): void;
  delta(ms: number | null): void;
  combo(text: string): void;
  toast(text: string): void;
  countdown(text: string | null): void;
  fade(v: number): void;
  setPath(path: LoopPath): void;
  showRespawnPrompt(show: boolean): void;
  onRespawn: () => void;
  onPause: () => void;
}

export function createHud(root: HTMLElement): Hud {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <div class="hud-tl">
      <div class="lapline"><span data-qa="hud-lap">รอบ 1/2</span> <span class="best" data-qa="hud-best"></span></div>
      <div class="timeline"><span data-qa="hud-time">0:00.000</span><span class="delta" data-qa="hud-delta"></span></div>
    </div>
    <div class="hud-turn" data-qa="hud-turn"><span class="arrow">${ICONS.arrowUp}</span><span class="dist"></span></div>
    <div class="hud-mid">
      <div class="combo" data-qa="hud-combo"></div>
      <div class="drift" data-qa="hud-drift"></div>
      <div class="toast" data-qa="hud-toast" role="status"></div>
    </div>
    <div class="countdown" data-qa="hud-countdown" aria-live="assertive"></div>
    <button class="tbtn small hud-pause" type="button" data-qa="btn-pause" aria-label="หยุดชั่วคราว">${ICONS.pause}</button>
    <canvas class="hud-map" data-qa="hud-map" width="176" height="176" aria-hidden="true"></canvas>
    <div class="hud-bottom">
      <div class="speedrow"><span class="speed" data-qa="hud-speed">0</span><span class="unit">กม./ชม.</span><span class="g" data-qa="hud-g">0.0g</span></div>
      <div class="tank" data-qa="hud-tank"><div class="fill"></div><i class="mark jump"></i><i class="mark moat"></i></div>
    </div>
    <button class="btn btn-icon respawn-btn" type="button" data-qa="btn-respawn">${ICONS.mapPin}กลับเข้าเส้นทาง</button>
    <div class="fade"></div>`;
  root.append(el);

  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const lap = q('[data-qa=hud-lap]'), best = q('[data-qa=hud-best]'), time = q('[data-qa=hud-time]');
  const deltaEl = q('[data-qa=hud-delta]'), speed = q('[data-qa=hud-speed]'), gEl = q('[data-qa=hud-g]');
  const fill = q('.tank .fill'), markJ = q('.tank .jump'), markM = q('.tank .moat'), tank = q('[data-qa=hud-tank]');
  const turn = q('[data-qa=hud-turn]'), turnArrow = q('.hud-turn .arrow'), turnDist = q('.hud-turn .dist');
  const combo = q('[data-qa=hud-combo]'), drift = q('[data-qa=hud-drift]'), toast = q('[data-qa=hud-toast]');
  const cd = q('[data-qa=hud-countdown]'), fadeEl = q('.fade'), respawnBtn = q('[data-qa=btn-respawn]');
  const map = q<HTMLCanvasElement>('[data-qa=hud-map]');
  const ctx = map.getContext('2d');
  let path: LoopPath | null = null;
  const last: Record<string, string> = {};
  const set = (key: string, node: HTMLElement, text: string) => {
    if (last[key] !== text) { node.textContent = text; last[key] = text; }
  };
  let comboT = 0, toastT = 0, deltaT = 0, gBigT = 0;

  const hud: Hud = {
    el,
    onRespawn: () => {},
    onPause: () => {},
    setPath(p) { path = p; },
    update(f) {
      set('lap', lap, `รอบ ${nf0.format(f.lap)}/${nf0.format(f.laps)}`);
      set('best', best, f.bestMs ? `ดีสุด ${formatLapMs(f.bestMs)}` : '');
      set('time', time, formatLapMs(f.lapMs));
      set('speed', speed, nf0.format(Math.round(f.speedKmh)));
      set('g', gEl, `${nf1.format(f.g)}g`);
      const now = performance.now();
      if (f.g >= 1.5) gBigT = now + 2000;
      gEl.classList.toggle('big', now < gBigT);
      fill.style.transform = `scaleX(${f.gas.toFixed(3)})`;
      markJ.style.left = `${f.jumpCost * 100}%`;
      markM.style.left = `${f.moatCost * 100}%`;
      tank.classList.toggle('low', f.gas < f.jumpCost);
      if (f.turn) {
        turn.classList.add('show');
        turnArrow.style.transform = `rotate(${Math.max(-150, Math.min(150, f.turn.deg)).toFixed(0)}deg)`;
        set('turn', turnDist, `${nf0.format(Math.max(0, Math.round(f.turn.inM / 10) * 10))} ม.`);
      } else turn.classList.remove('show');
      if (f.drift) {
        drift.classList.add('show');
        set('drift', drift, `มุม ${nf0.format(Math.round(f.drift.angle))}° · ${nf0.format(Math.round(f.drift.metres))} ม.`);
      } else drift.classList.remove('show');
      if (now > comboT) combo.classList.remove('show');
      if (now > toastT) toast.classList.remove('show');
      if (now > deltaT) deltaEl.classList.remove('show');
      drawMap(f);
    },
    delta(ms) {
      if (ms === null) return;
      deltaEl.textContent = `${ms < 0 ? '−' : '+'}${nf2.format(Math.abs(ms) / 1000)}`;
      deltaEl.classList.toggle('ahead', ms < 0);
      deltaEl.classList.add('show');
      deltaT = performance.now() + 3000;
    },
    combo(text) {
      combo.textContent = text;
      combo.classList.remove('show');
      void combo.offsetWidth; // restart CSS animation
      combo.classList.add('show');
      comboT = performance.now() + 1200;
    },
    toast(text) {
      toast.textContent = text;
      toast.classList.add('show');
      toastT = performance.now() + 2000;
    },
    countdown(text) {
      if (text === null) { cd.classList.remove('show'); return; }
      cd.textContent = text;
      cd.classList.remove('show');
      void cd.offsetWidth;
      cd.classList.add('show');
    },
    fade(v) { fadeEl.style.opacity = v.toFixed(2); },
    showRespawnPrompt(show) { respawnBtn.classList.toggle('show', show); },
  };
  q('[data-qa=btn-pause]').addEventListener('click', () => hud.onPause());
  respawnBtn.addEventListener('click', () => hud.onRespawn());

  function drawMap(f: HudFrame) {
    if (!ctx || !path || map.offsetParent === null) return;
    const W = map.width, R = W / 2, scale = R / 420;
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(7,6,15,0.55)'; ctx.fillRect(0, 0, W, W);
    ctx.translate(R, R);
    ctx.rotate(-f.car.heading); // heading up
    ctx.scale(scale, scale);
    ctx.translate(-f.car.x, -f.car.z);
    ctx.strokeStyle = 'rgba(34,230,255,0.85)'; ctx.lineWidth = 9 / scale * 0.5;
    ctx.beginPath();
    path.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.z) : ctx.moveTo(p.x, p.z)));
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#ff2fa8';
    for (const g of f.ghosts) { ctx.beginPath(); ctx.arc(g.x, g.z, 3 / scale, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // Player arrow (always centre, pointing up) + north marker.
    ctx.fillStyle = '#ffc23d';
    ctx.beginPath(); ctx.moveTo(R, R - 9); ctx.lineTo(R + 6, R + 7); ctx.lineTo(R - 6, R + 7); ctx.closePath(); ctx.fill();
    const nx = R + Math.sin(-f.car.heading) * (R - 14), ny = R - Math.cos(-f.car.heading) * (R - 14);
    ctx.fillStyle = '#eef0ff'; ctx.font = '700 22px "Noto Sans Thai", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('น', nx, ny);
  }

  return hud;
}
