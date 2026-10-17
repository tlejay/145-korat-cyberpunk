# REPORT — Scaffold + Leaderboard + Ghost อันดับ 1 (2026-10-17 · รอบ 2)

## สรุป
1. ✅ **ครบทุกส่วน 1–5** · Neon provision 1 ครั้ง (`korat-cyberpunk-db`, region `sin1`) → env pull → migrate 3 ไฟล์ → preview → ทดสอบทุก endpoint กับ DB จริงผ่าน · ลบข้อมูลทดสอบแล้ว (scores/ghosts/rate_events = 0 แถว)
2. ⚠️ **deploy ครั้งแรก (`vercel deploy` ไม่มี `--prod`) ขึ้นเป็น Production เอง** (โปรเจคใหม่ที่ยังไม่เคยมี production → Vercel ตั้ง target = production) → `korat-cyberpunk.vercel.app` ตอนนี้เสิร์ฟ **build เก่าของรอบแรก** (หน้าชั่วคราว + API schema เก่า → `run/finish` บน prod จะได้ `SERVER_ERROR` เพราะ migrate ไปแล้ว · `leaderboard` ยังตอบได้) · ไม่ได้ลบ/rollback เอง — conductor ตัดสิน: ปล่อยไว้จนผ่าน QA gate หรือสั่ง `vercel remove korat-cyberpunk-hek8o2yi9-dosx.vercel.app` · ครั้งต่อไปใช้ `vercel deploy --target=preview` เสมอ
3. ✅ preview ล่าสุด: **https://korat-cyberpunk-qhdelz5t3-dosx.vercel.app/koratrocketcar/** (มี Deployment Protection — ใช้ `vercel curl --deployment <url>` หรือเปิดในเบราว์เซอร์ที่ล็อกอิน Vercel)
4. ✅ สูตรแต้มจริงตาม GAMEPLAY §6 (Tle: เวลา + สไตล์ ≤ 20%) แทนตัวชั่วคราว · ตัวอย่างใน §6.2 คำนวณได้ 145,181 (เอกสารเขียน 145,182 — ปัดเศษในเอกสารคลาด 1)
5. ✅ ghost อันดับ 1 ออนไลน์ (ส่วนที่ 5) · ghost 1 รอบสนาม A ≈ **2.8 KB** (base64) · server ตรวจ ghost กับผลรอบ · `GET /api/ghost/top`
6. ✅ base path `/koratrocketcar/` ทำงานบน preview ทั้งหน้าเกม asset และ API · แก้บั๊ก rewrite หน้าแรก (`/koratrocketcar/` เคย 404)
7. ✅ สนาม `A` (2 รอบ) + `test` (ใช้ได้เฉพาะ preview/dev — ยืนยันแล้วว่า prod ตอบ `BAD_TRACK`)
8. ⚠️ **preview กับ production ใช้ฐานข้อมูลเดียวกัน** (Neon ตัวเดียว ผูกทุก environment) → ทดสอบบน preview ต้องใช้ track `test` แล้วลบทิ้งเสมอ
9. ✅ `pnpm typecheck && pnpm build` ผ่าน · ไม่ได้ commit / ไม่ได้ `deploy --prod`
10. รอค่าจาก physics pane: `minLapMs` (ตอนนี้ 45 วิ placeholder), `cpMinMs`, `altGroup`, ต้นทุนถังลม (`GAS`) ใน `src/net/score.ts` — ตอนนี้ split ตรวจแค่ "เรียงลำดับ ไม่ย้อน"

