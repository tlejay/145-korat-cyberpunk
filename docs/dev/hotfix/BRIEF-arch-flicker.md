# BRIEF — Hotfix: ภาพกะพริบใต้ซุ้มประตูชุมพล (z-fighting) · 2026-10-18 04:10

ที่มา: Tle (ผ่าน Mint, tlejay/mint#476) — ผู้เล่นเห็นด้วย ต้องแก้ **ในเกม** ไม่ใช่แค่ในคลิป

## อาการ
demo shot `?demo=1&shot=pratu-chumphon&hud=0&seed=1&fixedDt=1` เฟรม 100–105 (60fps):
ในช่องโค้งประตู (ครึ่งขวาของช่องประตู ใต้ป้ายชื่อสีทอง) พื้นผิวเปลี่ยนทุกเฟรม ระหว่าง สีเรียบ / ลายทแยงมืด / แถบ moiré
→ น่าจะเป็น z-fighting ของผิว coplanar (แผ่นประตู/ช่องว่าง vs ผนัง หรือพื้น vs ground) และ/หรือ shadow acne

## งาน
1. หาเรขาคณิตที่ทับระนาบกันในแลนด์มาร์กประตูชุมพล (`src/track/landmarks/` — site.ts / sites.ts / kit.ts / materials.ts) แล้ว **ถอยผิวหนึ่งออก (≥ 2–5 ซม. ตามระยะกล้อง) หรือเอาผิวที่ซ้ำออก** · ใช้ `polygonOffset` เฉพาะที่จำเป็น · ถ้าเป็น shadow acne ปรับ `shadow.bias` / `normalBias` ให้ไม่เกิด peter-panning
2. ไล่เช็คซุ้ม/โค้งอื่นทุกตัว + ลานย่าโม (`yamo.ts`, `statue.ts`) + ป้ายสปอนเซอร์/ด่าน/ป้ายบั้ง ที่วางชิดผนังหรือพื้น หาปัญหาเดียวกัน
3. ยืนยันแบบเฟรมต่อเฟรม: ใช้ demo mode (fixedDt=1, seed=1) ใน Playwright headless ที่ shot `pratu-chumphon`, `yamo-plaza`, `fly`, `menu` — แคปเฟรมติดกันหลายเฟรม แล้ว diff บริเวณช่องโค้ง **ต้อง ≈ 0** (ยกเว้นส่วนที่ขยับจริง เช่น ฝน/นีออนกะพริบ — ปิดฝนหรือวัดเฉพาะ ROI) · ทำทั้งก่อนแก้ (ยืนยันว่าเห็นปัญหา) และหลังแก้ · ทำทั้ง quality `mid` และ `high`
4. `pnpm typecheck && pnpm build && pnpm qa` ต้องผ่าน
5. bump `src/version.ts` เป็น `v0.3.1-build004` + เพิ่มบรรทัดใน `CHANGELOG.md`

## กติกา
- แก้เฉพาะที่จำเป็น ไม่เปลี่ยนอย่างอื่น (Mint จะอัดใหม่จาก production)
- ห้าม commit / push / deploy · ห้ามใช้พอร์ต 5199 · ปิด dev/preview server ของตัวเองก่อนจบ
- รายงานที่ `docs/dev/hotfix/REPORT-arch-flicker.md` สรุป ≤ 15 บรรทัดบนสุด: สาเหตุจริง · ไฟล์ที่แก้ · ตัวเลข diff ก่อน/หลังต่อ shot · ภาพเทียบก่อน/หลัง (เก็บใน `docs/dev/hotfix/` — ภาพจากเกมเท่านั้น)
