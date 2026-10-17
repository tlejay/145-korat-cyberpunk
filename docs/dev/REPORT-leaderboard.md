# REPORT — Scaffold + Leaderboard backend (2026-10-17)

## สรุป
1. **🟡 ติดที่ฐานข้อมูล — ต้องให้ Tle กดยอมรับเงื่อนไข Neon บน Vercel Marketplace** (ทำตามบรีฟ: หยุด ไม่กดยอมรับแทน) → ยังไม่ได้ provision DB / migrate / deploy preview / curl ทดสอบ
2. ✅ Scaffold: Vite 8 + TypeScript 7 + three.js 0.186 · pnpm · `src/{scene,car,track,ui,input,net,qa}` · `v0.1.0-build001` + `CHANGELOG.md`
3. ✅ หน้าแรกชั่วคราว: ฉาก three.js (กริดนีออน) + "กำลังสร้างสนาม…" + Noto Sans Thai (subset ตาม unicode-range) + ปุ่ม "ตารางอันดับ" + rotate-hint + error box ไทย
4. ✅ `window.__game` โครงเปล่าครบ interface ของ TEST-HOOKS (chunk แยก โหลดเฉพาะ `?qa=1`) · `qa.forceError()` ใช้งานได้จริงแล้ว ที่เหลือคืนค่า placeholder
5. ✅ base path `/koratrocketcar/` (ส่วนที่ 4): Vite `base` + `vercel.json` rewrite `/koratrocketcar/:path*` → `/:path*` + redirect ไม่มี `/` ท้าย · client เรียก API ผ่าน `import.meta.env.BASE_URL` (ไม่ hardcode โดเมน) · ทดสอบ `vite preview` ที่ `/koratrocketcar/` ได้ 200
6. ✅ Leaderboard API 4 ตัวใน `api/` (Node, web-standard `Request/Response`) + Drizzle schema + migration SQL (`db/migrations/0000_*.sql`) — **เขียนเสร็จ typecheck ผ่าน แต่ยังไม่ได้รันกับ DB จริง**
7. ✅ สนาม: เปิดเฉพาะ `A` (Tle เลือก) + `test` (ใช้ได้เฉพาะนอก production) · B/C ปิดไว้ใน `src/net/tracks.ts`
8. ✅ `pnpm typecheck && pnpm build` ผ่าน · ไม่มี `alert/confirm/prompt` ใน `src/`
9. ⚠️ `vercel link` ผูก GitHub repo ให้อัตโนมัติ — **ถอดออกแล้ว** (`vercel git disconnect`) ตาม CLAUDE.md "ไม่ผูก Git"

