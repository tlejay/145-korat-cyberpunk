import { getTrackRule } from '../../src/net/score.js';
import { allowTestTrack, fail, handle, ipHash, isUuid, ok, readJson } from '../_lib/http.js';
import { rateLimit } from '../_lib/rate.js';
import { issueToken } from '../_lib/token.js';

// POST { track, deviceId, qa? } -> { token, startedAt }
export const POST = handle(async (req) => {
  const body = await readJson(req);
  if (!body) return fail('BAD_REQUEST');
  if (!getTrackRule(body.track, allowTestTrack())) return fail('BAD_TRACK');
  if (!isUuid(body.deviceId)) return fail('BAD_DEVICE');
  const device = body.deviceId.toLowerCase();

  const allowed =
    (await rateLimit(`start:d:${device}`, 30, 600)) && (await rateLimit(`start:ip:${ipHash(req)}`, 150, 600));
  if (!allowed) return fail('RATE_LIMITED', { 'retry-after': '60' });

  const { token, payload } = issueToken(body.track as string, device, body.qa === true);
  return ok({ token, startedAt: payload.s });
});
