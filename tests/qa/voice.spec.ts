// FIX-01 (docs/dev/fix/REPORT-fix.md): announcer said "Three, Three" — beginCountdown() and the
// first stepOnce() both fired countdown3. Records every voice buffer the game starts (tagged by URL
// at fetch → decode time) and asserts the countdown is exactly three, two, one, go — once each, on beat.
import { expect, test } from '@playwright/test';
import { expectClean, openGame, readJson, record, watch } from './helpers';

declare global { interface Window { __voiceLog?: { id: string; when: number; now: number }[] } }

const STEP_S = 0.8; // GAME.countdownStepS

test('FIX-01 countdown voice: three, two, one, go — no repeats, 0.8 s apart', async ({ page }) => {
  const w = watch(page);
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
      const id = this.buffer && byBuffer.get(this.buffer);
      if (id) log.push({ id, when: Math.max(when ?? 0, this.context.currentTime), now: this.context.currentTime });
      return start.call(this, when, ...rest);
    };
  });
  await openGame(page);
  await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('[data-qa=btn-start]')?.disabled, null, { timeout: 60_000 });
  await page.locator('[data-qa=btn-start]').click(); // real tap → audio unlock
  await page.waitForFunction(() => window.__game!.state() === 'racing', null, { timeout: 30_000 });
  await page.waitForTimeout(1500); // let a queued duplicate (if any) start
  const log = await page.evaluate(() => window.__voiceLog!);
  const audio = await page.evaluate(() => window.__game!.audio());
  record(test.info(), 'FIX-01-voice', { audio, log });

  expect(audio.unlocked, 'audio must unlock in the test browser for this check to mean anything').toBe(true);
  const countdown = log.filter((e) => ['vo-three', 'vo-two', 'vo-one', 'vo-go'].includes(e.id));
  expect(countdown.map((e) => e.id)).toEqual(['vo-three', 'vo-two', 'vo-one', 'vo-go']);
  // On the beat: each word starts no sooner than one step after the previous one. No upper bound —
  // the countdown runs on physics steps, which fall behind wall-clock when frames are slow
  // (SwiftShader: up to +1.6 s; WebKit/real GPUs land at 0.80 ± 0.02 s).
  for (let i = 1; i < countdown.length; i++) {
    expect(countdown[i].when - countdown[i - 1].when).toBeGreaterThan(STEP_S - 0.12);
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
