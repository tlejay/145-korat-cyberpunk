// Optional ready-made HUD piece for the integrator (🌃 visuals / game-ui): top-centre turn badge with
// Heroicons-style chevrons (1–3 by severity), Thai label and distance, shown when the turn-in is ≤ 200 m.
//
//   const th = createTurnHud(hud.el);                     // once
//   const ev = th.update(race.progressM);                 // every frame while racing → 'uiTap' | null
//   if (ev) audio.play(ev);                               // soft warning tick
//   th.hide();                                            // menus / results
//
// Or keep the existing game-ui arrow: `hud.update({ …, turn: turnForHud(race.progressM) })`.
import { getUpcomingTurn } from './index.js';
import type { Severity, TurnDir } from './turns.js';

const nf0 = new Intl.NumberFormat('th-TH');

/** Existing HudFrame.turn format ({ deg, inM }) — arrow rotates by the signed corner angle. */
export function turnForHud(trackM: number): { deg: number; inM: number } | null {
  const u = getUpcomingTurn(trackM);
  return u ? { deg: u.deg, inM: u.distM } : null;
}

// Heroicons outline chevron-right path, repeated for 2–3 chevrons (mirrored for left turns).
const CHEV = 'm8.25 4.5 7.5 7.5-7.5 7.5';
function chevronSvg(dir: TurnDir, n: Severity) {
  const w = 24 + (n - 1) * 9;
  const paths = Array.from({ length: n }, (_, i) => `<path stroke-linecap="round" stroke-linejoin="round" transform="translate(${i * 9 - 3} 0)" d="${CHEV}"/>`).join('');
  const flip = dir === 'left' ? ` transform="translate(${w} 0) scale(-1 1)"` : '';
  return `<svg viewBox="0 0 ${w} 24" width="${(w / 24) * 44}" height="44" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><g${flip}>${paths}</g></svg>`;
}

export const TURN_LABEL = (dir: TurnDir, severity: Severity) =>
  severity === 3 ? `โค้งอันตราย ${dir === 'right' ? 'ขวา' : 'ซ้าย'}` : dir === 'right' ? 'เลี้ยวขวา' : 'เลี้ยวซ้าย';

const CSS = `
.wf-turn { position: absolute; left: 50%; top: var(--st, 8px); transform: translateX(-50%); display: none;
  flex-direction: column; align-items: center; gap: 2px; pointer-events: none; color: #ffd21a;
  font-family: "Noto Sans Thai", sans-serif; font-weight: 700; text-shadow: 0 1px 3px rgba(0,0,0,.8), 0 0 10px rgba(255,210,26,.55); }
.wf-turn.show { display: flex; }
.wf-turn svg { filter: drop-shadow(0 0 6px rgba(255,210,26,.7)); }
.wf-turn .wf-label { font-size: 16px; line-height: 1.1; }
.wf-turn .wf-dist { font-size: 14px; font-variant-numeric: tabular-nums; opacity: .92; }
.wf-turn.sev3 { color: #ff8a3d; }
.wf-turn.sev3 svg { animation: wfpulse .8s ease-in-out infinite alternate; }
@keyframes wfpulse { from { opacity: .65; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .wf-turn.sev3 svg { animation: none; } }
`;

export interface TurnHud {
  el: HTMLElement;
  /** Call every frame while racing. Returns 'uiTap' once when a turn first comes within range (and again at
   *  70 m for dangerous corners) — feed it to audio.play for a soft tick. */
  update(trackM: number): 'uiTap' | null;
  hide(): void;
  dispose(): void;
}

export function createTurnHud(root: HTMLElement): TurnHud {
  if (!document.getElementById('wf-turn-css')) {
    const st = document.createElement('style');
    st.id = 'wf-turn-css';
    st.textContent = CSS;
    document.head.append(st);
  }
  const el = document.createElement('div');
  el.className = 'wf-turn';
  el.dataset.qa = 'hud-turn-warn';
  el.setAttribute('role', 'status');
  el.innerHTML = '<span class="wf-icon"></span><span class="wf-label"></span><span class="wf-dist"></span>';
  root.append(el);
  const icon = el.querySelector<HTMLElement>('.wf-icon')!, label = el.querySelector<HTMLElement>('.wf-label')!, dist = el.querySelector<HTMLElement>('.wf-dist')!;

  let shownKey = '', lastDist = '', tickedFor = -1, tick70For = -1;
  const hide = () => { el.classList.remove('show'); shownKey = ''; };
  return {
    el,
    update(trackM) {
      const u = getUpcomingTurn(trackM);
      if (!u) { if (shownKey) hide(); return null; }
      const key = `${u.id}`;
      if (key !== shownKey) {
        shownKey = key;
        icon.innerHTML = chevronSvg(u.dir, u.severity);
        label.textContent = TURN_LABEL(u.dir, u.severity);
        el.classList.toggle('sev3', u.severity === 3);
        el.classList.add('show');
      }
      const d = u.distM <= 0 ? 'ตอนนี้' : `${nf0.format(Math.max(10, Math.round(u.distM / 10) * 10))} ม.`;
      if (d !== lastDist) { dist.textContent = d; lastDist = d; }
      let ev: 'uiTap' | null = null;
      if (tickedFor !== u.id) { tickedFor = u.id; ev = 'uiTap'; }
      else if (u.severity === 3 && u.distM <= 70 && u.distM > 0 && tick70For !== u.id) { tick70For = u.id; ev = 'uiTap'; }
      return ev;
    },
    hide,
    dispose() { el.remove(); },
  };
}
