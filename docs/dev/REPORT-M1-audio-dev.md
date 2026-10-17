# REPORT M1 — 🔊 audio-dev

> **สรุป**
> 1. ✅ `scripts/build-audio.sh` แปลง 31 เสียง → `public/assets/audio/{sfx,amb,music,voice}/*.ogg|.m4a` + `manifest.json` · **โหลดแรก 569 KB (Opus) / 890 KB (AAC)** ต่ำกว่างบ 1.5 MB · เพลงแข่ง 2 เพลงโหลดทีหลัง (+2.2 MB Opus / 3.0 MB AAC)
> 2. ✅ `src/audio/index.ts` `createAudio()` ตามสัญญา (`GameAudio` ใน src/types.ts) + ของแถมไม่บังคับใช้: `setMuted` `music()` `countdown()` `now()` `pause()` `resume()` `debug()`
> 3. ✅ มอเตอร์ไฟฟ้า = oscillator 4 ชั้น ไล่ pitch ตามความเร็ว 55→~1,050 Hz + ชั้น Kenney บาง ๆ · ทดสอบแล้วเปลี่ยน **≤ 1.61%/เฟรม และไล่ขึ้นต่อเนื่อง** (AUD-02 ≤ 2%)
> 4. ✅ เพลงวนลูปไร้รอยต่อ (AudioBuffer loop ตาม loop point ใน manifest — ตัดที่ 60 ห้องพอดี) · รอบสุดท้ายสลับเป็น Climax **ตรงห้องเพลงถัดไป** crossfade 1 ห้อง
> 5. ✅ เสียงพากย์ Charlie (Mint) 10 คำ: คิวทีละเสียง + ลำดับความสำคัญ + **duck เพลง −8 dB / ฝน −4 dB** · นับถอยหลังตั้งเวลาด้วยนาฬิกาเสียง (`countdown(0.8)` คืนเวลาแต่ละจังหวะ ให้ HUD เปลี่ยนเลขตรงเสียง)
> 6. ✅ ยาง/ดริฟต์ตาม driftAngle · boost (ลมพุ่ง+ไฟฟ้า+เสียงลมสังเคราะห์) · กระโดด (ลมอัดเย็น) · ลงพื้นดังตามความเร็วตก · ชนเบา/แรงตามความเร็ว · ฝน+เมือง · pool 4 เสียงต่อชนิด · compressor กันแตก
> 7. ✅ iOS: unlock ในแตะแรก + `audioSession.type='playback'` (กันสวิตช์เงียบ ถ้ารองรับ) · ซ่อนแท็บ = หยุดเสียงทันที · ค่าเสียงจำใน localStorage (try/catch) · ไฟล์หาย/ไม่รองรับ = เล่นเงียบ ไม่ขึ้น error
> 8. ✅ หน้าฟังเสียง `src/audio/lab.ts` → `mountAudioLab(root)` ปุ่มทุก event + สไลเดอร์ความเร็ว/มุมดริฟต์/ลอย + ระดับเสียง · **⚠️ ยังเปิดจาก `?qa=1&view=audio` ไม่ได้จนกว่า game-ui จะต่อ 3 บรรทัดใน `src/main.ts`** (ไฟล์ของ game-ui — ดูข้อ "ขอให้แก้")
> 9. ✅ ทดสอบด้วย Playwright headless: Chromium (Opus) + WebKit (Opus และบังคับ AAC) — ทุก event เล่นได้ ไม่มี console error · `pnpm typecheck && pnpm build` ผ่าน
> 10. ⚠️ **ผมฟังเสียงไม่ได้** — ระดับเสียง (`TRIM` ใน index.ts) และสูตรเสียงมอเตอร์ตั้งจากตัวเลข ต้องมีคนฟังที่หน้า lab (ดูข้อ "ต้องฟัง")
> 11. เพิ่มตารางไฟล์ที่ใช้จริง + ข้อความเครดิตในเกมลง `research/CREDITS.md` · ไม่ได้เพิ่ม dependency

