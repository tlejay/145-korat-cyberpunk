# BRIEF M1 — 🎮 game-ui: game loop + ปุ่ม + HUD + ต่อทุกชิ้นเข้าด้วยกัน (integrator)
อ่าน CLAUDE.md + docs/dev/M1-CONTRACTS.md (สัญญากลาง — ห้ามแก้ไฟล์นอกโฟลเดอร์ที่เป็นเจ้าของ) + docs/dev/GAMEPLAY.md ก่อน · ห้าม commit/push/deploy · จบด้วย pnpm typecheck && pnpm build ผ่าน + REPORT ตามสัญญา
อ่านเพิ่ม: docs/qa/TEST-PLAN.md (MOB/UI/ERR) + TEST-HOOKS.md · docs/dev/REPORT-leaderboard.md · src/net/** (ใช้ได้เลย)

1. **สร้าง `src/types.ts` ตามสัญญาเป็นอย่างแรก** (pane อื่น import) + `src/game/quality.ts`
2. `src/main.ts` + `src/game/`: state machine (เมนู → นับถอยหลัง → แข่ง 2 รอบ → สรุป → leaderboard/ตั้งชื่อ → เล่นใหม่ 1 แตะ) · fixed timestep loop เรียก `car.step` · จับเวลา/checkpoint/ทางลัดข้ามคู · respawn ≤ 0.6 วิ · ghost ตัวเอง + **ghost อันดับ 1 ออนไลน์** (ใช้ src/net/ghost*) · ส่งแต้มผ่าน src/net (สูตร GAMEPLAY §6)
3. `src/input/`: ปุ่มซ้าย/ขวา + ตัวช่วยเลี้ยว ตาม GAMEPLAY §1 · multi-touch · คีย์บอร์ดสำรอง · กันปุ่มกระโดด/BOOST ในเขตลาน (ไอคอนแม่กุญแจ)
4. `src/ui/`: HUD ไทย (ความเร็ว กม./ชม. th-TH, เวลารอบ, รอบ 1/2, เกจถังลม, เกจ g, ป้ายดริฟต์, ลูกศร/minimap) ปุ่ม+HUD ≤ 20% จอ · Heroicons ไม่ใช้ emoji · error ไทยตาม CLAUDE.md §9 · หน้าเครดิต (OSM, CC ภาพ, "ได้แรงบันดาลใจจาก Tesla Roadster (2026) ไม่มีส่วนเกี่ยวข้องกับ Tesla, Inc.", "เสียงพากย์: ElevenLabs", CC0 เสียง)
5. ระหว่างรอ pane อื่น ใช้ stub ของตัวเอง แล้ว **สลับเป็นของจริงเมื่อไฟล์มา** (เช็คเป็นระยะว่า src/track, src/car, src/audio มีของจริงหรือยัง) — เป็นคนเดียวที่ต่อทุกชิ้นเข้ากัน
6. `window.__game` ครบตาม TEST-HOOKS (?qa=1) · version bump เป็น v0.2.0-build002 + CHANGELOG
7. ทดสอบเองด้วย Playwright headless (ไม่ใช้ Chrome ของ Tle) จอ 844×390 แนวนอน + touch: ขับครบ 2 รอบด้วย autopilot hook ได้ ไม่มี console error
