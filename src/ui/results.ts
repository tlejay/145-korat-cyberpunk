// End-of-race summary (GAMEPLAY §5.1): time, laps, style breakdown, server rank,
// inline name form when the run qualifies. "แข่งอีกครั้ง" is the big primary button.
import type { FinishResult, Result } from '../net/leaderboard.js';
import { setName } from '../net/leaderboard.js';
import { messageFor } from '../net/messages.js';
import { NAME_MAX, validateName } from '../net/name.js';
import type { RunResult, ScoreBreakdown } from '../net/score.js';
import { escapeHtml, formatInt, formatLapMs } from './format.js';
import { ICONS } from './icons.js';

export interface ResultsView { el: HTMLElement; setServer(res: Result<FinishResult> | { ok: false; code: 'QA' | 'TUNED' }): void }

const nf1 = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function showResults(
  root: HTMLElement,
  r: RunResult,
  local: ScoreBreakdown,
  extra: { bestLapRecord: boolean; longestDriftM: number },
  h: { onRetry(): void; onBoard(): void; onMenu(): void },
): ResultsView {
  const el = document.createElement('section');
  el.className = 'screen results panel-like';
  el.dataset.qa = 'results';
  const best = Math.min(...r.lapMs);
  el.innerHTML = `
    <div class="res-grid">
      <div class="res-main">
        <div class="res-label">เวลารวม</div>
        <div class="res-time" data-qa="res-total">${formatLapMs(r.totalMs)}</div>
        ${r.lapMs.length < 2 ? '' : `<div class="res-laps">${r.lapMs.map((ms, i) => `<span class="${ms === best ? 'best' : ''}">รอบ ${formatInt(i + 1)} ${formatLapMs(ms)}</span>`).join('')}</div>`}
        ${extra.bestLapRecord ? `<div class="res-record">${r.lapMs.length < 2 ? 'สถิติใหม่ของคุณ' : 'สถิติรอบใหม่ของคุณ'}</div>` : ''}
        <div class="res-score">แต้ม <b data-qa="res-score">${formatInt(local.total)}</b></div>
        <ul class="res-break">
          <li>เวลา ${formatInt(local.time)}</li>
          <li>สไตล์ ${formatInt(local.style)}${local.style < local.styleRaw ? ' (เต็มเพดาน)' : ''}</li>
          ${local.respawn ? `<li>กลับเข้าเส้นทาง ${formatInt(local.respawn)}</li>` : ''}
          <li>ดริฟต์ ${nf1.format(r.driftMs / 1000)} วิ · ${formatInt(r.driftChains)} ครั้ง</li>
          <li>ข้ามคู ${formatInt(r.shortcuts)} · ลงพื้นสวย ${formatInt(r.cleanLandings)} · ออกตัวสมบูรณ์ ${formatInt(r.launches.perfect)}</li>
          ${r.checkpointClears ? `<li>ข้ามด่าน ${formatInt(r.checkpointClears)}</li>` : ''}
          <li>${r.lapMs.length < 2 ? (r.cleanLaps ? 'วิ่งไม่ชนเลย · ' : '') : `รอบไม่ชน ${formatInt(r.cleanLaps)} · `}ดริฟต์ยาวสุด ${formatInt(Math.round(extra.longestDriftM))} ม. · g สูงสุด ${nf1.format(r.maxG)}</li>
        </ul>
      </div>
      <div class="res-side">
        <div class="res-rank" data-qa="res-rank" role="status">กำลังส่งคะแนน…</div>
        <div class="res-form"></div>
        <div class="res-buttons">
          <button class="btn" type="button" data-qa="btn-view-board">${ICONS.trophy}ดูอันดับ</button>
          <button class="btn" type="button" data-qa="btn-menu">${ICONS.home}เมนู</button>
          <button class="btn btn-primary btn-big btn-icon" type="button" data-qa="btn-retry">${ICONS.refresh}แข่งอีกครั้ง</button>
        </div>
      </div>
    </div>`;
  root.append(el);
  el.querySelector('[data-qa=btn-retry]')!.addEventListener('click', h.onRetry);
  el.querySelector('[data-qa=btn-view-board]')!.addEventListener('click', h.onBoard);
  el.querySelector('[data-qa=btn-menu]')!.addEventListener('click', h.onMenu);
  const rank = el.querySelector<HTMLElement>('[data-qa=res-rank]')!;
  const formBox = el.querySelector<HTMLElement>('.res-form')!;

  return {
    el,
    setServer(res) {
      if (!res.ok) {
        rank.setAttribute('role', 'alert');
        rank.textContent =
          res.code === 'QA' ? 'รอบทดสอบ (โหมด QA) ไม่บันทึกแต้มขึ้นตาราง'
          : res.code === 'TUNED' ? 'มีการปรับค่าเกม รอบนี้ไม่บันทึกแต้ม'
          : res.code === 'NETWORK' ? 'ยังส่งคะแนนไม่ได้ จะลองส่งให้อีกครั้งอัตโนมัติ'
          : messageFor(res.code);
        return;
      }
      const d = res.data;
      rank.textContent = d.qualifies ? `ติดอันดับที่ ${formatInt(d.rank)}${d.personalBest ? ' · สถิติใหม่ของคุณ' : ''}` : `อันดับที่ ${formatInt(d.rank)} — ทำแต้มให้ติด 100 อันดับแรกเพื่อขึ้นตาราง`;
      el.querySelector('[data-qa=res-score]')!.textContent = formatInt(d.score);
      if (!d.qualifies) return;
      let lastName = '';
      try { lastName = localStorage.getItem('lastName.v1') ?? ''; } catch { /* ignore */ }
      formBox.innerHTML = `
        <form class="field" novalidate>
          <label for="res-name">${d.named ? 'เปลี่ยนชื่อที่แสดงในตาราง' : 'ตั้งชื่อเพื่อขึ้นกระดาน'}</label>
          <div class="row">
            <input id="res-name" name="name" autocomplete="nickname" maxlength="${NAME_MAX * 3}" data-qa="input-name" value="${escapeHtml(lastName)}"
              aria-describedby="res-name-err" enterkeyhint="done" />
            <button class="btn btn-primary" type="submit" data-qa="btn-save-name">บันทึกชื่อ</button>
          </div>
          <span id="res-name-err" class="err" role="alert" data-qa="name-error"></span>
        </form>`;
      const form = formBox.querySelector('form')!;
      const input = form.querySelector('input')!, err = form.querySelector('.err')!, submit = form.querySelector('button')!;
      const showErr = (t: string) => { err.textContent = t; input.setAttribute('aria-invalid', t ? 'true' : 'false'); };
      input.addEventListener('input', () => showErr(''));
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const v = validateName(input.value);
        if (!v.ok) return showErr(messageFor(v.code));
        submit.disabled = true;
        const r2 = await setName(v.name);
        submit.disabled = false;
        if (!r2.ok) return showErr(messageFor(r2.code));
        try { localStorage.setItem('lastName.v1', v.name); } catch { /* ignore */ }
        formBox.innerHTML = `<p class="ok">บันทึกชื่อ "${escapeHtml(v.name)}" แล้ว</p>`;
      });
    },
  };
}
