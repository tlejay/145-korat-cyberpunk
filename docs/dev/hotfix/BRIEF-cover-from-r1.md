# BRIEF — ภาพหน้าโหลด + OG ใหม่จากโมเดล R1 ในเกม · 2026-10-18 (Tle ผ่าน Mint 04:08)

ปัญหา: `public/assets/img/cover-1280x720.webp`, `cover-1920x1080.webp` (ภาพหน้าโหลด/เมนู) และ `og-cover-1200x630.jpg` (ภาพแชร์ Facebook/LINE) วาดด้วย imagegen → รถในภาพไม่ใช่ R1 ที่ผู้เล่นขับจริง
งาน: เรนเดอร์ภาพใหม่ **จากเกมจริง** (โมเดล R1 ในเกม ป้าย MADEBYTLE) แทนทั้ง 3 ไฟล์

1. ใช้ demo mode (`?demo=1&shot=rear-hero|neon-street|pratu-chumphon...&hud=0&cam=fly&seed=&fixedDt=1&quality=high`) ใน Playwright headless หาเฟรมที่สวยที่สุด: รถ R1 ชัด กลางคืน ฝน นีออน ถนนจริงของโคราช · ถ้าจำเป็นเพิ่ม shot ใหม่ใน `src/capture/` ได้ (เช่น `cover`) — เรนเดอร์ที่ความละเอียดสูง (≥ 2× แล้วย่อ) ให้คม
2. ทำ 3 ไฟล์ขนาดเดิม ชื่อเดิม (ไม่ต้องแก้ path ในโค้ด) · webp คุณภาพ ~82 · og เป็น JPEG ≤ 300 KB · เช็คว่าครอปแล้ว UI ที่ทับภาพ (โลโก้/ชื่อเกม/ปุ่มบนเมนู) ยังอ่านง่าย — เปิดดูหน้าเมนูจริงที่ 844×390 และ 1920×1080
3. แก้ `og:image:alt` ใน `index.html` ให้ตรงภาพใหม่ (ไทย) · ห้ามมีโลโก้/ชื่อ Tesla · ห้ามใช้ภาพข่าว/Google แม้แต่บางส่วน
4. `pnpm typecheck && pnpm build` ผ่าน · **ไม่ต้อง bump version** (conductor ทำ) · ห้ามแตะ `src/car/physics*`, `src/car/config.ts` (pane อื่นทำอยู่)
5. ห้าม commit/push/deploy · ห้ามพอร์ต 5199 · ปิด server ก่อนจบ · REPORT ที่ `docs/dev/hotfix/REPORT-cover-from-r1.md` (≤ 15 บรรทัดบนสุด + ภาพเทียบเก่า/ใหม่)
