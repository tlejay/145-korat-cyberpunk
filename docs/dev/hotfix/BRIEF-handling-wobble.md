# BRIEF — ปรับการเกาะถนน: รถส่ายบนทางตรง · 2026-10-18 (Tle ผ่าน Mint 04:10)

อาการที่ Tle เจอ: วิ่งทางตรงแล้วรถส่าย/โยก (wobble) ไม่นิ่ง — ต้องการให้ทางตรงนิ่ง มั่นใจ แต่ยังดริฟต์สนุกตามเดิมในโค้ง
ไฟล์: `src/car/physics*.ts`, `src/car/config.ts`, `src/car/camera.ts` (อ่าน `docs/dev/PHYSICS.md` ก่อน)

1. **ทำซ้ำให้เห็นก่อน** ด้วย QA hooks (`?qa=1`, `window.__game`) — เร่งตรงบนราชดำเนิน/มนัส ทั้งปล่อยพวงมาลัย และแตะซ้ายขวาเล็กน้อยแบบนิ้วโป้งบนมือถือ (input แบบ digital ±1 + ramp ของปุ่มสัมผัส) วัด yaw rate, heading oscillation, slip angle, ความถี่/แอมพลิจูดการส่าย และแยกให้ได้ว่าเป็น **ฟิสิกส์** (yaw oscillation จาก tyre/ESC/suspension) หรือ **กล้อง** (camera lag/spring) หรือ **input** (steer ramp/คืนศูนย์)
2. แก้ที่ต้นเหตุ เช่น yaw damping, ESC gain, steer ramp/speed-sensitive steering, คืนศูนย์ของพวงมาลัย, camera smoothing — ปรับน้อยที่สุดที่หายส่าย
3. เกณฑ์ผ่าน: ทางตรงปล่อยพวงมาลัยที่ 100/200/300 กม./ชม. heading oscillation < 0.3° และไม่มีการแกว่งต่อเนื่อง · แตะเลี้ยวแล้วปล่อย รถนิ่งภายใน ~0.5 วิ ไม่ overshoot เกิน 1 รอบ · **ดริฟต์ 95° ที่สี่แยกยังทำได้** · เวลาต่อรอบของ bot/replay อ้างอิงเปลี่ยนไม่เกิน ±1% (รายงานตัวเลข) — ถ้าเกิน บอกให้ conductor ตัดสินเรื่อง leaderboard
4. `pnpm typecheck && pnpm build && pnpm qa` ผ่าน (รวม FEEL-*) · **ไม่ต้อง bump version / ไม่แตะ ACCEPTED_BUILDS** (conductor ทำ) · ห้ามแตะ `public/assets/img`, `index.html` (pane อื่นทำอยู่)
5. ห้าม commit/push/deploy · ห้ามพอร์ต 5199 · ปิด server ก่อนจบ · REPORT ที่ `docs/dev/hotfix/REPORT-handling-wobble.md` (≤ 15 บรรทัดบนสุด: ต้นเหตุ · ค่าที่เปลี่ยน ก่อน→หลัง · ตัวเลขวัดก่อน/หลัง · เวลาต่อรอบ)
