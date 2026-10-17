# BRIEF — 🎬 clips: teaser แนวตั้งหลายคลิปจากเกมจริง ส่งให้ Mint ทำ video-story (Tle สั่ง 21:08)
อ่าน `CLAUDE.md` + `docs/qa/TEST-HOOKS.md` (autopilot/teleport/qa hooks) + REPORT-M3-*.md + `docs/dev/checkpoint/REPORT-checkpoint.md` · ห้าม commit/push/deploy · ห้ามแก้ไฟล์เกมยกเว้นเพิ่มโหมด capture แบบแยก (ดูข้อ 2) · ปิด dev server ของตัวเองก่อนจบ · **ห้ามใช้พอร์ต 5199**

## ผลลัพธ์
คลิป **แนวตั้ง 9:16 · 1080×1920 · 30 หรือ 60 fps · H.264 mp4** ช็อตละ 5–10 วิ ภาพลื่น (ไม่ใช่ screen record กระตุก) — **เวอร์ชันไม่มี HUD** (Mint ใส่ตัวอักษรเอง) + เวอร์ชันมี HUD อย่างละไฟล์ถ้าทำได้
1. `launch` — ออกตัว 4.6 g ใต้ซุ้มสตาร์ท MADEBYTLE ไฟ 5 ดวง ไอขาวพุ่งจากหัวพ่นท้าย
2. `yamo-pass` — วิ่งผ่านหน้าลานย่าโม/ประตูชุมพล (สง่า ไม่ตัดต่อแบบล้อเลียน)
3. `checkpoint-jump` — กระโดดข้ามด่านตรวจ "หยุดตรวจ" ไอขาวกระทบพื้นแผ่ออก
4. `checkpoint-crash` — ชนด่านแล้วกรวย/ป้ายกระเด็น (กระบองไฟยังเรือง)
5. `drift-224` — ดริฟต์เลี้ยวขวาสี่แยกหัวราชดำเนิน ละอองน้ำ/ควันยาง
6. `moat-jump` — กระโดดข้ามคูเมืองถนนมนัส
7. `neon-rain` — ทางตรงตึกแถวนีออนฝนตก สายไฟ/โคมแกว่งตอนรถผ่าน
8. `rear-hero` — มุมกล้องหลังรถโชว์ไฟท้ายแดง ป้าย MADEBYTLE ปีกหลัง (ช้า ๆ)

## วิธี (แนะนำ)
- เกมเป็นแนวนอนอย่างเดียว → เพิ่มโหมด `?capture=1&aspect=9x16&hud=0` แยกไฟล์ใหม่ `src/capture/**` (ปิด rotate-hint, ตั้ง FOV/ระยะกล้องให้เหมาะแนวตั้ง) — ต่อเข้า main.ts แบบเงื่อนไขบรรทัดเดียว จดใน REPORT · หรือเรนเดอร์แนวนอนความละเอียดสูงแล้ว crop กลาง ถ้าภาพดีพอ
- เรนเดอร์ **ทีละเฟรมแบบ deterministic** (fixed dt ผ่าน hook) แล้ว screenshot → ffmpeg ต่อเป็นวิดีโอ (ได้ภาพลื่นแม้ headless ช้า) · quality = high · ใช้ autopilot/teleport/สคริปต์ขับ
- เสียง: headless อัดเสียงยาก → ทำคลิปเงียบ + แนบ stem เสียงที่ตรงช็อตจาก `public/assets/audio/` (มอเตอร์/ไอพ่น/พากย์ Charlie) แยกไฟล์ให้ Mint เลือกใส่
- ภาพนิ่ง 9:16 ช็อตเด่น 6 ภาพไว้ทำปก/thumbnail

## ส่งมอบ
- ไฟล์ทั้งหมด → `/Users/tlej/Works (Local)/Vibe Docs/~Inbox/to-mint/korat-roadster-teaser/` (clips/, stills/, audio-stems/) + `SHOTLIST.md` (ชื่อไฟล์ · ความยาว · เกิดอะไรในช็อต · จุดเด่นที่ควรใส่ข้อความ · ข้อมูลจริงประกอบ เช่น "0–100 ใน 0.63 วิ", "ไอขาวจากแก๊สเย็น −183 °C", "สนามจริง 3.3 กม. รอบลานย่าโม")
- สำเนาเล็ก (≤ 720p) 2–3 คลิปเก็บ `docs/content/clips/` ได้ (ขนาดรวม ≤ 15 MB)
- `docs/content/clips/REPORT-clips.md` สรุป ≤ 10 บรรทัด

## ขั้นสุดท้าย — pane นี้ ping Mint เอง (Tle: "ให้คนอื่นทำ conductor เป็นวาทยากร")
หลังส่งไฟล์ครบ ใช้ skill `/ping-mint` (kind = ถามมิ้น/รอผล) ขอให้ Mint ทำ **video-story** จากคลิปชุดนี้:
- ที่อยู่ไฟล์บนเครื่อง Tle: `Vibe Docs/~Inbox/to-mint/korat-roadster-teaser/` + `SHOTLIST.md`
- เกม "โคราชโรสเตอร์" · เล่นที่ `madebytle.com/koratrocketcar` · สปอนเซอร์ MADEBYTLE + สมาคมดิจิทัลนครราชสีมา (NDA)
- ทำหลายคลิปสั้นแนวตั้ง (Reels/TikTok) ใช้ข้อเท็จจริงใน SHOTLIST · ห้ามแต่งตัวเลข · ห้ามล้อเลียนย่าโม · ด่านตรวจ = มุกขำ ไม่ส่งเสริมเมาแล้วขับ · ไม่ใช้ชื่อ/โลโก้ Tesla (เขียนได้ว่า "ได้แรงบันดาลใจจาก Roadster ที่เพิ่งเปิดตัว")
- ตอบกลับที่ pane ของ conductor (`w54:p1`) ไม่ใช่ pane นี้ (pane นี้จะถูกปิด) · ใส่ลิงก์ issue ใน REPORT-clips.md
