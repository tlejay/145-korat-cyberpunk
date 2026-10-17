# REPORT — Audio: เพลงประกอบ + เสียงเอฟเฟกต์

> **สรุป (สำหรับ conductor)**
> 1. ได้ไฟล์ตัวเลือก **72 ไฟล์ ทุกไฟล์เป็น CC0 1.0** (ไม่ต้องให้เครดิต ใช้เชิงพาณิชย์ได้) — ตรวจ license จากหน้าต้นฉบับทีละไฟล์แล้ว · ไม่มี CC-BY / NC / เพลงติดลิขสิทธิ์
> 2. แหล่ง: **Kenney** (UI, sci-fi, impact, jingle) · **OpenGameArt** (เพลง BGM) · **Freesound** (ยาง ชน ฝน ฟ้าร้อง เมือง นีออน ลมอัด แคน) → รายละเอียดทุกไฟล์ใน `sources.json` + เพิ่มลง `research/CREDITS.md` แล้ว
> 3. **BGM แข่ง (ตัวเลือกแรก):** "Neon sign Circuit [Remake]" ของ MintoDog — ทำมาเพื่อเกมแข่งรถ วนลูปได้ มี **เวอร์ชัน Climax (เร็วขึ้น) ไว้ใช้รอบสุดท้าย** · ตัวรอง: "Cool Highway" (ธีมทางด่วนกลางคืน) ของคนเดียวกัน
> 4. **กลิ่นอีสาน:** เจอ**เสียงแคน CC0 2 ไฟล์**บน Freesound ใช้เป็นชั้นเสียงซ้อนบนเพลงเมนู/ฉากเปิด · **พิณ: หาแบบ license ใช้ได้ไม่เจอเลย** → เสนอสังเคราะห์ด้วยโค้ด (Karplus-Strong) เล่นลายสเกลเพนทาโทนิก
> 5. **เสียงมอเตอร์ไฟฟ้า:** ไม่มีไฟล์ CC0 ที่เป็นเสียงหอนสะอาด ๆ วนลูปได้ → แนะนำ **สังเคราะห์ด้วย oscillator เป็นหลัก + loop "spaceEngine" ของ Kenney ซ้อนปรับ playbackRate** (เทียบข้อดีข้อเสียในหัวข้อ 4.3)
> 6. **กระโดด:** research/car ยืนยันว่ารถจริงใช้ **ลมอัดเย็น (cold-gas) ไม่มีไฟ** → เลือกเสียง "ลมแรงดันพุ่ง" (pshhh) แทนเสียงจรวด
> 7. **งบขนาด (วัดจริงด้วย ffmpeg):** โหลดแรก 25 ไฟล์ (SFX ทั้งหมด + ฝน/เมือง + เพลงเมนู + แคน) = **1.2 MB** (Opus) / 1.3 MB (AAC) · BGM แข่ง 2 เพลงสตรีมทีหลัง +2.3 MB → **รวม ~3.5 MB ต่ำกว่าเป้า 5 MB**
> 8. ฟอร์แมตแนะนำ: **Ogg Opus หลัก + AAC (.m4a) สำรองให้ Safari** · SFX mono 48 kbps · ambience 64 kbps · BGM stereo 96 kbps
> 9. ⚠️ **ผมฟังเสียงไม่ได้** — คัดจากคำอธิบาย/แท็ก/ยอดดาวน์โหลด + วัดค่าทางเทคนิค (ความยาว ระดับเสียงต้น-ท้ายลูป) → **ต้องมีคนฟังจริงก่อนเลือกขั้นสุดท้าย** (ไฟล์อยู่ใน `candidates/` กดฟังได้เลย)
> 10. **ต้องตัดสินใจ:** (ก) จะ commit `candidates/` 42 MB ลง git ไหม (แนะนำ: commit แค่ตัวที่เลือกแล้วหลังแปลงเป็น Opus ไปไว้ใน `public/assets/audio/`) · (ข) นับถอยหลังใช้ **เสียงบี๊บ** (แนะนำ) เพราะเสียงพากย์ CC0 ที่มีเป็นภาษาอังกฤษ ขัดกับกติกา "UI ไทยอย่างเดียว" — ถ้าอยากได้เสียงพากย์ไทย "สาม สอง หนึ่ง ไป!" ต้องอัดเอง · **อัปเดต 18:46:** Tle อนุญาตเสียงพากย์อังกฤษแล้ว → ดูหัวข้อ 8

---

## 1. ตารางหลัก — เสียง → ไฟล์ที่แนะนำ → license

ไฟล์ทั้งหมดอยู่ที่ `research/audio/candidates/<หมวด>/` · ⭐ = ตัวเลือกแรก · ตัวรอง = ทางเลือกถ้าฟังแล้วไม่ชอบ · license ทุกแถว = **CC0 1.0**

