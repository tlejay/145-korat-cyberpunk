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
| 18:27 | 🧪 qa เสร็จ (7 นาที): test case 122 ข้อ 10 หมวด (🔴 77) · TEST-HOOKS (`window.__game`) · RELEASE-GATE · ชี้ความเสี่ยง 15 ข้อ เช่น ยังไม่มีคนดู game feel → ตรวจผ่าน · ปิด tab | qa |
| 18:29 | 🔎 landmarks เสร็จ (12 นาที): 17 แลนด์มาร์ก · ย่าโมหันหน้าตะวันตก สูง 1.85 ม. บนลาน 26×26 ม. · ประตูชุมพล 43×11 ม. · ภาพ CC 30 ภาพ → ตรวจผ่าน · ปิด tab | landmarks |
| 18:30 | Tle ตัดสิน: แบริเออร์นีออน · ตามวันเวย์ · ห้ามเข้าลาน · มีทั้ง iPhone/Android | Tle |
| 18:31 | Tle สั่งเพิ่ม leaderboard ไม่ต้องสมัคร ตั้งชื่อขิงได้ → เปิด ⚙️ backend (Vite scaffold + Vercel + Neon + API) และ 🎮 gameplay (ออกแบบการควบคุม/กล้อง/สูตรแต้ม ตามที่ QA เตือน) | Tle + conductor |
| 18:32 | 🔎 streetview เสร็จ (14 นาที): 44 ช่วง 8 ถนน ภาพแคป 46 ภาพ (ไม่ขึ้น git) · ถนนรอบลานเป็น 'หุบเหว' ตึกแถว 3–5 ชั้น · เจอ OSM ไม่ตรงของจริง 3 จุด → ตรวจผ่าน · ปิด tab | streetview |
| 18:33 | Tle สั่ง URL `madebytle.com/koratrocketcar` → ส่งงาน base path ให้ ⚙️ backend | Tle |
| 18:35 | Tle เลือกสนาม A วงคูเมือง 3.36 กม. → เปิด 🔎 streetview-A เก็บข้อมูลให้ครบวง · แจ้ง backend/gameplay | Tle + conductor |
| 18:38 | Tle ถามเรื่องฟิสิกส์ → conductor เสนอ 4 จุดโชว์จากข้อมูลจริง · Tle เลือกครบ 4 → เปิด 🧮 physics (คำนวณจากสเปกรถ + ขนาดคูเมือง พร้อมสคริปต์จำลองพิสูจน์ตัวเลข) | Tle + conductor |
| 18:41 | Tle ย้ำ: content จะโพสต์ Facebook → เปิด ✍️ content ร่างโพสต์ long form ตั้งแต่ตอนนี้ (อัปเดตทุก milestone) | Tle + conductor |
| 18:39 | ⚙️ backend ส่งงาน (9 นาที): Vite + three.js scaffold · API leaderboard 4 ตัว · base path /koratrocketcar · typecheck/build ผ่าน → **ติด: Tle ต้องกดยอมรับเงื่อนไข Neon บน Vercel** (pane หยุดเองตามบรีฟ ไม่กดแทน) | backend |
| 18:41 | 🎮 gameplay เสร็จ (10 นาที): ปุ่มซ้าย/ขวา + ตัวช่วยเลี้ยว · กล้อง 5.5 ม. FOV ตามค่า g · 2 แตะเริ่มเล่น · แต้ม = เวลา + โบนัสสไตล์ ≤ 20% · แบ่งงานกับ physics → ตรวจผ่าน · ปิด tab | gameplay |
| 18:42 | ✍️ content ร่างแรกเสร็จ (~1,600 คำ) → conductor จับได้ว่าแต่งข้อมูลส่วนตัว Tle ('เขยโคราช') ที่ไม่มีในแหล่งใด → สั่งตัด · ตรวจผ่าน · ปิด tab (เปิดใหม่ตอนอัปเดต) | content |
| 18:43 | 🔎 audio เสร็จ (22 นาที): เสียง CC0 72 ไฟล์ (Kenney/OpenGameArt/Freesound) · BGM 'Neon sign Circuit' · เสียงมอเตอร์ไฟฟ้า + พิณ สร้างด้วยโค้ด (Web Audio) · โหลดแรก ~1.2 MB · ยอมรับว่า 'ฟังเสียงไม่ได้' ต้องให้คนฟัง → ตรวจผ่าน · ปิด tab | audio |
| 18:44 | Tle ตัดสิน gameplay: 2 รอบ · กดเร่งเอง · แต้มเวลา+สไตล์ · ghost อันดับ 1 ออนไลน์ตั้งแต่ M1 → ส่งงาน ghost ให้ backend | Tle |
| 18:46 | Tle อนุญาตเสียงพากย์ภาษาอังกฤษ (นับถอยหลัง/รอบสุดท้าย) ให้ตื่นเต้น — ข้อความบนจอยังไทย | Tle |
| 18:26 | Tle สั่งให้ทำ content making-of → เริ่ม LOG นี้ | Tle |

## Pane ทั้งหมด

| # | pane | งาน | เปิด | ปิด | ใช้เวลา | ผลลัพธ์ |
|---|---|---|---|---|---|---|
| 1 | 🔎 osm | ถนน/ตึก/คูเมืองจาก OSM + สนาม 3 แบบ | 18:17 | 18:24 | 7 นาที | `research/osm/` |
| 2 | 🔎 landmarks | แลนด์มาร์ก + ภาพ CC | 18:17 | 18:29 | 12 นาที | `research/landmarks/` |
| 3 | 🔎 streetview | เดินสำรวจ Street View | 18:17 | 18:32 | 14 นาที | `research/streetview/` |
| 4 | 🔎 car | Tesla Roadster ข่าว/สเปก/รูปทรง | 18:17 | 18:25 | 8 นาที | `research/car/` |
| 5 | 🔎 audio | BGM + SFX | 18:21 | 18:43 | 22 นาที | `research/audio/` |
| 6 | 🧪 qa | test plan + release gate | 18:23 | 18:27 | 7 นาที | `docs/qa/` |
| 7 | ⚙️ backend | scaffold + Vercel + Neon + leaderboard API | 18:31 | | | |
| 8 | 🎮 gameplay | ออกแบบการควบคุม กล้อง ฟิสิกส์ สูตรแต้ม | 18:31 | 18:41 | 10 นาที | `docs/dev/GAMEPLAY.md` |
| 9 | 🔎 streetview-A | สำรวจสนาม A ทั้งวง + ไขข้อขัดแย้ง | 18:35 | | | |
| 10 | 🧮 physics | โมเดลฟิสิกส์ + 4 จุดโชว์ + sim | 18:38 | | | |
| 11 | ✍️ content | โพสต์ Facebook long form (ร่างแรก) | 18:41 | 18:42 | ~2 นาที + แก้ 1 รอบ | `docs/content/` |
| 12 | 🎙️ announcer | เสียงพากย์อังกฤษ CC0 | 18:47 | | | |
