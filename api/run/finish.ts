import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { ghosts, scores } from '../../db/schema.js';
import { checkGhost } from '../../src/net/ghost-format.js';
import { computeScore, getTrackRule, parseRun, validateRun } from '../../src/net/score.js';
import { decodeGhostB64 } from '../_lib/ghost.js';
import { allowTestTrack, fail, handle, ipHash, isUuid, ok, readJson } from '../_lib/http.js';
import { rateLimit } from '../_lib/rate.js';
import { verifyToken } from '../_lib/token.js';

const TOP_N = 100;

// POST { token, deviceId, result: RunResult (src/net/score.ts), ghost?: base64 }
// -> { score, breakdown, rank, qualifies, personalBest, named, ghostSaved }
export const POST = handle(async (req) => {
  const now = Date.now();
  const body = await readJson(req);
  if (!body) return fail('BAD_REQUEST');

  const tok = verifyToken(body.token);
  if (typeof tok === 'string') return fail(tok);
  if (tok.q) return fail('QA_RUN');
  if (!isUuid(body.deviceId)) return fail('BAD_DEVICE');
  const device = body.deviceId.toLowerCase();
  if (tok.d !== device) return fail('TOKEN_MISMATCH');

  const run = parseRun(body.result);
  if (!run) return fail('BAD_REQUEST');
  const allowTest = allowTestTrack();
  const invalid = validateRun(run, { startedAtMs: tok.s, nowMs: now, trackId: tok.t, allowTest });
  if (invalid) return fail(invalid);
  const rule = getTrackRule(tok.t, allowTest)!;
  const bestLapMs = Math.min(...run.lapMs);

  // Ghost is optional, but if sent it must match the run (extra anti-cheat evidence).
  let ghostB64: string | null = null;
  if (body.ghost !== undefined && body.ghost !== null) {
    const g = decodeGhostB64(body.ghost);
    if (!g || checkGhost(g, bestLapMs, rule.lengthM)) return fail('BAD_GHOST');
    ghostB64 = body.ghost as string;
  }

  const ip = ipHash(req);
  const allowed = (await rateLimit(`finish:d:${device}`, 6, 60)) && (await rateLimit(`finish:ip:${ip}`, 60, 600));
  if (!allowed) return fail('RATE_LIMITED', { 'retry-after': '60' });

  const breakdown = computeScore(run, rule);
  const score = breakdown.total;

  const inserted = await db()
    .insert(scores)
    .values({
      trackId: tok.t,
      deviceId: device,
      // A device keeps the name it chose before.
      name: sql`(select name from scores where device_id = ${device} and name is not null order by created_at desc limit 1)`,
      score,
      scoreTime: breakdown.time,
      scoreStyle: breakdown.style,
      totalMs: run.totalMs,
      lapMs: bestLapMs,
      build: run.build,
      result: run,
      runId: tok.n,
      ipHash: ip,
    })
    .onConflictDoNothing({ target: scores.runId })
    .returning({ name: scores.name });
  if (inserted.length === 0) return fail('RUN_USED');

  // Keep only the device's best ghost: replace when this run scores higher.
  let ghostSaved = false;
  if (ghostB64) {
    const saved = await db()
      .insert(ghosts)
      .values({ trackId: tok.t, deviceId: device, runId: tok.n, score, lapMs: bestLapMs, data: ghostB64, build: run.build })
      .onConflictDoUpdate({
        target: [ghosts.trackId, ghosts.deviceId],
        set: { runId: tok.n, score, lapMs: bestLapMs, data: ghostB64, build: run.build, updatedAt: sql`now()` },
        setWhere: sql`${ghosts.score} < ${score}`,
      })
      .returning({ runId: ghosts.runId });
    ghostSaved = saved.length > 0;
  }

  const res = await db().execute<{ rank: number; best: number }>(sql`
    select
      1 + (select count(*)::int from (
        select device_id from scores
        where track_id = ${tok.t} and device_id <> ${device}
        group by device_id having max(score) > ${score}
      ) better) as rank,
      (select max(score)::int from scores where track_id = ${tok.t} and device_id = ${device}) as best
  `);
  const { rank, best } = res.rows[0];
  return ok({
    score,
    breakdown,
    rank,
    qualifies: rank <= TOP_N,
    personalBest: score >= best,
    named: inserted[0].name !== null,
    ghostSaved,
  });
});
