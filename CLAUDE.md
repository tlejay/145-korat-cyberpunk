# CLAUDE.md — 145 KORAT Cyberpunk (ชื่อเกม: **โคราชโรสเตอร์** / Korat Roadster)

> บันทึกงานร่วม (สถานะล่าสุด / งานค้าง / ต้องตัดสินใจ): `SYNC.md` — อ่านก่อนเริ่มทุก session
> repo: `tlejay/145-korat-cyberpunk` · branch `main` · เปิดใช้ 2026-10-17

## 1. ภาพรวม

- **ทำอะไร:** เกมแข่งรถ 3D บนเว็บ มุมกล้องแบบ Need for Speed (third-person หลังรถ) วิ่งบน **ถนนจริงรอบลานย่าโม (อนุสาวรีย์ท้าวสุรนารี) จ.นครราชสีมา** ตกแต่งสไตล์ **cyberpunk** (นีออน ฝน กลางคืน ป้ายไฟ) แต่ **โครงสร้างต้องตรงของจริงมากที่สุด** — แนวถนน ความกว้าง แลนด์มาร์ก รูปทรงตึก
- **เป้าหมาย:** โชว์ศักยภาพการทำเกมของ Claude Opus 5.5 → เล่าเรื่องลง madebytle.com
- **ผู้เล่น:** คนไทย เล่นบน **มือถือเป็นหลัก** (จอแนวนอน ปุ่มสัมผัส) · UI **ภาษาไทยอย่างเดียว**
- **รถของผู้เล่น:** Tesla Roadster รุ่นใหม่ (เปิดตัว ~ต.ค. 2026) — มี **กระโดด** และ **ออกตัวเร็ว (boost)** ตามความสามารถรถจริง · กล้องมองท้ายรถ ไม่มีมุมในรถ · สเปกและรูปทรงต้องมาจาก `research/car/` (ศึกษาข่าวก่อนปั้นเสมอ) · ภาพข่าวใช้อ้างอิงปั้น low-poly เท่านั้น ห้ามแปะเป็น texture
  - ตัดสินใจ 2026-10-17: ฐานความสามารถ = รุ่น **Rocket** (กระโดด + boost ใช้เกจถังลมร่วมกัน) · **ไม่ใส่โลโก้/ชื่อ Tesla ในเกม** ชื่อรถในเกม **ราชสีห์ R1** (conductor เลือก 19:10) ป้ายทะเบียน **"MADEBYTLE"** (Tle สั่ง 20:23) · หน้าเครดิตเขียน "ได้แรงบันดาลใจจาก Tesla Roadster (2026) ไม่มีส่วนเกี่ยวข้องกับ Tesla, Inc."
