import './style.css';
import { hasWebGL2, createScene } from './scene/scene.js';
import { setState } from './state.js';
import { showError } from './ui/error.js';
import { ICONS } from './ui/icons.js';
import { showLeaderboard } from './ui/leaderboard.js';
import { VERSION } from './version.js';

const params = new URLSearchParams(location.search);
const ui = document.getElementById('ui')!;
const canvas = document.getElementById('scene') as HTMLCanvasElement;

ui.innerHTML = `
  <div class="splash">
    <h1>โคราชไซเบอร์พังก์</h1>
    <p>กำลังสร้างสนาม…</p>
  </div>
  <button class="btn btn-icon corner" type="button" data-qa="btn-leaderboard">${ICONS.trophy}ตารางอันดับ</button>
  <div class="version" data-qa="version">${VERSION}</div>
  <div class="rotate-hint" data-qa="rotate-hint" role="alert">${ICONS.rotate}<p>หมุนจอเป็นแนวนอนเพื่อเล่น</p></div>
`;
ui.querySelector('[data-qa=btn-leaderboard]')!.addEventListener('click', () => showLeaderboard(ui));

// QA hooks live in their own chunk and only load with ?qa=1 (docs/qa/TEST-HOOKS.md).
if (params.get('qa') === '1') {
  void import('./qa/hooks.js').then((m) => m.installQaHooks(ui));
}

if (!hasWebGL2()) {
  showError(ui, 'webgl');
} else {
  createScene(canvas);
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    showError(ui, 'webgl_lost');
  });
  setState('menu');
}
