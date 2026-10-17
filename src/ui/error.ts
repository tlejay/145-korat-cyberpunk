// Full-screen Thai error box (CLAUDE.md §9, TEST-HOOKS H-06).
import { emit, game, setState, type ErrorKind } from '../state.js';
import { escapeHtml } from './format.js';
import { ICONS } from './icons.js';

export const ERROR_TEXT: Record<ErrorKind, string> = {
  webgl: 'เครื่องนี้เปิดกราฟิก 3D ไม่ได้ ลองเปิดด้วย Chrome หรือ Safari เวอร์ชันล่าสุด',
  webgl_lost: 'กราฟิกหยุดทำงานกะทันหัน กดลองใหม่เพื่อโหลดเกมอีกครั้ง',
  mapload: 'โหลดข้อมูลแผนที่ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วกดลองใหม่',
  asset: 'โหลดไฟล์เกมไม่ครบ ตรวจสอบอินเทอร์เน็ตแล้วกดลองใหม่',
  portrait: 'หมุนจอเป็นแนวนอนเพื่อเล่น',
  lowfps: 'เครื่องนี้เล่นได้ไม่ลื่น ลองลดคุณภาพกราฟิกลง',
  unknown: 'เกิดข้อผิดพลาดบางอย่าง กดลองใหม่เพื่อโหลดเกมอีกครั้ง',
};

export function showError(root: HTMLElement, code: ErrorKind, onRetry: () => void = () => location.reload()) {
  root.querySelector('[data-qa=error-box]')?.remove();
  const text = ERROR_TEXT[code];
  const box = document.createElement('div');
  box.className = 'error-box';
  box.setAttribute('role', 'alert');
  box.dataset.qa = 'error-box';
  box.innerHTML = `<p>${escapeHtml(text)}</p>
    <button class="btn btn-icon" type="button" data-qa="btn-retry">${ICONS.refresh}ลองใหม่</button>`;
  box.querySelector('button')!.addEventListener('click', onRetry);
  root.append(box);
  game.error = { code, shownText: text };
  setState('error');
  emit('error', game.error);
}
