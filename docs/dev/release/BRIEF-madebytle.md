# BRIEF — 🌐 madebytle: ต่อ madebytle.com/koratrocketcar → เกม (Tle อนุญาต 21:02 ก่อนนอน)
ทำงานในโปรเจค **`/Users/tlej/Works (Local)/Vibe Docs/00 Madebytle Profile/madebytle`** (Next.js) — **อ่าน CLAUDE.md / AGENTS.md / README ของโปรเจคนั้นก่อน** และทำตามกติกาของโปรเจคนั้น (CLAUDE.md ย่อยชนะ) · เว็บนี้เป็นเว็บจริงของ Tle ที่มีหน้าใช้งานอยู่ → **แก้ให้น้อยที่สุด ห้ามแตะหน้าอื่น**

## งาน
1. เพิ่ม rewrite ใน `next.config.ts` (คงของเดิมทุกตัว): `/koratrocketcar` → `https://korat-cyberpunk.vercel.app/koratrocketcar/` และ `/koratrocketcar/:path*` → `https://korat-cyberpunk.vercel.app/koratrocketcar/:path*` · เช็คว่าไม่มี route/page/middleware/redirect ของ madebytle ที่ชนกับ `/koratrocketcar` (เช่น `[slug]`, i18n, trailingSlash) — ถ้ามีให้จัดลำดับให้ rewrite นี้ชนะเฉพาะ path นี้
2. `pnpm build` (หรือคำสั่งของโปรเจค) ผ่าน
3. Deploy ตามวิธีของโปรเจคนั้น — เช็คก่อนว่าผูก Vercel Git integration ไหม (`vercel project ls`/`.vercel/project.json` + `vercel inspect` หรือ API) · ถ้า push = deploy ให้ commit + push · ถ้าไม่ใช่ให้ commit + push แล้ว `vercel deploy --prod --yes` · ตรวจ secret 2 ชั้นก่อน `git add` ตามกฎ root · commit เฉพาะไฟล์ที่แก้ · ห้าม force push
4. ตรวจหลัง deploy (curl): `https://madebytle.com/koratrocketcar/` 200 และเป็นหน้าเกม (`<title>โคราชโรสเตอร์`) · `/koratrocketcar` (ไม่มี /) ไปถึงเกม · `/koratrocketcar/data/track-A.json` 200 · `/koratrocketcar/api/leaderboard?track=A&limit=3` 200 JSON · asset JS/CSS 200 + cache header immutable · `og:image` (`/koratrocketcar/assets/img/og-cover-1200x630.jpg`) 200 · **หน้าเดิมของ madebytle ยัง 200**: `/`, `/prompt`, `/yfti/contact`, `/presentation` (ถ้ามี) และสุ่มอีก 3 หน้าจาก sitemap
5. เปิดด้วย Playwright (ไม่ใช่ Chrome ของ Tle, ห้ามพอร์ต 5199) ที่ `https://madebytle.com/koratrocketcar/` แนวนอน 844×390 → เมนูขึ้น ไม่มี console error (โดยเฉพาะ CORS/mixed content/404 asset)
6. ถ้าพัง: rollback ด้วยการ revert commit ของตัวเองแล้ว deploy ใหม่ (ห้าม force push) แล้วรายงาน
- รายงาน `docs/dev/release/REPORT-madebytle.md` ในโปรเจค **145** (สรุป ≤ 10 บรรทัด + ผล curl ทุกตัว + commit hash ฝั่ง madebytle)
