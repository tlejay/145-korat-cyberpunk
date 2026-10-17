# REPORT — 📘 readme (2026-10-18)

**สรุป:** README ใหม่ + ภาพ 4 ไฟล์ commit `e437f2d` push แล้ว · repo `tlejay/145-korat-cyberpunk` เป็น **PUBLIC** แล้ว · description / homepage / 12 topics ตั้งครบ · raw ภาพทุกไฟล์ 200 · หน้า repo 200

## ต้องทำ / ต้องตัดสินใจ
1. **Tle กดเอง:** Settings → General → Social preview → Upload `docs/readme/social-preview.png` (API ตั้งไม่ได้)
2. ⚠️ **ภาพข่าวใน repo (conductor ตัดสิน):** `docs/content/screens/m3-plume-vs-news.png` (commit `0e03a4c` 20:42) มีภาพข่าวเปิดตัว Tesla 2 ภาพ (มีรถ Tesla หลายรุ่น) — ไม่ใช่ secret จึงไม่เข้าเงื่อนไข "หยุด" ของบรีฟ แต่ขัดหลัก CLAUDE.md §2 / FACTS "ห้ามใช้ภาพข่าว" · แนะนำ `git rm` ออกจาก HEAD (ยังอยู่ใน history — ลบจาก history ต้อง force push ต้องถาม Tle) · pane นี้ไม่ได้รับสิทธิ์ commit ไฟล์นอก README/docs/readme เลยไม่ได้แตะ
3. ข้อสังเกต: `.env.example` ไม่ได้ระบุ `DATABASE_URL` / `RUN_TOKEN_SECRET` ที่ leaderboard ใช้จริง — README เขียนตามโค้ดแล้ว ถ้าอยากให้ครบควรเติมใน `.env.example` (ค่าว่าง)
4. เสียงพากย์ Charlie (ElevenLabs ฟรี ไม่เชิงพาณิชย์) อยู่ใน repo สาธารณะแล้ว — มีเครดิตใน README; ถ้ากังวลเรื่องแจกจ่ายไฟล์ให้ conductor พิจารณา

## ตรวจ secret ก่อนเปิด public (`git log -p --all`, 88 commit)
- token รูปแบบ sk_/ghp_/github_pat_/vercel_/npg_/AKIA/xox/JWT/private key/postgres URL มีรหัส/`DATABASE_URL=`/`RUN_TOKEN_SECRET=` ที่มีค่า → **0** (ghp_ 2 ที่เจอคือ regex ในสคริปต์เซ็นเซอร์ + ข้อความใน SHOTLIST)
- อีเมล: มีแค่ `...@users.noreply.github.com` (author) · ชื่อไฟล์ `Asset 2@3x.png` · IP / `*.ts.net` → 0
- `/Users/tlej` 4 จุดในบรีฟ (path ภายใน ไม่ใช่ secret) · "MacBook M1 Pro" ในเอกสารสเปกเครื่อง — ปล่อยไว้
- ไม่มีไฟล์ `.env*` ถูก track (มีแค่ `.env.example`) · `refs/` (Street View) gitignore ไม่เคยถูก commit

## ภาพ README (ทั้งหมดจากโหมดเดโม่บน production — `scripts/record-demo.mjs` 1280×720 GPU)
| ไฟล์ | ที่มา |
|---|---|
| `docs/readme/hero.png` (2560×1280, 1.6 MB) | template hero ของ skill + เฟรม `drift` hud=1 ที่ 3.5 วิ · สีนีออนชมพู/ฟ้า |
| `docs/readme/social-preview.png` (1280×640, 0.6 MB) | ย่อจาก hero |
| `docs/readme/demo.gif` (600 px, 10 fps, 8.6 วิ, 2.9 MB) | `launch-boost` → `checkpoint-jump` → `neon-street` (hud=0) · ฝนทำให้บีบยาก ใช้ gifsicle `--lossy=100` |
| `docs/readme/evolution.jpg` | ต่อจาก `promo/before-after/` 5 ภาพ (scaffold → v0.3.0) |

## เนื้อหา README (ตรวจกับโค้ด/ไฟล์แล้ว)
- ตัวเลขทั้งหมดมาจาก `promo/FACTS.md` / `CHANGELOG.md` · ปุ่มควบคุมตรง `src/input/index.ts` + `touch.ts` · env ตรง `db/client.ts` + `api/_lib/http.ts` · shot 17 ช็อตตรง `promo/SHOTLIST.md` · `pnpm dev` ใช้ base `/koratrocketcar/` ตาม `vite.config.ts`
- ไม่มีภาพข่าว/ภาพ Google · ไม่มีโลโก้ Tesla · License ตามบรีฟ (all rights reserved + Not affiliated with Tesla, Inc.)
- preview ผ่าน GitHub Markdown API: badge แนวนอน · ไม่มีหัวตารางว่าง · anchor ทุกลิงก์ตรง id จริง
- ไม่ได้รัน dev server (ใช้ production) — ไม่มี server ค้าง · ไฟล์อัดอยู่ใน scratchpad ไม่ commit
