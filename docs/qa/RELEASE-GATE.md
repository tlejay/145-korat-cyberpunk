# RELEASE-GATE — ด่านก่อน `vercel deploy --prod`

> **กติกา:** ห้าม `vercel deploy --prod` จนกว่า QA จะรันด่านนี้กับ build ที่จะขึ้นจริง และ **ผ่านทุกข้อ 🔴** · มีรายงานใน `docs/qa/reports/` · ถ้า dev แย้งผล QA → conductor ตัดสิน (บันทึกเหตุผลในรายงาน)
> รายละเอียดวิธีทดสอบแต่ละ ID อยู่ใน `TEST-PLAN.md` · hook ที่ต้องมีอยู่ใน `TEST-HOOKS.md`

## ลำดับการตรวจ

1. **ล็อก build** — จด version (`src/version.ts`) + git commit hash · build ครั้งเดียว ใช้ตัวนี้ทั้ง QA และ prod
2. `pnpm typecheck && pnpm build` ผ่าน
3. `vercel deploy` (**preview** ไม่ใช่ prod) → ได้ preview URL → ทดสอบทั้งหมดบน URL นี้
4. `pnpm qa:static` + `pnpm qa` (Playwright ทุกโปรเจค) บน preview URL
5. มือถือจริง (Android REF-MID + iPhone) เปิด preview URL `?qa=1&hud=1`
6. เขียนรายงาน → ถ้าผ่าน 🔴 ครบ = conductor promote / deploy prod → QA รัน "หลังขึ้น prod" (ข้อ H) ซ้ำบน URL prod

## Checklist 🔴 (ต้องผ่านทุกข้อ)

| กลุ่ม | ID | เช็ค (ย่อ) |
|---|---|---|
| **A. build / hook** | — | typecheck + build ผ่าน · `?qa=1` มี `window.__game` ครบตาม TEST-HOOKS · ไม่มี `?qa=1` แล้วไม่มี `__game` |
| **B. ห้ามพลาดเด็ดขาด** | UI-04, ERR-08, LIC-07 | ไม่มี alert/confirm/prompt · 0 console error · 0 secret ใน `dist/` |
| | REAL-12, REAL-13, REAL-14 | 🙏 ชนอนุสาวรีย์ไม่ได้ · ไม่มีอะไรล้อเลียนย่าโม · แสงอนุสาวรีย์เด่นสุด (Tle เคยอนุมัติภาพลาน) |
| | LIC-01..05 | ทุก asset มีที่มา + license ใช้ได้ · ไม่มีภาพ Google / ภาพข่าว / NC · เรื่องโลโก้ Tesla ตัดสินแล้ว |
| **C. ขับได้ สนุก** | FEEL-01, 03, 05, 06, 07, 08 | latency p95 ≤ 50 ms · boost/jump ตามค่าออกแบบ · ดริฟต์ควบคุมได้ · ไม่หมุนติ้ว |
| | FEEL-10, 11 | กล้องไม่วูบ · ไม่ทะลุตึก (insideMesh = 0) |
| | FEEL-13..18 | ชนไม่ติด (stuck < 2 วิ) · ไม่ตกโลก · ขอบสนามชัด · ตัดทางไม่ได้ · จับเวลาแม่น |
| | FEEL-19 | playtest 5 คน "อยากเล่นอีก" ≥ 4.0 (เฉพาะ release ที่มีการเปลี่ยน handling/สนาม — ระบุในรายงาน) |
| **D. มือถือ** | MOB-01..08, 10, 12 | ปุ่ม ≥ 48 px ไม่บังวิว · multi-touch · ไม่ zoom/scroll · iOS + Android เล่นครบ 3 รอบ · แนวนอน · safe-area · เสียง unlock · สลับแอปแล้วกลับมาเล่นต่อได้ |
| **E. ประสิทธิภาพ** | PERF-01, 03, 04 | REF-MID `fpsP5` ≥ 30 ทุกจุด · draw call ≤ 150 |
| | PERF-06, 07, 10, 11 | Fast 4G เมนู ≤ 5 วิ · โหลดแรก ≤ 8 MB · ไม่มี leak 10 รอบ · Safari ไม่ถูก kill |
| **F. ของจริง** | REAL-01, 02, 03, 05, 06, 07, 08, 10, 11 | อนุสาวรีย์ ≤ 1 ม. · สนามเบี่ยง OSM ≤ 5 ม. · ลำดับถนนถูก · คูเมือง · ประตูชุมพล · footprint/ความสูงตึก · ชื่อถนน/สถานที่ไทยถูก 100% |
| **G. ภาพ / เสียง / UI / error** | VIS-01, 03, 04, 05, 06 | HUD contrast ≥ 4.5:1 · เห็นทาง ≥ 2 วิ · กะพริบ ≤ 3 ครั้ง/วิ · ไม่มีตัวอักษรมั่ว · รถดูออก |
| | AUD-01..04, 07 | เสียงติด · pitch เนียน · loop ไร้รอยต่อ · ปุ่มปิดเสียง · หยุดเมื่อออกแอป |
| | UI-01, 02, 03, 06, 07, 08 | ไทยล้วน · กม./ชม. th-TH · ฟอนต์ไทยไม่ลอย · version ตรง · หน้าเครดิตมี OSM · pause ใช้ได้ |
| | ERR-01..05 | WebGL ไม่รองรับ · แผนที่โหลดไม่ได้ + ลองใหม่ · จอแนวตั้ง · fps ต่ำ · context lost — ข้อความไทย `role=alert` ไม่มีข้อความดิบ |
| **H. หลังขึ้น prod** | DEP-01, 02, 03, 05 | 200 ทุก URL · 0 console error / 4xx-5xx · cache header ถูก · version บน prod = build ที่ตรวจ |

