# BRIEF — เสียงพากย์ภาษาอังกฤษ (announcer)

อ่าน `CLAUDE.md` + `research/audio/REPORT.md` ก่อน · ห้าม commit
Tle อนุญาต (18:46) ให้ใช้ **เสียงพากย์ภาษาอังกฤษ** เพื่อความตื่นเต้น (ข้อความบนจอยังเป็นไทย)

## งาน
1. หาเสียงพากย์ **CC0 (ดีที่สุด) หรือ CC-BY** สไตล์เกมแข่งรถ/อาร์เคด เสียงเดียวกันทั้งชุด: "Three", "Two", "One", "Go!" · "Final lap!" · "New record!" / "New lap record!" · "Finish!" · ถ้ามี: "Boost!", "Nice drift!", "Great jump!", "Checkpoint", "You win!"
   - แหล่งที่ควรดู: Kenney (Voiceover Pack ฯลฯ), OpenGameArt, Freesound (กรอง CC0), Pixabay (เช็คเงื่อนไขล่าสุด) · ❌ ห้าม NC / ไม่รู้ license
   - ถ้าคำไหนไม่มี: เสนอทางเลือก (ตัดจากชุดเดียวกัน / TTS ที่ license อนุญาตให้ใช้ในเกม — ระบุเงื่อนไขชัด)
2. ดาวน์โหลดไป `research/audio/candidates/voice/` (โฟลเดอร์นี้ gitignored) · เพิ่มรายการใน `research/audio/sources.json` + `research/CREDITS.md`
3. แปลงชุดที่แนะนำเป็นไฟล์เล็ก (Opus + AAC สำหรับ iOS) วัดขนาดรวม
4. เพิ่มหัวข้อ "เสียงพากย์ (อังกฤษ)" ใน `research/audio/REPORT.md`: ตาราง คำ → ไฟล์ → license + จังหวะที่เกมควรเล่น (ซิงก์กับนับถอยหลัง/ตอนเข้ารอบสุดท้าย) · ไฟ ducking BGM ตอนพากย์
5. สรุป ≤ 8 บรรทัดแล้วจบ turn (ฟังเสียงเองไม่ได้ ให้บอกว่าเลือกจากอะไร)
