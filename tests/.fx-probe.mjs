import { chromium } from '@playwright/test';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage();
await p.addInitScript(() => { try { localStorage.setItem('settings.v1', JSON.stringify({ tutorialSeen: true })); } catch {} });
await p.goto('http://localhost:5287/koratrocketcar/?qa=1&track=A&laps=2&skip=1&quality=high');
await p.waitForFunction(() => window.__game && window.__game.state() === 'racing', null, { timeout: 120000 });
console.log(await p.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/src/game/engine.ts')).pop();
  const { E } = await import(url);
  const THREE = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('three') && n.includes('.js')));
  const out = [];
  E.car.object.updateMatrixWorld(true);
  E.car.object.traverse((o) => { if (/^nozzle-/.test(o.name)) { const v = new THREE.Vector3(0, 0, 1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())); const w = o.getWorldPosition(new THREE.Vector3()); out.push(o.name + ' pos ' + w.toArray().map((x) => x.toFixed(2)) + ' dir ' + v.toArray().map((x) => x.toFixed(2)) + ' rot ' + [o.rotation.x, o.rotation.y].map((x)=>x.toFixed(2))); } });
  const cm = E.scene.getObjectByName('fx-jet-cores');
  return out.join('\n') + '\ncores parent ' + cm?.parent?.name + ' count ' + cm?.count + ' heading ' + E.car.state.pose.heading.toFixed(2);
}));
await b.close();