| เสียง | ⭐ ไฟล์ที่แนะนำ | ตัวรอง | ผู้สร้าง (⭐) | หมายเหตุ |
|---|---|---|---|---|
| **BGM หน้าเมนู** | `bgm/oga-menu-cyberpunk-menu.ogg` (12.8 วิ, 170 KB) | `oga-menu-mirrorshade-1.mp3`, `oga-menu-pynchon.mp3` | ZaninDevelopers | ไฟล์เล็กมาก วนลูปได้ · ตัดความเงียบต้นไฟล์ก่อนวน |
| **ชั้นเสียงอีสาน (แคน)** | `bgm/fs418136-khaen-symphony-2.ogg` (31 วิ) | `fs516215-khaen-notes.ogg` (โน้ตแคนทีละเสียง 99 วิ — ตัดเป็น one-shot ได้) | makenoisemusic | ซ้อนเบา ๆ บนเพลงเมนู / ฉากเปิดที่ลานย่าโม |
| **ชั้นเสียงอีสาน (พิณ)** | **สังเคราะห์ด้วยโค้ด** (หัวข้อ 5) | — | — | หาไฟล์ license ใช้ได้ไม่เจอ |
| **BGM ระหว่างแข่ง** | `bgm/oga-race-neon-sign-circuit-145.ogg` (99 วิ, 145 BPM) | `oga-race-cool-highway-140.ogg`, `oga-race-cyber-runner.ogg` | MintoDog | ผู้แต่งระบุว่า "for racing game · loopable" |
| **BGM รอบสุดท้าย** | `bgm/oga-race-neon-sign-circuit-climax-160.ogg` (90 วิ, 160 BPM) | `oga-race-cool-highway-climax-155.ogg` | MintoDog | สลับจากเพลงหลักตอนเข้ารอบสุดท้าย (crossfade ตรงห้องเพลง) |
| **จบรอบ / ชนะ** | `ui/kenney-finish-jingle-sax-07.ogg` (jingle 1.7 วิ) แล้วตามด้วยเพลงเมนู | `kenney-finish-jingle-steel-07.ogg` · เพลงเต็ม `bgm/oga-win-cyber-march.mp3` (4 นาที ใช้ท่อน 30 วิ) | Kenney | |
| **แพ้ / หมดเวลา** | `ui/kenney-lose-jingle-hit-10.ogg` | — | Kenney | |
| **มอเตอร์ไฟฟ้า (หอนตามความเร็ว)** | **สังเคราะห์** + ซ้อน `car/kenney-motor-space-engine-000.ogg` | `fs761685-motor-ev-accel.ogg` (รถไฟฟ้าเร่งจริง 5 วิ — ใช้เป็นต้นแบบเทียบเสียง/one-shot ตอนออกตัว), `kenney-motor-space-engine-small-002.ogg`, `fs170421-motor-nissan-leaf.ogg`, `fs324119-motor-ev-startup-drive.ogg` | Kenney | ดูหัวข้อ 4.3 |
| **ยางเสียดสี / ดริฟต์** | `car/fs104026-tire-squeak.ogg` (2 วิ, โหลดกว่า 9 หมื่นครั้ง) | `fs71741-drift-handbrake-maxima.ogg`, `fs76804-drift-handbrake-volvo.ogg`, `fs536769-tire-short.ogg` | RutgerMuller | วนช่วงกลางไฟล์ · ระดับเสียงตามมุมสไลด์ |
| **ชน (แรง)** | `car/fs237375-crash-car.ogg` (4.4 วิ) | `fs592388-crash-glass.ogg` | squareal | |
| **ชน (เบา / เฉี่ยว)** | `car/fs151624-crash-clank.ogg` (0.5 วิ) | `kenney-crash-metal-heavy-000.ogg` | qubodup | |
| **ออกตัวเร็ว (boost)** | `car/fs540091-boost-rocket-blast.ogg` + ซ้อน `kenney-boost-phaser-up-6.ogg` | `fs683101-boost-quick-woosh.ogg`, `fs730959-boost-heavy-whoosh.ogg`, `kenney-boost-force-field-000.ogg` | magnuswaker / Kenney | ระเบิดลม + เสียงไฟฟ้าไซไฟพุ่งขึ้น |
| **กระโดด (พ่นลมอัด)** | `car/fs457294-jump-air-pressure-release.ogg` | `fs131934-jump-air-release-slips.ogg`, `fs477846-jump-short-gas-leak.ogg`, `fs136462-jump-train-air-release-hit.ogg` | brunoboselli | ตรงกับรถจริง (cold-gas) · ตัดช่วงพุ่งแรงสุด ~1 วิ · ตัวเลือกแนวจรวด: `fs347576-jump-thrusters-loop.ogg`, `kenney-jump-thruster-fire-000.ogg`, `fs446764-jump-rocket-thrust.ogg` |
| **ลงพื้น** | `car/fs329516-land-hood-impact.ogg` | `kenney-land-plate-heavy-001.ogg`, `kenney-land-soft-heavy-000.ogg`, `fs332056-land-fast-collision.ogg` | LPA134 | ความดังตามความเร็วแนวดิ่งตอนแตะพื้น |
| **ฝน (ลูป)** | `ambience/fs624645-rain-heavy-loop.ogg` (15.5 วิ, ตั้งใจทำเป็นลูป) | `fs177479-rain-slow-loop.ogg` (73 วิ), `fs217236-rain-city-steady-60s.opus` | Rubaoliva | ระดับต้น-ท้ายไฟล์ใกล้กันมาก (0.012 / 0.015) → วนไร้รอยต่อ |
| **ฟ้าร้องไกล ๆ** | `ambience/fs267550-thunder-3.ogg` (35 วิ) | `fs361401-thunder-distant-60s.opus`, `fs319568-thunder-distant-storm-60s.opus` | Yoyodaman234 | สุ่มเล่นทุก 20–60 วิ พร้อมแฟลชฟ้าแลบ |
| **เมืองกลางคืน** | `ambience/fs237329-city-night.ogg` (68 วิ) | `fs427841-city-night-quiet-60s.opus` | Soundkrampf | เบามาก ๆ ใต้ฝน |
| **ป้ายนีออนช็อต / หึ่ง** | `ambience/fs500693-neon-flicker.ogg` (กระพริบ) + `fs118340-neon-buzz.ogg` (หึ่งต่อเนื่อง) | `fs351430-neon-switch-on-hum.ogg`, `kenney-hologram-computer-noise-000.ogg` | bolkmar / Julien_Matthey | ใช้ PannerNode ผูกกับป้ายใกล้กล้อง |
| **กดปุ่ม UI** | `ui/kenney-click-002.ogg` · ยืนยัน `kenney-confirm-002.ogg` · ย้อนกลับ `kenney-back-002.ogg` | `kenney-select-003.ogg`, `kenney-error-004.ogg`, `kenney-glitch-002.ogg` | Kenney | |
| **นับถอยหลัง 3-2-1** | `ui/kenney-countdown-tone1.ogg` ×3 | `fs368779-countdown-short-beep.ogg`, `fs385928-countdown-signal.ogg`, `fs398238-countdown-fast.ogg` | Kenney | หรือสังเคราะห์ (หัวข้อ 5) |
| **GO!** | `ui/kenney-countdown-go-high-up.ogg` | — | Kenney | |
| **ผ่าน checkpoint** | `ui/kenney-checkpoint-three-tone-2.ogg` | `kenney-checkpoint-zap-up.ogg`, `kenney-checkpoint-power-up-7.ogg` | Kenney | |

