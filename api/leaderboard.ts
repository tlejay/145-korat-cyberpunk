import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { getTrack } from '../src/net/tracks.js';
import { allowTestTrack, fail, handle, ok } from './_lib/http.js';

// GET ?track=A&limit=50 -> { track, entries: [{ rank, name, score, lapMs, at }] }
// One entry per device (its best run). Device ids are never returned.
export const GET = handle(async (req) => {
  const url = new URL(req.url);
  const trackId = url.searchParams.get('track');
  if (!getTrack(trackId, allowTestTrack())) return fail('BAD_TRACK');
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '50', 10) || 50));

  const res = await db().execute<{ name: string | null; score: number; lap_ms: number; created_at: string }>(sql`
    select name, score, lap_ms, created_at from (
      select distinct on (device_id) device_id, name, score, lap_ms, created_at
      from scores where track_id = ${trackId}
      order by device_id, score desc, lap_ms asc, created_at asc
    ) best
    order by score desc, lap_ms asc, created_at asc
    limit ${limit}
  `);

  // Competition ranking: equal scores share a rank.
  let prevScore = Number.NaN;
  let prevRank = 0;
  const entries = res.rows.map((r, i) => {
    const rank = r.score === prevScore ? prevRank : i + 1;
    prevScore = r.score;
    prevRank = rank;
    return { rank, name: r.name, score: r.score, lapMs: r.lap_ms, at: r.created_at };
  });

  return ok({ track: trackId, entries }, { 'cache-control': 'public, s-maxage=10, stale-while-revalidate=30' });
});