- **Leaderboard (Tle สั่ง 2026-10-17):** เล่นได้ทันทีไม่ต้องลงทะเบียน · ทำแต้มติดอันดับแล้วค่อยให้ตั้งชื่อเพื่อ "ขิง" คนอื่น · ไม่มีบัญชีผู้ใช้ — ผูกกับเครื่องด้วย id ใน localStorage · บรีฟ `docs/dev/BRIEF-leaderboard.md`
- **สนามแรก = A วงคูเมือง 3.36 กม.** (Tle เลือก 2026-10-17) — `research/osm/track-A.geojson` · ราชดำเนิน↑ → เลี้ยวขวา ~95° ที่สี่แยกเข้าถนนราชสีมา-โชคชัย (ทาง 224 เลียบคูเหนือ — OSM เรียกผิดว่ามิตรภาพ) → มนัส↓ → สรรพสิทธิ์ → วัชรสฤษดิ์↓ → กำแหงสงคราม → ราชดำเนิน↑ · track_id = `A`
- **โชว์ฟิสิกส์ 4 จุด (Tle เลือก 2026-10-17):** กระโดดข้ามคูเมือง · ออกตัว 4.6g + พัดลมดูดพื้น · ดริฟต์เลี้ยวขวา ~95° ผ่านสี่แยกใหญ่หัวราชดำเนิน (เดิมเข้าใจว่าโค้งกลับ 148° — Street View ยืนยันว่าไม่มีจริง Tle เลือกตามของจริง 18:59) · ฝน + สายไฟ/โคม/ป้ายแกว่งตามแรงลม — ตัวเลขทุกค่าคำนวณจากรถจริง/ถนนจริง สเปกที่ `docs/dev/PHYSICS.md`
- **ตัดสินใจ gameplay 2026-10-17:** ~~2 รอบ~~ → **รอบเดียว** (Tle สั่ง 21:14 "นานเกินไป") · กดเร่งเอง (เร่งอัตโนมัติเป็นสวิตช์ในตั้งค่า) · แต้ม = เวลา + โบนัสสไตล์ ≤ 20% · **ghost อันดับ 1 ออนไลน์ใส่ตั้งแต่ M1** (เก็บ ghost ใน DB ~6 KB/คน) — รายละเอียด `docs/dev/GAMEPLAY.md`
- **สปอนเซอร์ในเกม (Tle สั่ง 20:23):** ซุ้มเส้นสตาร์ท ป้ายเลียบแบริเออร์ บิลบอร์ด แบบสนาม F1 — เฉพาะ **MADEBYTLE** และ **สมาคมดิจิทัลนครราชสีมา** (โลโก้สมาคมฯ Tle ส่งตามมา) · ห้ามติดบนอนุสาวรีย์/ประตู/วัด/ในเขตลาน · `src/sponsors/`
- **ด่านตรวจแอลกอฮอล์ (Tle สั่ง 20:30):** อุปสรรคให้กระโดดข้าม หรือชนแล้วของกระเด็น (ไม่ใช่ blocker) · **ไม่มีตัวคน** · ไม่ใช้ตราหน่วยงานจริง · มุกขำไม่ล้อเจ้าหน้าที่ ไม่ส่งเสริมเมาแล้วขับ · `src/checkpoint/`
- **จุดสตาร์ท (Tle สั่ง 20:55):** อยู่ใต้ลานย่าโมบนราชดำเนิน ออกตัวแล้ววิ่งผ่านหน้าลานในไม่กี่วินาทีแรก แล้วเจอด่านตรวจแรกไว้ลองกระโดด
- **ป้ายเตือนทางเลี้ยว (Tle สั่ง 21:14):** ป้ายบั้งเหลือง-ดำแบบไทยสไตล์ LED ก่อนทุกโค้ง + ลูกศร HUD — ให้คนเล่นใหม่รู้ทาง · `src/wayfinding/`
- **ห้ามขับทะลุประตูชุมพล** (ของจริงรถลอดไม่ได้ — บันได+รั้ว · บ้านย่าโม) · จุดกระโดดข้ามคูเมือง = ถนนมนัส คันดินข้ามคูเหนือ น้ำกว้าง ~30 ม. ที่ track_m ≈ 1,180 (`research/streetview/REPORT-track-A.md`)
- **ตัดสินใจแล้ว 2026-10-17:** สนามปิดด้วยแบริเออร์นีออนตามทางแยก (ไม่ใช่ open world) · วิ่งตามทิศวันเวย์จริงเท่าที่ทำได้ · **ห้ามขับเข้าลานย่าโม** วิ่งผ่านบนถนนเท่านั้น มีแนวกั้น ห้ามกระโดดในเขตลาน · เครื่องทดสอบจริงมีทั้ง iPhone และ Android
- **นอกขอบเขต (รอบแรก):** multiplayer สด, ระบบบัญชีผู้ใช้/ล็อกอิน, ร้านค้า

## 2. หลักการ "ของจริง" — อ่านก่อนแตะ asset ทุกครั้ง

| แหล่ง | ใช้ทำอะไร | ห้าม |
|---|---|---|
| **OpenStreetMap** (ODbL) | เรขาคณิตจริง: แนวถนน จำนวนเลน คูเมือง footprint ตึก → แปลงเป็นโมเดลในเกม | — ต้องใส่ credit "© OpenStreetMap contributors" ในหน้าเครดิต |
| **Google Street View / Google Maps** | **ภาพอ้างอิงเท่านั้น** ให้คน/agent ดูแล้วปั้นโมเดล จด สี วัสดุ ป้าย ความสูงตึก | ❌ ห้ามเอาภาพ/texture/mesh จาก Google เข้าเกมหรือ commit ลง repo (ผิด ToS) · ภาพแคปเก็บที่ `refs/` ซึ่ง gitignore ไว้ |
| **Wikimedia Commons / Mapillary** | ภาพอ้างอิงเพิ่ม · ใช้ในเกมได้ถ้า license อนุญาต (CC-BY / CC-BY-SA) — ต้องจด license + ผู้ถ่ายลง `research/CREDITS.md` | ห้ามใช้ภาพที่ไม่รู้ license |
| **`/kiki-gpt`** | texture / ป้ายนีออน / skybox / concept art ที่ "แต่ง" สไตล์ cyberpunk | ❌ ห้ามให้ imagegen เขียนตัวอักษรไทย — ป้ายชื่อถนน/ร้านให้เรนเดอร์ด้วยฟอนต์จริงในเกม |

