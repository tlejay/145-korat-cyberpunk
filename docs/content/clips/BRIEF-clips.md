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

## ⭐ เนื้อเรื่องที่ต้องบอก Mint ใน ping (Tle สั่ง 21:21)
video-story ต้องเล่าเรื่องเดียวกับโพสต์ Facebook = **"การทดลอง vibe coding ของจริง"** · ใส่ใน issue ให้ครบ:
1. ใช้เวลาเท่าไร + โมเดล (Claude Opus 5.5 · จำนวน Claude ที่ทำงานพร้อมกันผ่าน herdr) — ดึงจาก `docs/making-of/LOG.md`
2. ไม่ได้ส่งรูปรถให้ — AI ไปหาข่าว Roadster ที่เพิ่งเปิดตัวเอง แล้วปั้นรถด้วยโค้ด
3. แผนที่จาก OpenStreetMap + เดิน Google Street View ตรวจของจริง (จับได้ว่าแผนที่ผิดหลายจุด)
4. **จุดขาย: ไม่ได้เปิดโปรแกรมอะไรเลยนอกจาก command line** — ไม่มีโปรแกรม 3D/Photoshop/code editor
- แนบภาพเบื้องหลังจริงให้ Mint ใช้คู่กับคลิปเกม: แคปหน้าจอ herdr หลาย tab (ขอ conductor/ถ่ายด้วย `herdr pane read` แล้วทำเป็นภาพ terminal ไม่ใช่ภาพปลอม), ภาพเทียบรถกับภาพข่าว (`docs/content/screens/` เฉพาะภาพจากเกม — **ห้ามส่งภาพข่าว/Google ที่มีลิขสิทธิ์** ให้ใช้คำบรรยายแทน), `docs/content/screens/m3-plume-vs-news.png` **ห้ามใช้** (มีภาพข่าวครึ่งหนึ่ง)
- `docs/content/facebook-post.md` (ถ้า content pane อัปเดตแล้ว) แนบเป็นแหล่งข้อความ

## ⭐ น้ำเสียง (Tle สั่ง 21:35) — ใส่ใน ping ถึง Mint ด้วย
ให้แรงบันดาลใจกับคนที่อยากลอง vibe coding · ไม่อวดความรู้ ไม่ใช้ศัพท์เทคนิคยาก ไม่กดคนดู · เล่าแบบถ่อมตัว มีมุมพลาดขำ ๆ ได้ · เล่าการส่งงานกับ Mint (พากย์เสียง → video-story) ว่า AI หลายตัวทำงานเป็นทีม
- ❌ ห้ามเล่าเรื่อง "AI แต่งว่า Tle เป็นเขยโคราช" (Tle สั่ง 21:38)

## 🔁 สเปกจาก Mint (tlejay/mint#476 comment 21:45) — **ยึดอันนี้เป็นหลัก แทนรายการช็อตข้างบน**
อ่าน comment ล่าสุดของ Mint ด้วย `gh issue view 476 --repo tlejay/mint --comments` ก่อนเริ่ม
1. **ฟุตเทจ 1080×1920 · 60 fps** (30 ได้ถ้าจำเป็น) mp4 คุณภาพสูง ไม่บีบ · คลิปละ 3–8 วิ ชื่อไฟล์ตามโมเมนต์:
   `countdown` (3-2-1-Go + เสียง Charlie), `launch-boost`, `drift`, `great-jump` (ข้ามคูเมือง), `neon-street`, `pratu-chumphon`, `yamo-plaza`, `checkpoint-jump`, `sponsor-signs`, `finish`, `new-record`, `leaderboard`, `menu`
   - **2 ชุด: มี HUD/UI และไม่มี HUD/UI** ของทุกโมเมนต์ (`clips/hud/`, `clips/clean/`)
   - **flythrough 10–15 วิ** กล้องบินรอบลานย่าโมกลางคืนฝนตก ไม่มีรถก็ได้ (สง่า เคารพ ไม่หมุนวนเร็ว)
   - **เล่นจริง 1 รอบเต็มไม่ตัด** 1 ไฟล์ (มี HUD)