---

## 2. แหล่งที่ใช้ และเงื่อนไขล่าสุด (เช็ค 17 ต.ค. 2026)

| แหล่ง | สถานะ | หลักฐาน |
|---|---|---|
| **Kenney** (kenney.nl) | ✅ ใช้ — ทุกแพ็กเป็น CC0 ("free to use in personal, educational and commercial projects", เครดิตไม่บังคับ) | `License.txt` ในแพ็ก `sci-fi-sounds`, `interface-sounds`, `digital-audio`, `impact-sounds`, `music-jingles` (ดาวน์โหลดตรงจาก kenney.nl/assets/…) |
| **OpenGameArt** | ✅ ใช้ — คัดเฉพาะหน้าที่ "License(s): CC0" อย่างเดียว | ตรวจช่อง License ของทุกหน้า · ตัดออกแล้ว: "Nova" (CC-BY 3.0), "Eyeless" (CC-BY 4.0), เพลงรีมิกซ์ที่ license รวมเป็น CC-BY-SA |
| **Freesound** | ✅ ใช้ — ค้นด้วยตัวกรอง license "Creative Commons 0" แล้ว**เปิดหน้าเสียงทีละไฟล์ยืนยันอีกรอบ** (ลิงก์ license = `creativecommons.org/publicdomain/zero/1.0/`) | ไฟล์ที่โหลดคือ **HQ preview (Ogg ~192 kbps)** เพราะไฟล์ต้นฉบับต้องล็อกอิน — คุณภาพพอสำหรับเกมบนมือถือ · ถ้าต้องการต้นฉบับ WAV ให้ล็อกอิน Freesound แล้วโหลดจาก URL ใน `sources.json` |
| **Pixabay Audio** | ⏸ ไม่ได้ใช้รอบนี้ | ไม่ใช่ CC0 แต่เป็น "Pixabay Content License" ของเขาเอง (ใช้ฟรี ไม่ต้องให้เครดิต ห้ามขายแยกเดี่ยว) — ใช้ได้ถ้าจำเป็น แต่ดาวน์โหลดต้องผ่านเว็บ (กัน bot) และมีประวัติปัญหา Content ID บน YouTube กับเพลงบางเพลง → เก็บไว้เป็นแผนสำรอง |
| ❌ ไม่ใช้ | YouTube Audio Library, เพลงมีลิขสิทธิ์, ไฟล์ CC-BY-NC | ตามบรีฟ |

ข้อควรรู้: CC0 ไม่ต้องให้เครดิตก็จริง แต่**แนะนำใส่เครดิตในหน้าเครดิตของเกม**อยู่ดี (เป็นมารยาท + เล่าเรื่องลง madebytle.com ได้) → รายการพร้อมใช้อยู่ใน `research/CREDITS.md`

---

## 3. รายละเอียดการคัดเลือก

### 3.1 BGM
- **Neon sign Circuit [Remake]** (MintoDog) — คำอธิบาย: "Music for racing game… 'Climax' is final lap music. This music is loopable." · คำนวณแล้ว **99.31 วิ ÷ (4 จังหวะ × 60/145) = 60.0 ห้องพอดี** และเวอร์ชัน Climax 90.0 วิ ÷ (4 × 60/160) = 60.0 ห้องพอดี → ตั้ง loopEnd ที่ตัวเลขนี้ได้แม่นยำ
- **Cool Highway** (MintoDog) — "created with the image of a highway at night" · 89.14 วิ = 52 ห้อง @140 BPM · มี Climax 155 BPM เหมือนกัน
- **Cyber Runner** (ansimuz) — synthwave แอ็กชัน · ต้นไฟล์ดังกว่าท้ายไฟล์มาก (มี fade ท้าย) → ต้องหาจุด loop เอง
- **เมนู:** "Cyberpunk Menu Music" เล็กแค่ 170 KB · "Mirrorshade" (แนว dub techno) และ "PYNCHON" (lo-fi glitch) ของ cinameng เป็นทางเลือกอารมณ์ต่างกัน · ทั้งสามไฟล์ต้นไฟล์เงียบ ~20 ms → ตัดก่อนวน
- **แคน:** "Khaen Symphony 2" (makenoisemusic) และ "โนัตแคน" (SieuAmThanh, เสียงแคนเป่าทีละโน้ต) — ยังไม่รู้คีย์/สเกลแน่ชัด **[ยังไม่ยืนยัน — ต้องฟัง]** ถ้าคีย์ชนกับเพลงหลัก ให้ใช้เฉพาะในหน้าเมนู/ฉากเปิด หรือปรับ playbackRate ให้เข้าคีย์