ความจริงก่อนความสวย: ถ้า cyberpunk ขัดกับโครงสร้างจริง (เช่น อยากได้ตึกสูง 40 ชั้นตรงที่จริงเป็นตึกแถว 3 ชั้น) → ให้ตึกจริงอยู่ แล้วแต่งด้วยป้ายไฟ/โฮโลแกรม/สายไฟแทน
อนุสาวรีย์ท้าวสุรนารีเป็นที่เคารพของคนโคราช — **ห้ามทำให้ชน/ทำลาย/ล้อเลียน** ให้เป็นจุดศูนย์กลางที่ได้แสงสวยที่สุดในฉาก

## 3. Tech Stack

| Layer | ใช้ | หมายเหตุ |
|---|---|---|
| Build | Vite + TypeScript | static + Vercel Functions ใน `api/` (leaderboard เท่านั้น) |
| Database | Neon Postgres (ผ่าน Vercel Marketplace) · Drizzle | ตาราง leaderboard · env มาจาก `vercel env pull` |
| 3D | three.js (WebGL2) | post-processing: bloom สำหรับนีออน · ต้องลื่นบนมือถือกลาง ๆ (เป้า 60fps, ขั้นต่ำ 30fps) |
| ฟิสิกส์รถ | arcade physics เขียนเอง (raycast vehicle) | ไม่ต้องสมจริงระดับ sim — เน้นดริฟต์สนุกแบบ NFS |
| ข้อมูลแผนที่ | OSM → `scripts/` แปลง GeoJSON → JSON ที่เกมโหลด (`public/data/`) | พิกัดแปลงเป็นเมตรจากจุดศูนย์กลาง = อนุสาวรีย์ |
| UI / ฟอนต์ | HTML overlay · Noto Sans Thai · Heroicons (ห้าม emoji) | |
| Hosting | Vercel CLI | ไม่ผูก Git |
| Package manager | pnpm | |

## 4. Folder Structure

```
src/                 game source (scene, car, track, ui, input)
public/data/         processed map data loaded by the game
public/assets/       models / textures ที่ใช้ได้ตาม license
scripts/             OSM fetch + convert pipeline
research/            ผลสำรวจ (md + geojson + CREDITS.md) — commit ได้
refs/                ภาพแคป Street View อ้างอิง — gitignored ห้าม commit
docs/research/       บรีฟของ research pane แต่ละตัว
```

## 5. Commands

```bash
pnpm dev · pnpm typecheck · pnpm build · pnpm preview
```

## 6. Deploy

- **ใช้ Vercel CLI — push ไม่ใช่ deploy** · `vercel deploy --prod --yes` แล้ว `curl -s -o /dev/null -w '%{http_code}' <url>` ต้องได้ 200
- **URL จริง: `https://madebytle.com/koratrocketcar`** (Tle สั่ง 2026-10-17) — madebytle.com (`00 Madebytle Profile/madebytle`, Next.js) proxy `/koratrocketcar/*` → โปรเจค Vercel ของเกม · เกมใช้ Vite `base: '/koratrocketcar/'` + rewrite `/koratrocketcar/(.*)` → `/$1` ฝั่งเกม · แก้ฝั่ง madebytle ต้องอ่าน CLAUDE.md ของโปรเจคนั้นก่อน
- ก่อน deploy production: ต้องผ่าน QA gate (หัวข้อ 10) · เปิดในมือถือจริง (หรือ Chrome device mode แนวนอน) เช็คว่ากดเล่นได้ + fps ไม่ตก

## 7. Security & Credentials

- ตอนนี้ไม่มี secret (OSM / Overpass ไม่ต้องใช้ key) · ถ้าภายหลังใช้ Mapillary / Google Maps API ให้เก็บที่ `~/.config/<ชื่อ>.env` แล้วเติมตาราง Credentials ใน CLAUDE.md root
- ใน repo มีแค่ `.env.example` · เช็ค secret 2 ชั้นก่อน `git add`

## 8. Conventions

- โค้ด/comment อังกฤษ · คุยกับ Tle ไทย · สรุปท้ายงาน ≤ 10 บรรทัด
- Versioning: `v{MAJOR}.{MINOR}.{PATCH}-build{NNN}` ใน `src/version.ts` → แสดงที่หน้าเมนู · บันทึก `CHANGELOG.md`
- ตัวเลขในเกม (เวลา ความเร็ว) ใช้ `th-TH` · ความเร็วเป็น กม./ชม.
- typecheck + build ผ่านก่อน commit · auto commit + push ตามกฎ root
- ชื่อสถานที่/ถนนในเกมใช้ชื่อไทยตามป้ายจริง (ยืนยันจาก OSM `name` + Street View)

