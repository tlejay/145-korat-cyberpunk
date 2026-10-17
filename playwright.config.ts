// QA suite (docs/qa/TEST-PLAN.md). Runs against the local production build by default,
// or against a deployed preview when QA_BASE_URL is set (see tests/qa/README.md).
import { defineConfig } from '@playwright/test';

const PORT = process.env.QA_PORT ?? '4180'; // override when 4180 is taken (never 5199 — reserved for the conductor)
const BASE = process.env.QA_BASE_URL ?? `http://localhost:${PORT}/koratrocketcar/`;
const token = process.env.QA_OIDC_TOKEN;

const landscape = { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: false };

export default defineConfig({
  testDir: 'tests/qa',
  outputDir: 'tests/qa/.results',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  workers: 2,
  reporter: [['list'], ['json', { outputFile: 'tests/qa/.results/results.json' }]],
  use: {
    baseURL: BASE,
    extraHTTPHeaders: token ? { 'x-vercel-trusted-oidc-idp-token': token } : undefined,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-landscape',
      use: {
        browserName: 'chromium',
        ...landscape,
        deviceScaleFactor: 2,
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
      },
    },
    {
      name: 'webkit-landscape',
      use: { browserName: 'webkit', ...landscape, deviceScaleFactor: 3 },
      // Physics/soak/static checks are engine-independent; run them once on Chromium.
      testIgnore: [/physics\.spec/, /static\.spec/, /soak\.spec/],
    },
  ],
  webServer: process.env.QA_BASE_URL
    ? undefined
    : { command: `pnpm build && pnpm preview --port ${PORT} --strictPort`, url: BASE, reuseExistingServer: !process.env.QA_PORT, timeout: 120_000 },
});
