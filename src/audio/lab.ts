// Listening page for Tle / QA: ?qa=1&view=audio. Every AudioEvent has a button, plus a
// fake car (speed / slip / airborne sliders) feeding audio.update() so the motor pitch,
// tire squeal and landing can be judged by ear without driving.
import type { AudioEvent, CarState } from '../types.js';
import { createAudio } from './index.js';

const EVENTS: [AudioEvent, string][] = [
  ['countdown3', 'นับ 3'], ['countdown2', 'นับ 2'], ['countdown1', 'นับ 1'], ['go', 'ไป!'],
  ['finalLap', 'รอบสุดท้าย'], ['newRecord', 'ทำสถิติใหม่'], ['finish', 'เข้าเส้นชัย'],
  ['boost', 'บูสต์'], ['jump', 'กระโดด'], ['land', 'ลงพื้น'], ['crash', 'ชน'],
  ['checkpoint', 'ผ่านจุดตรวจ'], ['drift', 'ดริฟต์สวย'], ['uiTap', 'แตะปุ่ม'],
];

const CSS = `
.al{position:fixed;inset:0;overflow:auto;background:#07060f;color:#e8e6ff;font-family:'Noto Sans Thai',system-ui,sans-serif;
  padding:16px max(16px,env(safe-area-inset-right)) 32px max(16px,env(safe-area-inset-left));z-index:50;-webkit-user-select:none;user-select:none;touch-action:manipulation}
.al h1{font-size:20px;margin:0 0 4px;color:#ff3df2;text-shadow:0 0 12px #ff3df2aa}
.al h2{font-size:14px;margin:18px 0 8px;color:#38f3ff;letter-spacing:.04em}
.al p{margin:0;font-size:13px;color:#a9a6c9}
.al-grid{display:flex;flex-wrap:wrap;gap:12px}
.al button{min-height:48px;min-width:96px;padding:0 14px;border-radius:10px;border:1px solid #38f3ff66;background:#121032;color:#e8e6ff;font:inherit;font-size:15px}
.al button:active{background:#38f3ff;color:#07060f}
.al button.on{border-color:#ff3df2;box-shadow:0 0 10px #ff3df266}
.al .al-unlock{width:100%;min-height:64px;font-size:18px;border-color:#ff3df2;background:#2a0b2e}
.al label{display:flex;align-items:center;gap:12px;font-size:15px;min-height:48px}
.al input[type=range]{flex:1;min-width:160px;height:32px;accent-color:#ff3df2}
.al output{min-width:110px;text-align:right;font-variant-numeric:tabular-nums;color:#38f3ff}
.al pre{font-size:12px;background:#0e0c22;border-radius:8px;padding:10px;white-space:pre-wrap;color:#a9a6c9;margin:0}
`;

