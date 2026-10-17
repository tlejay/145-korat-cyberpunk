# BRIEF M3 — 💨 fx: ฟิสิกส์ฉาก (สายไฟ/โคม/ป้ายแกว่ง) + VFX รถ
อ่าน CLAUDE.md + docs/dev/M1-CONTRACTS.md + docs/dev/REPORT-M2-streetscape.md (§5 anchors) + docs/dev/PHYSICS.md (ฝน/สายไฟ) + docs/qa/TEST-PLAN.md (VIS/PERF) ก่อน · ห้าม commit/push/deploy · typecheck+build ผ่าน + REPORT ที่ docs/dev/REPORT-M3-<ชื่อ pane>.md · งบมือถือรวมทั้งฉากหลังเพิ่ม M3: ≤ 150 draw calls · ≤ 500k tris · quality tier low/mid/high ต้องปิดของหนักได้ (bloom/ฝน/สะท้อน)
**เจ้าของไฟล์:** `src/fx/**` (ใหม่) — export `createFx(scene, track, car): { update(dt, camera): void; dispose(): void }` ให้ pane visuals ต่อเข้า game loop (เขียนวิธีต่อใน REPORT) · ใช้ `src/car/physics-cables.ts` ที่มีอยู่ (แก้ได้ถ้าจำเป็น บอกใน REPORT)
1. **สายไฟพันกันแกว่ง** จาก `extras.cableSpans` (403 ช่วง) ด้วย CableSystem · ลมรถ ×8 · ลมพายุจริง · LOD ไกลไม่ simulate · ซ่อน mesh `cables` นิ่งของ M2
2. **โคมจีน 85 + ป้าย blade 138 แกว่ง** (pendulum ตาม PHYSICS §7) ตอนรถผ่าน/กระโดดผ่าน — ทำงานกับ mesh ของ visuals (ตกลง naming ผ่าน REPORT หรืออ่านโค้ดของ visuals)
3. **VFX รถ**: ไอพ่นแก๊สเย็นสีขาวจาก `nozzles` (rear = boost/launch, side-down = กระโดด/landing burn) · ควันยาง/ละอองน้ำตอนดริฟต์บนถนนเปียก · น้ำกระจายตอนตกคู/ลุยแอ่ง · ประกายตอนชนแบริเออร์ · ทั้งหมด pool particles งบต่ำ
4. คำนวณ cost ต่อเฟรม (เป้า fx รวม < 1.5 ms มือถือกลาง) แล้วใส่ใน REPORT · ภาพ/GIF เก็บ `refs/m3/fx-*`

## เพิ่ม (Tle สั่ง 20:12) — ควันขาวตอนกระโดด/boost ต้องตรงภาพข่าว + คำนวณจากฟิสิกส์จริง
- **ดูภาพข่าวก่อน** (Read ได้ ห้ามใช้เป็น texture): `refs/car/rear-closeup-taillight-wing-nozzles-tesla-via-electrek.jpg` (ไอขาวพุ่งลงพื้นจากหัวพ่นข้างล้อหลัง), `refs/car/flight-kickflip-over-semi-electrek.jpg`, `refs/car/rear-upright-and-inverted-tesla-via-electrek.jpg` + `research/car/REPORT.md` บรรทัดเรื่องกลไก — จดใน REPORT ว่าภาพข่าวเห็นควันแบบไหน (สี ทรง ความยาวลำ ฟุ้งตอนกระทบพื้นไหม ค้างนานแค่ไหน)
- **ฟิสิกส์ของไอขาว** (อธิบายใน REPORT สั้น ๆ + ใช้ตัวเลขจริง): แก๊สอัดขยายตัวเร็วผ่านหัวฉีด → อุณหภูมิลดลงมาก (adiabatic expansion) → ไอน้ำในอากาศรอบลำควบแน่นเป็นละอองขาว · ใช้ค่าจาก PHYSICS.md (ไอพ่น ~650 ม./วิ, แรงขับ, ถัง 225 กก.) คำนวณ **อัตราไหลมวล (ṁ = F/vₑ)** ต่อหัว → กำหนดจำนวน/ความเร็ว/อายุ particle ให้สัมพันธ์กับแรงขับจริง (แรงมาก = ลำยาวหนา) · ลำพุ่งตรงช่วงแรกแล้วชะลอ/ขยายเป็นกลุ่มควัน · **ground effect**: เมื่อหัวพ่นห่างพื้น < ~2 ม. ไอกระทบพื้นแล้วแผ่ออกเป็นวงรอบรถ (ตอนออกตัว/ยกตัว/landing burn) · ลมจากรถวิ่งพัดควันไปข้างหลัง · ฝนตกทำให้จางเร็วขึ้น · ความชื้นสูงในเมืองไทยกลางคืน = ควันขาวชัด
- **ห้ามมีไฟ/เปลว/สีส้ม** (cold gas) · แสงนีออน/ไฟท้ายแดงสะท้อนบนกลุ่มควันได้ (lit particles หรือ tint ตามสีรอบตัว ราคาถูก)
- เพิ่มค่า hook ให้ QA: `plume.massFlowKgS`, `plume.particles` · ใส่เกณฑ์ใน REPORT ให้ QA ตรวจได้
- แคปภาพเทียบกับภาพข่าว `refs/m3/fx-plume-compare.png`
