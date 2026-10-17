// FIX-01 (docs/dev/fix/REPORT-fix.md): announcer said "Three, Three" — beginCountdown() and the
// first stepOnce() both fired countdown3. Records every voice buffer the game starts (tagged by URL
// at fetch → decode time) and asserts the countdown is exactly three, two, one, go — once each, on beat.
// FIX-02: the countdown runs on the audio clock, not physics steps — beats stay 0.8 s under CPU throttle.
import { expect, test, type Page } from '@playwright/test';
import { expectClean, openGame, readJson, record, watch } from './helpers';

declare global {
  interface Window {
    __voiceLog?: { id: string; when: number; now: number }[];
    __hudLog?: { text: string; t: number }[];
    __clock?: [number, number][];
    __ctx?: BaseAudioContext;
  }
}

const STEP_S = 0.8; // GAME.countdownStepS
const TOL_S = 0.1;

async function instrument(page: Page) {
  await page.addInitScript(() => {
    // HUD digit changes, wall clock (s).
    const hud: { text: string; t: number }[] = (window.__hudLog = []);
    const clock: [number, number][] = (window.__clock = []);
    const tick = () => {
      if (window.__ctx) clock.push([performance.now() / 1000, window.__ctx.currentTime]);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    new MutationObserver(() => {
      const el = document.querySelector('[data-qa=hud-countdown]');
      const text = el?.textContent?.trim() ?? '';
      if (text && hud[hud.length - 1]?.text !== text) hud.push({ text, t: performance.now() / 1000 });
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await page.addInitScript(() => {
    const byBytes = new WeakMap<ArrayBuffer, string>();
    const byBuffer = new WeakMap<AudioBuffer, string>();
    const log: { id: string; when: number; now: number }[] = (window.__voiceLog = []);
    const origFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const r = await origFetch(input, init);
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const m = /\/voice\/(vo-[a-z-]+)\.(ogg|m4a)/.exec(url);
      if (!m) return r;
      const ab = r.arrayBuffer.bind(r);
      r.arrayBuffer = async () => { const b = await ab(); byBytes.set(b, m[1]); return b; };
      return r;
    };
    const decode = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (this: BaseAudioContext, bytes: ArrayBuffer, ...rest: never[]) {
      const id = byBytes.get(bytes);
      const p = decode.call(this, bytes, ...rest) as Promise<AudioBuffer>;
      return id ? p.then((buf) => { byBuffer.set(buf, id); return buf; }) : p;
    } as typeof decode;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, when?: number, ...rest: number[]) {
      window.__ctx ??= this.context;
      const id = this.buffer && byBuffer.get(this.buffer);
      if (id) log.push({ id, when: Math.max(when ?? 0, this.context.currentTime), now: this.context.currentTime });
      return start.call(this, when, ...rest);
    };
  });
}

/** Menu → tap "เริ่มแข่ง" (unlocks audio) → wait until racing; returns the voice + HUD logs. */
async function runCountdown(page: Page) {
  await openGame(page);
  await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('[data-qa=btn-start]')?.disabled, null, { timeout: 60_000 });
  await page.locator('[data-qa=btn-start]').click(); // real tap → audio unlock
  await page.waitForFunction(() => window.__game!.state() === 'racing', null, { timeout: 120_000 });
  await page.waitForTimeout(1500); // let a queued duplicate (if any) start
  const log = await page.evaluate(() => window.__voiceLog!);
  const hud = await page.evaluate(() => window.__hudLog!);
  const audio = await page.evaluate(() => window.__game!.audio());
  const countdown = log.filter((e) => ['vo-three', 'vo-two', 'vo-one', 'vo-go'].includes(e.id));
  return { log, hud, audio, countdown };
}

const gaps = (ts: number[]) => ts.slice(1).map((t, i) => +(t - ts[i]).toFixed(3));

test('FIX-01 countdown voice: three, two, one, go — no repeats, 0.8 s apart', async ({ page }) => {
  const w = watch(page);
  await instrument(page);
  const { log, hud, audio, countdown } = await runCountdown(page);
  record(test.info(), 'FIX-01-voice', { audio, log, hud });

  expect(audio.unlocked, 'audio must unlock in the test browser for this check to mean anything').toBe(true);
  expect(countdown.map((e) => e.id)).toEqual(['vo-three', 'vo-two', 'vo-one', 'vo-go']);
  for (const g of gaps(countdown.map((e) => e.when))) expect(Math.abs(g - STEP_S), `voice gap ${g}`).toBeLessThan(TOL_S);
  expectClean(w);
});

test('FIX-02 countdown on the clock under 6× CPU throttle: voice 0.8 ± 0.1 s, HUD on the beat', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CPU throttling needs CDP');
  const w = watch(page);
  await instrument(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const { log, hud, audio, countdown } = await runCountdown(page);
  const DIGITS = ['3', '2', '1', 'ไป!'];
  const beats = hud.filter((h) => DIGITS.includes(h.text));
  const clock = await page.evaluate(() => window.__clock!);
  const voiceAt = countdown.map((e) => e.when);
  // Wall ↔ audio clock: offset per frame sample; its spread over the countdown = audio clock drift.
  const win = clock.filter(([, a]) => a >= voiceAt[0] - 0.5 && a <= voiceAt[3] + 0.5);
  const offs = win.map(([p, a]) => p - a).sort((x, y) => x - y);
  const off = offs[Math.floor(offs.length / 2)], driftS = offs[offs.length - 1] - offs[0];
  // Longest frame during the countdown: the HUD can only change on a frame, so that is its resolution.
  const maxFrameS = Math.max(...gaps(win.map(([p]) => p)));
  // HUD lateness vs its beat on the audio clock (MutationObserver logs at the end of that frame).
  const late = beats.map((h) => +(h.t - off - voiceAt[DIGITS.indexOf(h.text)]).toFixed(3));
  record(test.info(), 'FIX-02-clock', {
    audio, fps: +(win.length / (win[win.length - 1][0] - win[0][0])).toFixed(1), maxFrameS, driftS,
    voiceGaps: gaps(voiceAt), hudBeats: beats.map((h) => h.text), hudLateS: late, log, hud,
  });

  // Voice is scheduled on the audio clock, and that clock keeps wall time: exact regardless of frame rate.
  expect(countdown.map((e) => e.id)).toEqual(['vo-three', 'vo-two', 'vo-one', 'vo-go']);
  for (const g of gaps(voiceAt)) expect(Math.abs(g - STEP_S), `voice gap ${g}`).toBeLessThan(TOL_S);
  expect(driftS, 'audio clock vs wall clock drift during countdown').toBeLessThan(0.05);
  // HUD reads the same clock: each digit appears on the first frame after its beat — never early,
  // at most one frame (+0.1 s) late. A frame longer than a beat may skip a digit; GO always shows.
  expect(beats[beats.length - 1].text).toBe('ไป!');
  if (maxFrameS < STEP_S * 0.8) expect(beats.map((h) => h.text)).toEqual(DIGITS);
  for (const l of late) {
    expect(l, `HUD digit early by ${-l}s`).toBeGreaterThan(-0.05);
    expect(l, `HUD digit late ${l}s (max frame ${maxFrameS}s)`).toBeLessThan(TOL_S + maxFrameS);
  }
  expectClean(w);
});

test('FIX-01 voice set: every vo-* id maps to its own Mint/Charlie take', async ({ browserName }) => {
  test.skip(browserName !== 'chromium', 'static file check');
  const words = ['three', 'two', 'one', 'go', 'final-lap', 'new-record', 'finish', 'boost', 'nice-drift', 'great-jump'];
  const m = readJson<{ sounds: Record<string, { path: string; kind: string; source: string; bytes: { ogg: number; m4a: number } }> }>(
    'public/assets/audio/manifest.json');
  for (const wd of words) {
    const e = m.sounds[`vo-${wd}`];
    expect(e, `vo-${wd}`).toBeTruthy();
    expect(e.kind).toBe('voice');
    expect(e.path).toBe(`voice/vo-${wd}`);
    expect(e.source).toBe(`voice/mint/charlie/${wd}.mp3`);
  }
});
