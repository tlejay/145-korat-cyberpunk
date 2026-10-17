# CLAUDE.md — 145 KORAT Cyberpunk

> บันทึกงานร่วม (สถานะล่าสุด / งานค้าง / ต้องตัดสินใจ): `SYNC.md` — อ่านก่อนเริ่มทุก session
> repo: `tlejay/145-korat-cyberpunk` · branch `main` · เปิดใช้ 2026-10-17

## 1. ภาพรวม

- **ทำอะไร:** เกมแข่งรถ 3D บนเว็บ มุมกล้องแบบ Need for Speed (third-person หลังรถ) วิ่งบน **ถนนจริงรอบลานย่าโม (อนุสาวรีย์ท้าวสุรนารี) จ.นครราชสีมา** ตกแต่งสไตล์ **cyberpunk** (นีออน ฝน กลางคืน ป้ายไฟ) แต่ **โครงสร้างต้องตรงของจริงมากที่สุด** — แนวถนน ความกว้าง แลนด์มาร์ก รูปทรงตึก
- **เป้าหมาย:** โชว์ศักยภาพการทำเกมของ Claude Opus 5.5 → เล่าเรื่องลง madebytle.com
- **ผู้เล่น:** คนไทย เล่นบน **มือถือเป็นหลัก** (จอแนวนอน ปุ่มสัมผัส) · UI **ภาษาไทยอย่างเดียว**
- **รถของผู้เล่น:** Tesla Roadster รุ่นใหม่ (เปิดตัว ~ต.ค. 2026) — มี **กระโดด** และ **ออกตัวเร็ว (boost)** ตามความสามารถรถจริง · กล้องมองท้ายรถ ไม่มีมุมในรถ · สเปกและรูปทรงต้องมาจาก `research/car/` (ศึกษาข่าวก่อนปั้นเสมอ) · ภาพข่าวใช้อ้างอิงปั้น low-poly เท่านั้น ห้ามแปะเป็น texture
  - ตัดสินใจ 2026-10-17: ฐานความสามารถ = รุ่น **Rocket** (กระโดด + boost ใช้เกจถังลมร่วมกัน) · **ไม่ใส่โลโก้/ชื่อ Tesla ในเกม** ตั้งชื่อรถเอง ป้ายทะเบียนไทยสไตล์โคราช · หน้าเครดิตเขียน "ได้แรงบันดาลใจจาก Tesla Roadster (2026) ไม่มีส่วนเกี่ยวข้องกับ Tesla, Inc."
- **นอกขอบเขต (รอบแรก):** multiplayer, ระบบบัญชีผู้ใช้, ร้านค้า, ฐานข้อมูล

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
| Build | Vite + TypeScript | static site — ไม่มี backend |
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
- โดเมน: ยังไม่มี (ใช้ `*.vercel.app` ไปก่อน) — บันทึก URL จริงลง `SYNC.md` หลัง deploy ครั้งแรก
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
- ภาษาไทยเท่านั้น · บอกว่าต้องทำอะไรต่อ เช่น "เครื่องนี้เปิดกราฟิก 3D ไม่ได้ ลองเปิดด้วย Chrome หรือ Safari เวอร์ชันล่าสุด"
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
- ลูกน้อง **ห้าม commit / push / deploy** · ใช้ Chrome ได้ **ทีละ pane** เท่านั้น
- **Making-of content:** conductor จดทุกเหตุการณ์ (เวลา · pane ไหนเปิด/ปิด · ทำอะไร · ผล) ลง `docs/making-of/LOG.md` ทันทีที่เกิด — ท้ายโปรเจคเปิด pane `✍️ content` เขียนบทความ **long form** เล่าเบื้องหลังจาก LOG นี้ (Tle สั่ง 2026-10-17)
- workspace id อาจเปลี่ยน — `herdr workspace list` ก่อนทุกครั้ง

## 11. Gotchas (เติมเมื่อเจอจริง พร้อมวันที่)

- <ว่างไว้ก่อน>

## "สร้างรูป" = `/kiki-gpt` เสมอ — ไม่ใช่การเขียน HTML
