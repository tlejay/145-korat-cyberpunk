# BRIEF M1 — 🔊 audio-dev: ระบบเสียงในเกม
อ่าน CLAUDE.md + docs/dev/M1-CONTRACTS.md (สัญญากลาง — ห้ามแก้ไฟล์นอกโฟลเดอร์ที่เป็นเจ้าของ) + docs/dev/GAMEPLAY.md ก่อน · ห้าม commit/push/deploy · จบด้วย pnpm typecheck && pnpm build ผ่าน + REPORT ตามสัญญา
อ่านเพิ่ม: research/audio/REPORT.md (ทั้งหมด รวม §8 เสียงพากย์) + sources.json · ไฟล์ต้นฉบับใน research/audio/candidates/ (เสียงพากย์ใช้ **voice/mint/charlie/**)

1. `scripts/build-audio.sh`: แปลงไฟล์ที่ REPORT แนะนำ → `public/assets/audio/` เป็น Opus (.ogg/.webm) + AAC (.m4a สำหรับ iOS) ตามขนาดที่แนะนำ · งบโหลดแรก ≤ 1.5 MB
2. `src/audio/`: `createAudio()` ตามสัญญา — Web Audio, unlock ตอนแตะครั้งแรก (iOS), BGM loop ไร้รอยต่อ + เวอร์ชันเร็วรอบสุดท้าย, **มอเตอร์ไฟฟ้า synth (oscillator) ไล่ pitch ตามความเร็ว** + ชั้น Kenney บาง ๆ, ยาง/ดริฟต์ตาม driftAngle, boost/กระโดด (ลมอัด), ลงพื้น, ชน, ฝน/เมือง ambience, เสียงพากย์ Charlie ซิงก์นับถอยหลัง + duck BGM ตอนพากย์, ปรับเพลง/เอฟเฟกต์แยก, pool เสียงซ้อน
3. หน้า `?qa=1&view=audio` มีปุ่มกดฟังทุก event + สไลเดอร์ความเร็วจำลองเสียงมอเตอร์ (ไว้ให้ Tle ฟัง)
4. เพิ่มรายการไฟล์ที่ใช้จริงลง research/CREDITS.md
