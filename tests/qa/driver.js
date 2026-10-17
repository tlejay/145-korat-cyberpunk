// In-page scripted driver for physics specs (loaded with page.addScriptTag). Uses only window.__game.
// Coordinates: x = east, z = south (three.js). Heading 0 = facing −z (north), + = clockwise (towards east).
(() => {
  const g = window.__game;
  const cl = g.track().centerline;
  const cum = [0];
  for (let i = 1; i < cl.length; i++) cum.push(cum[i - 1] + Math.hypot(cl[i][0] - cl[i - 1][0], cl[i][1] - cl[i - 1][1]));
  const L = cum[cum.length - 1];
  const wrap = (a) => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };
  const DEG = 180 / Math.PI;
  const at = (s) => {
    s = ((s % L) + L) % L;
    let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    const x = cl[i - 1][0] + t * (cl[i][0] - cl[i - 1][0]), z = cl[i - 1][1] + t * (cl[i][1] - cl[i - 1][1]);
    const h = Math.atan2(cl[i][0] - cl[i - 1][0], -(cl[i][1] - cl[i - 1][1])) * DEG;
    return { x, z, h };
  };
  const headingTo = (fx, fz, tx, tz) => Math.atan2(tx - fx, -(tz - fz)) * DEG;
  const snap = () => JSON.parse(JSON.stringify(g.car()));
  // Seeded RNG (mulberry32) so fuzz runs are repeatable.
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  /** Run `ctrl(car, tSec)` → input each tick (tick = `frames` × fixed dt); stop when it returns null or maxS passes. */
  async function drive(ctrl, { maxS = 20, frames = 2 } = {}) {
    const dt = frames / 60;
    let t = 0;
    for (;;) {
      const c = g.car();
      const inp = ctrl(c, t);
      if (!inp || t > maxS) break;
      g.qa.setInput({ throttle: 0, brake: 0, steer: 0, jump: false, boost: false, ...inp });
      await g.qa.step(frames);
      t += dt;
    }
    g.qa.clearInput();
    return t;
  }

  /** Steering towards a target heading (P controller, full lock at 25° error). */
  const steerTo = (c, hdg) => Math.max(-1, Math.min(1, wrap(hdg - c.yawDeg) / 25));
  /** Hold a target speed with throttle/brake. */
  const speedCtl = (c, kmh) => (c.speedKmh < kmh - 2 ? { throttle: 1 } : c.speedKmh > kmh + 4 ? { brake: 0.6 } : { throttle: 0.35 });

  /** Teleport to track distance s (+lateral metres to the right), facing along the track (+yawOffset). */
  function place(s, lateral = 0, yawOffset = 0) {
    const p = at(s);
    const r = p.h / DEG;
    const x = p.x + Math.cos(r) * lateral, z = p.z + Math.sin(r) * lateral;
    g.qa.teleport(x, z, p.h + yawOffset);
    return { x, z, h: p.h + yawOffset };
  }

  /** Accelerate along the track from s until speed reached (follows the centreline). */
  async function runUp(s, kmh, opts = {}) {
    place(s);
    if (opts.tank !== undefined) g.qa.setTank(opts.tank);
    return drive((c) => {
      if (c.speedKmh >= kmh) return null;
      const pr = nearestS(c.pos.x, c.pos.z, s);
      const a = at(pr + 25);
      return { throttle: 1, boost: !!opts.boost, steer: steerTo(c, headingTo(c.pos.x, c.pos.z, a.x, a.z)) };
    }, { maxS: 15 });
  }

  function nearestS(x, z, hint) {
    let best = hint ?? 0, bd = Infinity;
    for (let i = 0; i < cl.length; i++) { const d = (cl[i][0] - x) ** 2 + (cl[i][1] - z) ** 2; if (d < bd) { bd = d; best = cum[i]; } }
    return best;
  }

  window.__drv = { cl, cum, L, at, wrap, headingTo, snap, rng, drive, steerTo, speedCtl, place, runUp, nearestS, DEG };
})();
