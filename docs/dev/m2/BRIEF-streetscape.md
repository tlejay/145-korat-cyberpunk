# BRIEF M2 — 🏘️ streetscape: ตึกริมทาง + ของข้างถนนให้เหมือนโคราชจริง
อ่าน `CLAUDE.md` + `docs/dev/M1-CONTRACTS.md` + `docs/dev/REPORT-M1-world.md` + `research/streetview/REPORT.md` + `REPORT-track-A.md` + `segments.json` + `research/osm/REPORT.md` §3 · ภาพ `refs/streetview/` (ดูได้ ห้ามใช้เป็น texture) · ห้าม commit/deploy · typecheck+build ผ่าน + `docs/dev/REPORT-M2-streetscape.md`

**เจ้าของไฟล์:** `src/track/**` ยกเว้น `src/track/landmarks/**` (ของ landmarks-3d) + `src/scene/**` + `scripts/build-track.mjs` + `public/data/**` · ต่อ `buildLandmarks()` เข้า loadTrack เมื่อ landmarks-3d พร้อม (ตรวจโฟลเดอร์เป็นระยะ)
1. **ตึกแถวไทย (shophouse)** แทนกล่อง: โมดูลหน้าตึกตามประเภท/ชั้นใน segments.json — ชั้นล่างประตูเหล็กม้วน/หน้าร้าน กันสาด ระเบียง หน้าต่างเรียง ดาดฟ้ามีจานดาวเทียม/แท็งก์น้ำ · โรงแรม/ห้างยุค 80 · วัด · ตึกหุ้มตาข่ายเหล็ก · ใช้ instancing/atlas texture ที่สร้างด้วย canvas ในโค้ด (ยังไม่ใช้ภาพจาก GPT — M3)
2. **ของข้างถนน**: เสาไฟ เสาไฟฟ้า + **anchor ของสายไฟพันกัน** (จุดยึดสำหรับ physics-cables ใน M3 — export ตำแหน่ง), ไฟจราจรที่แยกจริง, ทางม้าลาย, เส้นถนน/เกาะกลางตามจำนวนเลนจริง, ต้นไม้ริมคู, รถจอดริมทาง (กล่อง low-poly) ตามที่ Street View เห็น
3. **anchor สำหรับ M3**: จุดวางป้ายร้านแนวตั้ง (blade sign) ร้านทอง โคมจีน ป้ายนีออน — export เป็นรายการตำแหน่ง+ขนาด ใน `public/data/track-A.json` ให้ M3 ใช้
4. ป้ายชื่อถนนจริง (ภาษาไทยด้วย Noto Sans Thai บน canvas): ราชดำเนิน ชุมพล จอมพล ราชสีมา-โชคชัย มนัส สรรพสิทธิ์ วัชรสฤษดิ์ กำแหงสงคราม ฯลฯ ตามที่ยืนยันแล้ว
5. งบรวมทั้งฉาก (รวมของ landmarks) ≤ 120 draw calls มุมขับจริง / ≤ 400k triangles · quality tier ลดของได้ · วัดแล้วเขียนใน REPORT
6. ภาพเทียบมุมขับ 5 จุดกับ Street View เก็บ `refs/m2/` · REPORT บอกเหมือน/ต่าง