ข้อ 🟡 ที่ไม่ผ่าน: ขึ้นได้ แต่ต้องลิสต์ในรายงานพร้อม "แก้ใน build ไหน" · 🟡 ที่ค้างเกิน 2 release ติด → QA เสนอยกเป็น 🔴

**ข้อยกเว้น:** release ที่ยังไม่มีบางระบบ (เช่น M1 ยังไม่มีเสียง/ประตูชุมพล) → ข้อนั้นใส่ `N/A` พร้อมเหตุผล · conductor ต้องเห็นชอบในรายงาน · ข้อในกลุ่ม **B** ห้าม N/A เด็ดขาด

## รูปแบบรายงาน — `docs/qa/reports/YYYY-MM-DD-<build>.md`

ตัวอย่างชื่อ: `docs/qa/reports/2026-10-24-v0.1.0-build003.md`

```markdown
# QA Report — v0.1.0-build003 · 2026-10-24

## ผล: ✅ ผ่าน | ❌ ไม่ผ่าน (ห้ามขึ้น prod)
- 🔴 ผ่าน x/y · ❌ ไม่ผ่าน n ข้อ: <ID, ID> · N/A m ข้อ (เหตุผลด้านล่าง)
- 🟡 ไม่ผ่าน k ข้อ: <ID> · 🟢 <สั้น ๆ>
- สรุป 1–3 บรรทัด: อะไรดีขึ้น/แย่ลงจาก build ก่อน

## สิ่งที่ตรวจ
- commit: `<hash>` · preview URL: <url> · prod URL (หลังขึ้น): <url>
- เครื่อง: Android <รุ่น / Chrome เวอร์ชัน> · iPhone <รุ่น / iOS เวอร์ชัน> · desktop <เบราว์เซอร์>
- สนาม: <A/B/C> · quality: <ค่าเริ่มต้น>

## ตัวเลขหลัก
| ตัวชี้วัด | build นี้ | build ก่อน | เกณฑ์ |
|---|---|---|---|
| fps median / P5 (REF-MID) | | | ≥55 / ≥30 |
| frameMs P99 | | | ≤50 |
| draw calls สูงสุด | | | ≤150 |
| triangles สูงสุด | | | ≤500k |
| โหลดแรก (MB) / เวลาเมนูพร้อม Fast 4G (วิ) | | | ≤8 / ≤5 |
| input latency p95 (ms) | | | ≤50 |
| heap หลัง 10 รอบ (% โต) | | | ≤10% |
| สนามเบี่ยง OSM สูงสุด (ม.) | | | ≤5 |

## ไม่ผ่าน (เรียงตามความรุนแรง)
### <ID> — <ชื่อ> 🔴
- ขั้นตอนทำซ้ำ: 1. … 2. …
- ผลที่ได้ vs เกณฑ์: …
- หลักฐาน: `docs/qa/reports/assets/<build>/<ไฟล์>` (screenshot/วิดีโอ/log JSON)
- ตำแหน่งในเกม: x, z (+ lat/lng) · ส่งกลับ pane: <ชื่อ pane dev>

## N/A + เหตุผล (conductor เห็นชอบ: ☐)

## ผลทุกข้อ
| ID | ระดับ | ผล (✅/❌/N/A) | ค่าที่วัด | หมายเหตุ |
|---|---|---|---|---|
```

ภาพ/วิดีโอหลักฐานเก็บที่ `docs/qa/reports/assets/<build>/` (ห้ามมีภาพจาก Google Street View — ถ้าต้องเทียบ ให้อ้างชื่อไฟล์ใน `refs/` แทน)
