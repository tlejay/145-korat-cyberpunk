import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { getTrackRule } from '../src/net/score.js';
import { allowTestTrack, fail, handle, ok } from './_lib/http.js';

// GET ?track=A&limit=50 -> { track, entries: [{ rank, name, score, totalMs, lapMs, at }] }
// One entry per device (its best run). Device ids are never returned.
export const GET = handle(async (req) => {
  const url = new URL(req.url);
  const trackId = url.searchParams.get('track');
  if (!getTrackRule(trackId, allowTestTrack())) return fail('BAD_TRACK');
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '50', 10) || 50));

  const res = await db().execute<{ name: string | null; score: number; total_ms: number; lap_ms: number; created_at: string }>(sql`
    select name, score, total_ms, lap_ms, created_at from (
      select distinct on (device_id) device_id, name, score, total_ms, lap_ms, created_at
      from scores where track_id = ${trackId}
      order by device_id, score desc, total_ms asc, created_at asc
    ) best
    order by score desc, total_ms asc, created_at asc
    limit ${limit}
  `);

  // Competition ranking: equal scores share a rank.
  let prevScore = Number.NaN;
  let prevRank = 0;
  const entries = res.rows.map((r, i) => {
    const rank = r.score === prevScore ? prevRank : i + 1;
    prevScore = r.score;
    prevRank = rank;
    return { rank, name: r.name, score: r.score, totalMs: r.total_ms, lapMs: r.lap_ms, at: new Date(r.created_at).toISOString() };
  });

  return ok({ track: trackId, entries }, { 'cache-control': 'public, s-maxage=10, stale-while-revalidate=30' });
});
