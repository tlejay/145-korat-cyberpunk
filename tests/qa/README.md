# tests/qa — QA suite (Playwright)

Test IDs follow `docs/qa/TEST-PLAN.md`. Hooks: `docs/qa/TEST-HOOKS.md` (`window.__game`, only with `?qa=1`).

| Command | What |
|---|---|
| `pnpm qa` | Full suite against a local production build (`pnpm build && pnpm preview --port 4180`, started automatically) — Chromium + WebKit, 844×390 landscape, touch |
| `pnpm qa:static` | Source / public / dist checks only (UI-04/05/06, LIC-*, DEP-06, PERF-07/08, headless physics 40/40) |
| `QA_BASE_URL=<preview>/koratrocketcar/ pnpm qa:preview` | Same suite on a deployed preview. `vercel env run` injects `VERCEL_OIDC_TOKEN` (Deployment Protection bypass for this project's previews) and `DATABASE_URL` (API spec deletes its `test`-track rows afterwards) |

- `api.spec.ts` / `deploy.spec.ts` only run with `QA_BASE_URL`. The API spec uses track `test` (refused in production) and deletes its rows.
- Physics, soak and static specs run on Chromium only (engine-independent; CDP needed for network/CPU/heap).
- Measured numbers land in `tests/qa/.metrics/<ID>.<project>.json` (gitignored) — the report quotes them. Screenshots: `docs/qa/reports/img/`.
- Headless Chromium uses SwiftShader (software GL): **fps / latency from CI are not the gate** — judge those on the real phones (see the M4 checklist in the report).
- Test a frozen build: other panes edit the working tree, so QA runs in a git worktree of the commit under test (`git worktree add --detach <dir> <commit>`).
- `driver.js` = in-page scripted driver (teleport to track distance, speed / heading controllers, seeded RNG) used by `physics.spec.ts`.
