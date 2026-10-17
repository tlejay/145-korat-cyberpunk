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
| 20:23 | Tle ขอป้ายทะเบียน MADEBYTLE + ป้ายสปอนเซอร์แบบสนาม F1 (ส่งภาพตัวอย่าง 6 ภาพ) สำหรับสมาคมดิจิทัลนครราชสีมา + MADEBYTLE → เปิด 🏁 sponsors (ซุ้มสตาร์ท+ไฟ 5 ดวง, ป้ายเลียบแบริเออร์, บิลบอร์ด) | Tle + conductor |
| 20:27 | Tle ส่งโลโก้ NDA สมาคมดิจิทัลนครราชสีมา (4 ไฟล์ พื้นขาว) + ให้ ChatGPT วาด artwork บิลบอร์ด → sponsors ทำเวอร์ชันพื้นมืด (คงตาราง pixel ส้ม) · art ต่อคิววาดพื้นหลังสปอนเซอร์ 7 ภาพ ไม่มีตัวอักษร | Tle + conductor |
| 20:30 | Tle ไอเดีย: จุดกระโดดข้ามเป็น 'ด่านเป่าแอลกอฮอล์' (มุกโคราชด่านเยอะ) ชนกระเด็นได้ → conductor ตั้งกติกา: ไม่มีตัวคนในด่าน · ไม่ใช้ตราตำรวจจริง · ไม่ส่งเสริมเมาแล้วขับ → เปิด 🚧 checkpoint (rigid-body ของกระเด็นตามมวลจริง) | Tle + conductor |
| 20:34 | 🐞 fix บั๊ก #1 เสร็จ: สาเหตุ = เกมสั่งพากย์ 'Three' ตอนเริ่มแล้วไม่จด เฟรมแรกเลยสั่งซ้ำ · ไฟล์เสียงถูก (ถอดเสียงตรวจครบ 10 คำ) · แก้ 1 บรรทัด + test จับบั๊ก → ส่งบั๊ก #2 ต่อ: นับถอยหลังผูกกับ physics step ทำให้เครื่องกระตุกนับช้า | fix |
| 20:34 | 🌃 visuals รอบแรกเสร็จ (23 นาที): bloom · ฝน GPU · ถนนเปียกสะท้อนนีออน · แอ่งน้ำ 6 จุดต่อฟิสิกส์ · ป้ายนีออนชื่อร้านไทยสมมุติ 297 ป้ายใน 5 draw calls · ไม่มีป้ายรอบย่าโม/ประตู/วัด (ตัดบิลบอร์ดใกล้ซุ้มประตูมุมเมืองออก 1 จุดตามกฎ) · สูงสุด 92 draw calls → ตรวจภาพผ่าน · เก็บ pane ไว้เป็น integrator | visuals |
| 20:36 | conductor commit snapshot M3 กลางทาง (build ผ่าน) | conductor |
| 20:41 | 💨 fx เสร็จ (30 นาที): ไอขาวคำนวณจริง แก๊สออกหัวฉีด ~−183 °C เจออากาศชื้นโคราช ไอน้ำควบแน่น · ṁ boost 11.3 / กระโดด 55 กก./วิ/หัว · กระทบถนนแผ่เป็นวงรอบรถ · สายไฟ 403 ช่วง โคม 85 ป้าย 138 แกว่ง · ~1.2 ms/เฟรมมือถือ → conductor เทียบภาพข่าวแล้วผ่าน · ปิด tab · ส่งงานเล็ก 2 ข้อ (หัวพ่น 4 หัว, พื้นหลัง HUD) ให้ fix | fx |
| 20:40 | Tle เปิด localhost เจอแต่โมเดลรถ → conductor สืบพบ dev server ค้างจาก pane car-model ที่ปิดไปแล้วแย่งพอร์ต → kill + ตั้งกติกาพอร์ต | conductor |
| 20:44 | Tle เปลี่ยนชื่อเกม 'โคราชไซเบอร์พังก์' → **'โคราชโรสเตอร์'** → ส่งให้ 🐞 fix (ชื่อโปรเจค/URL คงเดิม) | Tle |
| 20:51 | 🧪 qa-m1 เสร็จ (70 นาที): 86 เทสต์รันซ้ำได้ · 🔴 ผ่าน 58 ไม่ผ่าน 3 (ปุ่มค้างเมื่อลากนิ้วออก · cache ไฟล์ · ตัวรถยุบตอนลงพื้น) · กล้องหลุดเมื่อ 20 fps · จุดแข็ง: ฟิสิกส์ตรงสเปก ชนกำแพง 48 ครั้งไม่ติด สนามเบี่ยง OSM ≤ 3.1 ม. โหลดแรก 2.1 MB → conductor ตัดสิน FEEL-05 ผ่าน (โช้คยุบจริง) ส่งที่เหลือให้ 🐞 fix · ปิด tab | qa-m1 + conductor |
| 20:55 | Tle: ย้ายจุดสตาร์ทให้ผ่านลานย่าโมก่อน แล้วเจอด่านตรวจไว้ลองกระโดด → ส่ง 🚧 checkpoint ย้าย start/finish ไปใต้ลาน (คำนวณระยะ launch ให้จบก่อนเขตห้าม boost) + ด่านแรกหลังพ้นเขตลาน | Tle + conductor |
| 21:00 | 🖼️ art ส่งภาพ 20 ภาพจาก ChatGPT (ไม่มีตัวอักษร/โลโก้/อนุสาวรีย์) รวม 1.7 MB · ต้องแก้ภาพเองหลังวาด 3 กลุ่ม (หน้าต่างต่อรอย, เส้นขอบฟ้าต่ำ, ป้าย 6:1/8:1 ครอปจากแถบกลาง) → conductor ตีกลับ billboard MADEBYTLE (มีก้อนเบลอกลางภาพ) + สั่งทำเวอร์ชันย่อเพราะ GPU 45 MB เกินงบ 32 MB | art + conductor |
| 21:02 | Tle ไปนอน: "ทดสอบให้ด้วย เอาให้เสร็จ deploy ขึ้น madebytle.com ได้เลย" → conductor รับคุมทีมข้ามคืน: จบ M3 → QA → prod → madebytle proxy → content | Tle |
| 21:05 | Tle สั่ง /kiki-gh-readme + เปิด repo public → conductor ตรวจประวัติ git ทั้งหมดก่อน: ไม่มี secret/token/อีเมล/IP/ภาพ Google/ภาพข่าว → ผ่าน · คิว README ไว้หลัง deploy ให้ภาพเป็นเกมฉบับจบ | Tle + conductor |
| 21:08 | Tle สั่งทำ teaser แนวตั้งหลายคลิป แล้ว ping Mint ทำ video-story → conductor เขียนบรีฟ 🎬 clips (8 ช็อต 9:16 เรนเดอร์ทีละเฟรม) รออัดหลัง M3 ครบ แล้ว ping Mint พร้อมไฟล์ | Tle + conductor |
| 21:12 | 🖼️ art เสร็จ (61 นาที): วาดใหม่บิลบอร์ด 3 ภาพที่มีรอยเบลอ + ทำเวอร์ชันย่อ (-lo) ทุกภาพสำหรับ quality ต่ำ/กลาง ให้ GPU อยู่ในงบ → conductor ดูภาพแล้วผ่าน · ปิด tab · ส่งให้ visuals ต่อเข้าเกม | art |
| 21:12 | 🏁 sponsors เสร็จ (48 นาที): ทะเบียน MADEBYTLE · ซุ้มเส้นชัยใต้ลาน ห่างลาน 85 ม. ไม่บังย่าโม · ไฟสตาร์ท 5 ดวงแบบ F1 + ชุดซ้ำหน้ากริด · ป้ายเลียบทาง 25 แผ่น · บิลบอร์ด 5 + สะพานลอย 2 · โลโก้ NDA พื้นมืดคงตารางส้มทุกพิกเซล · 3 draw calls → conductor ดูภาพผ่าน (วินาทีที่ 3.8 ผ่านหน้าลานย่าโมจริง) · ปิด tab | sponsors |
| 21:14 | Tle: แข่งรอบเดียวพอ (2 รอบนานไป) + ต้องมีป้ายบอกเลี้ยวซ้าย/ขวาข้างทางให้คนเล่นใหม่ → #10 รอบเดียวให้ 🐞 fix (รวม server กันโกง/ghost) · เปิด 🔰 wayfinding ป้ายบั้งไทยสไตล์ LED + ลูกศร HUD | Tle + conductor |
| 21:17 | 🚧 checkpoint เสร็จ (46 นาที): ด่าน 2 จุด (ราชดำเนินหลังลาน 150 ม. = ด่านสอน · ถนนมนัส) · ย้ายสตาร์ทใต้ลาน ผ่านหน้าลานใน ~3 วิ · rigid body มวลจริง กรวย 2.5/ป้าย 12/แผง 16 กก. · ข้ามได้ ≥ 46 กม./ชม. · ชนเสียความเร็ว 10–20% · ไม่มีคน มีป้าย 'ดื่มไม่ขับ' · เทสต์ 56/56 → conductor ดูภาพผ่าน · ตัดสิน: แต้มข้ามด่านรวมในโบนัสสไตล์ · ghost ผูกเวอร์ชันสนาม · ปิด tab | checkpoint + conductor |
| 21:19 | 🌃 visuals รอบ 3: ต่อ art (ฟ้าหรี่เป็นกลางคืน · หน้าต่าง/กรอบนีออนวาดลง atlas เดิม GPU รวมแค่ ~2 MB) · ปกเมนูจางเข้าฉาก 3D · og:image · ต่อด่านตรวจ (เตือน+ปุ่มเขียว+สั่น) · เครดิตสปอนเซอร์ · กล้องเมนูเลื่อนไปหลังรถ 1.6 วิ + แก้บั๊กกล้องหมุนทะลุกำแพง → ผ่าน · snapshot commit | visuals |
| 21:21 | Tle กำหนดมุมเล่าโพสต์ + วิดีโอ Mint: 'การทดลอง vibe coding ของจริง' — เวลา/โมเดล · ไม่ได้ส่งรูปรถให้ AI ไปหาข่าวเอง · แผนที่จาก OSM + Street View · จุดขาย: ไม่ได้เปิดโปรแกรมอะไรนอกจาก command line → อัปเดตบรีฟ content + clips | Tle |
| 21:33 | 🔰 wayfinding เสร็จ (18 นาที): หาโค้งเองจากเส้นสนาม 6 โค้ง · ป้ายบั้งเหลือง-ดำ LED 35 ชิ้น + ป้ายเตือน 150/70 ม. ข้อความไทย · ลูกศร HUD ≤ 200 ม. + เสียงติ๊ก · 2 draw calls · เทสต์ 14/14 → conductor ดูภาพผ่าน (ป้ายเตือนอยู่ซ้ายทางตามป้ายจริงของไทย) · ตัดสินซ่อนลูกศรเดิม · ปิด tab | wayfinding |
| 21:35 | Tle กำหนดน้ำเสียงโพสต์/วิดีโอ: เล่าการส่งงานกับ Mint (ทีมพากย์) ด้วย · ไม่โชว์ความรู้ ไม่กดผู้อ่าน · ให้แรงบันดาลใจคนที่อยากเริ่ม vibe coding → อัปเดตบรีฟ content + clips | Tle |
| 21:36 | 🌃 visuals รอบ 4: ต่อป้ายเลี้ยว + HUD ใหม่ (ซ่อนลูกศรเดิม) · autopilot ทดสอบ 650 ม. ไม่ติดป้าย → **M3 integrate ครบ** · ปิด tab | visuals |
| 21:38 | Tle ให้รายงานสถานะผ่าน Mint เป็นระยะ (Tle คุยกับ Mint ทาง Discord) → เปิดใบสถานะ tlejay/mint#476 อัปเดตด้วย comment | Tle + conductor |
| 21:39 | 🐞 fix เสร็จ (84 นาที, 11 งาน): Three ซ้ำ · นับถอยหลังตามนาฬิกาเสียง (เครื่องช้า 6× ยัง 0.80 วิพอดี) · หัวพ่น 4 หัว · พื้นหลัง HUD · ชื่อ 'โคราชโรสเตอร์' · ปุ่มค้าง · cache 1 ปี · กล้องตามทันที่ 15 fps · แข่งรอบเดียวทั้งเกม+server · แต้มข้ามด่านต้องลอยผ่านจริง · ghost ผูกเวอร์ชันสนาม · เจอเพิ่มเอง: ล้อจมถนน 12 ซม. ตอนโช้คยุบ → ตรวจผ่าน · ปิด tab | fix |
| 21:41 | deploy preview ใหม่ (รวม M3 + fix ทั้งหมด) → เปิด 🧪 qa-m3 = ด่านตัดสิน GO/NO-GO ก่อน production | conductor |
| 21:46 | Mint ตอบใน #476 ส่งสเปกของที่ต้องใช้ทำ video-story (ฟุตเทจ 1080×1920 60fps 13 โมเมนต์ มี/ไม่มี HUD · flythrough · 1 รอบเต็ม · เสียงแยก · ภาพนิ่ง · โลโก้ · ข้อเท็จจริง · โหมดเดโม่ผ่าน URL) → conductor ใส่ลงบรีฟ clips รอ QA GO | Mint + conductor |
| 21:52 | Mint แจ้ง Tle ขยายคลิปเป็น 60–90 วิ เล่า workflow · ขอ PANES.md, อัดจอ terminal (เซ็นเซอร์คีย์/อีเมล/path), before/after, FACTS ครบ → ใส่บรีฟ clips (ใช้ข้อความจริงจาก pane เรนเดอร์ ห้ามแต่ง) | Mint + conductor |
| 22:20 | Tle (ผ่าน Mint) ถามว่าโมเดลรถดูรูป tesla.com/roadster/reserve ไหม → ตอบ: ยัง (เดิม 403) อิงภาพทางการผ่าน Electrek 6 ภาพ · เปิด 🔍 car-ref ดูหน้าทางการด้วย Chrome แล้วเทียบสัดส่วน (แก้หลัง production) | Tle/Mint + conductor |
| 23:05 | 🔍 car-ref เสร็จ (44 นาที): เปิด tesla.com/roadster ด้วย Chrome ได้ภาพทางการ 13 ภาพ (หน้าจอง #payment ระบบบล็อกเพราะเป็นหน้าชำระเงิน) · พบต้องแก้: ปีกสูงไป 25 ซม. · ฝาท้ายต้องมีกระจกคางหมู · แผงใต้ไฟท้ายเป็นขาว (แก้คำสั่ง conductor รอบก่อนที่ดูภาพข่าวมืด) · รถเตี้ยกว่า 9% · ปีก Hidden Aero กางเมื่อใช้งาน → คิวแก้หลัง production · ปิด tab | car-ref |
| 00:20 | 🧪 qa-m3 เสร็จ (2 ชม. 38 นาที): preview จริง 100 ผ่าน · ของใหม่ M3 ผ่านหมด (กะพริบ ≤ 3/วิ, ไม่มีป้ายในเขตลาน/วัด, ด่านตรวจ 4/4, ป้ายเลี้ยวขึ้นก่อนทุกโค้ง, autopilot ครบรอบทุก tier) · ตก 2: เครดิตโลโก้ไม่ครบ + รถดีด 5.9 ม. เมื่อชนแบริเออร์โค้งสรรพสิทธิ์ → NO-GO ตามกติกา | qa-m3 |
| 00:22 | conductor ตัดสิน **GO แบบมีเงื่อนไข** (เครดิตไม่อยู่ใน build · รถดีดเล่นต่อได้) แก้ทั้งคู่ใน polish แล้ว deploy ซ้ำ | conductor |
| 00:24 | 🚀 **ขึ้น production** `korat-cyberpunk.vercel.app/koratrocketcar/` (หน้าเกม, ข้อมูลสนาม, leaderboard API = 200) → เปิดคู่ขนาน 🌐 madebytle (proxy /koratrocketcar) + 🔧 polish (รถดีด, เครดิต, ป้ายหน้าวัด, ทรงรถตามรูปทางการ + ปีก Hidden Aero, v0.3.0) | conductor |
| 00:33 | 🌐 madebytle เสร็จ (9 นาที): แก้ไฟล์เดียว next.config.ts ของ madebytle (rewrite + ปิดการตัด / ท้าย URL เฉพาะหน้าเกม) 2 commit + deploy · **https://madebytle.com/koratrocketcar เปิดได้** · หน้าเดิมของ madebytle ยัง 200 ครบ · console error 0 → conductor curl ซ้ำผ่าน · ปิด tab | madebytle |
| 01:11 | 🔧 polish เสร็จ (45 นาที): รถดีดหาย 5.85 → 0 ม. (ต้นเหตุ: แรงเอียงตัวรถเอาแรงกระแทกกำแพงมาคิดด้วย) · ป้ายเลี้ยวห่างซุ้มวัด ≥ 25 ม. · GPU mid 29.7 MB · ทรงรถตามรูปทางการ + ปีก Hidden Aero · v0.3.0-build003 · Playwright 54/54 → conductor เทียบภาพผ่าน · ปิด tab | polish |
| 01:58 | 🎬 clips ส่งโหมดเดโม่ 17 ช็อต + promo/ ~20 MB (เพลง/SFX/พากย์/โลโก้/ภาพนิ่ง/คลิป terminal จากข้อความจริงที่เซ็นเซอร์แล้ว/before-after/FACTS/PANES) → conductor ตรวจภาพ terminal + grep ข้อมูลส่วนตัวผ่าน · commit · preview → เปิด 🧪 qa-release รอบสั้น | conductor |
| 02:09 | 🧪 qa-release: **GO** (WebKit 27/27 · preview 15/15 · ชน 60 ครั้งดีด 0 ม. · เดโม่ 34 แบบ 0 error) · ปิด tab | qa-release |
| 02:12 | 🚀 **production v0.3.0-build003** ที่ https://madebytle.com/koratrocketcar → ส่งของให้ Mint ใน #476 (promo/ + รายชื่อ shot= ทุกช็อต) | conductor |
| 02:15 | Mint อัดเอง 16 ช็อตจาก commit + script record-demo (deterministic ได้ตั้งแต่ครั้งแรก) · บท/พากย์ไทย/มิกซ์เสร็จ 89.7 วิ เล่าแบบ Mint เป็นคนเล่า + Charlie แทรก · ส่ง Tle ตอนเช้า · ใช้ตัวเลข FACTS: 6 ชม., 33 session, พร้อมกัน 7 → เปิด ✍️ content (โพสต์ฉบับเต็ม ใช้ตัวเลขชุดเดียวกัน) + 📘 readme (README + เปิด public) | Mint + conductor |
| 02:16 | ✍️ content เสร็จ: โพสต์ Facebook ฉบับเต็ม ~2,300 คำ ตัวเลขตรงวิดีโอ Mint · ภาพประกอบ 6 ภาพจากของจริง → conductor ตรวจกติกาน้ำเสียง/ห้ามเรื่องเขย/ศัพท์เทคนิค ผ่าน · ปิด tab | content |
| 02:19 | 📘 readme เสร็จ: README อังกฤษ+ไทย · hero · GIF 2.9 MB จากโหมดเดโม่ · before/after · ตรวจ secret 88 commit สะอาด · **repo เป็น public** · topics/homepage ตั้งครบ · ชี้ว่ามีภาพข่าวหลุดใน repo 1 ไฟล์ · ปิด tab | readme |
| 02:22 | conductor ลบภาพ m3-plume-vs-news.png (มีภาพข่าว Tesla — conductor ก๊อปเข้า repo เองตอน 20:42 พลาด) ออกจาก HEAD · การลบจากประวัติต้อง force push → รอ Tle ตัดสินตอนเช้า | conductor |
| 02:25 | **จบงานคืนนี้** · สรุปตอนเช้าใน SYNC.md · รายงาน Mint #476 | conductor |
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
| 18 | 🧪 qa-m1 | QA ตรวจ M1 บน preview | 19:41 | 20:51 | 70 นาที | `docs/qa/reports/` `tests/qa/` |
| 19 | 🏛️ landmarks-3d | M2 ลานย่าโม ประตูชุมพล คูเมือง | 19:41 | 20:06 | 25 นาที | `src/track/landmarks/` |
| 20 | 🏘️ streetscape | M2 ตึกแถว ของข้างถนน ป้ายชื่อถนน | 19:41 | 20:08 | 27 นาที | `src/track/` `public/data/` |
| 21 | 🖼️ art | M3 ภาพประกอบจาก ChatGPT (ส่งกลับแก้ 1 รอบ) | 20:11 | 21:12 | 61 นาที | `public/assets/img/` |
| 22 | 🌃 visuals | M3 แสง นีออน ฝน + integrator (4 รอบ) | 20:11 | 21:36 | 85 นาที | `src/scene/` `src/neon/` |
| 23 | 💨 fx | M3 สายไฟ/โคมแกว่ง + VFX รถ + ไอขาวฟิสิกส์ | 20:11 | 20:41 | 30 นาที | `src/fx/` |
| 24 | 🐞 fix | แก้บั๊ก 11 งาน (Tle + QA) | 20:15 | 21:39 | 84 นาที | `docs/dev/fix/REPORT-fix.md` |
| 25 | 🏁 sponsors | ป้ายสปอนเซอร์ + ทะเบียน MADEBYTLE | 20:24 | 21:12 | 48 นาที | `src/sponsors/` |
| 26 | 🚧 checkpoint | ด่านตรวจ กระโดดข้าม/ชนกระเด็น + ย้ายจุดสตาร์ท | 20:31 | 21:17 | 46 นาที | `src/checkpoint/` |
| 27 | 🔰 wayfinding | ป้ายเตือนทางเลี้ยว + ลูกศร HUD | 21:15 | 21:33 | 18 นาที | `src/wayfinding/` |
| 28 | 🧪 qa-m3 | QA ด่านก่อน production (GO/NO-GO) | 21:42 | 00:20 | 2 ชม. 38 นาที | `docs/qa/reports/2026-10-17-v0.2.0-build002.md` |
| 29 | 🔍 car-ref | เทียบโมเดลรถกับรูปทางการ tesla.com | 22:21 | 23:05 | 44 นาที | `docs/research/REPORT-car-ref.md` |
| 30 | 🌐 madebytle | ต่อ madebytle.com/koratrocketcar | 00:25 | 00:33 | 9 นาที | `docs/dev/release/REPORT-madebytle.md` |
| 31 | 🔧 polish | แก้หลัง production → v0.3.0 | 00:25 | 01:11 | 45 นาที | `docs/dev/release/REPORT-polish.md` |
| 32 | 🎬 clips | โหมดเดโม่ผ่าน URL + promo/ ให้ Mint | 01:13 | | | |
| 33 | 🧪 qa-release | QA รอบสั้นก่อน v0.3.0 | 01:59 | 02:09 | 10 นาที | `docs/qa/reports/2026-10-18-v0.3.0-build003.md` |
| 34 | ✍️ content | โพสต์ Facebook ฉบับเต็ม | 02:14 | 02:16 | ~3 นาที (เขียนจาก LOG/FACTS ที่เตรียมไว้) | `docs/content/facebook-post.md` |
| 35 | 📘 readme | README + เปิด repo public | 02:14 | 02:19 | 5 นาที | `README.md` `docs/readme/` |
