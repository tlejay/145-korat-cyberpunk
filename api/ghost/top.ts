import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { getTrackRule } from '../../src/net/score.js';
import { allowTestTrack, fail, handle, ok } from '../_lib/http.js';

// GET ?track=A -> { track, ghost: null | { name, score, lapMs, build, data } }
// Ghost of the #1 player who has one (data = base64 deflate-raw, ghost-format v1).
export const GET = handle(async (req) => {
  const trackId = new URL(req.url).searchParams.get('track');
  if (!getTrackRule(trackId, allowTestTrack())) return fail('BAD_TRACK');

  const res = await db().execute<{ name: string | null; score: number; lap_ms: number; build: string; data: string }>(sql`
    select g.score, g.lap_ms, g.build, g.data,
      (select name from scores s where s.device_id = g.device_id and s.name is not null order by s.created_at desc limit 1) as name
    from ghosts g
    where g.track_id = ${trackId}
    order by g.score desc, g.lap_ms asc, g.updated_at asc
    limit 1
  `);
  const r = res.rows[0];
  const ghost = r ? { name: r.name, score: r.score, lapMs: r.lap_ms, build: r.build, data: r.data } : null;
  return ok({ track: trackId, ghost }, { 'cache-control': 'public, s-maxage=30, stale-while-revalidate=120' });
});
