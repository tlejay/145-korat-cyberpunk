# Changelog

## v0.2.0-build002 — 2026-10-17 (M1 vertical slice — game-ui)

- Game loop: fixed 120 Hz physics step, state machine เมนู → สอนเล่น (ครั้งแรก) → intro กวาดรอบลาน → นับ 3-2-1-ไป! → แข่ง 2 รอบ → สรุป → ตั้งชื่อ/อันดับ → แข่งอีกครั้ง 1 แตะ
- Race rules: checkpoints เรียงลำดับ + พลาดจุดตรวจ, นับรอบที่เส้นชัยหน้าอนุสาวรีย์, กริดออกตัวพ้นเขตลานย่าโม, respawn ≤ 0.5 วิ (ตกน้ำ/ติด/หลุดสนาม/กดเอง), ผิดทาง, launch control ตอน "ไป!" (กดค้างสายฟ้าแล้วปล่อย), ข้ามคูเมืองเป็นแต้มสไตล์ (PHYSICS §2), ประตูเติมลมต่อรอบ
- Ghost: รอบดีสุดของตัวเอง (localStorage) + อันดับ 1 ออนไลน์ (`/api/ghost/top`), เทียบเวลา split บน HUD
- ส่งแต้มผ่าน `run/start`/`run/finish` + คิวส่งซ้ำเมื่อออฟไลน์ · โหมด `?qa=1` ไม่ยิง API (ไม่บันทึกแต้ม)
- Input: ปุ่มสัมผัสตาม GAMEPLAY §1.2 (multi-touch, ไถนิ้วซ้าย↔ขวา, ปล่อยเมื่อลากออก), steering ramp + ตัวช่วยจัดแนวถนน, คีย์บอร์ด/จอยเกม, ล็อกกระโดด/BOOST ในเขตลานย่าโมและเมื่อถังไม่พอ (ไอคอนแม่กุญแจ)
- HUD ไทย: ความเร็ว กม./ชม. th-TH, เวลารอบ นาที:วินาที.มิลลิ, รอบ 1/2, เกจถังลม + ขีดกระโดด/ข้ามคู, เกจ g, ป้ายดริฟต์, ลูกศรเลี้ยว + ระยะ, minimap หมุนตามรถ + "น"
- หน้าจอ: เมนู, สอนเล่น, หยุดชั่วคราว, ตั้งค่า (ตัวช่วยเลี้ยว/คุณภาพ/เร่งอัตโนมัติ/สั่น/เสียง), เครดิต (OSM + ทุกรายการใน research/CREDITS.md + ข้อความ Tesla/ElevenLabs), ผลการแข่ง
- `src/types.ts` (สัญญากลาง M1) + `src/game/quality.ts` (low/mid/high, `?quality=`) · โหลดโมดูลของ pane อื่นอัตโนมัติเมื่อไฟล์มา ไม่งั้นใช้ stub
- QA: `window.__game` ครบตาม TEST-HOOKS + PHYSICS §8 (car extras, physics(), setTank/armLaunch/setWeather), autopilot, fixedStep/step, `?qa=1&hud=1`, `?skip=1`, `?qa=1&view=audio|car`
- กันโกงฝั่ง server ตาม PHYSICS §6: เวลาต่อรอบขั้นต่ำ 54.4 วิ · ถังกระโดด 35 หน่วย · ความยาวสนาม 3,311 ม.

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