## ขอให้ game-ui แก้ (`src/main.ts` — ไม่ใช่ไฟล์ของผม)

```ts
if (params.get('qa') === '1' && params.get('view') === 'audio') {
  void import('./audio/lab.js').then((m) => m.mountAudioLab(ui));
  // แล้วไม่ต้องสร้างฉาก 3D / เมนูเกม
}
```

และ QA hook `audio()` ใน `src/qa/hooks.ts` ให้คืน `audio.debug()` (รูปแบบตรงกับ TEST-HOOKS แล้ว: contextState, unlocked, muted, musicVolume, sfxVolume, engineRate, playing)

## วิธีใช้ใน game loop

| ตอนไหน | เรียก |
|---|---|
| แตะ "เริ่มแข่ง" (ใน handler ของการแตะเลย — iOS) | `await audio.unlock()` |
| หน้าเมนู | `audio.music('menu')` (ถ้าต้องการ) |
| นับถอยหลัง | **แบบแนะนำ** `const times = audio.countdown(0.8)` แล้วเทียบ `audio.now()` กับ `times[k]` ใน loop เพื่อเปลี่ยนเลข 3/2/1/ไป! (times[3] = ไป!) · หรือแบบง่าย `play('countdown3'/'countdown2'/'countdown1'/'go')` ทีละจังหวะ — **อย่าใช้ทั้งสองแบบพร้อมกัน** (จะพากย์ซ้ำ) |
| ทุกเฟรมระหว่างแข่ง | `audio.update(car.state, dt)` — หยุดเรียกเมื่อไหร่ เสียงมอเตอร์/ยางจะเฟดออกเองใน ~0.3 วิ |
| ข้ามเส้นเริ่มรอบ 2 | `play('finalLap')` (พากย์ + สลับเพลงเอง) |
| เข้าเส้นชัย | `play('finish')` หรือ `play('newRecord')` ถ้าทำสถิติ (เลือกอันเดียวตาม REPORT §8.2) · เพลงเฟดออกแล้วเปลี่ยนเป็นเพลงเมนูเองหลัง 3.5 วิ |
| boost / launch | `play('boost')` — พากย์ "Boost" เฉพาะครั้งแรกของแต่ละเกม |
| กระโดด / ลงพื้น | `play('jump')` / `play('land')` — ความดังตอนลงคำนวณจาก `velocity.y` ที่เห็นใน `update()` · ลอยนาน > 1 วิ พากย์ "Great jump" (เว้น 8 วิ) |
| ชน | `play('crash')` — เลือกเสียงเบา/แรงจากความเร็วล่าสุดเอง · **ชนขอบลานย่าโม ห้ามเรียก** (GAMEPLAY: ไม่มีเสียงชนแรง) |
| ได้โบนัสดริฟต์ | `play('drift')` (พากย์ "Nice drift" เว้น 8 วิ) — เสียงยางมาจาก `update()` อยู่แล้ว |
| checkpoint / ปุ่ม UI | `play('checkpoint')` / `play('uiTap')` |
| หน้า pause / ปุ่มปิดเสียง / ตั้งค่า | `audio.pause()` `audio.resume()` · `audio.setMuted(bool)` · `audio.setVolumes(เพลง, เอฟเฟกต์)` (0..1, ค่าเริ่ม 0.6/0.8, อ่านค่าปัจจุบันจาก `audio.volumes`) |

## ไฟล์

