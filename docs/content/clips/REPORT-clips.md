# REPORT — 🎬 clips · 2026-10-18 (01:13–~02:15)

> ## สรุป
> 1. **โหมดเดโม่เสร็จ** `?demo=1&shot=<ชื่อ>&hud=0|1&cam=chase|fly&wing=auto|up|down&seed=&fixedDt=1` — 17 ช็อต (Mint ขอ 13 + `fly` + `full-lap` + แถม `checkpoint-crash`, `rear-hero`) · โค้ด `src/capture/**` + **`src/main.ts` เพิ่ม 1 บรรทัด** (else-if `demo=1` → dynamic import, chunk แยก 12 KB) · ไม่แตะ physics/model/track
> 2. **Deterministic จริง:** นาฬิกาเสมือน 1/60 วิ (performance.now + rAF + CSS animation) + `Math.random` seed → อัดซ้ำได้ภาพตรงกันทุกพิกเซล (md5 เท่ากัน) · real-time mode เล่น 60 fps แล้วหยุดเอง
> 3. **ทดสอบอัดเองครบทุกช็อต ทั้ง clean + hud** ที่ 1080×1920 60 fps ด้วย `scripts/record-demo.mjs` (local build) — ไฟล์ไม่ commit (อยู่ scratchpad) · สำเนาเล็ก 720p 3 คลิปใน `docs/content/clips/` (7 MB)
> 4. **`promo/` (~19 MB):** audio (เพลง CC0 3 · SFX 12 · ambience 2 · พากย์ Charlie 10 · มิกซ์ซิงก์ countdown) · logo PNG พื้นใส 2 · stills 1080×1920 8 · terminal 5 คลิป (ข้อความจริงจาก log ของ Claude แต่ละ pane / git log / #475 เซ็นเซอร์แล้ว) · before-after 5 ช่วงมุมเดียวกันจาก build เก่าใน git · `SHOTLIST.md` `FACTS.md` `PANES.md` `CREDITS.md` `MINT-COMMENT.md`
> 5. **ยังไม่ได้ยืนยันบน production** (ยังไม่ deploy) — ช็อต `leaderboard` บน local ขึ้น "ระบบอันดับขัดข้อง" เพราะไม่มี API · หลัง deploy ให้เปิด `https://madebytle.com/koratrocketcar/?demo=1&shot=leaderboard&hud=1` ดูว่าตารางขึ้น
> 6. **conductor ต้องทำ:** commit `src/capture/` `src/main.ts` `scripts/record-demo.mjs` `.gitignore` (เพิ่ม `promo-footage/`) `promo/` `docs/content/clips/` → QA รอบสั้น → deploy prod → ทดสอบ URL เดโม่ 200 → โพสต์ `promo/MINT-COMMENT.md` เป็น comment ใน [tlejay/mint#476](https://github.com/tlejay/mint/issues/476) (pane นี้ไม่ได้ ping เองตามบรีฟส่วน "เปลี่ยนวิธีส่ง")
> 7. ข้อควรรู้: ตัวเลขหน้าผลแข่งในช็อต finish/new-record/full-lap มาจาก autopilot (เวลา ~1:41.8, g สูงสุด 20.7 จากการแตะกำแพง) — เขียนเตือนใน FACTS/SHOTLIST แล้ว · ไม่ได้ bump version/CHANGELOG (ให้ conductor ตัดสิน)

## รายละเอียด

### โครงสร้าง `src/capture/`
- `clock.ts` — แทน `performance.now` / `requestAnimationFrame` / `Math.random` / CSS animations ด้วยนาฬิกาเสมือน · auto mode = 1 tick ต่อ rAF จริง · manual (`fixedDt=1`) = tick เมื่อ `__demo.step(n)` เท่านั้น
- `index.ts` — `startDemo()`: ตั้ง `E.fixedMode = true` แล้วเดิน sim เอง 1/60 วิต่อเฟรม (ฟิสิกส์ยัง 1/120 ตามเดิม) · ปิด ghost + `E.ticket = null` (ไม่ส่งแต้ม) · หลังเข้าเส้นชัยให้รถเบรกจอดตามถนนแทนค้างกลางอากาศ · ห่อ `visuals.render` เพื่อวางกล้อง (fly) / ปรับกล้อง chase ให้เหมาะ 9:16 (FOV ×1.1 + ขยับเข้าใกล้ตามความเร็ว ไม่เข้าใกล้กว่า 6.5 ม.) · ปีก `wing=up/down` ใช้ `WING_POSE` ของ model.ts · CSS: ซ่อน rotate-hint/ปกเมนู, `hud=0` ซ่อน `#ui` ทั้งหมด, `hud=1` ขยาย UI ×2 + หน้าผลแข่งคอลัมน์เดียวในแนวตั้ง
- `shots.ts` — สคริปต์ขับทุกช็อตผ่าน input pipeline เดียวกับผู้เล่น (`setQaInput`) · ดริฟต์ = แตะเบรก + เลี้ยวสุด 45 ม. ก่อนแยก · กระโดดคู = teleport ขึ้นเส้นกระโดดตอน setup แล้วกดกระโดดที่ 10 ม. ก่อนขอบคู (กด 3.2 ม. แบบเทสต์ QA ชนราวกั้น) + ลอยค้าง 0.64 วิ ลงถนนมนัสสะอาด · ด่านตรวจกระโดดตาม event `cue: now` ของเกมเอง · `finish`/`new-record` pre-roll ขับ autopilot เกือบทั้งรอบ (ไม่ teleport ข้ามด่าน) เวลาผลแข่งจึงมาจากการวิ่งจริง
- ช็อตที่ตรวจด้วยตา (contact sheet): ทุกช็อต clean + countdown/launch/finish/menu/leaderboard/new-record แบบ hud · ปรับกล้องแนวตั้งหลายรอบ (pratu-chumphon/sponsor-signs/yamo-plaza รถหลุดเฟรมเพราะมุมแนวนอนแคบ → แก้แล้ว)

### ผลอัดทดสอบ (local `vite preview`, MacBook M1 Pro, Chromium headless + Metal)
- 34 ไฟล์ (17 ช็อต × clean/hud) 1080×1920 60 fps ครบเฟรมตาม `__demo.frames` · ~3.5 วิเรนเดอร์ต่อ 1 วิวิดีโอ · `full-lap` 114 วิ (6,840 เฟรม) — ผลอยู่ท้ายไฟล์นี้
- เวลาเหตุการณ์จริง (ใช้ใน SHOTLIST): countdown GO 2.42 วิ · launch-boost GO 0.52 วิ → 199 กม./ชม. · drift 2.0–5.0 วิ · great-jump ลอย 0.4 → ลง 2.3 วิ · checkpoint-jump 1.4 → 3.0 วิ · finish เข้าเส้น 2.9 วิ

### ที่ทำต่างจากบรีฟ
- ไม่ใช้ `~Inbox/to-mint/` และไม่ส่งไฟล์วิดีโอ (ตาม "เปลี่ยนวิธีส่ง") · ไม่ได้ `/ping-mint` เอง — เขียน `promo/MINT-COMMENT.md` ให้ conductor โพสต์
- คลิป terminal ไม่ใช่การอัดหน้าจอสด (pane เกือบทั้งหมดปิดแล้ว) → เรนเดอร์จาก log จริงของ Claude Code (`~/.claude/projects/…/*.jsonl`) — เขียนที่มา + ผลเซ็นเซอร์ไว้ใน SHOTLIST §6 · ช่อง 8 pane ใน `05-workspace-7-panes` เป็นการจัดวาง ไม่ใช่ภาพหน้าจอ herdr จริง
- before/after ใช้ git worktree ใน scratchpad build commit `988177a` `7beb1f7` `01d1916` `56d34dd` + ปัจจุบัน ถ่ายมุมเดียวกันด้วย `?qa=1` teleport (ลบ worktree แล้ว)
- โลโก้แบบมีคำว่า "KORAT ROADSTER" เพิ่มอีกไฟล์ (ใช้หรือไม่ใช้ก็ได้)
