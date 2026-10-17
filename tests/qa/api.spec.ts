// Leaderboard API on a deployed preview (QA_BASE_URL). Uses track "test" only (accepted outside production)
// and deletes every row it creates (preview and production share one Neon DB — CLAUDE.md §11).
import { neon } from '@neondatabase/serverless';
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { MESSAGES } from '../../src/net/messages';
import { VERSION } from '../../src/version';
import { expectClean, record, seedSettings, watch } from './helpers';

const REMOTE = !!process.env.QA_BASE_URL;
test.skip(!REMOTE, 'API specs need a deployed preview (pnpm qa:preview)');
test.use({ viewport: { width: 400, height: 200 } });

const device = randomUUID();
const api = (p: string) => new URL(`api/${p}`, process.env.QA_BASE_URL).toString();

test.afterAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const sql = neon(url);
  const s = await sql`delete from scores where track_id = 'test' and device_id = ${device} returning id`;
  const g = await sql`delete from ghosts where track_id = 'test' and device_id = ${device} returning device_id`;
  const r = await sql`delete from rate_events where key like ${'%' + device + '%'} returning id`;
  const left = await sql`select count(*)::int as n from scores where track_id = 'test'`;
  record(test.info(), 'API-cleanup', { scores: s.length, ghosts: g.length, rate: r.length, testRowsLeft: left[0].n });
});

test('API: start → finish (track test) → name → leaderboard, then error codes are Thai', async ({ request }, info) => {
  test.skip(info.project.name !== 'chromium-landscape', 'once is enough');
  expect(process.env.DATABASE_URL, 'DATABASE_URL needed to clean up test rows').toBeTruthy();
  const lb = await request.get(api('leaderboard?track=A'));
  expect(lb.status()).toBe(200);
  const start = await (await request.post(api('run/start'), { data: { track: 'test', deviceId: device } })).json();
  expect(start.ok).toBe(true);
  await new Promise((r) => setTimeout(r, 6500)); // wall-clock check: elapsed ≥ total − 0.5 s
  const run = {
    trackId: 'test', build: VERSION, laps: 1, totalMs: 6000, lapMs: [6000], splitsMs: [2000, 4000, 5500],
    shortcuts: 0, driftMs: 0, driftChains: 0, jumps: 0, cleanLandings: 0, launches: { perfect: 0, total: 0 },
    boostMs: 0, refills: 0, cleanLaps: 1, respawns: 0, maxG: 1,
  };
  const fin = await request.post(api('run/finish'), { data: { token: start.token, deviceId: device, result: run } });
  const finBody = await fin.json();
  const again = await (await request.post(api('run/finish'), { data: { token: start.token, deviceId: device, result: run } })).json();
  const name = await (await request.post(api('score/name'), { data: { deviceId: device, name: 'ทดสอบQA' } })).json();
  const board = await (await request.get(api('leaderboard?track=test'))).json();
  // Error paths
  const badTrack = await request.post(api('run/start'), { data: { track: 'nope', deviceId: device } });
  const junk = await request.post(api('run/finish'), { data: 'not json', headers: { 'content-type': 'application/json' } });
  const tooFast = await (async () => {
    const s = await (await request.post(api('run/start'), { data: { track: 'test', deviceId: device } })).json();
    return (await request.post(api('run/finish'), { data: { token: s.token, deviceId: device, result: { ...run, totalMs: 1000, lapMs: [1000], splitsMs: [300, 600, 900] } } })).json();
  })();
  const r = { status: fin.status(), finBody, again, name, boardHasUs: JSON.stringify(board).includes('ทดสอบQA'), badTrack: [badTrack.status(), await badTrack.json()], junk: [junk.status(), await junk.text()], tooFast };
  record(info, 'API', r);
  expect(finBody.ok, JSON.stringify(finBody)).toBe(true);
  expect(again.code).toBe('RUN_USED');
  expect(name.ok).toBe(true);
  expect(r.boardHasUs).toBe(true);
  expect(badTrack.status()).toBe(400);
  expect(r.junk[1]).not.toMatch(/stack|Error:|at \w+ \(/);
  expect(tooFast.code).toBe('TOO_FAST');
  for (const code of ['RUN_USED', 'TOO_FAST', 'BAD_TRACK', 'BAD_REQUEST'] as const) expect(MESSAGES[code]).toMatch(/[฀-๿]/);
});

test('game with &net=1 (QA run) talks to the API and shows the Thai "QA run" note — no score saved', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-landscape', 'once is enough');
  const w = watch(page);
  const calls: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/api/')) calls.push(`${r.method()} ${r.url().replace(/^.*\/api\//, '')}`); });
  await seedSettings(page, { tutorialSeen: true });
  await page.goto('./?qa=1&net=1&track=A&laps=1&skip=1&quality=low'); // = TRACK_RULES.A.laps (fix #10), else no run ticket
  await page.waitForFunction(() => window.__game?.state() === 'racing', null, { timeout: 30_000 });
  await page.evaluate(async () => {
    const g = window.__game!; g.qa.fixedStep(true, 1000 / 30); g.qa.autopilot(true);
    let n = 0; while (g.state() === 'racing' && n < 30 * 400) { await g.qa.step(30); n += 30; }
  });
  await expect.poll(() => page.evaluate(() => window.__game!.state()), { timeout: 20_000 }).toBe('finished');
  await page.waitForTimeout(3000);
  const text = await page.locator('#ui').innerText();
  record(info, 'API-game', { calls, hasQaNote: text.includes(MESSAGES.QA_RUN), errors: w.errors, bad: w.badRequests });
  expect(calls.some((c) => c.startsWith('POST run/start'))).toBe(true);
  expect(calls.some((c) => c.startsWith('POST run/finish'))).toBe(true);
  // run/finish answers 403 QA_RUN by design for ?qa=1 tokens — that is the expected "not saved" path.
  expectClean(w, { allowRequests: /403 .*run\/finish/, allowErrors: /status of 403/ });
});