2. เสียง: เสียงเกม (ไม่มีเพลง) แยกจาก **เพลงประกอบแยกไฟล์** + license ของเพลง (ดู `research/audio/sources.json` — BGM เป็น CC0 ต้องยืนยันชื่อ/ลิงก์) · SFX หลัก (มอเตอร์ ดริฟต์ บูสต์ ไอพ่น) · เสียงพากย์ Charlie (ElevenLabs แพลนฟรี = ไม่เชิงพาณิชย์ + ต้องเครดิต)
3. ภาพนิ่ง 1080×1920 ไม่มี UI 5–8 ใบ มุมสวยสุด · **โลโก้ชื่อเกม "โคราชโรสเตอร์" PNG พื้นใส** ทำด้วย canvas/SVG + Noto Sans Thai (ห้าม imagegen) สไตล์นีออนเข้าเกม
4. `FACTS.md` ข้อเท็จจริงที่ยืนยันแล้วเท่านั้น (ดึงจาก LOG/REPORT): ลิงก์ + วันที่เปิด (17 ต.ค. 2026 / 2569) · เล่นบนมือถือในเบราว์เซอร์ ไม่ต้องลงแอป ฟรี ไม่ต้องสมัคร · leaderboard ออนไลน์ ตั้งชื่อขิงได้ · ตัวเลข (ป้ายนีออน 297, เวลาทำ, จำนวน commit, จำนวน Claude/pane, สนามจริง 3.3 กม., ฯลฯ) — Tle ให้เปิดเผยได้ (เป็นแกนของโพสต์อยู่แล้ว) · เครดิตท้ายคลิป: OSM, ฟอนต์ Noto Sans Thai (OFL), เพลง/เสียง CC0 + ผู้สร้าง, เสียงพากย์ ElevenLabs "Charlie" โดย Mint, ภาพประกอบ ChatGPT, three.js, Claude Opus 5.5 · ไม่มีโมเดล 3D จากภายนอก (สร้างด้วยโค้ดทั้งหมด)
5. **โหมดเดโม่ผ่าน URL** (Mint อยากได้มาก): `?demo=1&hud=0|1&cam=chase|fly&shot=<ชื่อโมเมนต์>&seed=` ที่รันเส้นทาง/ช็อตเดิมทุกครั้ง (deterministic) — ทำใน `src/capture/**` + ต่อ main.ts แบบเงื่อนไขบรรทัดเดียว · ใช้โหมดนี้อัดเองด้วย แล้วเขียนวิธีใช้ใน `SHOTLIST.md` ให้ Mint อัดซ้ำเองได้บน production
- ส่งที่ `/Users/tlej/Works (Local)/Vibe Docs/~Inbox/to-mint/korat-roadster-teaser/promo-footage/` (clips/hud, clips/clean, flythrough, full-lap, audio, stills, logo, FACTS.md, SHOTLIST.md, CREDITS.md)
- ping: **comment ใน tlejay/mint#476** (ไม่ต้องเปิดใบใหม่) บอก path + สรุปของที่ส่ง + ลิงก์โหมดเดโม่บน production (ถ้า deploy แล้ว)

## 🔁 เปลี่ยนวิธีส่ง (Mint 21:48) — Mint อ่านโฟลเดอร์บน MBP ไม่ได้
1. **หลักคือโหมดเดโม่บน production** — Mint อัดเองด้วย Playwright → ต้อง deterministic + ครบทุก `shot=` (13 โมเมนต์ + `fly` + `full-lap`) · ทดสอบอัดเองทุก shot ให้แน่ใจว่าใช้ได้ (ไม่ต้องส่งวิดีโอ) · `SHOTLIST.md` ระบุ URL เต็มของทุก shot + ความยาว + viewport ที่แนะนำ (1080×1920 dpr 1) + วิธีอัด 60 fps (เช่น ใช้ `?demo=1&fixedDt=1` + frame stepping ผ่าน hook ถ้ามี)
2. **ไฟล์ให้ commit ลง repo ใต้ `promo/`** (conductor commit ให้ — pane นี้ยังห้าม commit): `promo/audio/` (เพลงแยก + license, SFX หลัก, เสียงพากย์ Charlie), `promo/logo/` (PNG พื้นใส), `promo/stills/` (1080×1920 ไม่มี UI 5–8 ใบ webp/png ≤ 1 MB ต่อใบ), `promo/FACTS.md`, `promo/CREDITS.md`, `promo/SHOTLIST.md` · รวม ≤ 25 MB · **ไม่ต้องทำไฟล์วิดีโอ**
3. ไม่ต้องใช้ `~Inbox/to-mint/` แล้ว · ไม่ต้องใช้ Google Drive
4. comment ใน #476: ลิงก์ `promo/` บน GitHub + รายชื่อ shot= ทั้งหมด (ทำหลัง conductor commit + deploy production แล้ว — ให้เขียนข้อความ comment ไว้ใน `promo/MINT-COMMENT.md` แล้ว conductor จะโพสต์เอง)

