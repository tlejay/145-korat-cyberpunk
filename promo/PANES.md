# PANES — ไทม์ไลน์ทุก pane (คัดจาก `docs/making-of/LOG.md` ตาราง "Pane ทั้งหมด" + Timeline · ไม่แต่งเพิ่ม)

> 1 pane = 1 tab ใน herdr = Claude Code 1 ตัว (**Claude Opus 5.5** ทุกตัว) · conductor เปิด → ส่งบรีฟ → ตรวจงาน → ปิด tab
> ⚠️ ชื่อ "Tesla" ในตารางเป็นบันทึกงานภายใน — **ในคลิปห้ามใช้ชื่อ/โลโก้ Tesla** ให้เขียนว่า "Roadster ที่เพิ่งเปิดตัว"
> เวลาไทย 17–18 ต.ค. 2026 · ทำงานพร้อมกันสูงสุด 7 pane + conductor (20:31–20:41: qa-m1, art, visuals, fx, fix, sponsors, checkpoint)

| # | เปิด | ปิด | ใช้เวลา | pane | โมเดล | ภารกิจ | ผลที่ได้ (ไฟล์) |
|---|---|---|---|---|---|---|---|
| 0 | 18:10 | (ยังเปิด) | ตลอดงาน | 🏁 main · conductor | Claude Opus 5.5 | แตกงาน เขียนบรีฟ เปิด/ปิด pane ตรวจงาน commit/deploy ห้ามลงมือเขียนเกมเอง | `docs/making-of/LOG.md` · บรีฟทุกไฟล์ · deploy production 00:24 |
| 1 | 18:17 | 18:24 | 7 นาที | 🔎 osm | Claude Opus 5.5 | ถนน/ตึก/คูเมืองจาก OSM + สนาม 3 แบบ | `research/osm/` |
| 2 | 18:17 | 18:29 | 12 นาที | 🔎 landmarks | Claude Opus 5.5 | แลนด์มาร์ก + ภาพ CC | `research/landmarks/` |
| 3 | 18:17 | 18:32 | 14 นาที | 🔎 streetview | Claude Opus 5.5 | เดินสำรวจ Street View | `research/streetview/` |
| 4 | 18:17 | 18:25 | 8 นาที | 🔎 car | Claude Opus 5.5 | Tesla Roadster ข่าว/สเปก/รูปทรง | `research/car/` |
| 5 | 18:21 | 18:43 | 22 นาที | 🔎 audio | Claude Opus 5.5 | BGM + SFX | `research/audio/` |
| 6 | 18:23 | 18:27 | 7 นาที | 🧪 qa | Claude Opus 5.5 | test plan + release gate | `docs/qa/` |
| 7 | 18:31 | 18:52 | 21 นาที (รอ Tle กดยอมรับ Neon คั่นกลาง) | ⚙️ backend | Claude Opus 5.5 | scaffold + Vercel + Neon + leaderboard API + ghost | `api/` `db/` `src/net/` |
| 8 | 18:31 | 18:41 | 10 นาที | 🎮 gameplay | Claude Opus 5.5 | ออกแบบการควบคุม กล้อง ฟิสิกส์ สูตรแต้ม | `docs/dev/GAMEPLAY.md` |
| 9 | 18:35 | 18:57 | 22 นาที | 🔎 streetview-A | Claude Opus 5.5 | สำรวจสนาม A ทั้งวง + ไขข้อขัดแย้ง | `research/streetview/REPORT-track-A.md` |
| 10 | 18:38 | 19:10 (ต่อยอดเป็น car-physics) | 32 นาที | 🧮 physics | Claude Opus 5.5 | โมเดลฟิสิกส์ + 4 จุดโชว์ + sim | `docs/dev/PHYSICS.md` `scripts/physics-sim.mjs` |
| 11 | 18:41 | 18:42 | ~2 นาที + แก้ 1 รอบ | ✍️ content | Claude Opus 5.5 | โพสต์ Facebook long form (ร่างแรก) | `docs/content/` |
| 12 | 18:47 | 18:52 | 5 นาที | 🎙️ announcer | Claude Opus 5.5 | เสียงพากย์อังกฤษ CC0 | `research/audio/REPORT.md` §8 |
| 13 | 19:02 | 19:29 | 27 นาที | 🛣️ world | Claude Opus 5.5 | M1 สนาม A จาก OSM+Street View | `src/track/` `src/scene/` `public/data/` |
| 14 | 19:02 | 19:15 | 13 นาที | 🚗 car-model | Claude Opus 5.5 | M1 โมเดลรถ low-poly (ส่งกลับแก้ 1 รอบ) | `src/car/model*.ts` |
| 15 | 19:02 | 19:38 | 36 นาที | 🎮 game-ui | Claude Opus 5.5 | M1 game loop + ปุ่ม + HUD + integrator | `src/game/` `src/input/` `src/ui/` |
| 16 | 19:02 | 19:11 | 9 นาที | 🔊 audio-dev | Claude Opus 5.5 | M1 ระบบเสียง | `src/audio/` `public/assets/audio/` |
| 17 | 19:11 | 19:25 | 14 นาที | 🧮 car-physics | Claude Opus 5.5 | M1 โค้ดฟิสิกส์รถในเกม (pane เดิมของ physics) | `src/car/physics*.ts` |
| 18 | 19:41 | 20:51 | 70 นาที | 🧪 qa-m1 | Claude Opus 5.5 | QA ตรวจ M1 บน preview | `docs/qa/reports/` `tests/qa/` |
| 19 | 19:41 | 20:06 | 25 นาที | 🏛️ landmarks-3d | Claude Opus 5.5 | M2 ลานย่าโม ประตูชุมพล คูเมือง | `src/track/landmarks/` |
| 20 | 19:41 | 20:08 | 27 นาที | 🏘️ streetscape | Claude Opus 5.5 | M2 ตึกแถว ของข้างถนน ป้ายชื่อถนน | `src/track/` `public/data/` |
| 21 | 20:11 | 21:12 | 61 นาที | 🖼️ art | Claude Opus 5.5 | M3 ภาพประกอบจาก ChatGPT (ส่งกลับแก้ 1 รอบ) | `public/assets/img/` |
| 22 | 20:11 | 21:36 | 85 นาที | 🌃 visuals | Claude Opus 5.5 | M3 แสง นีออน ฝน + integrator (4 รอบ) | `src/scene/` `src/neon/` |
| 23 | 20:11 | 20:41 | 30 นาที | 💨 fx | Claude Opus 5.5 | M3 สายไฟ/โคมแกว่ง + VFX รถ + ไอขาวฟิสิกส์ | `src/fx/` |
| 24 | 20:15 | 21:39 | 84 นาที | 🐞 fix | Claude Opus 5.5 | แก้บั๊ก 11 งาน (Tle + QA) | `docs/dev/fix/REPORT-fix.md` |
| 25 | 20:24 | 21:12 | 48 นาที | 🏁 sponsors | Claude Opus 5.5 | ป้ายสปอนเซอร์ + ทะเบียน MADEBYTLE | `src/sponsors/` |
| 26 | 20:31 | 21:17 | 46 นาที | 🚧 checkpoint | Claude Opus 5.5 | ด่านตรวจ กระโดดข้าม/ชนกระเด็น + ย้ายจุดสตาร์ท | `src/checkpoint/` |
| 27 | 21:15 | 21:33 | 18 นาที | 🔰 wayfinding | Claude Opus 5.5 | ป้ายเตือนทางเลี้ยว + ลูกศร HUD | `src/wayfinding/` |
| 28 | 21:42 | 00:20 | 2 ชม. 38 นาที | 🧪 qa-m3 | Claude Opus 5.5 | QA ด่านก่อน production (GO/NO-GO) | `docs/qa/reports/2026-10-17-v0.2.0-build002.md` |
| 29 | 22:21 | 23:05 | 44 นาที | 🔍 car-ref | Claude Opus 5.5 | เทียบโมเดลรถกับรูปทางการ tesla.com | `docs/research/REPORT-car-ref.md` |
| 30 | 00:25 | 00:33 | 9 นาที | 🌐 madebytle | Claude Opus 5.5 | ต่อ madebytle.com/koratrocketcar | `docs/dev/release/REPORT-madebytle.md` |
| 31 | 00:25 | 01:11 | 45 นาที | 🔧 polish | Claude Opus 5.5 | แก้หลัง production → v0.3.0 | `docs/dev/release/REPORT-polish.md` |
| 32 | 01:13 | 02:06 | ~1 ชม. | 🎬 clips | Claude Opus 5.5 | โหมดเดโม่ผ่าน URL + promo/ ให้ Mint | `src/capture/` โหมดเดโม่ `?demo=1` · `promo/` |

## ผู้ช่วยนอก workspace

| ใคร | ช่วงเวลา | เครื่องมือ/โมเดล | ภารกิจ | ผล |
|---|---|---|---|---|
| 🎨 ChatGPT pane (Codex) | 20:11–21:12 (สั่งผ่าน pane 🖼️ art ด้วย `/kiki-gpt`) | ChatGPT (Codex CLI) | วาด texture นีออน บิลบอร์ด ฟ้า ปก — ไม่มีตัวอักษร | 20 ภาพ 1.7 MB (`public/assets/img/`) |
| 🌸 Mint (ผู้ช่วย AI อีกเครื่อง) | 18:48 ขอ → 18:50 ส่ง | ElevenLabs TTS (แพลนฟรี) เสียง "Charlie" | เสียงพากย์อังกฤษ 10 คำ (3-2-1-GO, Final lap, New record …) ส่งมา 2 ชุดให้เลือก | Tle เลือก Charlie → `public/assets/audio/voice/` (ใบงาน tlejay/mint#475) |

หมายเหตุ: pane #10 🧮 physics ต่อยอดเป็น #17 🧮 car-physics ใน tab เดิม · ใช้เวลาแต่ละ pane นับจากเวลาเปิด-ปิด tab ตาม LOG
