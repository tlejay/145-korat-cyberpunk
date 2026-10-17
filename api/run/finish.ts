import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { scores } from '../../db/schema.js';
import { computeScore, validateRun } from '../../src/net/score.js';
import { getTrack } from '../../src/net/tracks.js';
import { allowTestTrack, fail, handle, ipHash, isUuid, ok, readJson } from '../_lib/http.js';
import { rateLimit } from '../_lib/rate.js';
import { verifyToken } from '../_lib/token.js';

export const TOP_N = 100;

// POST { token, track, deviceId, build, stats: { lapMs, driftMs, jumps, collisions } }
// -> { score, rank, qualifies, personalBest, named }
export const POST = handle(async (req) => {
  const now = Date.now();
  const body = await readJson(req);
  if (!body) return fail('BAD_REQUEST');

  const tok = verifyToken(body.token);
  if (typeof tok === 'string') return fail(tok);
  if (!isUuid(body.deviceId)) return fail('BAD_DEVICE');
  const device = body.deviceId.toLowerCase();
  if (tok.t !== body.track || tok.d !== device) return fail('TOKEN_MISMATCH');

  const track = getTrack(tok.t, allowTestTrack());
  if (!track) return fail('BAD_TRACK');
  const run = validateRun(body.stats, track);
  if (typeof run === 'string') return fail(run);
  // The race cannot be shorter than the wall-clock time since the token was issued.
  if (now - tok.s < run.lapMs) return fail('RUN_TOO_FAST');

  const ip = ipHash(req);
  const allowed = (await rateLimit(`finish:d:${device}`, 6, 60)) && (await rateLimit(`finish:ip:${ip}`, 60, 600));
  if (!allowed) return fail('RATE_LIMITED', { 'retry-after': '60' });

  const build = typeof body.build === 'string' ? body.build.slice(0, 40) : 'unknown';
  const score = computeScore(run, track);

  const inserted = await db()
    .insert(scores)
    .values({
      trackId: tok.t,
      deviceId: device,
      // A device keeps the name it chose before.
      name: sql`(select name from scores where device_id = ${device} and name is not null order by created_at desc limit 1)`,
      score,
      lapMs: run.lapMs,
      driftMs: run.driftMs,
      jumps: run.jumps,
      collisions: run.collisions,
      build,
      runId: tok.n,
      ipHash: ip,
    })
    .onConflictDoNothing({ target: scores.runId })
    .returning({ name: scores.name });
  if (inserted.length === 0) return fail('RUN_USED');

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
    rank,
    qualifies: rank <= TOP_N,
    personalBest: score >= best,
    named: inserted[0].name !== null,
  });
});
