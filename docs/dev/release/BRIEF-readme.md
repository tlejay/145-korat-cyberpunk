# BRIEF — 📘 readme: README โชว์ของ + เปิด repo สาธารณะ (Tle สั่ง /kiki-gh-readme 21:05 "ทำ git เป็นสาธารณะได้เลย")
ใช้ skill **`/kiki-gh-readme`** ตามขั้นตอนของ skill · อ่าน `CLAUDE.md` + `SYNC.md` + `promo/FACTS.md` + `CHANGELOG.md` ก่อน · ห้ามพอร์ต 5199 · ปิด server ตัวเองก่อนจบ
**conductor ตอบคำถามขั้น 2 ของ skill แทน Tle (Tle นอน · มอบสิทธิ์ M1–M3 + อนุญาต public แล้ว):**
1. hero: ชื่อ "โคราชโรสเตอร์ · Korat Roadster" · หัวข้อแนว "A real-street racing game around Korat's Ya Mo plaza." / "Built entirely from the terminal." (เลือกแบบที่พอดี 2 บรรทัด) · README เป็น **อังกฤษ + บรรทัดไทยสั้น ๆ** ใต้ hero
2. GIF: ใช้โหมดเดโม่บน production `https://madebytle.com/koratrocketcar/?demo=1&...` (ดู `promo/SHOTLIST.md`) — launch + checkpoint-jump + neon-street · ไม่ใช่ UI คลิก
3. live demo = **https://madebytle.com/koratrocketcar** (ไม่ต้องสร้าง Vercel project ใหม่ — ข้ามขั้น 10 ของ skill)
4. topics: threejs, typescript, vite, racing-game, webgl, openstreetmap, vibe-coding, claude-code, vercel, neon, thailand, korat · homepage = ลิงก์เกม
- เนื้อหา: เกมคืออะไร · เล่นยังไง (มือถือแนวนอน ไม่ต้องลงแอป) · **ทำยังไง** = conductor + herdr pane หลายตัว (ตาราง/สรุปจาก `promo/PANES.md`) · ของจริง (OSM, Street View อ้างอิง, ไม่ใช้ภาพ Google เข้าเกม) · ฟิสิกส์ · tech stack · รันเอง (`pnpm i && pnpm dev`, env จาก `.env.example`) · เครดิต (ชี้ `research/CREDITS.md`) · **License: ไม่ใส่ open-source license** — เขียนว่า "Code © Tle (madebytle) — all rights reserved for now. Assets keep their own licenses (see research/CREDITS.md). Not affiliated with Tesla, Inc."
- ทุกข้อความตรวจกับโค้ด/ไฟล์จริง (กฎความซื่อตรงของ skill) · ห้ามภาพข่าว/ภาพ Google ใน README
- **ก่อนเปิด public ตรวจซ้ำ:** `git log -p --all` หา secret/token/อีเมล/IP/ชื่อเครื่อง (conductor ตรวจ 21:06 สะอาด — ตรวจ commit ที่เพิ่มหลังจากนั้น: promo/, docs/qa/reports/img/, tests/) · ถ้าเจอ → **หยุด ห้ามเปิด public** เขียนรายงาน
- ผ่านแล้ว: commit README + docs ภาพ (pane นี้ **อนุญาตให้ commit + push** เฉพาะ README.md / docs/readme/** ) → `gh repo edit tlejay/145-korat-cyberpunk --visibility public --accept-visibility-change-consequences` + description/topics/homepage → curl ภาพ raw 200
- รายงาน `docs/dev/release/REPORT-readme.md` + สิ่งที่ Tle ต้องกดเอง (social preview)
