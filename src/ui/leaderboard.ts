// Draft leaderboard UI: ranking table + "name yourself" form after a qualifying run.
// Errors render under the field / in the panel — never browser popups (CLAUDE.md §9).
import { getLeaderboard, setName, type FinishResult } from '../net/leaderboard.js';
import { messageFor } from '../net/messages.js';
import { NAME_MAX, validateName } from '../net/name.js';
import { DEFAULT_TRACK } from '../net/tracks.js';
import { escapeHtml, formatInt, formatLap } from './format.js';
import { ICONS } from './icons.js';

const TRACK_TITLE: Record<string, string> = {
  A: 'สนาม ก — วงคูเมืองตะวันตก',
  test: 'สนามทดสอบ',
};

function panel(root: HTMLElement, title: string): { el: HTMLElement; body: HTMLElement; close: () => void } {
  const el = document.createElement('section');
  el.className = 'panel';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', title);
  el.innerHTML = `
    <header>
      <h2>${escapeHtml(title)}</h2>
      <button class="btn btn-icon" type="button" data-qa="btn-close" aria-label="ปิด">${ICONS.close}</button>
    </header>
    <div class="body"></div>`;
  const close = () => el.remove();
  el.querySelector('header button')!.addEventListener('click', close);
  root.append(el);
  return { el, body: el.querySelector('.body')!, close };
}

function renderTable(body: HTMLElement, track: string, onRetry: () => void) {
  body.innerHTML = `<p class="status" role="status">กำลังโหลดอันดับ…</p>`;
  void getLeaderboard(track).then((res) => {
    if (!res.ok) {
      body.innerHTML = `
        <div class="status" role="alert" data-qa="error-box">
          <p>${escapeHtml(messageFor(res.code))}</p>
          <button class="btn btn-icon" type="button" data-qa="btn-retry">${ICONS.refresh}ลองใหม่</button>
        </div>`;
      body.querySelector('button')!.addEventListener('click', onRetry);
      return;
    }
    if (res.data.entries.length === 0) {
      body.innerHTML = `<p class="status">ยังไม่มีใครทำแต้มในสนามนี้ เป็นคนแรกเลย</p>`;
      return;
    }
    const rows = res.data.entries
      .map(
        (e) => `
        <tr class="${e.rank <= 3 ? 'top' : ''}">
          <td>${formatInt(e.rank)}</td>
          <td>${e.name ? escapeHtml(e.name) : '<span class="anon">ไม่ระบุชื่อ</span>'}</td>
          <td class="num">${formatInt(e.score)}</td>
          <td class="num">${formatLap(e.lapMs)}</td>
        </tr>`,
      )
      .join('');
    body.innerHTML = `
      <table class="lb" data-qa="leaderboard">
        <thead><tr><th>อันดับ</th><th>ชื่อ</th><th class="num">แต้ม</th><th class="num">เวลา</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  });
}

export function showLeaderboard(root: HTMLElement, track = DEFAULT_TRACK) {
  const { body } = panel(root, `อันดับ · ${TRACK_TITLE[track] ?? track}`);
  const load = () => renderTable(body, track, load);
  load();
}

// Results screen after a run. Shows the name form only when the run made the top list.
export function showRunResult(root: HTMLElement, track: string, result: FinishResult, onDone?: () => void) {
  const { body, close } = panel(root, 'จบรอบ');
  const rankLine = result.qualifies
    ? `ติดอันดับที่ ${formatInt(result.rank)}`
    : `อันดับที่ ${formatInt(result.rank)} — ทำแต้มให้ติด 100 อันดับแรกเพื่อขึ้นตาราง`;
  body.innerHTML = `
    <div class="result">
      <div class="rank">${escapeHtml(rankLine)}</div>
      <div>แต้ม ${formatInt(result.score)}${result.personalBest ? ' · สถิติใหม่ของคุณ' : ''}</div>
      ${
        result.qualifies
          ? `<form class="field" novalidate>
              <label for="lb-name">${result.named ? 'เปลี่ยนชื่อที่แสดงในตาราง' : 'ตั้งชื่อเพื่อโชว์ในตารางอันดับ'}</label>
              <input id="lb-name" name="name" autocomplete="nickname" maxlength="${NAME_MAX * 3}" data-qa="input-name"
                aria-describedby="lb-name-hint lb-name-err" enterkeyhint="done" />
              <span id="lb-name-hint" class="hint">2–${NAME_MAX} ตัวอักษร ไทย อังกฤษ หรือตัวเลข</span>
              <span id="lb-name-err" class="err" role="alert" data-qa="name-error"></span>
              <div class="row">
                <button class="btn btn-primary" type="submit" data-qa="btn-save-name">บันทึกชื่อ</button>
                <button class="btn" type="button" data-qa="btn-view-board">ดูตารางอันดับ</button>
              </div>
            </form>`
          : `<div class="row"><button class="btn" type="button" data-qa="btn-view-board">ดูตารางอันดับ</button></div>`
      }
    </div>`;

  const viewBoard = () => {
    close();
    showLeaderboard(root, track);
    onDone?.();
  };
  body.querySelector('[data-qa=btn-view-board]')!.addEventListener('click', viewBoard);

  const form = body.querySelector('form');
  if (!form) return;
  const input = form.querySelector('input')!;
  const err = form.querySelector('.err')!;
  const submit = form.querySelector<HTMLButtonElement>('[type=submit]')!;
  const showErr = (text: string) => {
    err.textContent = text;
    input.setAttribute('aria-invalid', text ? 'true' : 'false');
  };
  input.addEventListener('input', () => showErr(''));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const v = validateName(input.value);
    if (!v.ok) return showErr(messageFor(v.code));
    submit.disabled = true;
    const res = await setName(v.name);
    submit.disabled = false;
    if (!res.ok) return showErr(messageFor(res.code));
    viewBoard();
  });
}
