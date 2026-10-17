# BRIEF M1 — 🛣️ world: สนาม A จากข้อมูลจริง
อ่าน CLAUDE.md + docs/dev/M1-CONTRACTS.md (สัญญากลาง — ห้ามแก้ไฟล์นอกโฟลเดอร์ที่เป็นเจ้าของ) + docs/dev/GAMEPLAY.md ก่อน · ห้าม commit/push/deploy · จบด้วย pnpm typecheck && pnpm build ผ่าน + REPORT ตามสัญญา
อ่านเพิ่ม: research/osm/REPORT.md · research/streetview/REPORT-track-A.md + segments.json · research/landmarks/REPORT.md + landmarks.json + footprints.geojson

1. `scripts/build-track.mjs` (รันซ้ำได้) แปลง OSM + Street View → `public/data/track-A.json` (บีบอัด เล็กที่สุด): เส้นกลางถนนตามสนาม A **ฉบับแก้แล้ว** (เลี้ยวขวา ~95° ที่สี่แยกหัวราชดำเนิน ไม่ใช่โค้งกลับ 148° · ไม่วิ่งสวนวันเวย์) ความกว้าง/เลนจาก Street View, ทางเท้า/ขอบทาง, แบริเออร์ 24 จุดตามรายงาน, คูเมือง (water), ตึก: footprint OSM + ความสูงจาก Street View (ช่วงที่ OSM ไม่มีตึก ~970 ม. ให้สร้างจาก segments.json), checkpoints (รวมทางลัดข้ามคูถนนมนัส ~track_m 1,180), startGrid นอกเขตลาน, zones ลาน/ประตู
2. `src/track/`: `loadTrack('A', scene)` ตาม interface — สร้าง mesh ถนน (ribbon), ตึก extrude แล้ว **merge ต่อบล็อก**, คูเมือง, แบริเออร์นีออน (สีเรืองแสงพื้นฐาน), แลนด์มาร์กหยาบ: อนุสาวรีย์บนลาน 26×26 ม. หันหน้าตะวันตก (ไม่ต้องปั้นละเอียด แต่สัดส่วนตรง), ประตูชุมพล 43×11 ม. + กำแพงใบเสมา, Terminal 21 บนขอบฟ้า · `heightAt/surfaceAt` เร็ว (grid lookup)
3. `src/scene/`: ฉากกลางคืนพื้นฐาน แสง ฟ้า หมอก (ยังไม่ต้อง bloom/ฝน) · quality tier ลดระยะมองเห็น/รายละเอียด
4. ตรวจงบ: นับ draw calls / triangles ของทั้งสนามแล้วเขียนใน REPORT
5. ทำหน้า debug `?qa=1&view=top` มองสนามจากด้านบนเทียบแผนที่ (เช็คว่าแนวถนนตรงของจริง ≤ 5 ม. ตาม QA REAL)
