// Menu, tutorial, pause, settings and credits overlays (GAMEPLAY §5.1, UI-07/08/10).
import creditsMd from '../../research/CREDITS.md?raw';
import { getQuality, setQuality } from '../game/quality.js';
import type { Quality } from '../types.js';
import { VERSION } from '../version.js';
import { escapeHtml } from './format.js';
import { ICONS } from './icons.js';
import { saveSettings, settings } from './settings.js';

function overlay(root: HTMLElement, cls: string, html: string, qa?: string): HTMLElement {
  const el = document.createElement('section');
  el.className = `screen ${cls}`;
  if (qa) el.dataset.qa = qa;
  el.innerHTML = html;
  root.append(el);
  return el;
}

export function showMenu(root: HTMLElement, h: { onStart(): void; onBoard(): void; onCredits(): void; onSettings(): void; loading: boolean }) {
  const el = overlay(root, 'menu', `
    <div class="menu-title">
      <h1>โคราชไซเบอร์พังก์</h1>
      <p>แข่งรถรอบคูเมือง ลานย่าโม นครราชสีมา</p>
    </div>
    <button class="btn btn-primary btn-big btn-icon" type="button" data-qa="btn-start" ${h.loading ? 'disabled' : ''}>${ICONS.flag}<span>${h.loading ? 'กำลังสร้างสนาม…' : 'เริ่มแข่ง'}</span></button>
    <div class="menu-row">
      <button class="btn btn-icon" type="button" data-qa="btn-leaderboard">${ICONS.trophy}ตารางอันดับ</button>
      <button class="btn btn-icon" type="button" data-qa="btn-settings">${ICONS.sliders}ตั้งค่า</button>
      <button class="btn btn-icon" type="button" data-qa="btn-credits">${ICONS.info}เครดิต</button>
    </div>
    <div class="version" data-qa="version">${VERSION}</div>`, 'menu');
  el.querySelector('[data-qa=btn-start]')!.addEventListener('click', h.onStart);
  el.querySelector('[data-qa=btn-leaderboard]')!.addEventListener('click', h.onBoard);
  el.querySelector('[data-qa=btn-settings]')!.addEventListener('click', h.onSettings);
  el.querySelector('[data-qa=btn-credits]')!.addEventListener('click', h.onCredits);
  return {
    el,
    ready() {
      const b = el.querySelector<HTMLButtonElement>('[data-qa=btn-start]')!;
      b.disabled = false;
      b.querySelector('span')!.textContent = 'เริ่มแข่ง';
    },
  };
}

export function showTutorial(root: HTMLElement, onDone: () => void) {
  const row = (icon: string, text: string) => `<li><span class="ico">${icon}</span><span>${text}</span></li>`;
  const el = overlay(root, 'tutorial panel-like', `
    <h2>วิธีเล่น</h2>
    <ul class="howto">
      ${row(ICONS.chevronLeft + ICONS.chevronRight, 'นิ้วโป้งซ้าย กดค้างเพื่อเลี้ยว ไถนิ้วสลับซ้ายขวาได้')}
      ${row(ICONS.chevronDoubleUp, 'ปุ่มใหญ่ขวาล่าง = เร่ง')}
      ${row(ICONS.chevronDoubleDown, 'เบรก · แตะเบรกขณะเลี้ยว = ดริฟต์ · จอดนิ่งแล้วกดค้าง = ถอย')}
      ${row(ICONS.arrowUpCircle, 'กระโดด · กดค้างกลางอากาศ = ประคองลอย')}
      ${row(ICONS.bolt, 'เร่งพิเศษ ใช้ลมจากถัง ดริฟต์แล้วถังจะเติมเร็วขึ้น')}
      ${row(ICONS.bolt, 'ออกตัวเร็ว: กดค้างสายฟ้าตอนนับถอยหลัง แล้วปล่อยตอน "ไป!"')}
    </ul>
    <p class="hint">เขตลานย่าโม งดกระโดดและเร่งพิเศษ</p>
    <button class="btn btn-primary btn-big" type="button" data-qa="btn-tutorial-ok">เข้าใจแล้ว</button>`, 'tutorial');
  el.querySelector('button')!.addEventListener('click', () => {
    saveSettings({ tutorialSeen: true });
    el.remove();
    onDone();
  });
}

