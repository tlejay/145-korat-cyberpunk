# REPORT — 🐞 fix

## สรุป
| # | บั๊ก | สาเหตุจริง | แก้ | test | สถานะ |
|---|---|---|---|---|---|
| 1 | นับถอยหลังพากย์ "Three, Three" | engine สั่ง `countdown3` ซ้ำ 2 ครั้ง (ไฟล์เสียงถูกต้องทุกไฟล์) | `src/game/engine.ts` +1 บรรทัด | `tests/qa/voice.spec.ts` | ✅ แก้แล้ว · test จับบั๊กได้ทั้ง Chromium + WebKit |

typecheck ✅ · build ✅ · ไม่ได้ commit (ตามบรีฟ)

---

## บั๊ก #1 — เสียงพากย์ "Three, Three"

### สาเหตุ (root cause)
`src/game/engine.ts`
- `beginCountdown()` โชว์ "3" แล้วสั่ง `E.audio.play('countdown3')` ทันที แต่ **ไม่ได้ตั้ง `countdownShown = '3'`** (ค่ายังเป็น `''`)
- physics step แรกใน `stepOnce()` คำนวณ `step = ceil(3.19 / 0.8) = 4` → `shown = '3'` ≠ `''` → สั่ง `countdown3` **อีกรอบ**
- ใน `say()` (`src/audio/index.ts`) เสียงพากย์ priority เท่ากัน (5) ไม่ตัดกัน แต่ **ต่อคิว** หลังคำแรกจบ → ได้ยิน "Three" ซ้ำห่าง ~0.5 วิ แล้ว "Two" ถูกดันช้าไปด้วย

ไทม์ไลน์จริงที่วัดได้ (WebKit, build ก่อนแก้): `three +0 · three +0.495 · two +0.495 · one +0.621 · go +0.800`
หลังแก้: `three +0 · two +0.813 · one +0.803 · go +0.800`

บั๊กเกิด **ทุกครั้งที่เริ่มนับถอยหลัง** (ทั้งรอบแรกและกดเล่นใหม่) — `countdownShown` ถูกรีเซ็ตเป็น `''` ตอน "ไป!" เสมอ

### ตัดเหตุอื่นที่บรีฟสงสัยออก
- **ไฟล์เสียงชื่อสลับ / build-audio ทับชื่อผิด** — ไม่ใช่: ถอดเสียงทุกไฟล์ใน `public/assets/audio/voice/` ด้วย faster-whisper (medium, ในเครื่อง) ได้ตรงทุกคำทั้ง `.ogg` และ `.m4a`:
  three→"Three" · two→"Two" · one→"One" · go→"Go!" · final-lap→"Final lap!" · new-record→"New Lap Record" · finish→"Finish." · boost→"Boost!" · nice-drift→"Nice drift!" · great-jump→"Great jump!"
  md5 ไม่ซ้ำกันทุกไฟล์ (three/one/go mp3 ต้นฉบับขนาดเท่ากัน 12,582 B แต่เนื้อไม่เหมือนกัน) · manifest `vo-X` → `voice/vo-X` → `voice/mint/charlie/X.mp3` ตรงทุกตัว
- **mapping ใน audio** — `play()` แมป countdown3/2/1/go → vo-three/two/one/go ถูกต้อง
- **เสียงอื่นในชุด** (ตรวจจากโค้ด — แต่ละตัวยิงจากจุดเดียว ไม่มีทางซ้ำ):
  final-lap = `race.ts` ตอนเข้ารอบสุดท้าย 1 ครั้ง · finish / new-record = `finishRace()` เลือกอย่างใดอย่างหนึ่ง · boost = ครั้งแรกของเกมเท่านั้น (`boostSaid` รีเซ็ตที่ countdown3 — หลังแก้ยังยิง 1 ครั้งตามเดิม) · nice-drift / great-jump = `sayCooled` เว้น 8 วิ

### แก้ไฟล์ไหน
`src/game/engine.ts` — `beginCountdown()` เพิ่ม 1 บรรทัดหลัง `play('countdown3')`:
```ts
countdownShown = '3'; // already announced — stepOnce() must not fire countdown3 again ("Three, Three")
```
ผลข้างเคียงที่ดี: กรณีกด "เล่นใหม่" ระหว่างนับถอยหลัง (`countdownShown` ค้างเป็น '2'/'1') ก็ไม่ซ้ำแล้วเช่นกัน
⚠️ engine.ts มีงานของ pane 🌃 visuals ค้างอยู่ใน working tree ด้วย — แก้ของ fix มีแค่บรรทัดนี้บรรทัดเดียว (ใน `beginCountdown`) conductor add ได้โดยไม่ชน

### Test
`tests/qa/voice.spec.ts` (Playwright, ทั้ง chromium-landscape + webkit-landscape)
- **FIX-01 countdown voice** — ดักทุก `AudioBufferSourceNode.start()` ที่เล่นบัฟเฟอร์เสียงพากย์ (ติดป้าย id จาก URL ตอน fetch → decode) กดปุ่ม "เริ่มแข่ง" จริงเพื่อปลดล็อกเสียง รอจนเข้า racing แล้วตรวจว่าเสียงพากย์ = `[vo-three, vo-two, vo-one, vo-go]` เป๊ะ และแต่ละคำห่างกัน ≥ 0.68 วิ
- **FIX-01 voice set** — manifest ครบ 10 คำ และแต่ละ id ชี้ไฟล์ของตัวเอง

ผลรัน (build แยกใน scratchpad, เสิร์ฟพอร์ต 4191/4192 — ไม่แตะ server 4180 ของ QA):
- build **ก่อนแก้**: ❌ fail ทั้ง 2 เบราว์เซอร์ — `Received: ["vo-three", "vo-three", "vo-two", "vo-one", "vo-go"]`
- build **หลังแก้**: ✅ 3 passed, 1 skipped (static check รันแค่ Chromium)

รัน: `pnpm exec playwright test tests/qa/voice.spec.ts`

### ข้อสังเกต (ไม่ใช่บั๊กนี้ — ให้ conductor พิจารณา)
- บน Chromium + SwiftShader (เฟรมช้า) ช่วงห่างแต่ละคำยืดเป็น 1.0–2.4 วิ เพราะ countdown เดินตาม physics step ซึ่งตัดที่ 30 step/เฟรม — เครื่องที่ fps ตกหนักตอนเริ่มเกม (compile shader) จะนับช้ากว่านาฬิกาจริง · WebKit ได้ 0.80 ± 0.02 วิ ตรงจังหวะ · test จึงเช็คแค่ขั้นต่ำ ไม่เช็คเพดาน
- เส้นทาง `skipCountdown` (QA `?skip=1`) ไม่รีเซ็ต `boostSaid` — กระทบแค่โหมด QA ไม่กระทบผู้เล่น
