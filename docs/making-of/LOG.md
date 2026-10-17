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
| 18:48 | Tle เสนอให้ Mint (ผู้ช่วย AI อีกเครื่อง) พากย์ → ping-mint เปิด issue tlejay/mint#475 ขอเสียงพากย์ 10 คำ · pane announcer หา CC0 ไว้สำรอง | Tle + conductor |
| 18:50 | Mint ส่งเสียงพากย์ 2 ชุด (Charlie/Liam, ElevenLabs) กลับมาทาง pane → Tle ฟังแล้วเลือก Charlie | Mint + Tle |
| 18:52 | ⚙️ backend เสร็จรอบ 2: Neon (สิงคโปร์) · migrate · ghost อันดับ 1 (~2.8 KB) · ทดสอบโกงแต้ม 9 แบบถูกปัดตกครบ · พลาด 1 จุด: deploy แรกขึ้น production เอง (ยังไม่มีลิงก์สาธารณะชี้ไป) | backend |
| 18:52 | 🎙️ announcer เสร็จ (5 นาที): ชุดสำรอง Kenney CC0 · แผนซิงก์เสียงพากย์กับนับถอยหลัง + ลดเพลงตอนพากย์ | announcer |
| 18:57 | 🔎 streetview-A เสร็จ (22 นาที): +37 จุดทั้งวงสนาม · ไขข้อขัดแย้ง: ถนนเลียบคูเหนือคือ 'ราชสีมา-โชคชัย' (OSM ผิด) · ประตูชุมพลรถลอดไม่ได้ (OSM ถูก) · **พบว่าโค้งกลับ 148° ไม่มีจริง** (OSM routing ผิด) ของจริงเป็นสี่แยกเลี้ยวขวา ~95° · เจอจุดข้ามคูจริงที่ถนนมนัส น้ำกว้าง ~30 ม. | streetview-A |
| 18:59 | Tle เลือกตามของจริง: ดริฟต์ 95° ผ่านสี่แยก แทนโค้งกลับ 148° ที่ไม่มีจริง → แจ้ง physics | Tle |
| 19:02 | Tle สั่งเริ่ม M1 → conductor เขียนสัญญากลาง `docs/dev/M1-CONTRACTS.md` (เจ้าของไฟล์ + interface TypeScript) แล้วเปิด 4 pane พร้อมกัน: 🛣️ world · 🚗 car-model · 🎮 game-ui (integrator) · 🔊 audio-dev · ส่วน 🧮 physics จะต่อยอดเป็น car-physics | Tle + conductor |
| 19:03 | Tle อยากลองเล่นก่อน → สั่ง game-ui หยุดพักเมื่อขับครบวงได้ เพื่อ deploy preview ให้ลอง | Tle |
| 19:05 | Tle เปลี่ยนใจ: รอ milestone เสร็จทีเดียว ให้ conductor เฝ้าทีม → ยกเลิกการหยุดพักของ game-ui | Tle |
| 19:06 | Tle: M1–M3 ไม่ต้องรอตัดสินใจ conductor เลือกเองแล้วเดินต่อ · Tle รอดูที่ M4 ทีเดียว | Tle |
| 19:07 | Tle สั่ง: โพสต์ต้องไล่ทุก pane ที่เปิด-ปิดไป ว่าเปิดมาทำภารกิจอะไร ได้อะไรกลับมา → เพิ่มลงบรีฟ content | Tle |
| 19:09 | 🚗 car-model ส่งรอบ 1 (7 นาที): รถสร้างด้วยโค้ดล้วน 2,505 สามเหลี่ยม 6 draw call · ป้าย 'ไซเบอร์ 1 นครราชสีมา' → conductor เทียบภาพข่าวแล้ว **ไม่ผ่าน** ส่งกลับแก้ 6 ข้อ (ไฟท้ายต้องแดงเต็มแถบ แผงท้ายดำ ปีกโลหะ ยางหลัง หัวพ่นข้าง) · conductor ตั้งชื่อรถ 'ราชสีห์ R1' | car-model + conductor |
| 19:10 | 🧮 physics เสร็จ (32 นาที): sim พิสูจน์ตัวเลข · ยางอย่างเดียวได้แค่ 0.76 g ต้องพัดลมดูด + หัวพ่น 70 kN ถึงได้ 0–60 ใน 0.58 วิ · พบว่าข่าว '80 kN' กับ 'พ่น 5–6 วิ' จริงพร้อมกันไม่ได้ · ดริฟต์แยก 224 R56 ม. 122 กม./ชม. · ข้ามคูมนัส 28.6 ม. ไม่ใช่ทางลัด (ช้ากว่า 0.7 วิ) · สายไฟจริงแทบไม่ขยับ → ขยายลม ×8 · เพิ่ม landing burn แบบจรวด SpaceX → conductor ตัดสิน 3 ข้อตามแนะนำ แล้วให้ pane เดิมต่อยอดเป็น 🧮 car-physics | physics + conductor |
| 19:11 | 🔊 audio-dev เสร็จ (9 นาที): 31 ไฟล์ .ogg + .m4a · โหลดแรก 569 KB · มอเตอร์ synth 4 ชั้น 55→1,050 Hz · พากย์ Charlie ซิงก์นับถอยหลังด้วยนาฬิกาเสียง + ลดเพลง −8 dB · ทดสอบ Chrome+WebKit อัตโนมัติ → ตรวจผ่าน · ปิด tab | audio-dev |
| 19:15 | 🚗 car-model รอบ 2 (4 นาที): แก้ครบ 6 ข้อ ไฟท้ายแดงเต็มแถบ แผงท้ายดำ ปีกโลหะปลายเชิด หัวพ่นข้างล้อ 2 หัว · 2,759 สามเหลี่ยม 7 draw call → conductor เทียบภาพข่าวแล้วผ่าน (ผิวโลหะ/สะท้อนเก็บไว้ M3) · ปิด tab | car-model |
| 19:25 | 🧮 car-physics เสร็จ (14 นาที): ฟิสิกส์รถในเกม + เทสต์ headless 40/40 · launch 4.63 g 0–100 ใน 0.63 วิ · เจอรถหมุนเองตอนสลับเลี้ยว 120 กม./ชม. → เพิ่ม stability control · ~2 µs/step → ตรวจผ่าน (รันเทสต์ซ้ำเอง) · ปิด tab | car-physics |
| 19:29 | 🛣️ world เสร็จ (27 นาที): สนาม A 3,307 ม. จาก OSM+Street View เบี่ยงจากแผนที่จริงสูงสุด 3.07 ม. · แยก 224 เลี้ยวขวา 93° + กรวยนีออน · 33 checkpoint · ขอบลานย่าโมชนนุ่ม · ทั้งสนาม 47 draw calls / 51,617 สามเหลี่ยม (งบ 150/500k) · ข้อมูลแผนที่ 31 KB → ตรวจผ่าน · ปิด tab | world |
| 19:38 | 🎮 game-ui เสร็จ (36 นาที): เกมครบวงจร เมนู→นับถอยหลัง→2 รอบ→สรุป→leaderboard→เล่นใหม่ · ghost ตัวเอง + อันดับ 1 · autopilot ขับครบ 2 รอบใน Playwright · ปุ่ม+HUD 19% ของจอ · error ไทยครบ → ตรวจผ่าน · ปิด tab | game-ui |
| 19:40 | **M1 รวมเสร็จ** v0.2.0-build002 → conductor deploy preview · เปิด 🧪 qa-m1 ตรวจ + เริ่ม M2 คู่ขนาน: 🏛️ landmarks-3d · 🏘️ streetscape | conductor |
| 20:06 | 🏛️ landmarks-3d เสร็จ (25 นาที): ย่าโมบนฐานไพที 26×26 ม. หันตะวันตก ไฟสีทองนวลสว่างสุดในฉาก · ประตูชุมพลใบเสมา + หอรบแดงเลือดหมู + บันไดกันรถ · คูเมือง shader · แลนด์มาร์กรอง 7 จุด · 30 draw calls → conductor ดูภาพเองเรื่องความเคารพ ผ่าน (จดไว้: รูปหล่อยังผอมคล้ายหุ่น ขัดชุดไทย/ทรงผมใน M3) · ปิด tab | landmarks-3d + conductor |
| 20:08 | 🏘️ streetscape เสร็จ (27 นาที): ตึกแถวไทย 8 แบบ + เติม 156 คูหาย่านร้านทองที่ OSM ไม่มี · ร้านทองป้ายแดง 31 ร้าน (ชื่อสมมุติ) · เสาไฟ 70 เสาไฟฟ้า 100 สายไฟ 403 ช่วง ไฟจราจร 10 แยก ป้ายชื่อถนนไทย 18 ป้าย · จุดวางนีออน/โคม/สายไฟแกว่งเตรียมให้ M3 · มุมหนักสุด 53 draw calls → ตรวจภาพผ่าน · ปิด tab | streetscape |
| 20:08 | **M2 เสร็จ** (landmarks-3d + streetscape) | conductor |
| 20:11 | เริ่ม **M3 cyberpunk** คู่ขนานกับ QA-M1: 🖼️ art (สั่ง ChatGPT pane วาด texture นีออน/บิลบอร์ด/ฟ้า/ปก ไม่มีตัวอักษร) · 🌃 visuals (bloom แสงคืน ฝน ถนนเปียก ป้ายนีออนไทยตาม anchor 300+ จุด + integrator) · 💨 fx (สายไฟ 403 ช่วงแกว่ง โคม/ป้ายแกว่ง ไอพ่นแก๊ส ควันยาง) | conductor |
| 20:12 | Tle ชี้: ในข่าวตอนกระโดดมีควันขาว → conductor เพิ่มงานให้ 💨 fx: ดูภาพข่าว + คำนวณไอขาวจากฟิสิกส์จริง (แก๊สขยายตัวเย็นลง → ไอน้ำควบแน่น, ṁ = F/vₑ, ground effect แผ่รอบรถ) ห้ามมีไฟ | Tle + conductor |
| 20:14 | Tle ลองเล่น preview เจอบั๊ก: นับถอยหลังพากย์ 'Three, Three' → เปิด 🐞 fix (pane แก้บั๊กประจำ รับบั๊กจาก QA ด้วย) | Tle + conductor |
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
| 7 | ⚙️ backend | scaffold + Vercel + Neon + leaderboard API + ghost | 18:31 | 18:52 | 21 นาที (รอ Tle กดยอมรับ Neon คั่นกลาง) | `api/` `db/` `src/net/` |
| 8 | 🎮 gameplay | ออกแบบการควบคุม กล้อง ฟิสิกส์ สูตรแต้ม | 18:31 | 18:41 | 10 นาที | `docs/dev/GAMEPLAY.md` |
| 9 | 🔎 streetview-A | สำรวจสนาม A ทั้งวง + ไขข้อขัดแย้ง | 18:35 | 18:57 | 22 นาที | `research/streetview/REPORT-track-A.md` |
| 10 | 🧮 physics | โมเดลฟิสิกส์ + 4 จุดโชว์ + sim | 18:38 | 19:10 (ต่อยอดเป็น car-physics) | 32 นาที | `docs/dev/PHYSICS.md` `scripts/physics-sim.mjs` |
| 11 | ✍️ content | โพสต์ Facebook long form (ร่างแรก) | 18:41 | 18:42 | ~2 นาที + แก้ 1 รอบ | `docs/content/` |
| 12 | 🎙️ announcer | เสียงพากย์อังกฤษ CC0 | 18:47 | 18:52 | 5 นาที | `research/audio/REPORT.md` §8 |
| 13 | 🛣️ world | M1 สนาม A จาก OSM+Street View | 19:02 | 19:29 | 27 นาที | `src/track/` `src/scene/` `public/data/` |
| 14 | 🚗 car-model | M1 โมเดลรถ low-poly (ส่งกลับแก้ 1 รอบ) | 19:02 | 19:15 | 13 นาที | `src/car/model*.ts` |
| 15 | 🎮 game-ui | M1 game loop + ปุ่ม + HUD + integrator | 19:02 | 19:38 | 36 นาที | `src/game/` `src/input/` `src/ui/` |
| 16 | 🔊 audio-dev | M1 ระบบเสียง | 19:02 | 19:11 | 9 นาที | `src/audio/` `public/assets/audio/` |
| 17 | 🧮 car-physics | M1 โค้ดฟิสิกส์รถในเกม (pane เดิมของ physics) | 19:11 | 19:25 | 14 นาที | `src/car/physics*.ts` |
| 18 | 🧪 qa-m1 | QA ตรวจ M1 บน preview | 19:41 | | | |
| 19 | 🏛️ landmarks-3d | M2 ลานย่าโม ประตูชุมพล คูเมือง | 19:41 | 20:06 | 25 นาที | `src/track/landmarks/` |
| 20 | 🏘️ streetscape | M2 ตึกแถว ของข้างถนน ป้ายชื่อถนน | 19:41 | 20:08 | 27 นาที | `src/track/` `public/data/` |
| 21 | 🖼️ art | M3 ภาพประกอบจาก ChatGPT | 20:11 | | | |
| 22 | 🌃 visuals | M3 แสง นีออน ฝน + integrator | 20:11 | | | |
| 23 | 💨 fx | M3 สายไฟ/โคมแกว่ง + VFX รถ | 20:11 | | | |
| 24 | 🐞 fix | แก้บั๊ก (เริ่มจาก Three ซ้ำ) | 20:15 | | | |