export function showPause(root: HTMLElement, h: { onResume(): void; onRestart(): void; onRespawn(): void; onMute(): void; onSettings(): void; onMenu(): void }) {
  const el = overlay(root, 'pause panel-like', `
    <h2>หยุดชั่วคราว</h2>
    <div class="pause-grid">
      <button class="btn btn-primary btn-icon" type="button" data-qa="btn-resume">${ICONS.play}เล่นต่อ</button>
      <button class="btn btn-icon" type="button" data-qa="btn-restart">${ICONS.refresh}เริ่มใหม่</button>
      <button class="btn btn-icon" type="button" data-qa="btn-respawn-pause">${ICONS.mapPin}กลับเข้าเส้นทาง</button>
      <button class="btn btn-icon" type="button" data-qa="btn-mute">${settings.muted ? ICONS.speakerOff : ICONS.speaker}<span>${settings.muted ? 'เปิดเสียง' : 'ปิดเสียง'}</span></button>
      <button class="btn btn-icon" type="button" data-qa="btn-settings">${ICONS.sliders}ตั้งค่า</button>
      <button class="btn btn-icon" type="button" data-qa="btn-menu">${ICONS.home}ออกเมนู</button>
    </div>`, 'pause');
  const on = (qa: string, fn: () => void) => el.querySelector(`[data-qa=${qa}]`)!.addEventListener('click', fn);
  on('btn-resume', h.onResume);
  on('btn-restart', h.onRestart);
  on('btn-respawn-pause', h.onRespawn);
  on('btn-settings', h.onSettings);
  on('btn-menu', h.onMenu);
  on('btn-mute', () => {
    h.onMute();
    const b = el.querySelector('[data-qa=btn-mute]')!;
    b.innerHTML = `${settings.muted ? ICONS.speakerOff : ICONS.speaker}<span>${settings.muted ? 'เปิดเสียง' : 'ปิดเสียง'}</span>`;
  });
  return el;
}

export function showSettings(root: HTMLElement, h: { onChange(): void; onTutorial(): void }) {
  const q = getQuality().tier;
  const opt = (name: string, value: string, label: string, cur: string) =>
    `<label class="chip"><input type="radio" name="${name}" value="${value}" ${cur === value ? 'checked' : ''}/><span>${label}</span></label>`;
  const el = overlay(root, 'settings panel-like', `
    <header><h2>ตั้งค่า</h2><button class="btn btn-icon" type="button" data-qa="btn-close" aria-label="ปิด">${ICONS.close}</button></header>
    <div class="set-body">
      <div class="set-row"><span>ตัวช่วยเลี้ยว</span><div class="chips">${opt('assist', 'off', 'ปิด', settings.assist)}${opt('assist', 'normal', 'ปกติ', settings.assist)}${opt('assist', 'high', 'มาก', settings.assist)}</div></div>
      <div class="set-row"><span>คุณภาพกราฟิก</span><div class="chips">${opt('quality', 'low', 'ต่ำ', q)}${opt('quality', 'mid', 'กลาง', q)}${opt('quality', 'high', 'สูง', q)}</div></div>
      <label class="set-row"><span>เร่งอัตโนมัติ</span><input type="checkbox" name="autoThrottle" ${settings.autoThrottle ? 'checked' : ''}/></label>
      <label class="set-row"><span>สั่นเครื่อง (Android)</span><input type="checkbox" name="haptics" ${settings.haptics ? 'checked' : ''}/></label>
      <label class="set-row"><span>ลดการสั่นกล้อง</span><input type="checkbox" name="reduceShake" ${settings.reduceShake ? 'checked' : ''}/></label>
      <label class="set-row"><span>เสียงเพลง</span><input type="range" name="music" min="0" max="1" step="0.05" value="${settings.music}"/></label>
      <label class="set-row"><span>เสียงเอฟเฟกต์</span><input type="range" name="sfx" min="0" max="1" step="0.05" value="${settings.sfx}"/></label>
      <button class="btn" type="button" data-qa="btn-tutorial">ดูวิธีเล่นอีกครั้ง</button>
    </div>`, 'settings');
  el.querySelector('[data-qa=btn-close]')!.addEventListener('click', () => el.remove());
  el.querySelector('[data-qa=btn-tutorial]')!.addEventListener('click', () => { el.remove(); h.onTutorial(); });
  el.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'assist') saveSettings({ assist: t.value as 'off' | 'normal' | 'high' });
    else if (t.name === 'quality') setQuality(t.value as Quality);
    else if (t.type === 'checkbox') saveSettings({ [t.name]: t.checked } as Partial<typeof settings>);
    else if (t.type === 'range') saveSettings({ [t.name]: Number(t.value) } as Partial<typeof settings>);
    h.onChange();
  });
  el.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.type === 'range') { saveSettings({ [t.name]: Number(t.value) } as Partial<typeof settings>); h.onChange(); }
  });
}

