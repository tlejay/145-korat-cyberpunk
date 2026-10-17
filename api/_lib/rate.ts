import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';

// Returns true if the action is allowed (and records it). Atomic per call:
// count + insert happen in one statement.
export async function rateLimit(key: string, max: number, windowSec: number): Promise<boolean> {
  const rows = await db().execute<{ allowed: boolean }>(sql`
    with recent as (
      select count(*)::int as n from rate_events
      where key = ${key} and at > now() - make_interval(secs => ${windowSec})
    ), ins as (
      insert into rate_events (key)
      select ${key} from recent where n < ${max}
      returning 1
    )
    select (select n from recent) < ${max} as allowed
  `);
  // Opportunistic cleanup (~1% of calls).
  if (Math.random() < 0.01) {
    await db().execute(sql`delete from rate_events where at < now() - interval '1 day'`);
  }
  return Boolean(rows.rows[0]?.allowed);
}