## Vercel
- โปรเจค `korat-cyberpunk` · scope `dosx` · **ไม่ผูก Git** (CLI ผูกให้เอง ถอดออกแล้ว)
- **Production domain สำหรับ madebytle proxy: `https://korat-cyberpunk.vercel.app`** → ปลายทาง `https://korat-cyberpunk.vercel.app/koratrocketcar/:path*` (ทดสอบแล้ว: `/koratrocketcar` → 307 ไป `/koratrocketcar/`, API ผ่าน prefix ได้ 200)
- Env (ชื่อเท่านั้น): `RUN_TOKEN_SECRET` (Prod/Preview/Dev ค่าแยกกัน) · จาก Neon: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PGHOST`, `PGHOST_UNPOOLED`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL_NO_SSL`, `POSTGRES_PRISMA_URL`, `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, `NEON_PROJECT_ID`, `NEON_AUTH_BASE_URL`, `VITE_NEON_AUTH_URL`
- `.env.local` (gitignored ตามกฎ `.env.*`) · Vercel CLI เติม `.env.local`/`.vercel` ใน `.gitignore` ให้เอง → ย้อนออกแล้วเพราะกฎเดิมครอบคลุม

## สิ่งที่ Tle / conductor ต้องทำ
- ตัดสินเรื่อง production ที่ขึ้นไปเอง (ข้อ 2)
- ไม่มีอย่างอื่น

## API (base `/koratrocketcar/api` — `/api` ตรงก็ได้)
| Endpoint | ส่ง | คืน |
|---|---|---|
| `POST run/start` | `{ track, deviceId, qa? }` | `{ token, startedAt }` — token HMAC-SHA256 อายุ 45 นาที · `qa:true` → token ที่ finish ไม่รับ (`QA_RUN`) |
| `POST run/finish` | `{ token, deviceId, result: RunResult, ghost?: base64 }` | `{ score, breakdown{time,styleRaw,style,respawn,total}, rank, qualifies, personalBest, named, ghostSaved }` |
| `POST score/name` | `{ deviceId, name }` | `{ name }` |
| `GET leaderboard` | `?track=A&limit=50` | `{ track, entries:[{rank, name, score, totalMs, lapMs, at}] }` · 1 แถว/เครื่อง · `s-maxage=10` |
| `GET ghost/top` | `?track=A` | `{ track, ghost: null \| {name, score, lapMs, build, data} }` · `s-maxage=30` |

`RunResult` = ตาม GAMEPLAY §6.1 ทุกฟิลด์ (`src/net/score.ts` → `parseRun`) · client ใช้ `startRun()`, `finishRun(token, result, ghost?)`, `getTopGhost()` ใน `src/net/leaderboard.ts`

## ผลทดสอบบน preview (DB จริง)
ผ่าน: `BAD_TRACK` · `BAD_DEVICE` · `TOKEN_INVALID` · `TOKEN_MISMATCH` · `NO_SCORE` · `BAD_CLOCK` · `TOO_FAST` · `BAD_SPLITS` · `OLD_BUILD` · `BAD_STYLE` · `BAD_GHOST` · `QA_RUN` · `RUN_USED` (token ซ้ำ) · ชื่อ: สั้น/ยาว/คำหยาบไทย-อังกฤษ/HTML · ตั้งชื่อไทยสำเร็จ (ช่องว่างซ้อนถูกยุบ) · `RATE_LIMITED` (ครั้งที่ 11 ของ name) · บันทึกแต้ม + ghost → `leaderboard` และ `ghost/top` คืนข้อมูลถูก · รอบไม่มี ghost บันทึกได้ (`ghostSaved:false`) · `BAD_TANK` ทดสอบแบบ unit ในเครื่อง

## Ghost (ส่วนที่ 5)
- รูปแบบ v1 (`src/net/ghost-format.ts`): 10 Hz · x/y/z int16 หน่วย 5 ซม. + yaw int16 + flag 1 byte (ดริฟต์/BOOST/ลอย) · เก็บเป็นผลต่างจากจุดก่อน → deflate-raw → base64 · รอบ 67 วิ: ดิบ 6.0 KB → ส่งจริง 2.8 KB
- เก็บ **1 ghost/เครื่อง/สนาม** (รอบที่แต้มดีสุด) ตาราง `ghosts` · แทนที่เมื่อแต้มใหม่สูงกว่าเท่านั้น
- server ตรวจ: lapMs ตรงกับรอบดีสุดของผล · จำนวนจุดตรงกับเวลา (±3) · ไม่กระโดดเกิน 15 ม./จุด (540 กม./ชม.) · อยู่ในกรอบแผนที่ · จุดแรก-สุดท้ายห่าง ≤ 60 ม. (เป็นวง) · ระยะทางรวม 60–150% ของความยาวสนาม — ghost ไม่ผ่าน = **ไม่รับทั้งรอบ** (`BAD_GHOST`)
- ghost เป็น optional (iOS เก่าไม่มี CompressionStream) → `ghost/top` คืนคนที่แต้มสูงสุด **ที่มี ghost**
- ยังไม่ได้ตรวจ ghost กับตำแหน่ง checkpoint จริง (server ยังไม่มีข้อมูลเส้นทาง) — ทำได้เมื่อ track data นิ่ง

## DB (Drizzle · `db/schema.ts` · migrations `db/migrations/0000–0002`)
`scores` (id, track_id, device_id, name, score, score_time, score_style, total_ms, lap_ms=รอบดีสุด, build, result jsonb ค่าดิบทั้งหมด, run_id unique, ip_hash, created_at) · `ghosts` (pk track_id+device_id) · `rate_events`

## ช่องโหว่โกงแต้มที่ยังเหลือ
1. ผลรอบ + ghost มาจาก client — คนแก้ JS แต่งค่าดิบ + ghost ให้ "เป็นไปได้" ได้ · ด่านที่มีแค่บอกว่าไม่เกินฟิสิกส์ · กันจริง = replay input log บน server (GAMEPLAY §6.3)
2. ด่าน split / เวลาขั้นต่ำ / ถังลม ยังหลวมจนกว่า physics pane ส่ง `minLapMs`, `cpMinMs`, ต้นทุนแก๊ส
3. ด่าน `qa:true` เป็นแค่กันคนซื่อ — client ที่แก้แล้วไม่ส่ง flag ก็ได้
4. device id สร้างใหม่ได้ไม่จำกัด → เหลือ limit ราย IP · ใครรู้ device id คนอื่นเปลี่ยนชื่อแทนได้
5. ไม่มีหน้าแอดมินลบ/ซ่อนแต้ม — ต้องลบใน DB ตรง