export function mountAudioLab(root: HTMLElement) {
  const audio = createAudio();
  (window as unknown as { __audio?: typeof audio }).__audio = audio;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.className = 'al';
  el.setAttribute('data-qa', 'audio-lab');
  el.innerHTML = `
    <h1>ห้องทดสอบเสียง</h1>
    <p>ใส่หูฟังหรือเปิดลำโพงมือถือ แล้วกดปุ่มด้านล่างเพื่อฟังทีละเสียง · iPhone ที่เปิดโหมดเงียบอาจไม่มีเสียง ให้ปิดสวิตช์เงียบข้างเครื่องก่อน</p>
    <h2>เริ่ม</h2>
    <button class="al-unlock" type="button" data-qa="audio-unlock">แตะเพื่อเปิดเสียง</button>
    <h2>เสียงเหตุการณ์</h2>
    <div class="al-grid" data-qa="audio-events">
      ${EVENTS.map(([e, label]) => `<button type="button" data-ev="${e}">${label}</button>`).join('')}
      <button type="button" data-act="countdown">นับถอยหลังทั้งชุด</button>
    </div>
    <h2>เพลง</h2>
    <div class="al-grid">
      <button type="button" data-music="menu">เพลงเมนู</button>
      <button type="button" data-music="race">เพลงแข่ง</button>
      <button type="button" data-ev="finalLap">สลับเป็นรอบสุดท้าย</button>
      <button type="button" data-music="off">ปิดเพลง</button>
    </div>
    <h2>รถจำลอง (เสียงมอเตอร์ไฟฟ้า + ยาง)</h2>
    <div class="al-grid">
      <button type="button" data-act="drive" class="on">เปิดเครื่องรถ</button>
      <button type="button" data-act="ramp">เร่ง 0 → 200 กม./ชม.</button>
      <button type="button" data-act="air">ลอยกลางอากาศ</button>
    </div>
    <label>ความเร็ว <input type="range" min="0" max="300" step="1" value="0" data-in="speed"><output data-out="speed"></output></label>
    <label>มุมดริฟต์ <input type="range" min="0" max="45" step="1" value="0" data-in="slip"><output data-out="slip"></output></label>
    <h2>ระดับเสียง</h2>
    <label>เพลง <input type="range" min="0" max="100" step="1" data-in="music"><output data-out="music"></output></label>
    <label>เอฟเฟกต์ <input type="range" min="0" max="100" step="1" data-in="sfx"><output data-out="sfx"></output></label>
    <div class="al-grid"><button type="button" data-act="mute">ปิดเสียงทั้งหมด</button></div>
    <h2>สถานะ</h2>
    <pre data-qa="audio-debug"></pre>
  `;
  root.appendChild(el);

  const $ = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const fmt = (n: number, d = 0) => n.toLocaleString('th-TH', { maximumFractionDigits: d, minimumFractionDigits: d });

  const state: CarState = {
    pose: { x: 0, y: 0, z: 0, heading: 0 }, speedKmh: 0, velocity: { x: 0, y: 0, z: 0 },
    gForce: 0, gas: 1, airborne: false, drifting: false, driftAngleDeg: 0, onSurface: 'road',
  };
  let driving = true;
  let ramp = false;

  const speedIn = $<HTMLInputElement>('[data-in=speed]');
  const slipIn = $<HTMLInputElement>('[data-in=slip]');
  const musicIn = $<HTMLInputElement>('[data-in=music]');
  const sfxIn = $<HTMLInputElement>('[data-in=sfx]');
  musicIn.value = String(Math.round(audio.volumes.music * 100));
  sfxIn.value = String(Math.round(audio.volumes.sfx * 100));

  const unlockBtn = $<HTMLButtonElement>('[data-qa=audio-unlock]');
  unlockBtn.addEventListener('click', async () => {
    await audio.unlock();
    unlockBtn.textContent = audio.debug().unlocked ? 'เปิดเสียงแล้ว' : 'ยังเปิดเสียงไม่ได้ แตะอีกครั้ง';
  });

  el.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (!b || b === unlockBtn) return;
    void audio.unlock();                            // any tap also unlocks (first tap on iOS)
    const e = b.dataset.ev as AudioEvent | undefined;
    if (e) {
      if (e === 'land') state.velocity.y = -9;      // pretend we fell for a solid thump
      audio.play(e);
      return;
    }
    if (b.dataset.music) {
      audio.music(b.dataset.music as 'menu' | 'race' | 'off');
      return;
    }
    switch (b.dataset.act) {
      case 'countdown': audio.countdown(0.8); break;
      case 'drive': driving = !driving; b.classList.toggle('on', driving); break;
      case 'ramp': ramp = true; speedIn.value = '0'; break;
      case 'air': {
        state.airborne = !state.airborne;
        b.classList.toggle('on', state.airborne);
        if (state.airborne) { state.velocity.y = 6; audio.play('jump'); }
        else audio.play('land');
        break;
      }
      case 'mute': {
        audio.setMuted(!audio.muted);
        b.classList.toggle('on', audio.muted);
        b.textContent = audio.muted ? 'เปิดเสียง' : 'ปิดเสียงทั้งหมด';
        break;
      }
    }
  });
  const onVol = () => audio.setVolumes(+musicIn.value / 100, +sfxIn.value / 100);
  musicIn.addEventListener('input', onVol);
  sfxIn.addEventListener('input', onVol);
  speedIn.addEventListener('input', () => { ramp = false; });

  const dbg = $<HTMLPreElement>('[data-qa=audio-debug]');
  let last = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (ramp) {
      // ~4.6 g launch tapering off: 0 → 100 km/h in ≈ 0.6 s, 200 km/h in ≈ 3 s
      const v = +speedIn.value;
      const next = Math.min(200, v + dt * Math.max(40, 160 - v * 0.6));
      speedIn.value = String(next);
      if (next >= 200) ramp = false;
    }
    state.speedKmh = +speedIn.value;
    state.driftAngleDeg = +slipIn.value;
    state.drifting = state.driftAngleDeg >= 15;
    if (state.airborne) state.velocity.y = Math.max(-15, state.velocity.y - 9.8 * dt);
    else state.velocity.y = 0;
    if (driving) audio.update(state, dt);

    $('[data-out=speed]').textContent = `${fmt(state.speedKmh)} กม./ชม.`;
    $('[data-out=slip]').textContent = `${fmt(state.driftAngleDeg)}°`;
    $('[data-out=music]').textContent = `${fmt(+musicIn.value)}%`;
    $('[data-out=sfx]').textContent = `${fmt(+sfxIn.value)}%`;
    if (frame++ % 6 === 0) {
      const d = audio.debug();
      dbg.textContent = [
        `ระบบเสียง: ${d.contextState === 'running' ? 'ทำงาน' : d.contextState === 'suspended' ? 'รอแตะเพื่อเปิด' : d.contextState}`,
        `ไฟล์: ${d.format === 'ogg' ? 'Opus (.ogg)' : 'AAC (.m4a)'} · ปิดเสียง: ${d.muted ? 'ใช่' : 'ไม่'}`,
        `ความถี่มอเตอร์: ${fmt(d.engineRate, 1)} Hz`,
        `เพลง: ${d.music ?? '—'}`,
        `กำลังเล่น: ${d.playing.join(', ') || '—'}`,
      ].join('\n');
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
