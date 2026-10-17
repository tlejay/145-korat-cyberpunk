# Making-of LOG — บันทึกเบื้องหลังการทำเกม (conductor จดเอง)

> ใช้ทำ content **long form** ลง madebytle.com: ใช้เทคโนโลยีอะไร · subagent pane กี่ตัว · ใครทำอะไร · ใช้เวลาเท่าไร
> เวลาเป็นเวลาไทย (ICT) · conductor = Claude Opus 5.5 ใน herdr tab `🏁 main` (workspace `145 KORAT Cyberpunk`)

## เครื่องมือ
- **herdr** — terminal workspace manager: 1 workspace ต่อโปรเจค, แต่ละ tab = Claude Code 1 ตัว (agent pane) · conductor สั่งงานด้วย `herdr tab create` → `herdr pane run` → `send-keys Enter` และเฝ้าสถานะผ่าน `herdr pane get` (working / done / blocked)
- **Claude Code + Opus 5.5** ทุก pane · **Codex/ChatGPT pane** (นอก workspace) สำหรับวาดภาพผ่าน `/kiki-gpt`
- **claude-in-chrome** — pane Street View คุม Chrome ดู Google Street View
- **OpenStreetMap / Overpass API**, Wikimedia Commons, web search
- three.js + Vite + TypeScript, Vercel CLI (deploy), GitHub `tlejay/145-korat-cyberpunk`

## Timeline

| เวลา | เหตุการณ์ | ใคร |
|---|---|---|
| 18:10 | Tle สั่งเริ่มโปรเจค: เกมแข่งรถลานย่าโม สไตล์ cyberpunk ยึดของจริงจาก Street View | Tle |
| 18:12 | ตัดสินใจ: OSM = เรขาคณิต, Street View = ภาพอ้างอิงเท่านั้น (ToS) · ไทยอย่างเดียว · มือถือ | Tle + conductor |
| 18:15 | สร้าง CLAUDE.md, SYNC.md, บรีฟ research, private repo, commit แรก | conductor |
| 18:15 | Tle เพิ่ม: รถต้องเป็น Tesla Roadster รุ่นใหม่ (กระโดด + ออกตัวเร็ว) กล้องท้ายรถ → เพิ่มบรีฟ car | Tle |
| 18:17 | เปิด 4 pane พร้อมกัน: 🔎 osm · 🔎 landmarks · 🔎 streetview · 🔎 car | conductor |
| 18:18 | Tle ประกาศบทบาท: conductor ห้ามทำงานเอง กระจายงาน+ตรวจงานเท่านั้น pane เสร็จแล้วปิด | Tle |
| 18:19 | streetview ถาม Chrome profile → conductor ถาม Tle แทน → DOSX | Tle |
| 18:20 | Tle เพิ่มงานเสียง → เปิด 🔎 audio (pane ที่ 5) · อนุญาตให้ใช้ GPT วาดภาพประกอบ | Tle + conductor |
| 18:22 | Tle สั่ง QA → เปิด 🧪 qa (pane ที่ 6) เป็นด่านก่อน production | Tle + conductor |
| 18:24 | 🔎 osm เสร็จ (7 นาที): ถนน 1,741 เส้น ตึก 1,087 หลัง · เสนอสนาม A/B/C → conductor ตรวจผ่าน · commit · ปิด tab | osm |
| 18:25 | 🔎 car เสร็จ (8 นาที): Roadster เปิดตัว 15 ต.ค. 2026 ที่ฐาน SpaceX · 3 รุ่น (Performance/Thrust/Rocket) · cold-gas thruster กระโดด ~7 ม. · blueprint สัดส่วน → ตรวจผ่าน · ปิด tab | car |
| 18:27 | Tle เลือก: รถฐานรุ่น Rocket · ไม่ใช้โลโก้ Tesla ตั้งชื่อเอง | Tle |
| 18:26 | Tle สั่งให้ทำ content making-of → เริ่ม LOG นี้ | Tle |

## Pane ทั้งหมด

| # | pane | งาน | เปิด | ปิด | ใช้เวลา | ผลลัพธ์ |
|---|---|---|---|---|---|---|
| 1 | 🔎 osm | ถนน/ตึก/คูเมืองจาก OSM + สนาม 3 แบบ | 18:17 | 18:24 | 7 นาที | `research/osm/` |
| 2 | 🔎 landmarks | แลนด์มาร์ก + ภาพ CC | 18:17 | | | |
| 3 | 🔎 streetview | เดินสำรวจ Street View | 18:17 | | | |
| 4 | 🔎 car | Tesla Roadster ข่าว/สเปก/รูปทรง | 18:17 | 18:25 | 8 นาที | `research/car/` |
| 5 | 🔎 audio | BGM + SFX | 18:21 | | | |
| 6 | 🧪 qa | test plan + release gate | 18:23 | | | |