### 3.2 รถ
- รถจริง (จาก `research/car/REPORT.md`): มอเตอร์ไฟฟ้า 2 ตัว · boost = มอเตอร์ + หัวพ่นท้าย 4 หัว · กระโดด = **ลมอัดเย็น ไม่มีการเผาไหม้** พ่นได้ 5–6 วิ/ถัง → เสียง boost/กระโดดควรเป็น "ลมแรงดัน + ไฟฟ้า" ไม่ใช่ "ไฟจรวดคำราม"
- เสียงยาง/ชนเลือกตัวที่ยอดดาวน์โหลดสูง (ผ่านการใช้จริงมาเยอะ) และสั้น (ไฟล์เล็ก)

### 3.3 ค่าทางเทคนิคที่วัดได้ (ช่วยตัดสินว่าวนลูปได้ไหม)
ระดับเสียง RMS 20 ms แรก / 20 ms สุดท้าย (ใกล้กัน = วนลูปเนียน):

| ไฟล์ | ต้น | ท้าย | แปลผล |
|---|---|---|---|
| rain-heavy-loop | 0.012 | 0.015 | ✅ วนได้เลย |
| rain-slow-loop | 0.002 | 0.002 | ✅ |
| jump-thrusters-loop | 0.157 | 0.156 | ✅ |
| neon-sign-circuit-145 | 0.245 | 0.098 | ใช้ loopEnd ตามห้องเพลง (60 ห้อง) ไม่ใช่ท้ายไฟล์ |
| kenney space-engine | 0.334 | 0.169 | ⚠️ ต้องตั้ง loopStart/loopEnd ช่วงกลาง + crossfade |
| neon-buzz | 0.118 | 0.092 | ⚠️ ข้ามรอยต่อด้วย crossfade 50 ms |

---

## 4. แนวทางใช้งานในเกม (ข้อเสนอ — ยังไม่ได้เขียนโค้ด)

### 4.1 ฟอร์แมตและงบขนาด
| ประเภท | codec | ช่อง | bitrate | เหตุผล |
|---|---|---|---|---|
| SFX สั้น | Opus (`.ogg`/`.webm`) / สำรอง AAC `.m4a` | mono | 48 kbps | เสียงรถของผู้เล่นไม่ต้องเป็น stereo · mono ลดครึ่ง |
| Ambience ลูป (ฝน เมือง) | Opus / AAC | stereo | 64 kbps | ฝนต้องกว้าง |
| เสียงหึ่งนีออน | Opus / AAC | mono | 32 kbps | ย่านเสียงแคบ ตัดยาว 8 วิ พอ |
| BGM | Opus / AAC | stereo | 96 kbps | ฟังบนลำโพงมือถือ/หูฟัง แยกไม่ออกจาก 128+ |

**วัดจริง** (แปลงตัวเลือกแรกทั้งหมดด้วย ffmpeg ตามตารางบน):
- โหลดแรก 25 ไฟล์ (SFX ทุกตัว + ฝน + เมือง + นีออน + ฟ้าร้อง 12 วิ + เพลงเมนู + แคน) = **1.22 MB Opus / 1.28 MB AAC**
- BGM แข่ง: เพลงหลัก 1.21 MB + Climax 1.06 MB (Opus 96 kbps)
- **รวมทั้งเกม ≈ 3.5 MB** — ต่ำกว่าเป้า 5 MB และโหลดแรกจริงแค่ ~1.2 MB

เรื่อง Safari: Opus ใน Safari รองรับไม่ครบทุกเวอร์ชัน/ทุก container **[ยังไม่ยืนยันเวอร์ชันแน่ชัด]** → ให้ `scripts/` สร้างไฟล์ 2 ชุด (`.ogg` Opus + `.m4a` AAC) แล้วในเกมเช็ค `audio.canPlayType('audio/ogg; codecs="opus"')` เลือกชุดที่เล่นได้ · ทั้งสองชุดมี encoder padding ต้นไฟล์ → **อย่าพึ่งท้ายไฟล์ในการวนลูป** ให้ตั้ง `loopStart/loopEnd` เป็นวินาทีที่คำนวณไว้ (เก็บในไฟล์ manifest)

### 4.2 Web Audio API
- **ใช้ Web Audio (`AudioContext` + `AudioBufferSourceNode`) ทั้งหมด ไม่ใช้ `<audio>`** — `<audio loop>` มีช่องว่างตอนวน และเล่นพร้อมกันหลายเสียงบน iOS ไม่ได้
- **ปลดล็อกเสียงบน iOS:** สร้าง `AudioContext` ตั้งแต่ต้น แต่เรียก `ctx.resume()` + เล่น buffer เงียบ 1 เฟรม **ในตัวจัดการ `pointerdown`/`touchend` ครั้งแรก** (ผูกกับปุ่ม "เริ่มเกม" ซึ่งต้องแตะอยู่แล้ว) · ฟัง `visibilitychange` → `suspend()` ตอนสลับแอป แล้ว `resume()` ตอนกลับมา (iOS จะตัดเสียงเป็นสถานะ "interrupted")
- **iPhone เปิดโหมดเงียบ (สวิตช์ข้าง)** Web Audio จะไม่มีเสียง — ถ้าต้องการให้ดังแม้เปิดโหมดเงียบ ใช้ `navigator.audioSession.type = 'playback'` (Safari 17+) **[ยังไม่ยืนยัน — ทดสอบบนเครื่องจริง]** · ข้อความ UI แนะนำ: "ไม่ได้ยินเสียง? ลองปิดโหมดเงียบที่ข้างเครื่อง"
- **ลูปไร้รอยต่อ:** `src.loop = true; src.loopStart = a; src.loopEnd = b;` บน buffer ที่ decode แล้ว (แม่นระดับ sample) · ลูปที่รอยต่อไม่เนียนให้ทำ crossfade 2 source สลับกัน
- **สลับเพลงรอบสุดท้าย:** ตั้งเวลาเริ่ม Climax ที่ห้องเพลงถัดไป (`ctx.currentTime` + เวลาจนจบห้อง) แล้ว crossfade 1 ห้อง — ฟังลื่นแบบเกมแข่งรถจริง
- **กราฟเสียง (mixer):** `master ← [music bus, sfx bus, ambience bus]` แต่ละบัสเป็น `GainNode` · ใส่ `DynamicsCompressorNode` ที่ master กันเสียงชนแตก · **ducking:** ตอนชน/ข้อความสำคัญ ลด music bus ลง −6 dB 300 ms
- **จำกัดจำนวนเสียงซ้อน:** pool ละ 4 voice ต่อชนิด (ชนรัว ๆ ไม่ซ้อนจนดังเกิน) · สุ่ม `playbackRate` ±5% ทุกครั้งที่เล่น SFX ให้ไม่ซ้ำซาก
- **เสียงตำแหน่ง 3D:** ใช้ `PannerNode` (panningModel `equalpower` ประหยัดกว่า HRTF บนมือถือ) แค่กับนีออน/ฟ้าร้อง/รถคันอื่น · รถผู้เล่นเล่นตรงไม่ต้อง pan

