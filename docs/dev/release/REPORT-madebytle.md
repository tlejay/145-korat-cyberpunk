# REPORT — madebytle.com/koratrocketcar → เกม (18 ต.ค. 2569)

## สรุป
- ✅ madebytle.com/koratrocketcar/ เปิดเกมได้แล้ว (rewrite ไป korat-cyberpunk.vercel.app) ใน prod
- madebytle ไม่ผูก Vercel Git → commit + push แล้ว `vercel deploy --prod --yes` เอง
- commit ฝั่ง madebytle (`tlejay/00-Madebytle-Profile-App`, main): `5dce291` (rewrite 2 ตัว) + `fe717cb` (แก้ trailing slash)
- ทำไมมีรอบ 2: Next ตัด `/` ท้าย URL อัตโนมัติ → `/koratrocketcar/` โดน 308 ไป `/koratrocketcar` ก่อนถึง rewrite
  แก้โดยตั้ง `skipTrailingSlashRedirect: true` แล้วใส่ redirect ตัดสแลชกลับคืนให้ทุก path **ยกเว้น** `/koratrocketcar` (`/prompt/` ยัง 308 → `/prompt` เหมือนเดิม)
- ไม่มี route/middleware/`[slug]`/i18n ที่ชนกับ `/koratrocketcar` · แตะไฟล์เดียว `next.config.ts` · `pnpm build` ผ่าน
- Playwright (headless Chromium, 844×390 แนวนอน, ไม่ใช่ Chrome ของ Tle) → เมนูขึ้น (เริ่มแข่ง/ตารางอันดับ/ตั้งค่า/เครดิต) · console error 0 · request ≥400/failed 0 · ภาพ: `madebytle-koratrocketcar-844x390.png`
- ไม่ต้อง rollback

## ผล curl (หลัง deploy fe717cb)
```
https://madebytle.com/koratrocketcar/  200 text/html; charset=utf-8 redirect=
https://madebytle.com/koratrocketcar  200 text/html; charset=utf-8 redirect=
https://madebytle.com/koratrocketcar/data/track-A.json  200 application/json; charset=utf-8 redirect=
https://madebytle.com/koratrocketcar/api/leaderboard?track=A&limit=3  200 application/json; charset=utf-8 redirect=
https://madebytle.com/koratrocketcar/assets/img/og-cover-1200x630.jpg  200 image/jpeg redirect=
title: <title>โคราชโรสเตอร์ — แข่งรถรอบลานย่าโม
leaderboard body: {"ok":true,"track":"A","entries":[]}
index-CbY7bWbp.js: HTTP/2 200  cache-control: public, max-age=31536000, immutable 
index-CKUbqe9z.css: HTTP/2 200  cache-control: public, max-age=31536000, immutable 
three.core-DekxHve3.js: HTTP/2 200  cache-control: public, max-age=31536000, immutable 
https://madebytle.com/  200 text/html; charset=utf-8 redirect=
https://madebytle.com/prompt  200 text/html; charset=utf-8 redirect=
https://madebytle.com/yfti/contact  200 text/html; charset=utf-8 redirect=
https://madebytle.com/presentation  200 text/html; charset=utf-8 redirect=
https://madebytle.com/prompt/  308 text/plain redirect=https://madebytle.com/prompt
https://madebytle.com/esp  200 text/html; charset=utf-8 redirect=
https://madebytle.com/prompt/monthly-project-review-stronger-model  200 text/html; charset=utf-8 redirect=
https://madebytle.com/prompt/claude-code-codex-cli-compatibility  200 text/html; charset=utf-8 redirect=
```
