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

## บั๊ก/งานเล็ก #3–#4 (จาก fx REPORT §8, conductor 20:42)
- #3 โมเดลรถ: ภาพข่าวมีหัวพ่นลงพื้นด้านข้าง **4 หัว** (คู่หน้า+คู่หลัง?) แต่โมเดลมี 2 — ตรวจภาพ `refs/car/rear-*.jpg` ยืนยันจำนวน/ตำแหน่งก่อน แล้วเพิ่มใน `src/car/model.ts` + export ใน `nozzles` (type `side-down`) ให้ fx ใช้ได้อัตโนมัติ
- #4 HUD: ตัวเลขความเร็ว/เกจ อ่านยากเมื่อมีควันขาวด้านหลัง → เพิ่มพื้นหลังโปร่งเข้ม/เงาตัวอักษรใต้ HUD (ประสานกับ visuals ที่อาจแก้ src/ui อยู่ — แก้เฉพาะ CSS ของ HUD)

## งาน #5 (Tle สั่ง 20:44) — เปลี่ยนชื่อเกม "โคราชไซเบอร์พังก์" → **"โคราชโรสเตอร์"**
- แทนทุกที่ที่ผู้เล่นเห็น: `<title>` + meta (index.html), หัวเมนู, หน้าโหลด, หน้าเครดิต, ข้อความแชร์/OG ถ้ามี, ข้อความ error ที่อ้างชื่อเกม · ภาษาอังกฤษ (ถ้ามี) = "Korat Roadster"
- ห้ามเปลี่ยน: ชื่อโปรเจค/repo/โฟลเดอร์/URL `/koratrocketcar/`/ชื่อ Vercel project · `src/ui/**` อาจมี visuals แก้อยู่ — แก้เฉพาะข้อความ
- หลังแก้ grep ชื่อเก่าใน src index.html public ต้องไม่เหลือในส่วนที่ผู้เล่นเห็น · test UI ที่เช็คชื่อเกมให้อัปเดตด้วย
