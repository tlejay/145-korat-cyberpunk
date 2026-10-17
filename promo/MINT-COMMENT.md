<!-- conductor: โพสต์ข้อความข้างล่างเป็น comment ใน tlejay/mint#476 หลัง commit promo/ + deploy production (ตรวจลิงก์ demo ตอบ 200 ก่อน) -->

🎬 **ของสำหรับ video-story พร้อมแล้วค่ะ** — ทุกอย่างอยู่ใน repo `tlejay/145-korat-cyberpunk` โฟลเดอร์ [`promo/`](https://github.com/tlejay/145-korat-cyberpunk/tree/main/promo) (clone แล้วใช้ได้เลย)

**เริ่มอ่านที่** [`promo/SHOTLIST.md`](https://github.com/tlejay/145-korat-cyberpunk/blob/main/promo/SHOTLIST.md) — มี URL เต็มทุกช็อต ความยาว เกิดอะไรวินาทีไหน + วิธีอัด 60 fps

### 1) ฟุตเทจเกม = โหมดเดโม่บน production (อัดเองได้ ได้ภาพเหมือนกันทุกครั้ง)
```
https://madebytle.com/koratrocketcar/?demo=1&shot=<ชื่อ>&hud=0|1
```
- เปิดในเบราว์เซอร์ = เล่นช็อตแบบ real-time 60 fps แล้วหยุดที่เฟรมสุดท้าย
- อัด 60 fps แบบไม่กระตุก: `node scripts/record-demo.mjs --shot all --hud both` (Playwright ทีละเฟรม → mp4 1080×1920 H.264) · ต้องมี `pnpm install` + ffmpeg
- ตัวเลือก: `cam=chase|fly` (กล้องเกม / กล้องภาพยนตร์ของช็อตนั้น) · `wing=auto|up|down` · `seed=<เลข>` (ฝน/ละอองคนละแบบ แต่ยังซ้ำได้) · `fixedDt=1` (เดินทีละเฟรมผ่าน `window.__demo.step()`)

**รายชื่อ `shot=` ทั้งหมด (16):**
`countdown` · `launch-boost` · `drift` · `great-jump` · `neon-street` · `pratu-chumphon` · `yamo-plaza` · `checkpoint-jump` · `sponsor-signs` · `finish` · `new-record` · `leaderboard` · `menu` · `fly` (flythrough 14 วิ) · `full-lap` (1 รอบเต็ม ~114 วิ ใช้คู่ `hud=1`) · แถม `checkpoint-crash`, `rear-hero`

### 2) ไฟล์ใน `promo/` (รวม ~19 MB)
- `audio/` เพลงแยก (CC0 + license) · SFX หลัก (มอเตอร์ ดริฟต์ บูสต์ ไอพ่น ชน ลงพื้น) · เสียงพากย์ Charlie · `countdown-shot-sync.wav` ซิงก์กับช็อต countdown พอดี
- `logo/` "โคราชโรสเตอร์" PNG พื้นใส 2 แบบ (ไทย / ไทย+อังกฤษ)
- `stills/` ภาพนิ่ง 1080×1920 ไม่มี UI 8 ใบ
- `terminal/` คลิป terminal 5 คลิป (8 วิ) เรนเดอร์จาก**ข้อความจริง**ใน log ของ Claude แต่ละตัว / git log / ใบ #475 — เซ็นเซอร์ path ส่วนตัว อีเมล ชื่อเครื่องแล้ว
- `before-after/` ฉากเดียวกัน มุมเดียวกัน 5 ช่วง: โครงเปล่า 18:40 → M1 19:40 → M2 20:08 → M3 21:35 → v0.3 01:11 (+ แบบแนวตั้ง 2 ภาพ)
- `PANES.md` ไทม์ไลน์ทุก pane (33 Claude + ChatGPT + มิ้น) · `FACTS.md` ตัวเลขที่ยืนยันแล้ว · `CREDITS.md` ข้อความเครดิตท้ายคลิปพร้อมใช้

### ⭐ เรื่องที่เล่า (พี่เติ้ลกำหนด)
"การทดลอง vibe coding ของจริง" — ใช้เวลา ~6 ชม. (18:10 → ขึ้นเว็บ 00:24) · Claude Opus 5.5 ทำงานพร้อมกันสูงสุด 7 ตัว + conductor ผ่าน herdr · **ไม่ได้ส่งรูปรถให้** AI ไปหาข่าว Roadster ที่เพิ่งเปิดตัวเองแล้วปั้นรถด้วยโค้ด · แผนที่จาก OpenStreetMap + เดิน Street View ตรวจของจริง (จับได้ว่าแผนที่ผิดหลายจุด) · **จุดขาย: ไม่ได้เปิดโปรแกรมอะไรเลยนอกจาก command line** · เล่าการส่งงานกับมิ้น (เสียงพากย์ → video-story) ว่า AI หลายตัวทำงานเป็นทีม

**น้ำเสียง:** ให้แรงบันดาลใจคนที่อยากลอง vibe coding · ถ่อมตัว ไม่ใช้ศัพท์ยาก ไม่กดคนดู · มีมุมพลาดขำ ๆ ได้ (ดู FACTS)
**ห้าม:** แต่งตัวเลข · ล้อเลียนย่าโม/ประตูชุมพล · ส่งเสริมเมาแล้วขับ (ด่านตรวจ = มุกขำ) · ชื่อ/โลโก้ Tesla (เขียนว่า "ได้แรงบันดาลใจจาก Roadster ที่เพิ่งเปิดตัว") · ภาพข่าว/ภาพ Google · เรื่อง "เขยโคราช" · อ้างตัวเลขบนหน้าผลแข่งของโหมดเดโม่เป็นสถิติ (เป็น autopilot)
**สปอนเซอร์:** MADEBYTLE + สมาคมดิจิทัลนครราชสีมา (NDA)

ตอบกลับที่ pane ของ conductor (`w54:p1`) นะคะ — pane 🎬 clips ปิดไปแล้ว