## 9. Error ที่ผู้ใช้เห็น (ห้ามตัดหัวข้อนี้)

- ❌ ห้าม `alert()` / `confirm()` / `prompt()` · ห้ามข้อความดิบจากระบบ (WebGL error, stack trace, "Failed to fetch")
- ภาษาไทยเท่านั้น (ข้อยกเว้นเดียว: **เสียงพากย์ภาษาอังกฤษ** เช่น "3, 2, 1, GO!", "Final lap" ใช้ได้ — Tle อนุญาต 2026-10-17 เพื่อความตื่นเต้น · ข้อความบนจอยังเป็นไทย · ใช้ชุด **Charlie** ที่ Mint ทำด้วย ElevenLabs แพลนฟรี = ไม่เชิงพาณิชย์ + เครดิต "เสียงพากย์: ElevenLabs" · สำรอง Kenney CC0) · บอกว่าต้องทำอะไรต่อ เช่น "เครื่องนี้เปิดกราฟิก 3D ไม่ได้ ลองเปิดด้วย Chrome หรือ Safari เวอร์ชันล่าสุด"
- กรณีที่ต้องออกแบบไว้: WebGL ไม่รองรับ · โหลดข้อมูลแผนที่ไม่สำเร็จ (มีปุ่ม "ลองใหม่") · จอแนวตั้ง (บอกให้หมุนจอ) · fps ต่ำมาก (เสนอลดคุณภาพกราฟิก)
- หน้าตาตาม design ของเกม (นีออน cyberpunk) · `role="alert"` สำหรับข้อความ error

## 10. Conductor + Agent panes (herdr) — กติกาหลักของโปรเจคนี้

Tle สั่ง 2026-10-17: **Claude ใน tab ซ้ายสุด (`🏁 main`) = วาทยากร (conductor) เท่านั้น — ห้ามลงมือทำงานเอง**
- Tle คุยงานผ่าน conductor คนเดียว · conductor แตกงาน → เขียนบรีฟ `docs/<หมวด>/BRIEF-*.md` → เปิด tab ใหม่ใน workspace `145 KORAT Cyberpunk` รัน Claude เป็นลูกน้อง → ตรวจงาน → commit/push/deploy รวม → สรุปให้ Tle
- งานที่ conductor ทำเองได้: เขียน/แก้บรีฟ, CLAUDE.md, SYNC.md, ตรวจผลงาน (อ่านไฟล์ รัน typecheck/build ตรวจ), git commit/push, ตัดสินใจถาม Tle — **ห้ามเขียนโค้ดเกม/ปั้นโมเดล/ทำ research เอง**
- ตรวจงานไม่ผ่าน → ส่งกลับ pane เดิม (ถ้ายังเปิด) หรือเปิด pane ใหม่พร้อมบรีฟแก้
- ลูกน้องทำงานเสร็จ = เขียนผลลงไฟล์ตามบรีฟ (สรุปบนสุด) แล้วจบ turn → conductor อ่านรายงาน → **ปิด tab ของลูกน้องทิ้งได้เลย** (`herdr tab close`) ไม่ต้องถาม Tle
- เปิด pane: `herdr tab create --workspace w54 --cwd <โปรเจค> --label "<emoji> <งาน>" --no-focus` → `herdr pane run <pane> "claude --permission-mode bypassPermissions '<สั่งงาน>'"` → `send-keys Enter` → pane ใหม่จะถามว่าเชื่อถือโฟลเดอร์ไหม: ส่ง `Down` แล้ว `Enter` → รอจนขึ้น `working`
- **ภาพประกอบคุณภาพสูง** (texture, skybox, ป้ายนีออน, หน้าโหลด, ไอคอน UI, concept art) → ลูกน้องสั่ง `/kiki-gpt` ให้ pane ChatGPT วาด แล้วก๊อปเข้า `public/assets/` — Tle อนุญาตแล้ว 2026-10-17 · ตัวอักษรไทยบนภาพให้ใส่ทีหลังด้วยฟอนต์จริง · ส่งงานวาดทีละ pane (ChatGPT มีตัวเดียว)
- **QA pane = ด่านก่อน production** — ห้าม `vercel deploy --prod` จนกว่า QA จะรันตาม `docs/qa/RELEASE-GATE.md` แล้วผ่านทุกข้อ 🔴 · รายงานอยู่ `docs/qa/reports/` · ผล QA แย้ง dev ได้ conductor เป็นคนตัดสิน
- **Tle สั่ง 2026-10-17 19:06: M1–M3 ไม่ต้องรอ Tle ตัดสินใจ** — conductor เลือกตัวเลือกที่แนะนำ (Recommended) เองแล้วเดินต่อ จดทุกการตัดสินใจลง `docs/making-of/LOG.md` + SYNC.md ให้ Tle ย้อนดูได้ · Tle จะดูงานทีเดียวตอน **M4** · ยกเว้นเรื่องที่ irreversible / เสียเงิน / เผยแพร่สาธารณะ (เช่น deploy production, แก้ madebytle.com) ยังต้องถาม
- **Tle อนุญาต 2026-10-17 21:02 (ก่อนเข้านอน):** "ทดสอบให้ด้วย เอาให้เสร็จ deploy ขึ้น madebytle.com ได้เลย" → conductor ทำ M3 ให้จบ + QA ผ่าน 🔴 ทุกข้อที่ทดสอบอัตโนมัติได้ → `vercel deploy --prod` เกม + แก้ madebytle.com ให้ proxy `/koratrocketcar` + deploy madebytle → ตรวจ 200 ทั้งคู่ · ข้อที่ต้องใช้มือถือจริงเก็บไว้ M4 checklist ให้ Tle ตอนตื่น
- **รายงานสถานะให้ Mint เป็นระยะ (Tle สั่ง 21:38):** comment ใน `tlejay/mint#476` (ใบเดียว ไม่เปิดใหม่) ทุก milestone/เหตุการณ์สำคัญ หรืออย่างน้อยทุก ~30–45 นาที — Mint ส่งต่อให้ Tle ทาง Discord
- ลูกน้อง **ห้าม commit / push / deploy** · ใช้ Chrome ได้ **ทีละ pane** เท่านั้น
- **Making-of content:** conductor จดทุกเหตุการณ์ (เวลา · pane ไหนเปิด/ปิด · ทำอะไร · ผล) ลง `docs/making-of/LOG.md` ทันทีที่เกิด — pane `✍️ content` เขียนโพสต์ **Facebook long form** จาก LOG นี้ (`docs/content/`) — ร่างแรกตั้งแต่ระหว่างทำ แล้วเรียกอัปเดตทุก milestone + ตอนจบ (Tle สั่ง 2026-10-17)
- workspace id อาจเปลี่ยน — `herdr workspace list` ก่อนทุกครั้ง