// Credits page (UI-07): fixed lines + every table row of research/CREDITS.md (kept in sync by the panes).
export function showCredits(root: HTMLElement) {
  const sections: { title: string; rows: string[] }[] = [];
  let cur: { title: string; rows: string[] } | null = null;
  for (const line of creditsMd.split('\n')) {
    if (line.startsWith('## ')) sections.push((cur = { title: line.slice(3).trim(), rows: [] }));
    else if (cur && line.startsWith('|') && !/^\|\s*-/.test(line) && !/^\|\s*ไฟล์/.test(line)) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      const link = (s: string) => s.replace(/\[([^\]]+)\]\((?:[^()\s]|\([^()\s]*\))*\)/g, '$1');
      const [, src = '', author = '', license = ''] = cells;
      cur.rows.push(`${escapeHtml(link(src))} — ${escapeHtml(author)} · ${escapeHtml(link(license))}`);
    }
  }
  const sectionTitle = (t: string) =>
    t.includes('landmarks') ? 'ภาพอ้างอิงแลนด์มาร์ก (Wikimedia Commons)' : t.includes('audio') ? 'เสียงและเพลง (CC0)' : t;
  const el = overlay(root, 'credits panel-like', `
    <header><h2>เครดิต</h2><button class="btn btn-icon" type="button" data-qa="btn-close" aria-label="ปิด">${ICONS.close}</button></header>
    <div class="credits-body" data-qa="credits">
      <p><strong>สร้างโดย</strong> Tle J ร่วมกับ Claude Opus 5.5 · ${VERSION}</p>
      <p>ข้อมูลแผนที่ © OpenStreetMap contributors (ODbL)</p>
      <p>ได้แรงบันดาลใจจาก Tesla Roadster (2026) ไม่มีส่วนเกี่ยวข้องกับ Tesla, Inc.</p>
      <p>เสียงพากย์: ElevenLabs (ใช้แบบไม่แสวงหากำไร) · เสียงประกอบและเพลง CC0 ขอบคุณผู้สร้างทุกท่านด้านล่าง</p>
      <p>ฟอนต์ Noto Sans Thai (SIL OFL) · ไอคอน Heroicons (MIT) · three.js (MIT)</p>
      ${sections.filter((s) => s.rows.length).map((s) => `<h3>${escapeHtml(sectionTitle(s.title))}</h3><ul>${s.rows.map((r) => `<li>${r}</li>`).join('')}</ul>`).join('')}
    </div>`, 'credits-screen');
  el.querySelector('[data-qa=btn-close]')!.addEventListener('click', () => el.remove());
}
