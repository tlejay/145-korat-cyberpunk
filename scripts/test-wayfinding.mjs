#!/usr/bin/env node
// Headless test for src/wayfinding/turns.ts on the real public/data/track-A.json.
// Usage: node scripts/test-wayfinding.mjs [--json]     (exit code 1 if any check fails)
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath } from 'node:url';
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('.') && spec.endsWith('.js') && ctx.parentURL?.endsWith('.ts')) {
          const ts = new URL(spec.slice(0, -3) + '.ts', ctx.parentURL);
          if (existsSync(fileURLToPath(ts))) return next(ts.href, ctx);
        }
        return next(spec, ctx);
      }`),
  import.meta.url,
);
const { findTurns, upcomingTurn } = await import('../src/wayfinding/turns.ts');

const raw = JSON.parse(readFileSync(new URL('../public/data/track-A.json', import.meta.url), 'utf8'));
const center = [];
for (let i = 0; i + 1 < raw.center.length; i += 2) center.push({ x: raw.center[i] * 0.1, z: raw.center[i + 1] * 0.1 });
const widthAt = (i) => raw.widths[i * 5] * 0.1;
const { turns, lengthM } = findTurns(center, widthAt);

const results = [];
const check = (name, ok, value) => results.push({ name, ok: !!ok, value });

if (process.argv.includes('--json')) console.log(JSON.stringify(turns, null, 1));
for (const t of turns) console.log(`#${t.id} ${t.dir.padEnd(5)} ${String(t.deg).padStart(4)}° s0 ${t.s0.toFixed(0).padStart(4)} apex ${t.sApex.toFixed(0).padStart(4)} s1 ${t.s1.toFixed(0).padStart(4)} w ${t.widthM} rArc ${t.arcRadiusM} rLine ${t.lineRadiusM} → ${t.safeKmh} km/h sev ${t.severity}`);

// every corner the world pane reported (track-A.json corners) is found, same direction, angle ±10°
for (const c of raw.corners) {
  const t = turns.find((t) => Math.min(Math.abs(t.sApex - c.s), lengthM - Math.abs(t.sApex - c.s)) < 30);
  check(`corner s=${c.s} ${c.dir} ${c.deg}° found`, t && (t.dir === 'right') === (c.dir === 'R') && Math.abs(Math.abs(t.deg) - Math.abs(c.deg)) <= 10, t ? `${t.dir} ${t.deg}° @${t.sApex.toFixed(0)}` : 'missing');
}
check('no spurious turns (≤ corners + 4)', turns.length <= raw.corners.length + 4, turns.length);
// the 224 junction right (first corner) is the fastest 90° (PHYSICS §4.2 grip 107 km/h, R 56)
const t224 = turns.find((t) => Math.abs(t.sApex - raw.corners[0].s) < 30);
check('224 corner safe speed 85–120 km/h, severity 1', t224 && t224.severity === 1 && t224.safeKmh >= 85 && t224.safeKmh <= 120, t224?.safeKmh);
// town corners (PHYSICS §4.2: 65–81 km/h grip) are severity ≥ 2
const town = turns.filter((t) => Math.abs(t.deg) >= 80 && t !== t224);
check('town 90° corners severity ≥ 2', town.every((t) => t.severity >= 2), town.map((t) => t.severity).join(','));
check('town 90° corners 60–90 km/h', town.every((t) => t.safeKmh >= 60 && t.safeKmh <= 90), town.map((t) => t.safeKmh).join(','));

// upcomingTurn: 150 m before the first turn-in → that turn, 150 m; inside the corner → distM 0; far → null
const f = turns[0];
const u1 = upcomingTurn(turns, lengthM, (f.s0 - 150 + lengthM) % lengthM);
check('upcoming 150 m before turn-in', u1 && u1.turn.id === f.id && Math.abs(u1.distM - 150) < 0.5, u1 && `${u1.turn.id} ${u1.distM.toFixed(1)}`);
const u2 = upcomingTurn(turns, lengthM, (f.s0 + f.sApex) / 2);
check('inside corner before apex → distM 0', u2 && u2.turn.id === f.id && u2.distM === 0, u2 && `${u2.turn.id} ${u2.distM}`);
const u3 = upcomingTurn(turns, lengthM, (f.s0 - 260 + lengthM) % lengthM);
check('260 m before first turn (straight) → null or another turn', !u3 || u3.turn.id !== f.id, u3 && u3.turn.id);
// wrap-around: the last turn seen from just before the line
const l = turns[turns.length - 1];
const u4 = upcomingTurn(turns, lengthM, (l.s0 - 50 + lengthM) % lengthM);
check('last turn found 50 m ahead', u4 && u4.turn.id === l.id, u4 && u4.turn.id);

let fail = 0;
for (const r of results) { console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.value})`); if (!r.ok) fail++; }
console.log(`\n${results.length - fail}/${results.length} passed`);
process.exit(fail ? 1 : 0);
