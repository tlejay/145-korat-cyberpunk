# Changelog

## v0.1.0-build001 — 2026-10-17

- Scaffold: Vite + TypeScript + three.js, folder layout (`src/scene|car|track|ui|input|net|qa`)
- Placeholder start screen (Thai, Noto Sans Thai) with empty three.js scene
- QA hook skeleton `window.__game` (only with `?qa=1`, lazy-loaded chunk)
- Leaderboard: Neon Postgres + Drizzle, Vercel Functions `api/run/start`, `api/run/finish`, `api/score/name`, `api/leaderboard`
- Leaderboard client + draft UI (ranking table, name form with score breakdown)
- Score formula per GAMEPLAY §6 (time² vs par + style ≤ 20% − respawns); server-side checks 1–9 (laps, total, min lap, wall clock, splits, style, air tank, build)
- Online #1 ghost: upload with `run/finish` (ghost-format v1, deflate-raw ≈ 3 KB/lap), server validates against the run, `GET /api/ghost/top`
- Base path `/koratrocketcar/` (madebytle.com proxy) + Vercel rewrites
- Runs started with `?qa=1` are never scored (`QA_RUN`)
