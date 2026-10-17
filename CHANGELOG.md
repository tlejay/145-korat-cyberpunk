# Changelog

## v0.3.0-build003 — 2026-10-18 (M2 + M3 + production polish)

ทุกอย่างตั้งแต่ build002 (M1) — รายละเอียด polish: `docs/dev/release/REPORT-polish.md`

**Polish (หลัง production รอบแรก)**
- 🔴 FEEL-14 แก้แล้ว: ชนแบริเออร์แล้วรถดีดขึ้นฟ้า (5.9 ม. ที่โค้งสรรพสิทธิ์→วัชรสฤษดิ์) — สาเหตุ: แรงกระแทกกำแพง + การหมุนหัวหลังชนถูกนับเป็น "แรง g ด้านข้าง" แล้วไปบิดตัวรถจนโช้คอัดสุด ดีดรถขึ้น · ตอนนี้ตัวรถเอียงตามแรงยางเท่านั้น · ชนทุกโค้งที่ 30–210 กม./ชม. ลอยสูงสุด 0 ม. · เพิ่ม test ชนทุกโค้งสนาม A ที่ 80/110/150 + กวาดทุกมุม 10–90° (headless) และ 110 กม./ชม. ใน `physics.spec.ts`
- 🔴 LIC-01: เครดิตโลโก้สปอนเซอร์ 4 ไฟล์ใน `research/CREDITS.md` (ใช้โดยได้รับอนุญาต ไม่ใช่ CC)
- 🟡 ป้ายบั้งเลี้ยวหลบซุ้มประตูวัดสุทธจินดา: กฎใหม่ใน `src/wayfinding` — ห่างวัด/ซุ้มประตู ≥ 25 ม. และห้ามยืนบังซุ้มจากทุกจุดที่คนขับมองมา · ป้ายที่ขยับแล้วไม่ซ้อนกัน
- 🟡 GPU texture ระดับกลาง 32.1 → ~29.7 MB (atlas ป้ายเลี้ยว 768² บน mid)
- 🚗 ราชสีห์ R1 ตามภาพทางการ: เตี้ยลง 9% (1.16 ม.) หลังคาสูงสุดกลางฐานล้อ ลาด fastback · กระจกหลังคางหมูสีเข้ม + แผง sail ขาวพับเหลี่ยม · แผงใต้ไฟท้ายเป็นสีขาว (ดำเฉพาะ diffuser) + ครีบห้อย 2 อัน · ไฟท้ายบางลง 3.5 ซม. ในร่องดำ + เส้นที่สอง · ปีกต่ำลง แผ่นเดียวโค้งปลายเชิด · **Hidden Aero**: ปีกพับเรียบกับฝาท้ายตอนจอด/หน้าเมนู กางเมื่อ > 80 กม./ชม. หรือเบรกแรง (0.4 วิ) พับเมื่อต่ำกว่า 70
- server รับผลทั้ง build003 และ build002 (ฟิสิกส์เวลาต่อรอบเทียบกันได้)

**M3 cyberpunk pass**
- กลางคืน ฝน ถนนเปียกสะท้อนแสง bloom · ป้ายนีออนไทย 297 ป้าย (ฟอนต์จริง) · ภาพจาก ChatGPT 20 ชุด (ปก ฟ้า บิลบอร์ด หน้าต่าง) + เวอร์ชันความละเอียดต่ำ
- fx: ไอแก๊สเย็นสีขาวตอนออกตัว/กระโดด · สายไฟ/โคม/ป้ายแกว่งตามลมและรถ · ละอองน้ำ
- สปอนเซอร์ MADEBYTLE + สมาคมดิจิทัลนครราชสีมา: ซุ้มเส้นชัยแบบ F1 + ไฟออกตัว · ป้ายเลียบแบริเออร์ 25 แผ่น · บิลบอร์ด · ทะเบียน MADEBYTLE
- ด่านตรวจแอลกอฮอล์: กระโดดข้ามหรือชนแล้วของกระเด็น (ไม่มีคน) · ย้ายจุดสตาร์ทลงใต้ลานย่าโม
- ป้ายเตือนทางเลี้ยวบั้งเหลือง-ดำ LED + ป้ายล่วงหน้า 150/70 ม. + ลูกศร HUD
- แก้ #1–#11: แข่งรอบเดียว, นับถอยหลังตามนาฬิกาจริง, ปุ่มค้าง, cache header, กล้องตอน fps ต่ำ, ghost ผูกเวอร์ชันสนาม
- โหมดเดโม่ผ่าน URL บน production (สำหรับอัดคลิป)

**M2 landmarks + streetscape**
- อนุสาวรีย์ท้าวสุรนารี + ลานย่าโม, ประตูชุมพล + กำแพงใบเสมา, คูเมือง (shader น้ำ), วัดสุทธจินดา, สระแก้ว, โรงแรม, Terminal 21 skyline
- ตึกจาก OSM 171 หลังตรง footprint + ตึกแถวเติม, เสาไฟ/สายไฟ/ต้นไม้/รถจอด/ป้ายชื่อถนนไทย, collider เสา

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
