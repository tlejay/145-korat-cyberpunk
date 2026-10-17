# BRIEF — 🏁 sponsors: ป้ายสปอนเซอร์แบบสนาม F1 + ป้ายทะเบียน MADEBYTLE (Tle สั่ง 20:23)
อ่าน `CLAUDE.md` (ความเคารพย่าโม) + `docs/dev/M1-CONTRACTS.md` + `docs/dev/REPORT-M2-streetscape.md` (anchors, bridges) + `docs/dev/REPORT-M1-world.md` (startGrid/finishLine) · ภาพตัวอย่างจาก Tle: `refs/sponsors/ref-1..6.png` (แบบสนาม F1 — ใช้ดูสไตล์ ห้ามก๊อปโลโก้แบรนด์ในภาพ) · ห้าม commit/push/deploy · typecheck+build ผ่าน + `docs/dev/sponsors/REPORT-sponsors.md`

**เจ้าของไฟล์:** `src/sponsors/**` (ใหม่) · `public/assets/sponsors/**` · `src/car/model-plate.ts` · export `buildSponsors(track): THREE.Group` + `getSponsorTexture(slot: 'billboard'|'board'|'gantry', i): THREE.Texture` — pane 🌃 visuals (M3 integrator) จะต่อเข้าเกมและใช้บิลบอร์ด 5 anchor แสดงสปอนเซอร์ (เขียนวิธีต่อใน REPORT)

## สปอนเซอร์ (เท่านั้น — ห้ามแบรนด์อื่น)
1. **MADEBYTLE** — ตาม `../00 Madebytle Profile/BRAND.md` §3–4 (พื้น #050505, gradient #818cf8 → #c084fc → #f472b6, mark ตัว T) · ทำโลโก้เป็น SVG/canvas จากสเปกนี้
2. **สมาคมดิจิทัลนครราชสีมา** — Tle จะส่งโลโก้ตามมา · ระหว่างนี้ทำ placeholder เป็นตัวอักษรไทย "สมาคมดิจิทัลนครราชสีมา" (Noto Sans Thai ตัวหนา) บนแถบสีเรียบ · ออกแบบให้ **สลับเป็นไฟล์โลโก้จริงได้โดยแก้ไฟล์เดียว** (`public/assets/sponsors/kda-logo.png|svg` ถ้ามีไฟล์ให้ใช้ไฟล์ ไม่มีใช้ตัวอักษร)
- ตัวอักษรบนป้ายทั้งหมดเรนเดอร์ด้วย canvas + ฟอนต์จริง (ห้ามให้ imagegen เขียนตัวอักษร)

## งาน
1. **ป้ายทะเบียนรถ** = `MADEBYTLE` (แทน "ไซเบอร์ 1 นครราชสีมา") สไตล์ป้ายเรียบคมอ่านชัดจากกล้องหลัง
2. **ซุ้มเส้นสตาร์ท/เส้นชัย (gantry)** คร่อมถนนราชดำเนินตรง `finishLine` แบบ ref-6 (แถบสปอนเซอร์บนคาน + ไฟสตาร์ท 5 ดวงที่ game loop สั่งติดตามนับถอยหลังได้ — export API) · **ต้องอยู่นอกเขตลานย่าโม และไม่บังมุมมองอนุสาวรีย์จากถนน** (เช็คด้วยภาพ)
3. **ป้ายเลียบแบริเออร์ (perimeter boards)** แบบ ref-2/3/5 สลับ MADEBYTLE / สมาคมฯ ช่วงทางตรงหน้าเส้นชัย + ทางตรงยาวถนนมนัส (ราว 15–25 แผง) — ห้ามช่วงติดลาน/ประตู/วัด/ซุ้มพระบรมฉายาลักษณ์
4. **บิลบอร์ดใหญ่** แบบ ref-1/4 ใช้ 5 billboard anchor ของ streetscape (ทำ texture ให้ visuals) + ซุ้มบนสะพานลอย 2 ตัว (`streetscape.bridges`)
5. เป็นเมืองกลางคืน cyberpunk: ป้ายเป็นจอ LED/emissive เข้ากับ bloom · กะพริบ/วิ่ง ≤ 3 ครั้ง/วิ
6. งบ ≤ 12 draw calls · texture รวม ≤ 2 MB · ภาพเทียบ 3 มุม `refs/m3/sponsors-*.png`
7. เครดิต: เพิ่ม "สนับสนุนโดย สมาคมดิจิทัลนครราชสีมา · MADEBYTLE" ในหน้าเครดิต — แก้ `src/ui/**` ไม่ได้ ให้เขียนใน REPORT ให้ conductor ส่งต่อ

## เพิ่ม (20:27) — โลโก้สมาคมฯ มาแล้ว + artwork บิลบอร์ดจาก ChatGPT
- โลโก้ **NDA — Nakhonratchasima Digital Association (สมาคมดิจิทัลนครราชสีมา)** อยู่ที่ `~human/nda logo/`: `Asset 3@3x.png` แนวนอนสี (ตาราง pixel ส้ม + NDA ดำ) · `Asset 5@3x (1).png` แนวนอนขาวดำ · `Asset 2@3x.png` แนวตั้งสี · `Asset 4@3x.png` แนวตั้งขาวดำ — **ทุกไฟล์พื้นขาวทึบ ไม่มี alpha**
- ทำเวอร์ชันสำหรับพื้นมืด (ป้ายกลางคืน): เจาะพื้นขาวเป็นโปร่งใส · ตัวอักษร NDA/ชื่อสมาคมสีดำ → ขาว · **คงตาราง pixel สีส้มไว้ตามเดิม** (ห้ามเปลี่ยนสีแบรนด์ ห้ามบิดสัดส่วน) → `public/assets/sponsors/nda-*.png|webp` · ป้ายที่พื้นสว่างใช้ไฟล์สีเดิมได้
- ข้อความประกอบภาษาไทย "สมาคมดิจิทัลนครราชสีมา" ใช้ Noto Sans Thai ตัวหนา คู่โลโก้ได้
- **artwork พื้นหลังบิลบอร์ด** จะมาจาก pane 🖼️ art (ChatGPT วาด ไม่มีตัวอักษร) ที่ `public/assets/img/sponsor-bg-*.webp` ตาม `docs/dev/m3/art-manifest.json` → ประกอบโลโก้ + ข้อความทับด้วย canvas ในเกม · ระหว่างรอใช้พื้น gradient ตามแบรนด์