### 4.3 เสียงมอเตอร์: sample ปรับ playbackRate vs สังเคราะห์ด้วย oscillator

| | A. loop ไฟล์เดียว + ปรับ `playbackRate` | B. สังเคราะห์ (oscillator) | **C. ผสม (แนะนำ)** |
|---|---|---|---|
| วิธี | เล่น `kenney-motor-space-engine-000` วนลูป, `playbackRate = 0.6 + speed/vmax × 1.4` | `OscillatorNode` sawtooth + sine 2–3 ตัว (ฮาร์โมนิกของมอเตอร์ เช่น ×1, ×2, ×4.5) → `BiquadFilter` lowpass ตามความเร็ว · ความถี่ 80→1,800 Hz ตามความเร็ว | B เป็นเสียงหอนหลัก + A ซ้อนเบา ๆ ให้มีเนื้อเสียง/ความหยาบ |
| ข้อดี | ทำง่าย เสียงมี "เนื้อ" ของจริง | **0 KB** · เปลี่ยน pitch ลื่นต่อเนื่องไม่มีขีดจำกัด · ปรับแต่งให้เหมือนรถไฟฟ้าได้แม่น (เสียงหอนแหลมสะอาด) · เพิ่มเสียง "ยกคันเร่ง/ชาร์จกลับ (regen)" ได้ง่าย | ได้ทั้งความต่อเนื่องของ B และความสมจริงของ A |
| ข้อเสีย | pitch สูงมาก/ต่ำมากจะเพี้ยน (chipmunk) · ความยาวเสียงเปลี่ยนตาม rate · ต้องหาจุดลูปเนียน | ถ้าจูนไม่ดีจะฟังเหมือน "เสียงคอมพิวเตอร์" · ต้องใช้เวลาจูน | โค้ดซับซ้อนขึ้นเล็กน้อย |
| CPU มือถือ | ต่ำมาก | ต่ำ (oscillator ไม่กี่ตัว) | ต่ำ |

ข้อแนะนำการจูน: ใช้ `setTargetAtTime` เปลี่ยนความถี่ (time constant ~0.05 วิ) ไม่ใช่เซ็ตตรง ๆ ทุกเฟรม (จะมีเสียงแตก) · ตอน boost ดันความถี่ขึ้นเร็ว + เปิด filter กว้าง · ตอนปล่อยคันเร่งให้เสียงหอนค่อย ๆ ลดพร้อม lowpass ปิด · ใช้ `fs761685-motor-ev-accel.ogg` (รถไฟฟ้าเร่งจริง) เป็น**ต้นแบบเทียบหู**ตอนจูน

### 4.4 ลำดับการโหลด
1. **ก่อนกด "เริ่มเกม"** (พร้อมแผนที่): UI click/confirm + เพลงเมนู (~200 KB)
2. **ระหว่างหน้าเมนู** (background, `fetch` + `decodeAudioData`): SFX รถทั้งหมด + countdown + checkpoint + ฝน/เมือง (~1 MB)
3. **ระหว่างนับถอยหลัง/เริ่มแข่ง:** สตรีม BGM แข่งเพลงหลัก — ถ้ายังโหลดไม่เสร็จ เริ่มแข่งไปก่อนแล้วเฟดเพลงเข้าเมื่อพร้อม (ห้ามบล็อกเกม)
4. **กลางรอบ:** โหลด Climax + jingle จบรอบ + ฟ้าร้องตัวยาว
- ถ้าไฟล์เสียงโหลดไม่สำเร็จ → **เล่นเงียบต่อไป ห้ามขึ้น error** (เสียงไม่ใช่สิ่งจำเป็น) · log ไว้ใน console เท่านั้น
- decode แล้ว BGM 96 วิ stereo กินแรม ~35 MB (Float32) — มือถือกลาง ๆ รับได้ แต่**อย่า decode เพลงพร้อมกันหลายเพลง** · คืนแรมเพลงที่ไม่ใช้แล้ว

### 4.5 ปุ่มเสียงในเกม
- ปุ่ม **ปิดเสียงทั้งหมด** (ไอคอน Heroicons `speaker-wave` / `speaker-x-mark`) มุมจอระหว่างแข่ง
- หน้าตั้งค่า: แถบเลื่อน **"เพลง"** และ **"เสียงเอฟเฟกต์"** แยกกัน (ambience รวมกับเอฟเฟกต์) · ค่าเริ่ม เพลง 60% / เอฟเฟกต์ 80%
- เก็บค่าใน `localStorage` (ห่อ try/catch) · ปรับด้วย `gain.setTargetAtTime` ไม่ให้มีเสียงคลิก

