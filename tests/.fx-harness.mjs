// scratch harness (pane fx) — attaches src/fx to the running dev game and captures shots + stats
import { chromium } from '@playwright/test';
const BASE = 'http://localhost:5287/koratrocketcar/';
const OUT = process.argv[2] || 'refs/m3';
const q = process.argv[3] || 'high';
const only = process.argv[4] || 'all';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'log' && m.text().startsWith('[fx]'))) logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.addInitScript(() => { try { localStorage.setItem('settings.v1', JSON.stringify({ tutorialSeen: true })); } catch {} });
await page.goto(`${BASE}?qa=1&track=A&laps=2&skip=1&quality=${q}`);
await page.waitForFunction(() => window.__game && window.__game.state() === 'racing', null, { timeout: 120000 });
await page.evaluate((Q) => { window.__Q = Q; }, q === 'mid' ? 'medium' : q);
await page.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/src/game/engine.ts')).pop();
  const eng = await import(url);
  const E = eng.E;
  const fx = E.fx;
  if (!fx) throw new Error('game has no fx');
  window.__fxi = fx; window.__E = E;
  fx.setAutoBackoff(false);
  window.__pinQ = setInterval(() => window.__game.qa.setQuality(window.__Q), 200);
  E.car.setRain?.(1);
  // optional orbit camera: window.__cam = { back, side, up, look }
  const cu = E.car.camera.update;
  E.car.camera.update = (dt, cam) => {
    const c = window.__cam;
    if (!c) return cu(dt, cam);
    const p = E.car.state.pose, s = Math.sin(p.heading), co = Math.cos(p.heading);
    // forward = (s, −co), right = (co, s)
    cam.position.set(p.x - s * c.back + co * c.side, p.y + c.up, p.z + co * c.back + s * c.side);
    cam.lookAt(p.x + s * (c.look ?? 0), p.y + (c.lookUp ?? 0.6), p.z - co * (c.look ?? 0));
    cam.fov = c.fov ?? 60; cam.updateProjectionMatrix();
  };
});
const G = (f, a) => page.evaluate(f, a);
const shot = async (name) => { await page.screenshot({ path: `${OUT}/fx-${name}.png` }); };
const stats = async (tag) => { const s = await G(() => { const r = window.__fxi.stats(); const i = window.__game.stats(); const p = window.__E.car.state.pose; const c = window.__E.camera.position; return { fx: r, drawCalls: i.drawCalls, tris: i.triangles, fps: Math.round(i.fps), car: [p.x, p.y, p.z].map(Math.round), cam: [c.x, c.y, c.z].map(Math.round) }; }); console.log(tag, JSON.stringify(s)); return s; };
const inp = (i) => G((x) => window.__game.qa.setInput(x), i);
const wait = (ms) => page.waitForTimeout(ms);

await G(() => { window.__cam = { back: 7.5, side: 0, up: 2.3, look: 8, lookUp: 0.9, fov: 58 }; });
if (only === 'all' || only === 'drive') {
  await G(() => window.__game.qa.armLaunch()); await wait(700);
  await inp({ boost: false, throttle: 1 }); await wait(200); await shot('launch'); await stats('launch');
  await inp({ boost: true, throttle: 1 }); await wait(500); await shot('boost'); await stats('boost');
  await inp({ boost: false, throttle: 1 }); await wait(600);
  await G(() => window.__game.qa.setTank(100));
  await inp({ jump: true, throttle: 1 }); await wait(120); await shot('jump-takeoff'); await stats('jump');
  await inp({ jump: false, throttle: 1 }); await wait(400); await shot('jump-air'); await stats('air');
  await wait(1400); await shot('jump-land'); await stats('land');
  await inp({ steer: 1, throttle: 1, brake: 0.6 }); await wait(700); await shot('drift-wet'); await stats('drift');
  await inp({ steer: 0, throttle: 1 }); await wait(2500); await stats('cruise');
}
if (only === 'all' || only === 'compare') {
  // stationary jump from the rear, low camera — framing of the news photo
  await G(() => { const g = window.__game.qa, T = window.__E.track, c = T.centerline, i = Math.floor(c.length * 1520 / T.lengthM), a = c[i], b = c[i + 2];
    g.teleport(a.x, a.z, Math.atan2(b.x - a.x, -(b.z - a.z)) * 180 / Math.PI, 0); g.setTank(100); });
  await inp({ throttle: 0, brake: 1 }); await wait(800);
  await G(() => { window.__cam = { back: 6.5, side: 0, up: 1.3, look: 0, lookUp: 0.5, fov: 50 }; });
  await wait(400);
  await inp({ jump: true, brake: 0 }); await wait(140); await shot('plume-takeoff'); await stats('cmp-takeoff');
  await G(() => { window.__E.scene.getObjectByName('fx-jet-cores').visible = false; }); await wait(250); await shot('plume-takeoff-nocore');
  await G(() => { window.__E.scene.getObjectByName('fx-jet-cores').visible = true; window.__E.scene.getObjectByName('fx-particles').visible = false; }); await wait(250); await shot('plume-takeoff-coreonly');
  await G(() => { window.__E.scene.getObjectByName('fx-particles').visible = true; });
  await inp({ jump: false }); await wait(250); await shot('plume-rise');
  await wait(1100); await shot('plume-landing'); await stats('cmp-land');
  await wait(1200); await shot('plume-settle');
  await G(() => { window.__cam = { back: 1.5, side: 4.2, up: 1.6, look: -2.5, lookUp: 0.6, fov: 62 }; });
  await G(() => window.__game.qa.setTank(100));
  await inp({ boost: true, throttle: 1 }); await wait(250); await inp({ boost: false, throttle: 0 });
  await inp({ brake: 1, throttle: 0 }); await wait(1500);
  await G(() => { window.__cam = { back: 6.5, side: 2.5, up: 1.4, look: 0, lookUp: 0.5, fov: 55 }; });
  await G(() => window.__game.qa.armLaunch()); await wait(600); await inp({ boost: false, throttle: 1, brake: 0 });
  for (const ms of [60, 200, 400]) { await wait(ms === 60 ? 60 : ms - (ms === 200 ? 60 : 200)); await shot('plume-launch-' + ms); }
  await stats('cmp-launch');
}
console.log(logs.slice(0, 20).join('\n'));
await browser.close();
