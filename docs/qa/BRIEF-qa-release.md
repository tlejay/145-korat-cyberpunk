# BRIEF — 🧪 qa-release: QA รอบสั้นก่อน deploy production v0.3.0-build003
อ่าน `CLAUDE.md` + `docs/qa/reports/2026-10-17-v0.2.0-build002.md` (คำตัดสิน conductor ท้ายไฟล์) + `docs/dev/release/REPORT-polish.md` §7 + `docs/content/clips/REPORT-clips.md` · ห้าม commit/deploy · ห้ามแก้โค้ดเกม (แก้ test ได้) · ห้ามพอร์ต 5199 · ปิด server ตัวเองก่อนจบ · rm ตรง ๆ ไม่ห่อ sh -c
- preview: https://korat-cyberpunk-970313p3a-dosx.vercel.app/koratrocketcar/ (OIDC เหมือนเดิม)
- รันเฉพาะที่ polish ยังไม่ได้รัน + ของใหม่: **WebKit** ชุด static/physics/m3/fix/ui/errors · `mobile` · `voice` · `api` + `deploy` บน preview (track test แล้วลบ) · FEEL-14 ชนทุกโค้ง 110 กม./ชม. บน preview
- **โหมดเดโม่ใหม่** `?demo=1&shot=…` (17 ช็อตใน `promo/SHOTLIST.md`): ทุกช็อตเปิดได้บน preview ไม่มี console error · ไม่กระทบเกมปกติ (ไม่มี `demo=1` = เหมือนเดิม) · โหมดนี้ไม่ส่งแต้มเข้า leaderboard
- ภาพรถใหม่ (Hidden Aero): ปีกกาง > 80 กม./ชม. · ป้าย MADEBYTLE อ่านได้ · กล้องไม่ทะลุรถ
- รายงาน `docs/qa/reports/2026-10-18-v0.3.0-build003.md` บนสุด **GO / NO-GO** (เวลาจำกัด ~40 นาที)