- `scripts/build-audio.sh` — ffmpeg (ใช้ encoder AAC ของ Apple ถ้ามี) · ตัดช่วงที่ดีที่สุดของไฟล์ยาว (เช่น ลมอัด 17.8 → 1.4 วิ) · loop ที่รอยต่อไม่เนียนอบ crossfade ลงไฟล์ (มอเตอร์ Kenney, ยาง, ฝน, เมือง) · เสียงพากย์ตัดเงียบหัวท้าย + loudnorm −16 LUFS · รันซ้ำได้ (ลบแล้วสร้างใหม่ทั้งโฟลเดอร์) · ต้องมี `research/audio/candidates/` (gitignored อยู่บนเครื่องนี้)
- `src/audio/assets.ts` — โหลด manifest · เลือก `.ogg` ถ้า `canPlayType` บอกว่าได้ ถ้า decode พังสลับเป็น `.m4a` ต่อไฟล์ · เพลงยาวเก็บไฟล์บีบอัดไว้ แล้วคืนแรมหลังเพลงหยุด (เพลง decode แล้ว ~35 MB)
- `src/audio/motor.ts` — มอเตอร์สังเคราะห์ (ไม่มีเสียงเกียร์/ท่อ — AUD-09)
- `src/audio/index.ts` — mixer, pool, คิวพากย์, ducking, เพลง, ambience, event
- `src/audio/lab.ts` — หน้าฟังเสียงสำหรับ Tle/QA (ภาษาไทย, ปุ่ม ≥ 48 px)

## ผลทดสอบ (Playwright headless, scratchpad — ไม่ได้ commit สคริปต์)
- Chromium: unlock → `contextState: running` · เร่ง 0→250 กม./ชม. 240 เฟรม: engineRate 55 → 1,048 Hz, ขยับมากสุด 1.61%/เฟรม, ไม่ลดลงเลย · กด event ครบ 14 ตัวเห็นเสียงใน `playing` ทุกตัว · ชนรัว 10 ครั้งไม่เกิน pool · mute + ค่าจำใน localStorage · `countdown()` ครบแล้วเพลงแข่งเล่นต่อ · 0 console error
- WebKit: Opus ใช้ได้ · บังคับ AAC ก็เล่นได้ · `.m4a` decode แล้วยาวกว่าเดิม ~16 ms ที่ท้ายไฟล์ (encoder padding) → ทุก loop ใช้ loop point จาก manifest แทนท้ายไฟล์แล้ว
- ยังไม่ได้ทดสอบบน iPhone/Android จริง (MOB-10, AUD-01, AUD-07 ต้องมือถือจริง)

## ต้องฟัง (Tle/QA ที่หน้า lab)
1. เสียงมอเตอร์ฟังเป็นรถไฟฟ้าไหม (ไม่ใช่ "เสียงคอม") — ปรับที่ `motor.ts` (`F_SPAN`, ชั้น partial)
2. ระดับเสียงแต่ละตัว (`TRIM` ใน index.ts) — โดยเฉพาะฝนกับเพลงแข่ง
3. รอยต่อ loop ของเพลงเมนู (ต้นไฟล์ดังกว่าท้ายไฟล์ — อาจได้ยินรอยต่อ ถ้ามีให้ตั้ง crossfade ใน build script) และชั้นมอเตอร์ Kenney (ค่าโดดที่รอยต่อเล็กแต่ไม่ศูนย์)
4. คีย์ของแคนไม่ได้ใส่ใน M1 (ยังไม่มีใครฟังว่าเข้ากับเพลงไหม) · นีออน/ฟ้าร้องไม่ใส่ (GAMEPLAY: ไม่มีฟ้าร้อง, นีออนเป็นงาน M3)

## ข้อควรรู้
- เสียงพากย์ Charlie = ElevenLabs แพลนฟรี → **ไม่เชิงพาณิชย์ + ต้องเครดิต "เสียงพากย์: ElevenLabs"** · ถ้าเกมจะมีสปอนเซอร์ ให้สลับเป็นชุด Kenney CC0 (แก้แค่ลูป `vo-*` ใน build script)
- `public/assets/audio/` ทั้งสองฟอร์แมตรวม ~6.7 MB บนดิสก์ แต่เครื่องหนึ่งโหลดแค่ฟอร์แมตเดียว