---

## 5. เสียงที่ควรสังเคราะห์ด้วยโค้ด (procedural Web Audio)

| เสียง | ทำไมไม่ใช้ไฟล์ | วิธีสร้าง |
|---|---|---|
| **มอเตอร์ไฟฟ้า** | ไม่มี CC0 ที่สะอาดและวนลูปได้ | หัวข้อ 4.3 |
| **พิณ (กลิ่นอีสาน)** | หาไฟล์ license ใช้ได้ไม่เจอ (Freesound / OpenGameArt ไม่มีผลลัพธ์) | **Karplus-Strong** (noise burst สั้น → delay line ยาว 1/f วินาที → lowpass ใน feedback loop) ได้เสียงสายดีดใกล้พิณมาก · เล่นลายในสเกลเพนทาโทนิกอีสาน (เช่น ลายสุดสะแนน/ลายเซิ้ง — ใช้แค่ "สเกล" ไม่ลอกเพลงใคร) · ใส่ delay + reverb ให้เข้ากับ synthwave · ทำเป็น `AudioWorklet` หรือ pre-render ลง buffer ตอนโหลด |
| **บี๊บนับถอยหลัง** (ทางเลือก) | ไฟล์ Kenney ใช้ได้อยู่แล้ว แต่สังเคราะห์ได้ 0 KB | sine 880 Hz 120 ms ×3 + "GO" 1,760 Hz 400 ms พร้อม envelope |
| **ฟ้าร้อง** (ทางเลือก) | ไฟล์จริงดีกว่า แต่ใช้ประหยัดได้ | brown noise → lowpass 200 Hz → envelope ยาว 3–6 วิ + กระตุกแรงตอนต้น |
| **ลมพุ่ง boost/กระโดด** (เสริม) | — | white noise → bandpass ที่กวาดความถี่ขึ้น ซ้อนกับไฟล์ลมอัด ให้เสียงยาวตามเวลาที่กดค้างได้ (ไฟล์มีความยาวตายตัว) |

---

## 6. ไฟล์ในโฟลเดอร์นี้

```
research/audio/
  REPORT.md        ← ไฟล์นี้
  sources.json     ← ทุกไฟล์: name, url, author, license, duration_s, size_bytes, role, recommended (1/2/3)
  candidates/
    bgm/       11 ไฟล์  (OpenGameArt 9 + Freesound แคน 2)
    car/       31 ไฟล์
    ambience/  12 ไฟล์  (ไฟล์ยาวเกิน 2 นาทีถูกตัดเหลือ 60 วิ เป็น .opus เพื่อลดขนาด)
    ui/        18 ไฟล์
    voice/    ~190 ไฟล์ + build/ (เสียงพากย์อังกฤษ — หัวข้อ 8)
```
ขนาดรวม `candidates/` ≈ 42 MB (ยังเป็นไฟล์ต้นฉบับคุณภาพสูง) — ไฟล์ที่จะใส่เกมจริงควรแปลงใหม่ตามหัวข้อ 4.1 ลง `public/assets/audio/`

## 7. สิ่งที่ยังไม่ได้ทำ / ต้องทำต่อ
- **ฟังจริงทุกตัวเลือกแรก** (ผมฟังไม่ได้) — โดยเฉพาะ: คีย์ของแคนเข้ากับเพลงหลักไหม, เสียงลมอัดตอนกระโดดฟังแล้วใช่ไหม
- เขียน `scripts/build-audio` (ffmpeg → Opus + AAC + manifest loopStart/loopEnd) — งานของ dev pane
- ถ้าอยากได้เสียงพากย์ไทย "สาม · สอง · หนึ่ง · ไป!" / "รอบสุดท้าย!" → ต้องอัดเสียงเอง (ไม่มี CC0 ภาษาไทย) หรือใช้ TTS ที่ license อนุญาต

---

## 8. เสียงพากย์ (อังกฤษ)