## 11. Gotchas (เติมเมื่อเจอจริง พร้อมวันที่)

- 2026-10-17 conductor: ตอนกดยืนยัน trust ของ pane ใหม่ ให้ส่ง `Down`+`Enter` **เฉพาะ pane id ที่เพิ่งสร้าง** — อย่าวนส่งทุก pane ที่ไม่ใช่ working (เคยหลุดไปโดน pane ที่เพิ่งเสร็จ)
- 2026-10-17 conductor: อย่า `git add -A` ระหว่างที่ pane อื่นยังเขียนไฟล์ — จะ commit งานครึ่ง ๆ กลาง ๆ ของ pane นั้น · add เฉพาะ path ของ pane ที่ตรวจผ่านแล้ว
- 2026-10-17 backend: `vercel deploy` ครั้งแรกของโปรเจคใหม่ขึ้น **production** เองโดยอัตโนมัติ — ใช้ `vercel deploy --target=preview` เสมอจนกว่าจะผ่าน QA gate
- preview กับ production ใช้ Neon DB ตัวเดียวกัน → ทดสอบบน preview ใช้ track `test` แล้วลบทิ้งทุกครั้ง · preview มี Vercel deployment protection (curl ได้ 302)
- 2026-10-17 conductor: pane ที่ปิดไปทิ้ง dev server ค้าง (car-model preview จอง localhost:5199) → Tle เปิดเกมแล้วเจอแต่โมเดลรถ · **พอร์ต 5199 สงวนให้ conductor เปิดให้ Tle เล่น** · pane ต้องปิด dev/preview server ของตัวเองก่อนจบ turn และห้ามใช้พอร์ต 5199
- ภาพ Wikimedia ส่วนใหญ่ CC BY-SA → texture ที่ทำจากภาพเหล่านี้ต้องปล่อยเป็น CC BY-SA และเครดิตผู้ถ่าย

## "สร้างรูป" = `/kiki-gpt` เสมอ — ไม่ใช่การเขียน HTML
