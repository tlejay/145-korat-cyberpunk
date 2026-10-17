# BRIEF — OSM: โครงถนนจริง + ตัวเลือกสนามแข่ง

อ่าน `docs/research/README.md` ก่อน

## เป้าหมาย
ดึงเรขาคณิตจริงรอบลานย่าโมจาก OpenStreetMap ให้เกมสร้างถนน/คูเมือง/ตึกได้ และเสนอเส้นทางแข่ง

## งาน
1. ใช้ Overpass API (`https://overpass-api.de/api/interpreter`) ดึงใน bbox: `highway=*` (พร้อม `name`, `name:en`, `lanes`, `oneway`, `width`, `surface`), `building=*` (พร้อม `height`, `building:levels`), `waterway`/`natural=water` (คูเมือง), `historic`/`tourism`/`memorial` (อนุสาวรีย์ ประตูชุมพล กำแพงเมือง), `leisure=park`, `landuse`
2. เขียนสคริปต์ที่รันซ้ำได้ `scripts/fetch-osm.mjs` (Node 24, ไม่ต้องลง package) เซฟ raw → `research/osm/raw.json` และแยกเป็น GeoJSON: `roads.geojson`, `buildings.geojson`, `water.geojson`, `landmarks.geojson`
3. เขียน `research/osm/REPORT.md`:
   - พิกัดจริงของอนุสาวรีย์ (จุดศูนย์กลางเกม)
   - ตารางถนนหลักในพื้นที่: ชื่อไทย / ชื่ออังกฤษ / เลน / one-way / ความยาวในพื้นที่
   - สถิติตึก: จำนวน, กี่ % มี height/levels, ถ้าไม่มีควรเดาความสูงยังไง
   - **เสนอสนามแข่ง 3 แบบ** (วงปิด 1.5–3.5 กม.) ผ่านลานย่าโมทุกแบบ บอกลำดับถนน ความยาว จำนวนโค้ง จุดเด่น (เช่น ผ่านประตูชุมพล เลียบคูเมือง) ข้อเสีย และ export เส้นทางแต่ละแบบเป็น `track-A.geojson` / `-B` / `-C`
   - ข้อสังเกต: ถนนที่ OSM ข้อมูลน่าสงสัย ให้ pane Street View ไปตรวจ
4. ใส่ credit: `© OpenStreetMap contributors (ODbL)` ใน REPORT
