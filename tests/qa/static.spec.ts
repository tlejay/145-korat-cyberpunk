// Static checks on source / public / dist (no browser): UI-04/05/06, LIC-01..04/07, DEP-06, PERF-07/08, PHY headless.
import { expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ROOT, readJson, record } from './helpers';

const walk = (dir: string): string[] =>
  fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)])) : [];
const rel = (p: string) => path.relative(ROOT, p);
const DIST = path.join(ROOT, 'dist');

test.describe('static', () => {
  test('UI-04 no alert/confirm/prompt in src', () => {
    const hits = walk(path.join(ROOT, 'src')).filter((f) => /\.(ts|js)$/.test(f)).flatMap((f) =>
      fs.readFileSync(f, 'utf8').split('\n').map((l, i) => ({ f: rel(f), i: i + 1, l }))
        .filter(({ l }) => /\b(window\.)?(alert|confirm|prompt)\s*\(/.test(l) && !/^\s*\/\//.test(l)));
    expect(hits).toEqual([]);
  });

  test('UI-05 no emoji in UI source strings', () => {
    const emoji = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u; // © ® ™ are text symbols, not emoji
    const hits = walk(path.join(ROOT, 'src')).filter((f) => /\.(ts|css|html)$/.test(f)).flatMap((f) =>
      fs.readFileSync(f, 'utf8').split('\n').map((l, i) => ({ f: rel(f), i: i + 1, l: l.trim() }))
        .filter(({ l }) => emoji.test(l) && !/^\/\//.test(l)));
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect([...hits, ...(emoji.test(html) ? [{ f: 'index.html' }] : [])]).toEqual([]);
  });

  test('UI-06 version.ts = CHANGELOG top + format', () => {
    const v = /VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'src/version.ts'), 'utf8'))![1];
    expect(v).toMatch(/^v\d+\.\d+\.\d+-build\d{3}$/);
    const top = /^## (v\S+)/m.exec(fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8'))![1];
    expect(top).toBe(v);
  });

  test('LIC-01 every public/ file has source + license', ({}, info) => {
    const man = readJson<{ sounds: Record<string, { path: string; source?: string }>; music: Record<string, unknown> }>('public/assets/audio/manifest.json');
    const src = readJson<{ files: { file: string; license: string; author: string; url: string }[] }>('research/audio/sources.json');
    const byFile = new Map(src.files.map((f) => [f.file, f]));
    const credits = fs.readFileSync(path.join(ROOT, 'research/CREDITS.md'), 'utf8');
    const ok = /^(CC0|CC BY|CC-BY|ODbL|OFL|MIT)/i;
    const problems: string[] = [];
    const covered = new Set<string>();
    for (const [id, s] of Object.entries(man.sounds)) {
      for (const ext of ['ogg', 'm4a']) covered.add(`public/assets/audio/${s.path}.${ext}`);
      if (id.startsWith('vo-')) {
        // Tle 2026-10-17: Charlie voice pack (Mint / ElevenLabs free, non-commercial) + credit "เสียงพากย์: ElevenLabs".
        if (!/ElevenLabs/.test(credits)) problems.push(`${id}: ElevenLabs credit missing in CREDITS.md`);
        continue;
      }
      const f = s.source ? byFile.get(`candidates/${s.source}`) : undefined;
      if (!f) problems.push(`${id}: source ${s.source} not in research/audio/sources.json`);
      else if (!ok.test(f.license) || !f.author || !f.url) problems.push(`${id}: license/author/url incomplete (${f.license})`);
    }
    covered.add('public/assets/audio/manifest.json');
    // Map data derived from OSM (ODbL) — credited on the credits page.
    for (const f of ['public/data/track-A.json', 'public/data/track-A.debug.json']) covered.add(f);
    const files = walk(path.join(ROOT, 'public')).map(rel);
    const unlisted = files.filter((f) => !covered.has(f));
    const h07 = fs.existsSync(path.join(ROOT, 'public/assets/manifest.json'));
    record(info, 'LIC-01', { files: files.length, unlisted, problems, h07ManifestPresent: h07 });
    expect(unlisted, 'files in public/ without a manifest entry').toEqual([]);
    expect(problems).toEqual([]);
  });

  test('LIC-02/03 no Google / news imagery in repo or build', ({}, info) => {
    const tracked = execSync('git ls-files', { cwd: ROOT }).toString().split('\n');
    expect(tracked.filter((f) => f.startsWith('refs/')), 'refs/ must stay untracked').toEqual([]);
    const img = /\.(png|jpe?g|webp|gif|avif|ktx2|basis|bmp|tga|glb|gltf)$/i;
    const publicImgs = walk(path.join(ROOT, 'public')).filter((f) => img.test(f)).map(rel);
    const distImgs = walk(DIST).filter((f) => img.test(f)).map(rel);
    // Byte-compare against every local reference capture (Street View + car news photos).
    const refs = walk(path.join(ROOT, 'refs')).filter((f) => img.test(f));
    const sizes = new Map<number, string[]>();
    for (const r of refs) { const s = fs.statSync(r).size; sizes.set(s, [...(sizes.get(s) ?? []), r]); }
    const dupes = [...publicImgs, ...distImgs].filter((f) => (sizes.get(fs.statSync(path.join(ROOT, f)).size) ?? [])
      .some((r) => fs.readFileSync(r).equals(fs.readFileSync(path.join(ROOT, f)))));
    const googleNames = walk(path.join(ROOT, 'public')).concat(walk(DIST)).filter((f) => /google|streetview|gsv|maps\.gstatic/i.test(f)).map(rel);
    record(info, 'LIC-02', { publicImgs, distImgs, refsCompared: refs.length, dupes, googleNames });
    expect(dupes).toEqual([]);
    expect(googleNames).toEqual([]);
    expect(publicImgs, 'M1 ships no raster images (car is procedural)').toEqual([]);
  });

  test('LIC-04 no NC / unknown-license audio', () => {
    const man = readJson<{ sounds: Record<string, { source?: string }> }>('public/assets/audio/manifest.json');
    const src = readJson<{ files: { file: string; license: string }[] }>('research/audio/sources.json');
    const used = Object.entries(man.sounds).filter(([id]) => !id.startsWith('vo-')).map(([, s]) => src.files.find((f) => f.file === `candidates/${s.source}`));
    expect(used.filter((f) => !f || /NC|ND|youtube/i.test(f.license))).toEqual([]);
  });

  test('LIC-07 no secrets in dist + git (2 layers)', ({}, info) => {
    const pat = /(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|xox[bpa]-[A-Za-z0-9-]{10,}|postgres(ql)?:\/\/[^\s"'`]+:[^\s"'`]+@|BEGIN (RSA |EC )?PRIVATE KEY|npg_[A-Za-z0-9]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.)/;
    const hits = walk(DIST).filter((f) => !/\.(woff2?|ogg|m4a)$/.test(f)).filter((f) => pat.test(fs.readFileSync(f, 'utf8'))).map(rel);
    const tracked = execSync('git ls-files', { cwd: ROOT }).toString().split('\n')
      .filter((f) => /(^|\/)\.env($|\.)|credentials\.json$|\.pem$|\.p12$|id_rsa$|secrets?\.(json|ya?ml|toml)$/i.test(f))
      .filter((f) => !/\.env\.(example|sample|template)$/.test(f));
    const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    record(info, 'LIC-07', { distHits: hits, trackedSecretFiles: tracked });
    expect(hits).toEqual([]);
    expect(tracked).toEqual([]);
    expect(gi).toMatch(/^\.env\.\*$/m);
  });

  test('DEP-06 no sourcemaps / research / tests in dist', () => {
    const files = walk(DIST).map(rel);
    expect(files.filter((f) => /\.map$|\/(tests|research|refs)\//.test(f))).toEqual([]);
  });

  test('PERF-07/08 download budget from dist', ({}, info) => {
    const files = walk(DIST);
    const gz = (f: string) => zlib.gzipSync(fs.readFileSync(f)).length;
    const total = files.reduce((s, f) => s + fs.statSync(f).size, 0);
    const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
    const entryJs = [...html.matchAll(/(?:src|href)="\/koratrocketcar\/(assets\/[^"]+\.js)"/g)].map((m) => path.join(DIST, m[1]));
    const lazyJs = files.filter((f) => f.endsWith('.js') && /(track|car|audio|model|hooks)-/.test(path.basename(f)) && !/preview|lab|top-view|stub/.test(f));
    const jsGz = [...new Set([...entryJs, ...lazyJs])].reduce((s, f) => s + gz(f), 0);
    const mapGz = gz(path.join(DIST, 'data/track-A.json'));
    const biggest = files.map((f) => ({ f: rel(f), b: fs.statSync(f).size })).sort((a, b) => b.b - a.b)[0];
    const m = { distMB: total / 1e6, firstLoadJsGzKB: jsGz / 1e3, mapGzKB: mapGz / 1e3, biggest };
    record(info, 'PERF-07', m);
    expect(jsGz).toBeLessThanOrEqual(800e3);
    expect(mapGz).toBeLessThanOrEqual(1.5e6);
    expect(total).toBeLessThanOrEqual(40e6);
    expect(biggest.b).toBeLessThanOrEqual(5e6);
  });

  test('PHY headless physics suite (PHYSICS §9) passes', ({}, info) => {
    const out = execSync('node scripts/test-car-physics.mjs', { cwd: ROOT, timeout: 120_000 }).toString();
    const m = /(\d+)\s*\/\s*(\d+)/.exec(out.split('\n').reverse().find((l) => /\d+\s*\/\s*\d+/.test(l)) ?? '');
    record(info, 'PHY-headless', { tail: out.split('\n').slice(-60).join('\n') });
    expect(m && m[1] === m[2], out.slice(-800)).toBeTruthy();
  });
});