## ➕ ของเพิ่มจาก Mint (#476, 21:52) — คลิปเดียว 60–90 วิ เล่า workflow เป็นหลัก
1. **`promo/PANES.md`** — ไทม์ไลน์ทุก pane บรรทัดละ pane: เวลาเปิด/ปิด · ชื่อ pane · โมเดล (Claude Opus 5.5 ทุกตัว + ChatGPT pane วาดภาพ + Mint/ElevenLabs เสียงพากย์) · ภารกิจ · ผลที่ได้ — ดึงจากตาราง "Pane ทั้งหมด" + Timeline ใน `docs/making-of/LOG.md` เท่านั้น (ห้ามแต่ง) · รวม conductor ด้วย
2. **อัดจอ herdr/terminal ช็อต 3–8 วิ** (แนวตั้งหรือนอน): workspace หลาย pane รันพร้อมกัน · conductor สั่งงาน · pane research แผนที่ (ข้อความใน terminal) · commit ไหลขึ้น (`git log --oneline`) · ใบ ping Mint เรื่องเสียงพากย์
   - วิธีที่ซื่อตรงที่สุดในโหมดไม่มีคนเฝ้า: ดึงข้อความจริงจาก pane ด้วย `herdr pane read <id> --source recent --format ansi` / `git log` / `gh issue view 475 --repo tlejay/mint` แล้วเรนเดอร์เป็นวิดีโอ terminal (พิมพ์ไหลทีละบรรทัด ฟอนต์ monospace ธีมมืด) — **ต้องเป็นข้อความจริงที่เกิดขึ้น ห้ามแต่งข้อความ** · ภาพ workspace หลาย pane: เรนเดอร์จาก `herdr tab list` + ข้อความจริงของ pane ที่เปิดอยู่ตอนนั้น จัดเป็นหลายช่อง · ถ้า `screencapture` อัดหน้าต่างจริงได้โดยไม่ต้องขอสิทธิ์ ใช้ได้ (ห้ามขอสิทธิ์/กดหน้าต่างระบบ)
   - **ก่อนส่ง เซ็นเซอร์:** โทเคน/คีย์/รหัส, อีเมล (`*@*`), path ส่วนตัว `/Users/tlej/...` → แทนด้วย `~/…`, ชื่อเครื่อง/tailnet (`*.ts.net`), IP — grep ไฟล์ข้อความต้นฉบับทุกไฟล์ก่อนเรนเดอร์ และจดผลการตรวจใน SHOTLIST
3. **before/after**: ฉากหน้าเดิมจาก commit เก่าที่รันได้ (เช่น `988177a` หน้าแรกกริดนีออนเปล่า · M1 กล่อง · M2 ตึกแถว · M3 นีออนฝน) ใช้ git worktree ใน scratchpad + `?demo=1` หรือ screenshot มุมเดียวกัน · มีของพร้อมใช้แล้วใน `docs/content/screens/` (m1-first-drive, m2-*, m3-*) — **ห้ามใช้ m3-plume-vs-news.png** (มีภาพข่าว)
4. **`promo/FACTS.md`** ครบ: เวลาเริ่ม 18:10 – เวลาเสร็จ (ขึ้น production) · ชั่วโมงรวม · จำนวน pane (นับจากตาราง) · จำนวน commit (`git log --oneline | wc -l`) · โมเดล · เครื่องมือ (herdr, Claude Code, Codex/ChatGPT, three.js, Vite, Vercel, Neon) · แหล่ง research (OpenStreetMap, Google Street View ดูอ้างอิง, Wikimedia Commons, ข่าวเปิดตัว Roadster 15 ต.ค.) — Tle อนุญาตเปิดเผยเต็มที่
- ไฟล์อัดจอ/วิดีโอ terminal ใส่ `promo/terminal/` (mp4 สั้น รวม ≤ 20 MB) · before/after ใส่ `promo/before-after/`
