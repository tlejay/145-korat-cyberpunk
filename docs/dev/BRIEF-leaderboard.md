# BRIEF — Scaffold โปรเจค + Leaderboard backend

อ่าน `CLAUDE.md` ทั้งไฟล์ + `docs/qa/TEST-PLAN.md` + `docs/qa/TEST-HOOKS.md` ก่อน · **ห้าม commit / push / deploy --prod**

## เป้าหมาย
1) วางโครงโปรเจคเกมให้ dev pane ตัวอื่นเขียนต่อได้ 2) ทำ leaderboard ที่ใช้จริงบน Vercel — ไม่ต้องลงทะเบียน ทำแต้มติดอันดับแล้วค่อยตั้งชื่อ

## ส่วนที่ 1 — Scaffold
- Vite + TypeScript (vanilla, ไม่ใช้ React) + three.js · pnpm · โครงโฟลเดอร์ตาม CLAUDE.md หัวข้อ 4 (`src/scene`, `src/car`, `src/track`, `src/ui`, `src/input`, `src/net`)
- `src/version.ts` (`v0.1.0-build001`) + `CHANGELOG.md`
- สคริปต์ `pnpm dev | typecheck | build | preview`
- หน้าแรกชั่วคราว: ฉาก three.js เปล่า + ข้อความไทย "กำลังสร้างสนาม…" + ฟอนต์ Noto Sans Thai (subset) · มี `window.__game` โครงเปล่าเมื่อ `?qa=1` ตาม TEST-HOOKS
- ห้ามเขียนฟิสิกส์รถ/ฉากจริง — dev pane อื่นจะทำ

## ส่วนที่ 2 — Vercel + ฐานข้อมูล (provision ของจริง ห้าม mock)
- `vercel link` สร้างโปรเจคชื่อ `korat-cyberpunk` (scope ส่วนตัวของ Tle ตามค่าเริ่มต้นของ CLI)
- ฐานข้อมูล: **Neon Postgres ผ่าน Vercel Marketplace** — `vercel integration add neon --yes --no-claim` → `vercel env pull --yes` (ไฟล์ `.env*` ห้ามเข้า git) · ถ้า CLI ต้องให้กดในเบราว์เซอร์/ยอมรับเงื่อนไข: **หยุด** เขียนลงรายงานว่าต้องให้ Tle ทำอะไร แล้วจบ turn
- ⚠️ ถ้า `integration add` provision สำเร็จแต่ขั้นอื่นพัง **ห้ามรันซ้ำ** (จะได้ DB ตัวที่ 2)
- Drizzle schema + migration ในโปรเจค

## ส่วนที่ 3 — Leaderboard API (Vercel Functions ใน `api/`, Node runtime)
- ตาราง `scores`: id, track_id, device_id (uuid จาก localStorage), name (nullable จนกว่าจะตั้ง), score (int, มากดีกว่า), lap_ms, build, created_at · index (track_id, score desc)
- **แต้ม** = ช่องเก็บทั่วไป `score` + `lap_ms` — สูตรแต้มจริงมาจาก gameplay pane ทีหลัง ให้ฟังก์ชันคำนวณแยกไว้ `src/net/score.ts` ใช้ร่วมกันทั้ง client/server
- Endpoints:
  - `POST /api/run/start` → คืน run token ที่ sign ด้วย secret (track, device, เวลาเริ่ม) — เก็บ secret ใน Vercel env `RUN_TOKEN_SECRET` (ตั้งด้วย `vercel env add`, ห้ามลง repo)
  - `POST /api/run/finish` (token + ผล) → ตรวจ: token ถูก, เวลาจริงที่ผ่านไป ≥ lap_ms, lap_ms อยู่ในช่วงเป็นไปได้ต่อสนาม, rate limit ต่อ device/IP → บันทึก → คืน `{rank, qualifies}` (qualifies = ติด top 100 ของสนาม)
  - `POST /api/score/name` → ตั้ง/เปลี่ยนชื่อให้แต้มของ device ตัวเอง · ชื่อ 2–16 ตัว ไทย/อังกฤษ/ตัวเลข · กรองคำหยาบไทย+อังกฤษ (ลิสต์ใน repo) · ห้าม HTML
  - `GET /api/leaderboard?track=C&limit=50` → อันดับ + ชื่อ + แต้ม + เวลา · cache สั้น ๆ (เช่น s-maxage=10)
- error ทุกตัวคืน `code` (เช่น `NAME_TOO_LONG`, `RATE_LIMITED`) ไม่คืนข้อความดิบ — ฝั่งเกมแปลงเป็นข้อความไทยเอง (CLAUDE.md หัวข้อ 9) · ทำ map `code → ข้อความไทย` ไว้ใน `src/net/messages.ts`
- client `src/net/leaderboard.ts` + UI ร่าง: ตารางอันดับ (ไทย, ตัวเลข th-TH), ฟอร์มตั้งชื่อหลังจบรอบเมื่อ qualifies (error ใต้ช่อง ไม่ใช้ popup เบราว์เซอร์)

## ตรวจก่อนส่ง
- `pnpm typecheck && pnpm build` ผ่าน · `vercel deploy` (preview เท่านั้น) แล้ว curl ทุก endpoint บน preview ให้เห็นว่าทำงานกับ DB จริง (ใส่แต้มทดสอบ track `test` แล้วลบทิ้ง)
- เขียน `docs/dev/REPORT-leaderboard.md`: สรุป ≤ 15 บรรทัดบนสุด · preview URL · env ที่สร้าง (ชื่ออย่างเดียว) · สิ่งที่ Tle ต้องทำ (ถ้ามี) · ช่องโหว่ที่ยังเหลือเรื่องโกงแต้ม
