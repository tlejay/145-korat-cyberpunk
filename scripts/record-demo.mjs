#!/usr/bin/env node
// Record promo footage from the demo mode (src/capture) frame by frame → 60 fps H.264 mp4.
// Every frame is stepped on the game's virtual clock (?fixedDt=1), so the video is smooth and identical
// on any machine no matter how slow it renders. Needs: pnpm install (Playwright + Chromium) and ffmpeg.
//
//   node scripts/record-demo.mjs --shot drift --hud 0                      # → promo-footage/clean/drift.mp4
//   node scripts/record-demo.mjs --shot all --hud both                     # every shot, clean + hud
//   node scripts/record-demo.mjs --shot great-jump --cam fly --seed 3 --base http://localhost:5173/koratrocketcar/
//
// Options: --base <url> (default https://madebytle.com/koratrocketcar/) --shot <name|all> --hud 0|1|both
//          --cam chase|fly --wing auto|up|down --seed <n> --width 1080 --height 1920 --crf 16 --out <dir>
//          --gpu 0 (use SwiftShader instead of the machine GPU — much slower, same pixels on any machine)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []),
);
const base = args.base ?? 'https://madebytle.com/koratrocketcar/';
const W = Number(args.width ?? 1080), H = Number(args.height ?? 1920);
const out = args.out ?? 'promo-footage';
const huds = args.hud === 'both' ? ['0', '1'] : [args.hud ?? '0'];
const gpu = args.gpu !== '0';

const browser = await chromium.launch({
  args: !gpu ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-gpu', '--ignore-gpu-blocklist'],
});

async function open(shot, hud) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const q = new URLSearchParams({ demo: '1', shot, hud, fixedDt: '1' });
  for (const k of ['cam', 'wing', 'seed', 'quality', 'uiScale']) if (args[k]) q.set(k, args[k]);
  await page.goto(`${base}?${q}`);
  await page.waitForFunction(() => window.__demo, null, { timeout: 120000 });
  await page.evaluate(() => window.__demo.ready);
  const err = await page.evaluate(() => window.__demo.error);
  if (err) throw new Error(`${shot}: ${err}`);
  return page;
}

async function record(shot, hud) {
  const page = await open(shot, hud);
  const frames = await page.evaluate(() => window.__demo.frames);
  const dir = join(out, hud === '1' ? 'hud' : 'clean');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${shot}${args.cam ? '-' + args.cam : ''}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf ?? 16), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    await page.evaluate(() => window.__demo.step(1));
    const jpg = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 120 === 0) process.stdout.write(`\r${shot} hud=${hud} ${f}/${frames}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await page.close();
  console.log(`\r${file} · ${frames} frames · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

const first = await open('menu', '0');
const all = await first.evaluate(() => window.__demo.shots);
await first.close();
const shots = args.shot === 'all' || !args.shot ? all : args.shot.split(',');
for (const s of shots) {
  if (!all.includes(s)) { console.error(`unknown shot "${s}" — one of: ${all.join(', ')}`); continue; }
  for (const h of huds) await record(s, h);
}
await browser.close();