## Vercel
- โปรเจค: `korat-cyberpunk` ใน scope **`dosx`** (ค่าเริ่มต้นของ CLI ตอนนี้ — ถ้าตั้งใจให้อยู่ scope อื่น ต้องย้าย/สร้างใหม่ก่อนติดตั้ง Neon)
- **Production domain ที่ madebytle จะ proxy ไปหา: `https://korat-cyberpunk.vercel.app`** (ผูกกับโปรเจคแล้ว แต่ตอนนี้ยัง 404 เพราะยังไม่เคย deploy prod — ห้าม deploy prod จนผ่าน QA gate) → URL ปลายทางของ proxy = `https://korat-cyberpunk.vercel.app/koratrocketcar/:path*`
- Preview URL: **ยังไม่มี** (รอ DB ก่อนตามบรีฟ)
- Env ที่สร้างแล้ว (ชื่อเท่านั้น): `RUN_TOKEN_SECRET` — Production / Preview / Development (ค่าสุ่มแยกกันทุก environment) · Preview ตั้งผ่าน Vercel API เพราะ CLI 51.8 วนถาม git branch ไม่จบ
- Env ที่จะมาเมื่อ Neon ติดตั้ง: `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (+ ตัวแปร `PG*`/`POSTGRES_*` ของ integration)

## สิ่งที่ Tle ต้องทำ (1 ครั้ง)
1. เปิด https://vercel.com/dosx/~/integrations/accept-terms/neon?source=cli แล้วกดยอมรับเงื่อนไข Neon (อ่าน: [Marketplace addendum](https://vercel.com/legal/integration-marketplace-end-users-addendum) · [Neon ToS](https://neon.tech/terms-of-service) · [Neon privacy](https://neon.tech/privacy-policy))
2. บอก conductor → เปิด pane ต่องานด้านล่าง (ยังไม่มีการ provision อะไร รันได้ปลอดภัย ไม่เกิด DB ซ้ำ)

## งานที่เหลือหลัง Tle ยอมรับเงื่อนไข (ให้ pane ถัดไปทำ ตามลำดับ)
```bash
vercel integration add neon --name korat-cyberpunk-db -m region=sin1 --non-interactive   # ⚠️ รันครั้งเดียว — ถ้าขั้นอื่นพังห้ามรันซ้ำ (เช็ค `vercel integration list` ก่อน)
vercel env pull --yes                      # → .env.local (gitignored)
pnpm db:migrate                            # ใช้ DATABASE_URL_UNPOOLED
vercel deploy                              # preview เท่านั้น
# curl ทุก endpoint บน preview ด้วย track=test (preview มี Deployment Protection → ใช้ `vercel curl` หรือ bypass token)
# ลบแถวทดสอบ: delete from scores where track_id = 'test'; delete from rate_events;
```
ถ้า `region=sin1` ไม่ผ่าน ให้ดู `vercel integration add neon --help` หา region สิงคโปร์ (`aws-ap-southeast-1`)

## API (base `/koratrocketcar/api` — ใช้ได้ทั้ง `/api` ตรง)
| Endpoint | Body / Query | คืน |
|---|---|---|
| `POST run/start` | `{ track, deviceId }` | `{ token, startedAt }` — token = HMAC-SHA256 ของ `{track, device, startMs, nonce}` อายุ 30 นาที |
| `POST run/finish` | `{ token, track, deviceId, build, stats:{lapMs, driftMs, jumps, collisions} }` | `{ score, rank, qualifies, personalBest, named }` — `qualifies` = ติด top 100 |
| `POST score/name` | `{ deviceId, name }` | `{ name }` — ใช้กับทุกแต้มของเครื่องนั้น · รอบใหม่สืบทอดชื่อเดิม |
| `GET leaderboard` | `?track=A&limit=50` (1–100) | `{ track, entries:[{rank, name, score, lapMs, at}] }` · 1 แถว/เครื่อง (แต้มดีสุด) · `s-maxage=10, swr=30` · ไม่คืน device id |

Error ทุกตัว = `{ ok:false, code }` เท่านั้น (รายการใน `src/net/codes.ts`) → ข้อความไทยใน `src/net/messages.ts`

## ไฟล์หลัก
- `src/net/score.ts` — `validateRun()` + `computeScore()` ใช้ร่วม client/server (**สูตรเป็น placeholder** ให้ gameplay pane แทนตาม GAMEPLAY.md โดยคง signature) · server คำนวณแต้มเอง ไม่รับแต้มจาก client
- `src/net/tracks.ts` — ความยาว/เวลาขั้นต่ำต่อสนาม (ขั้นต่ำ = วิ่งเฉลี่ย 220 กม./ชม. → สนาม A ≥ 55.0 วิ) · ตัวเลขนี้ต้องปรับตามท็อปสปีดจริงของ gameplay
- `src/net/name.ts` + `src/net/bad-words.ts` — ชื่อ 2–16 grapheme (นับแบบ Intl.Segmenter ภาษาไทยสระ/วรรณยุกต์ไม่นับแยก) · ไทย/อังกฤษ/ตัวเลข/เว้นวรรค · กรองคำหยาบแบบถอดวรรณยุกต์ + leetspeak + ตัวซ้ำ (ทดสอบ: "f u c k", "Fuuuck", "ไอ้ควาย" โดนกรอง · "Jason", "classic", "สุดสวย" ผ่าน)
- `src/net/leaderboard.ts` (client) · `src/net/device.ts` (uuid ใน localStorage) · `src/ui/leaderboard.ts` (ตารางอันดับ + `showRunResult()` ฟอร์มตั้งชื่อ error ใต้ช่อง `role=alert`)
- `api/_lib/{http,token,rate}.ts` · `db/{schema,client}.ts` · `drizzle.config.ts` (อ่าน `.env.local`)
- ตารางเพิ่มจากบรีฟ: คอลัมน์ `run_id` (unique — token ใช้ได้ครั้งเดียว), `ip_hash` (HMAC ของ IP ไม่เก็บ IP ดิบ), `drift_ms/jumps/collisions` · ตาราง `rate_events` (rate limit แบบ sliding window ใน Postgres)

## Rate limit ที่ตั้งไว้
start: 30/10 นาที/เครื่อง, 150/10 นาที/IP · finish: 6/นาที/เครื่อง, 60/10 นาที/IP · name: 10/ชั่วโมง/เครื่อง

## ช่องโหว่โกงแต้มที่ยังเหลือ
1. **ผลรอบมาจาก client ทั้งหมด** — คนแก้ JS ส่ง `lapMs` ต่ำสุดที่ยังผ่านเกณฑ์ (55 วิ) ได้เสมอ ถ้ารอเวลาจริงครบ · แก้จริงต้องส่ง replay/input log ให้ server จำลองซ้ำ (หนัก) หรืออย่างน้อยส่ง checkpoint timestamps แล้วตรวจความเร็วระหว่าง checkpoint
2. เกณฑ์เวลาขั้นต่ำ 220 กม./ชม. เฉลี่ยยังหลวม — ควรตั้งจาก top speed จริงของ gameplay (+ ช่วง boost) ให้แน่นขึ้น
3. device id ปลอมใหม่ได้ไม่จำกัด → เลี่ยง rate limit รายเครื่องได้ เหลือแค่ limit ราย IP (ซึ่งเปลี่ยนได้ด้วย VPN/มือถือ)
4. ใครรู้ device id ของคนอื่น (ไม่ได้เปิดเผยผ่าน API แต่ถ้าแอบดู localStorage ในเครื่องคนอื่น) เปลี่ยนชื่อแทนได้
5. driftMs/jumps เชื่อ client ภายในเพดาน (ดริฟต์ ≤ เวลารอบ, กระโดด ≤ 1 ครั้ง/2 วิ, โบนัสรวม ≤ 40% ของแต้มเวลา)
6. ไม่มีปุ่มลบ/ซ่อนแต้มสำหรับแอดมิน — ตอนนี้ต้องลบใน DB ตรง
