// DEP-01/03/04/05/07 against the deployed URL (QA_BASE_URL). Locally these headers come from vite preview, so skip.
import { expect, test } from '@playwright/test';
import { VERSION } from '../../src/version';
import { record } from './helpers';

test.skip(!process.env.QA_BASE_URL, 'needs a deployed URL');

test('DEP-01/03/04/05/07 status, cache headers, compression, MIME, version, meta', async ({ request }, info) => {
  test.skip(info.project.name !== 'chromium-landscape', 'once is enough');
  const base = process.env.QA_BASE_URL!;
  const html = await request.get(base);
  const body = await html.text();
  const js = /src="(\/koratrocketcar\/assets\/index-[^"]+\.js)"/.exec(body)![1];
  const css = /href="(\/koratrocketcar\/assets\/index-[^"]+\.css)"/.exec(body)?.[1];
  const urls = { html: base, js: new URL(js, base).toString(), css: css ? new URL(css, base).toString() : null, data: new URL('data/track-A.json', base).toString(), audio: new URL('assets/audio/sfx/ui-click.ogg', base).toString(), audioM4a: new URL('assets/audio/sfx/ui-click.m4a', base).toString(), noSlash: base.replace(/\/$/, '') };
  const out: Record<string, unknown> = {};
  for (const [k, u] of Object.entries(urls)) {
    if (!u) continue;
    const r = await request.get(u, { headers: { 'accept-encoding': 'br, gzip' }, maxRedirects: 0 });
    const h = r.headers();
    out[k] = { status: r.status(), type: h['content-type'], cache: h['cache-control'], enc: h['content-encoding'] ?? null, location: h.location ?? null };
  }
  const meta = {
    viewport: /<meta name="viewport" content="([^"]+)"/.exec(body)?.[1],
    ogTitle: /property="og:title" content="([^"]+)"/.exec(body)?.[1] ?? null,
    ogImage: /property="og:image" content="([^"]+)"/.exec(body)?.[1] ?? null,
    favicon: /rel="icon"/.test(body), lang: /<html lang="th"/.test(body),
  };
  record(info, 'DEP', { urls, out, meta });
  const o = out as Record<string, { status: number; type: string; cache: string; enc: string | null }>;
  for (const k of ['html', 'js', 'data', 'audio']) expect(o[k].status, k).toBe(200);
  expect(base.startsWith('https://')).toBe(true);
  expect(o.js.cache).toMatch(/max-age=31536000/);
  expect(o.js.cache).toMatch(/immutable/);
  expect(o.html.cache).toMatch(/no-cache|max-age=0/);
  expect(o.data.cache).toMatch(/max-age=300/);
  expect(o.js.enc).toMatch(/br|gzip/);
  expect(o.data.enc).toMatch(/br|gzip/);
  expect(o.audio.type).toMatch(/audio\/ogg/);
  // DEP-05: the deployed bundle is the build QA tested.
  const bundle = await (await request.get(urls.js)).text();
  expect(bundle).toContain(VERSION);
});
