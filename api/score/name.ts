import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { scores } from '../../db/schema.js';
import { validateName } from '../../src/net/name.js';
import { fail, handle, isUuid, ok, readJson } from '../_lib/http.js';
import { rateLimit } from '../_lib/rate.js';

// POST { deviceId, name } -> { name }  (applies to every score of this device)
export const POST = handle(async (req) => {
  const body = await readJson(req);
  if (!body) return fail('BAD_REQUEST');
  if (!isUuid(body.deviceId)) return fail('BAD_DEVICE');
  const device = body.deviceId.toLowerCase();
  const v = validateName(body.name);
  if (!v.ok) return fail(v.code);

  if (!(await rateLimit(`name:d:${device}`, 10, 3600))) return fail('RATE_LIMITED', { 'retry-after': '600' });

  const updated = await db()
    .update(scores)
    .set({ name: v.name })
    .where(eq(scores.deviceId, device))
    .returning({ id: scores.id });
  if (updated.length === 0) return fail('NO_SCORE');
  return ok({ name: v.name });
});
