# BRIEF — 🐞 fix: แก้บั๊กที่ Tle / QA เจอ
อ่าน `CLAUDE.md` + `docs/dev/M1-CONTRACTS.md` + REPORT ของโมดูลที่เกี่ยว · ห้าม commit/push/deploy · ทุกบั๊กต้อง: หาสาเหตุจริง (root cause) → แก้น้อยที่สุด → **เขียน test ที่จับบั๊กนี้ได้** (headless/Playwright) → typecheck+build ผ่าน · บันทึกใน `docs/dev/fix/REPORT-fix.md` (บั๊ก · สาเหตุ · แก้ไฟล์ไหน · test)
⚠️ pane 🌃 visuals (M3 integrator) กำลังแก้ `src/main.ts` / `src/game/**` อยู่ด้วย → แก้ให้แคบที่สุด อย่า refactor · ถ้าต้องแก้ไฟล์เดียวกันเยอะ เขียนใน REPORT ให้ conductor ประสาน

## บั๊ก #1 (Tle เจอ 20:14 บน preview build002)
ตอนนับถอยหลัง เสียงพากย์ได้ยินเป็น **"Three, Three"** (Three ซ้ำ 2 ครั้ง) แทน "Three, Two, One, Go!"
- เป็นไปได้หลายทาง: game loop เรียก event `countdown3` ซ้ำ / mapping ไฟล์ `two` ชี้ไปไฟล์ three / ไฟล์เสียงของ Mint ชื่อสลับ (ตรวจด้วย ffprobe ความยาว + ถ้ามี whisper/STT ในเครื่องลองถอดเสียง) / build-audio แปลงทับชื่อผิด / queue พากย์เล่นซ้ำ
- ตรวจครบทั้งชุด: three, two, one, go, final-lap, new-record, finish, boost, nice-drift, great-jump ว่าเล่นถูกคำ ถูกจังหวะ ไม่ซ้ำ

## บั๊ก #2 (conductor สั่ง 20:35 จากข้อสังเกตของบั๊ก #1)
นับถอยหลังเดินตาม physics step → เครื่องเฟรมตก (ตอน compile shader) นับช้าได้ถึง 2.4 วิ/คำ
- ต้องเดินตาม **นาฬิกาจริง/นาฬิกาเสียง** (AudioContext.currentTime หรือ performance.now) ให้ HUD + เสียง + ไฟสตาร์ท 5 ดวง (จาก 🏁 sponsors) ตรงกันทุกเครื่อง ~0.8 วิ/จังหวะ · การแข่งเริ่มจับเวลาที่ "ไป!" ตรงนาฬิกา
- พิจารณา warm-up compile shader ก่อนเริ่มนับ (หน้าโหลด) เพื่อไม่ให้เฟรมแรกกระตุก
- test: จำลองเฟรมช้า (CPU throttle) แล้วจังหวะยังอยู่ใน 0.8 ± 0.1 วิ
⚠️ `src/game/engine.ts` มีงานของ visuals ค้างอยู่ — แก้เฉพาะจุด
