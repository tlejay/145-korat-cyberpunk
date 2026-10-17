# Changelog

## v0.1.0-build001 — 2026-10-17

- Scaffold: Vite + TypeScript + three.js, folder layout (`src/scene|car|track|ui|input|net|qa`)
- Placeholder start screen (Thai, Noto Sans Thai) with empty three.js scene
- QA hook skeleton `window.__game` (only with `?qa=1`, lazy-loaded chunk)
- Leaderboard: Neon Postgres + Drizzle, Vercel Functions `api/run/start`, `api/run/finish`, `api/score/name`, `api/leaderboard`
- Leaderboard client + draft UI (ranking table, name form)
