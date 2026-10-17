# Research panes — กติการ่วม

ทุก pane อ่าน `CLAUDE.md` ของโปรเจค (โดยเฉพาะหัวข้อ 2 "หลักการของจริง") ก่อนเริ่ม แล้วทำตามบรีฟของตัวเอง

- **พื้นที่สำรวจ:** รัศมี ~700 ม. รอบอนุสาวรีย์ท้าวสุรนารี (ลานย่าโม) ประมาณ 14.9750 N, 102.0980 E — ยืนยันพิกัดจริงจาก OSM ก่อนใช้
- **bbox ตั้งต้น:** south 14.968, west 102.090, north 14.982, east 102.106 (ขยายได้ถ้าเส้นทางแข่งเลยออกไป)
- **ภาษา:** เขียนรายงานเป็นไทย ชื่อไฟล์/คีย์ JSON เป็นอังกฤษ
- **ความจริงก่อน:** ทุกข้อเท็จจริง (ชื่อถนน ความสูง จำนวนเลน) ต้องบอกแหล่ง — OSM tag / ลิงก์ Street View (`https://www.google.com/maps/@lat,lng,3a,...`) / Wikimedia URL ถ้าไม่แน่ใจเขียน `[ยังไม่ยืนยัน]`
- **ห้าม** commit / push / deploy — pane หลักรวบรวมเอง
- **ห้าม** เอาภาพจาก Google ลง `research/` (ไปที่ `refs/` ซึ่ง gitignore)
- เสร็จแล้วเขียนสรุป ≤ 15 บรรทัดไว้บนสุดของไฟล์รายงานหลัก แล้วจบ turn (pane หลักจะมาอ่าน)

| บรีฟ | ผลลัพธ์ | ใช้ Chrome |
|---|---|---|
| `BRIEF-osm.md` | `research/osm/` | ไม่ |
| `BRIEF-landmarks.md` | `research/landmarks/` | ไม่ (web search + Wikimedia) |
| `BRIEF-streetview.md` | `research/streetview/` + `refs/streetview/` | **ใช่ — ตัวเดียว** |
| `BRIEF-car.md` | `research/car/` + `refs/car/` | ไม่ (web search) |
| `BRIEF-audio.md` | `research/audio/` | ไม่ (web search + ดาวน์โหลด CC0) |
