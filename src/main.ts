import './style.css';
import { QA, boot, hasWebGL2 } from './game/engine.js';
import { showError } from './ui/error.js';
import { ICONS } from './ui/icons.js';

const params = new URLSearchParams(location.search);
const ui = document.getElementById('ui')!;
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const view = QA ? params.get('view') : null;

ui.innerHTML = `<div class="rotate-hint" data-qa="rotate-hint" role="alert">${ICONS.rotate}<p>หมุนจอเป็นแนวนอนเพื่อเล่น</p></div>`;

// QA hooks live in their own chunk and only load with ?qa=1 (docs/qa/TEST-HOOKS.md).
const hooks = QA ? import('./qa/hooks.js') : null;

if (view === 'audio') {
  // Audio lab (audio-dev REPORT): no 3D scene, no game menu.
  void import('./audio/lab.js').then((m) => m.mountAudioLab(ui));
} else if (view === 'car') {
  // Car model preview (car-model REPORT).
  void import('./car/model-preview.js').then((m) => m.mountCarPreview(canvas));
} else if (view === 'top') {
  // Track vs OSM top view (world REPORT §4).
  void import('./scene/top-view.js').then((m) => m.startTopView(canvas, ui));
} else if (!hasWebGL2()) {
  showError(ui, 'webgl');
  void hooks?.then((m) => m.installQaHooks(ui));
} else {
  void boot(ui, canvas);
  void hooks?.then((m) => m.installQaHooks(ui));
}