> **สรุป**
> 1. **ชุดหลักของเกม = เสียงที่ Mint อัด** (conductor สั่งแล้ว — tlejay/mint#475) · ได้ไฟล์ Mint เมื่อไรใช้ของ Mint · ชุด CC0 ข้างล่างเป็น **ตัวสำรอง / ใช้ทดสอบระหว่างรอ** · ⚠️ ไฟล์ Mint ทำด้วย ElevenLabs **แพลนฟรี = ไม่เชิงพาณิชย์ + ต้องให้เครดิต** (ดู `research/CREDITS.md`) → ถ้าเกมจะใช้เชิงพาณิชย์ (โฆษณา/สปอนเซอร์) ให้สลับมาใช้ชุด CC0 นี้ หรืออัดใหม่บนแพลนเสียเงิน
> 2. ตัวสำรองที่แนะนำ: **Kenney Voiceover Pack — เสียงผู้ชาย (Jeffrey M. Smith) CC0** — เสียงเดียวกันทั้งชุด ครอบคลุม 3-2-1-Go, "Final round", "New highscore", "Congratulations", "You win", "Power up", "Time over", "Hurry up"
> 3. **ไม่มีในชุด CC0 ที่หาเจอ:** "Final **lap**" (มีแค่ "Final round"), "Finish!", "New lap record", "Nice drift!", "Great jump!" → ใช้คำใกล้เคียง หรือรอไฟล์ Mint (ดู 8.3)
> 4. ขนาดชุดแนะนำ 11 ไฟล์ หลังแปลง: **53 KB (Opus 40 kbps) / 93 KB (AAC 64 kbps)** — เล็กมาก โหลดพร้อม SFX ได้เลย
> 5. ⚠️ **ผมฟังเสียงไม่ได้** — เลือกจาก (ก) license ในแพ็ก (ข) ข้อความที่พูด (ชื่อไฟล์/คำอธิบาย) (ค) **เสียงเดียวกันทั้งชุด** (ผู้พากย์คนเดียวตาม `Credits.txt`) (ง) ค่าทางเทคนิค: ระดับพีคใกล้ 0 dB, mono 44.1 kHz, ความยาว 0.6–1.5 วิ (สั้นพอซิงก์นับถอยหลังทุก 1 วิ) — ต้องมีคนฟังก่อนใช้จริง

### 8.1 ตาราง คำ → ไฟล์ → license

ไฟล์ต้นฉบับ `candidates/voice/<โฟลเดอร์>/` · ไฟล์แปลงแล้ว `candidates/voice/build/` (`.ogg` Opus mono 40 kbps + `.m4a` AAC mono 64 kbps + `.wav` ต้นแบบ) — ผ่าน ffmpeg: ตัดความเงียบหัว-ท้าย + `loudnorm I=-16 LUFS, TP -1.5 dB` ให้ทุกคำดังเท่ากัน · license ทุกแถว **CC0 1.0**

| คำที่บรีฟขอ | ⭐ ไฟล์ (build) | ต้นฉบับ | ความยาว | ตัวสำรอง | หมายเหตุ |
|---|---|---|---|---|---|
| "Three" | `vo-3` | `kenney-voiceover-male/3.ogg` | 0.75 วิ | `oga-turtle-countdown/3.wav` (หุ่นยนต์) · `kenney-voiceover-female/3.ogg` | |
| "Two" | `vo-2` | `kenney-voiceover-male/2.ogg` | 0.61 วิ | เหมือนบน | |
| "One" | `vo-1` | `kenney-voiceover-male/1.ogg` | 0.64 วิ | เหมือนบน | |
| "Go!" | `vo-go` | `kenney-voiceover-male/go.ogg` | 0.62 วิ | `oga-turtle-countdown/GO.wav` · `kenney-fighter/fight.ogg` | |
| "Final lap!" | `vo-final-lap` | `kenney-voiceover-male/final_round.ogg` → **พูดว่า "Final round"** | 1.07 วิ | `alt-final-lap-fs386803` = "Final lap" ตรงคำ แต่**คนละเสียง** (RichieMcMullen, Freesound) · `kenney-fighter/final_round.ogg` (เสียงประกาศมวย) | ไม่มี CC0 ที่เป็นเสียงเดียวกันและพูด "lap" |
| "New record!" / "New lap record!" | `vo-new-record` | `kenney-voiceover-male/new_highscore.ogg` → **"New highscore"** | 1.20 วิ | — | ความหมายตรงกับ "ทำสถิติใหม่" |
| "Finish!" | `vo-finish` | `kenney-voiceover-male/congratulations.ogg` → **"Congratulations"** | 1.52 วิ | `mission_completed.ogg` (ฟังเป็นเกมยิงมากกว่า) | ไม่มีคำว่า "Finish" ใน CC0 |
| "You win!" | `vo-you-win` | `kenney-voiceover-male/you_win.ogg` | 1.00 วิ | `kenney-fighter/winner.ogg` | ใช้ตอนชนะ ghost อันดับ 1 / ขึ้นอันดับ 1 |
| "Boost!" | `vo-boost` | `kenney-voiceover-male/power_up.ogg` → **"Power up"** | 0.79 วิ | `oga-timrockk-game-voice/g-nitro.wav`, `g-turbo.wav` (คนละเสียง, ระดับเบากว่า −8 dB) | ดูกติกาความถี่ 8.2 |
| "Checkpoint" | — (แนะนำใช้ SFX เดิม) | — | — | `alt-checkpoint-fs338223` = "Check Point" เสียงผู้หญิง ตัดจากไฟล์รวม 66 วิ ช่วง 5.0–6.4 วิ (**ตัดด้วยการหาช่วงเงียบ ยังไม่ได้ฟังยืนยัน**) | ผ่านบ่อย พากย์ทุกครั้งจะน่ารำคาญ |
| "Nice drift!" | ❌ ไม่มี | — | — | Mint / TTS (8.3) | |
| "Great jump!" | ❌ ไม่มี | — | — | Mint / TTS (8.3) | |
| (แถม) "Time over" | `vo-time-over` | `kenney-voiceover-male/time_over.ogg` | 0.95 วิ | — | ถ้ามีจำกัดเวลา |
| (แถม) "Hurry up!" | `vo-hurry-up` | `kenney-voiceover-male/hurry_up.ogg` | 0.65 วิ | — | ตอน ghost นำห่างเกิน ~2 วิ ในรอบสุดท้าย (เล่นครั้งเดียว) |

**ขนาดวัดจริง** (ชุด `vo-*` 11 ไฟล์): Opus **53,840 B** · AAC **93,074 B** · แต่ละไฟล์ 3–8 KB (Opus) — ใช้รูปแบบเดียวกับ SFX ในหัวข้อ 4.1 (Opus หลัก + AAC สำรองให้ Safari)

แหล่งที่ดูแล้วไม่ได้ใช้: Freesound ค้น CC0 คำว่า "nice drift", "lap record", "boost voice", "new record voice" → ไม่เจอเสียงพากย์ · OpenGameArt "voiceover-pack-40-lines" / "voiceover-pack-fighter-40-taunts" = แพ็ก Kenney ตัวเดียวกัน · Pixabay ยังไม่ได้ใช้ (เหตุผลเดิมหัวข้อ 2)

### 8.2 จังหวะที่เกมควรเล่น

| เหตุการณ์ | เล่นอะไร | จังหวะ |
|---|---|---|
| นับถอยหลัง | `vo-3` → `vo-2` → `vo-1` → `vo-go` **แทน** บี๊บ `kenney-countdown-tone1` (หรือซ้อนบี๊บเบา ๆ −12 dB) | ตั้งเวลาด้วย `AudioContext.currentTime` ไม่ใช่ `setTimeout`: เลข 3 ที่ t₀, 2 ที่ t₀+1.0, 1 ที่ t₀+2.0, Go ที่ t₀+3.0 — **ตัวเลขบนจอเปลี่ยนในเฟรมเดียวกับเวลาเสียง** (อ่าน `ctx.currentTime` ใน game loop) · ไฟล์ตัดหัวแล้ว เสียงพูดเริ่มทันที ไม่ต้องเลื่อน · ปลดล็อกคันเร่งพร้อม "Go" |
| เข้ารอบที่ 2 (รอบสุดท้าย) | `vo-final-lap` | ทันทีที่ข้ามเส้นเริ่มรอบ 2 · **พร้อมกับ** สลับ BGM เป็นเวอร์ชัน Climax (หัวข้อ 1) — เริ่มพากย์ก่อน แล้ว crossfade BGM ใต้เสียงพากย์ |
| จบรอบ 1 ได้ best lap ใหม่ | `vo-new-record` | หลัง `vo-final-lap` 1.3 วิ (ห้ามซ้อนกัน — ใช้คิวเสียงพากย์ทีละคำ) |
| เข้าเส้นชัย | `vo-finish` แล้ว jingle `kenney-finish-jingle-sax-07` | พากย์ทันที · jingle ตามหลัง 0.2 วิ |
| เข้าเส้นชัย + ทำสถิติ/ชนะ ghost | `vo-new-record` หรือ `vo-you-win` **แทน** `vo-finish` | เลือกคำเดียว อย่าพูดต่อกัน 3 คำ |
| Boost | `vo-boost` | **เฉพาะ boost ครั้งแรกของเกม** (สอนผู้เล่นว่าปุ่มนี้คืออะไร) หรือเมื่อเกจเต็มกลับมาพร้อมใช้ — ห้ามพากย์ทุกครั้ง |
| ดริฟต์/กระโดดสวย (ถ้ามีไฟล์จาก Mint) | "Nice drift!" / "Great jump!" | ตอนได้โบนัสสไตล์ · cooldown ≥ 8 วิ ต่อคำ |

**กติกาคิวเสียงพากย์:** มีได้ทีละ 1 เสียง · คำใหม่ที่สำคัญกว่าตัดคำเก่า (Go > Final lap > Finish > New record > Boost) · คำสำคัญต่ำทิ้งได้ถ้าคิวไม่ว่าเกิน 0.5 วิ

### 8.3 Ducking BGM ตอนพากย์

- ต่อ graph: `voiceGain → master` แยกจาก `musicGain → master` · ตอนพากย์: `musicGain.gain.setTargetAtTime(0.4, t, 0.03)` (ลด ~−8 dB เร็ว ~80 ms) แล้วคืนค่า `setTargetAtTime(1.0, t + duration + 0.15, 0.15)` (ปล่อยช้า ~0.4 วิ ฟังไม่วูบ)
- ลด ambience (ฝน) ด้วย −4 dB เท่านั้น · **ไม่ลด** เสียงมอเตอร์/ยาง (ผู้เล่นต้องได้ยินรถตลอด)
- ระดับเสียงพากย์ตั้งต้น 0 dB (ไฟล์ normalize −16 LUFS แล้ว) และมีสไลเดอร์ "เสียงพากย์" แยกในตั้งค่า (เปิด/ปิดได้)
- นับถอยหลังตอนรถยังไม่วิ่ง → duck BGM ค้างไว้ตลอด 3 วิ แล้วค่อยปล่อยพร้อม "Go"

### 8.4 ถ้าคำไหนไม่มี — ทางเลือก

1. **เสียง Mint (ชุดหลัก)** — อัดครบทุกคำในเสียงเดียว → แก้ปัญหาทุกคำที่ขาด · ส่งเป็น WAV แล้วผ่าน pipeline เดียวกัน (ตัดเงียบ + loudnorm −16 LUFS + Opus/AAC)
2. **ใช้คำใกล้เคียงจากชุด Kenney** (ตาราง 8.1) — "Final round", "New highscore", "Congratulations", "Power up"
3. **ตัดต่อจากชุดเดียวกัน** — ทำได้จำกัด: ชุด Kenney ไม่มีพยางค์ "lap" / "drift" / "jump" ให้ตัด
4. **TTS ที่ license อนุญาตใช้ในเกม** — เช่น **Kokoro-82M** (โมเดล Apache-2.0 รันในเครื่อง ผลลัพธ์ใช้เชิงพาณิชย์ได้) **[ยังไม่ได้ตรวจเงื่อนไขล่าสุด — เช็คก่อนใช้]** · ข้อเสีย: เสียงไม่เหมือน Kenney → ถ้าใช้ TTS ควรทำ**ทั้งชุด**ด้วยเสียง TTS เดียว · ❌ ห้ามใช้เสียง `say` ของ macOS (license Apple อนุญาตแค่ใช้ส่วนตัวไม่ใช่เชิงพาณิชย์) · ❌ ElevenLabs แพ็กฟรีห้ามใช้เชิงพาณิชย์

### 8.5 สิ่งที่ยังไม่ได้ทำ
- ฟังจริงทุกไฟล์ในตาราง 8.1 (โดยเฉพาะ `alt-checkpoint-fs338223` ที่ตัดโดยไม่ได้ฟัง)
- รอไฟล์ Mint → แปลงด้วยสูตรเดียวกัน แล้วย้ายชุดที่เลือกไป `public/assets/audio/voice/` (งาน dev pane)
