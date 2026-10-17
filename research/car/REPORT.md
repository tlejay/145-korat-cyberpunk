# REPORT — Tesla Roadster (รุ่นที่ 2, เปิดตัว 15 ต.ค. 2026)

> **สรุป (สำหรับ conductor)**
> 1. เปิดตัวจริง **15 ต.ค. 2026** ที่ฐานทดสอบ SpaceX เมือง McGregor, Texas (เลื่อนมาจาก 1 ต.ค. เพราะฝน) · เริ่มผลิตปี **2028** · ยังไม่ประกาศราคา
> 2. มี **3 รุ่นย่อย**: Performance (ไม่มี thruster ใช้พัดลมดูดพื้น) · **Thrust** (หัวพ่นแก๊สเย็น 4 หัวด้านท้าย = ออกตัว) · **Rocket** (หัวพ่น 10 หัวรอบคัน = บิน/กระโดด, นั่งได้คนเดียว, ใช้บนถนนไม่ได้)
> 3. ตัวเลขทางการมีน้อยมาก: 0–60 mph < 1.6 / < 0.9 / < 0.59 วิ (ตามรุ่น) · ท็อปสปีด > 230 mph (> 370 กม./ชม.) · ระยะทาง > 300 ไมล์ · ที่เหลือ (1 MW, ~1,700 กก., RWD 2 มอเตอร์) มาจาก**ผู้บริหาร Tesla ให้สัมภาษณ์** Top Gear/Hagerty ไม่ใช่สเปกชีท
> 4. **กระโดด** = แก๊สไนโตรเจน/อากาศอัดแรงดันสูงพ่นผ่านหัวฉีด (cold-gas) ไม่มีการเผาไหม้ · ถังเต็ม = พ่นได้ราว **5–6 วิ** · เติมจริงใช้ **2–6 ชม.** · ในเดโมกระโดดข้ามรถ 5 คันรวม Tesla Semi (สูง 4.1 ม.) และตีลังกากลางอากาศ — **ไม่มีตัวเลขความสูง/เวลาลอยทางการ** (ประเมินจากภาพได้ ~7 ม.)
> 5. **ออกตัวเร็ว** = มอเตอร์ 2 ตัว + หัวพ่นด้านท้าย 4 หัวช่วยดัน + พัดลมดูดพื้นเพิ่มแรงยึดเกาะ (> 2 g)
> 6. ทรงรถ: ลิ่ม (wedge) เหลี่ยมแบบ Cybertruck/Lotus Esprit · **ด้านท้าย = แถบไฟแดงเต็มความกว้าง + ปีกหลังขนาดใหญ่บนขาคอห่าน + กล่อง diffuser ที่มีพัดลม 4 ตัวและหัวพ่น 4 หัว** · ไฟหน้าสามเหลี่ยมเล็กแบบพับเก็บ · ล้อ 6 ก้านบาง · สี Ano White + กระจกสีทอง
> 7. ขนาดตัวรถ: ทางการไม่ประกาศ · ฐานล้อ ~2,825 มม. / กว้าง ~2,000 มม. (มาจากรายงานข่าว **[ยังไม่ยืนยัน]**) · ยาว ~4.45 ม. สูง ~1.25 ม. **(ประเมินจากภาพด้านข้าง)** → ดู `blueprint.md`
> 8. ข้อเสนอเกม: ใช้สเปก "Rocket" เป็นฐาน (ทั้งกระโดด + boost ใช้ถังลมร่วมกัน 1 เกจ) · ตัวเลขฟิสิกส์ใน `specs.json` → `game`
> 9. **Tle ต้องตัดสินใจ:** ใช้ชื่อ/โลโก้ Tesla หรือไม่ (แนะนำ: ไม่ใช้โลโก้ ใช้ชื่อในเกมเอง) — ดูหัวข้อ 7
> 10. ข่าวขัดกันหลายจุด (0–60, แรงม้า, ท็อปสปีด, เวลาเติมถัง) — ตารางเทียบในหัวข้อ 3 · ภาพอ้างอิง 6 ภาพเก็บใน `refs/car/` (gitignored) · ไม่พบภาพ CC บน Wikimedia ของรุ่น 2026

---

## 1. การเปิดตัว — ยืนยันแล้ว

| เรื่อง | ข้อเท็จจริง | แหล่ง |
|---|---|---|
| วันเปิดตัว | 15 ต.ค. 2026 (เดิมนัด 1 ต.ค. ที่ Waco เลื่อนเพราะฝนตกหนัก ประกาศเลื่อน 28 ก.ย.) | [TechCrunch](https://techcrunch.com/2026/10/15/tesla-reveals-spacex-powered-roadster-that-flies-and-falls-with-style/), [Electrek 13 ต.ค.](https://electrek.co/2026/10/13/tesla-roadster-event-thursday-nine-years-delays/), [tech-insider](https://tech-insider.org/tesla-roadster-unveiling-october-15-2026/) |
| สถานที่ | ฐานทดสอบ SpaceX, McGregor, Texas (ถ่ายทอดสด) | [Fox Business](https://www.foxbusiness.com/technology/teslas-new-roadster-makes-flying-debut-hitting-60-mph-under-second), [Wikipedia](https://en.wikipedia.org/wiki/Tesla_Roadster_(second_generation)) |
| ชื่อรุ่น | "Roadster" (รุ่นที่ 2) · ป้ายทะเบียนโชว์ในภาพทางการเขียน `RDSTR` | ภาพทางการ Tesla ผ่าน [Electrek](https://electrek.co/2026/10/15/tesla-unveils-cyberfied-new-roadster-kickflip/) |
| รุ่นย่อย | Performance ("road ready", 2 ที่นั่ง) · Thrust ("race ready", 2 ที่นั่ง, limited release) · Rocket ("air ready", 1 ที่นั่ง, invite only, "not approved for public road use") | [Teslarati](https://www.teslarati.com/tesla-roadster-specs-configurations/), [Electrek](https://electrek.co/2026/10/15/tesla-unveils-cyberfied-new-roadster-kickflip/) |
| รุ่นที่ 4 | ผู้บริหารพูดถึงรุ่น "base" ต่ำกว่า Performance (~800 kW) ในคลิป Top Gear — Tesla ยังไม่ประกาศบนเว็บ **[ยังไม่ยืนยัน]** | [InsideEVs](https://insideevs.com/news/812242/tesla-roadster-2026-specs/) |
| ผลิต | 2028 ที่ Texas (Musk: "2028, actually") | [CNBC](https://www.cnbc.com/video/2026/10/16/tesla-unveils-its-next-generation-roadster-flying-car.html), [InsideEVs](https://insideevs.com/news/812242/tesla-roadster-2026-specs/) |
| ราคา | ไม่ประกาศ · มัดจำ Performance $50,000 · Thrust $250,000 · Rocket เชิญเท่านั้น | [TechCrunch](https://techcrunch.com/2026/10/15/tesla-reveals-spacex-powered-roadster-that-flies-and-falls-with-style/), [Fox Business](https://www.foxbusiness.com/technology/teslas-new-roadster-makes-flying-debut-hitting-60-mph-under-second) |

> ⚠️ ข้อสงสัยต่อเดโม: บางสำนักตั้งคำถามว่าคันที่ตีลังกาเป็นคันจริงหรือ mockup น้ำหนักเบา/วิดีโอ — [SlashGear](https://www.slashgear.com/2288900/was-tesla-roadster-flip-stunt-real-or-ai-generated/), [Autonocion](https://www.autonocion.com/us/tesla-roadster-live-demo-recap/) · Musk บอกว่ารถในเดโม "ขับเอง" (ไม่มีคนนั่ง) — [Not a Tesla App](https://www.notateslaapp.com/news/4837/tesla-roadster-event-recap-it-flies-flips-and-hits-0-60-in-081s)
> ข้อมูลเก่าปี 2017 (0–60 ใน 1.9 วิ, > 250 mph, 620 ไมล์, 3 มอเตอร์ AWD, 2+2 ที่นั่ง) **ไม่ใช่สเปกรุ่นนี้แล้ว** — เว็บหลายแห่งยังลงตัวเลขเก่าอยู่ อย่าใช้

## 2. สเปกและความสามารถ

### 2.1 ตัวเลขหลัก

| รายการ | ค่า | สถานะ | แหล่ง |
|---|---|---|---|
| 0–60 mph Performance | < 1.6 วิ | **ทางการ** (Tesla launch post) | [Teslarati](https://www.teslarati.com/tesla-roadster-specs-configurations/), [Electrek](https://electrek.co/2026/10/15/tesla-unveils-cyberfied-new-roadster-kickflip/) |
| 0–60 mph Thrust | < 0.9 วิ (วิ่งโชว์สด 0.81 วิ — ไม่มีคนกลางจับเวลา) | ทางการ / เดโม | เดียวกัน + [Detroit News](https://www.detroitnews.com/story/business/autos/2026/10/15/tesla-roadster-second-generation-revealed/92272421007/) |
| 0–60 mph Rocket | < 0.59 วิ | ทางการ (เป้า) | [Teslarati](https://www.teslarati.com/tesla-roadster-specs-configurations/) |
| 0–100 กม./ชม. | ไม่มีตัวเลขทางการ · ประมาณ ~1.7 / ~0.95 / ~0.62 วิ (คูณ 62/60 ×~1.03) | **คำนวณเอง** | — |
| ท็อปสปีด | > 230 mph (> 370 กม./ชม.) | ทางการ | [TechCrunch](https://techcrunch.com/2026/10/15/tesla-reveals-spacex-powered-roadster-that-flies-and-falls-with-style/) |
| ท็อปสปีด (คันปัจจุบัน) | 214 mph (344 กม./ชม.) เป้า 330 mph | ผู้บริหารให้สัมภาษณ์ | [InsideEVs](https://insideevs.com/news/812242/tesla-roadster-2026-specs/) |
| กำลัง | > 1,000 kW (> 1,341 hp) รุ่นแรง · base > 800 kW (1,073 hp) | ผู้บริหาร (Moravy) | [InsideEVs](https://insideevs.com/news/812242/tesla-roadster-2026-specs/), [EVXL](https://evxl.co/2026/10/16/tesla-roadster-everything-we-know/) |
| แรงบิด | > 1,032 lb-ft (~1,400 Nm) · base 885 lb-ft | ผู้บริหาร | [InsideEVs](https://insideevs.com/news/812242/tesla-roadster-2026-specs/) |
| น้ำหนัก | ~1,700 กก. (~3,700 lb) รุ่นเบาสุด, ยังไม่ final | ผู้บริหาร | [InsideEVs](https://insideevs.com/news/812242/tesla-roadster-2026-specs/) |
| ขับเคลื่อน | ล้อหลัง (RWD) มอเตอร์หลัง 2 ตัว + torque vectoring ไม่มีเฟืองท้าย | ผู้บริหาร | [InsideEVs](https://insideevs.com/news/812242/tesla-roadster-2026-specs/), [EVXL](https://evxl.co/2026/10/16/tesla-roadster-everything-we-know/) |
| แบตเตอรี่ | 800–1,000 V เซลล์เฉพาะรุ่น ไม่บอกความจุ · ชาร์จ 500 kW (15→85% ~10 นาที) | ผู้บริหาร | [InsideEVs](https://insideevs.com/news/812242/tesla-roadster-2026-specs/) |
| ระยะทาง | > 300 ไมล์ (ทางการ) · 310–320 ไมล์ใช้งานจริง | ทางการ / ผู้บริหาร | เดียวกัน |
| เข้าโค้ง | > 2 g (0–50 mph ด้วยพัดลมดูด ไม่ใช้ปีก) · ยางล้วน ~1.26 g | ผู้บริหาร | [Car and Driver via Yahoo](https://autos.yahoo.com/ev-and-future-tech/articles/explained-tesla-roadster-flies-flips-004630568.html), [Not a Tesla App](https://www.notateslaapp.com/news/4837/tesla-roadster-event-recap-it-flies-flips-and-hits-0-60-in-081s) |
| ช่วงล่าง | Track Mode เตี้ยลง 40 มม. แข็งขึ้น 3 เท่า | Hagerty | [EVXL](https://evxl.co/2026/10/16/tesla-roadster-everything-we-know/) |
| ล้อ/ยาง | หน้า 20" 295/30 · หลัง 21" 335/30 · Pirelli P Zero Trofeo RS | แฟนอ่านจากคลิป **[ยังไม่ยืนยัน]** | [EVXL](https://evxl.co/2026/10/16/tesla-roadster-everything-we-know/) |
| ตัวถัง | แชสซีใหม่ อะลูมิเนียม + คาร์บอน · แมกนีเซียม ไทเทเนียม · steer-by-wire (พวงมาลัย yoke) · brake-by-wire เบรกคาร์บอนเซรามิก | ผู้บริหาร / ทางการ | [InsideEVs](https://insideevs.com/news/812242/tesla-roadster-2026-specs/), [Electrek](https://electrek.co/2026/10/15/tesla-unveils-cyberfied-new-roadster-kickflip/) |

### 2.2 ระบบ "กระโดด / บิน" (cold-gas thrusters)

**กลไกจริง:** ไม่ใช่จรวดเผาเชื้อเพลิง — เป็น**แก๊สเย็นอัดแรงดันสูง** (ไนโตรเจน/อากาศ) เก็บในถังคาร์บอน (COPV) แล้วปล่อยผ่านหัวฉีด แรงดันมาจากแก๊สล้วน ๆ จึงมีแค่ "ไอขาว" พุ่งออก ไม่มีไฟ (ในภาพทางการเห็นเป็นกลุ่มควันขาว)

| รายการ | ค่า | แหล่ง |
|---|---|---|
| หัวพ่น Thrust | 4 หัว ด้านท้าย (ในกล่อง diffuser เหนือพัดลม) ใช้เร่งไปข้างหน้า | [Carbuzz](https://carbuzz.com/new-tesla-roadster-debut-features-specs/), [AutoGuide](https://www.autoguide.com/auto/manufacturers/tesla-manufacturers/the-reality-behind-tesla-s-roadster-thruster-system-44640505) |
| หัวพ่น Rocket | รวม 10 หัว (เพิ่ม 6: หลังล้อแต่ละล้อ 1 + จมูกรถ 2) — แรงไปข้างหน้า, ขึ้นบน, และหมุนตัว | [EVXL](https://evxl.co/2026/10/16/tesla-roadster-everything-we-know/) (Hagerty/MotorTrend), [Teslarati](https://www.teslarati.com/tesla-roadster-specs-configurations/) |
| ทรงตัวกลางอากาศ | actuator ไฟฟ้าปรับหัวพ่นละเอียดเพื่อทรงตัว | ทางการ via [Teslarati](https://www.teslarati.com/tesla-roadster-specs-configurations/) |
| ถัง | Thrust 200 ลิตรในท้ายรถ (กินพื้นที่สัมภาระ) · Rocket +400 ลิตรแทนที่นั่งผู้โดยสาร = 600 ลิตร (~250 กก. อากาศ) | [InsideEVs](https://insideevs.com/news/812242/tesla-roadster-2026-specs/), [Not a Tesla App](https://www.notateslaapp.com/news/4837/tesla-roadster-event-recap-it-flies-flips-and-hits-0-60-in-081s) |
| แรงดัน | ถังรับได้ถึง 10,000 psi (690 bar) · หน้าจอในรถโชว์ 5,500 psi | [EVXL](https://evxl.co/2026/10/16/tesla-roadster-everything-we-know/) |
| แรงขับ | > 80 kN (Moravy) · Tesla บน X: "4–5x the force the tires can" · carwow อ้าง 8,000 Nm (หน่วยแปลก) | [EVXL](https://evxl.co/2026/10/16/tesla-roadster-everything-we-know/), [Fox Business](https://www.foxbusiness.com/technology/teslas-new-roadster-makes-flying-debut-hitting-60-mph-under-second), [carwow](https://www.carwow.co.uk/tesla/news/11408/new-tesla-roadster-revealed-performance-specs-design) |
| เวลาพ่นต่อถัง | ~5–6 วิ | [InsideEVs](https://insideevs.com/news/812242/tesla-roadster-2026-specs/) |
| เติมถัง | 2–6 ชม. (เป้า < 30 นาที) · Hagerty: 6–7 ชม. · Musk อ้างว่าอัดลมเองได้ **[ยังไม่ยืนยัน]** | [InsideEVs](https://insideevs.com/news/812205/tesla-roadster-replenishes-air-tanks/), [AutoGuide](https://www.autoguide.com/auto/manufacturers/tesla-manufacturers/the-reality-behind-tesla-s-roadster-thruster-system-44640505) |
| ความสูง/เวลาลอย | **ไม่มีตัวเลขทางการ** · ประเมินจากภาพเดโม: จุดต่ำสุดของรถสูงจากพื้น ~7 ม. ขณะข้าม Semi (Semi สูง ~4.1 ม.) **[ประเมินจากภาพ ±30%]** | `refs/car/flight-kickflip-over-semi-electrek.jpg` |

**เดโมบนเวที (2 ช็อต):**
1. ขับขึ้นทางลาดโค้งจนคว่ำ (พัดลมดูดตัวรถติดทางลาดไว้) → พ่นตัวออกจากทางลาด พลิกตัวกลับหงาย ลอยนิ่งชั่วครู่ แล้วลงพื้น — [Fox Business](https://www.foxbusiness.com/technology/teslas-new-roadster-makes-flying-debut-hitting-60-mph-under-second)
2. "Kickflip" — ไม่ใช้ทางลาด พ่นตัวขึ้นข้าม Model 3, Model Y, Cybertruck, Cybercab, Semi พร้อมตีลังกากลางอากาศ แล้วลงอีกฝั่ง — [Not a Tesla App](https://www.notateslaapp.com/news/4837/tesla-roadster-event-recap-it-flies-flips-and-hits-0-60-in-081s) · คลิปทางการ "Tesla Roadster — The Kickflip Live Demo" ยาว 0:43 ([eletric-vehicles.com](https://eletric-vehicles.com/videos/tesla/tesla-roadster-the-kickflip-live-demo-sdr3vxm4/))

### 2.3 ระบบ "ออกตัวเร็ว"

ไม่มีชื่อเรียกโหมดอย่างเป็นทางการ (ข่าวไม่พูดถึง "launch mode") — ประกอบด้วย 3 ส่วน:
1. **มอเตอร์ 2 ตัวขับล้อหลัง** ~1 MW (Performance ได้แค่ส่วนนี้ + พัดลม → < 1.6 วิ)
2. **พัดลมดูดพื้น (suction fans)** 4 ตัว ~20 kW/ตัว ใต้ท้าย + skirt ลดลงปิดพื้น → ยางกดแน่นขึ้น ออกตัวไม่ฟรีทิ้ง · 2 โหมด: High-Downforce (ดูดลง) / Low-Drag (เปิดให้ลมไหลผ่าน) · พับพัดลมขึ้นหลบเศษถนนได้ — [Car and Driver via Yahoo](https://autos.yahoo.com/ev-and-future-tech/articles/explained-tesla-roadster-flies-flips-004630568.html), [InsideEVs](https://insideevs.com/news/812242/tesla-roadster-2026-specs/)
3. **หัวพ่น 4 หัวด้านท้าย** (Thrust/Rocket) ดันเพิ่ม — ทั้ง 4 หัวทำงานตอนวิ่ง 0–60 โชว์ — [Carbuzz](https://carbuzz.com/new-tesla-roadster-debut-features-specs/) · Musk: ใช้ได้ "whenever you'd like" — [TechCrunch](https://techcrunch.com/2026/10/15/tesla-reveals-spacex-powered-roadster-that-flies-and-falls-with-style/)

### 2.4 อื่น ๆ ที่เกมใช้ได้

- **ปีกหลัง active**: ขยับด้วย actuator สาย Optimus · ยกออกเมื่อต้องการแรงกด เก็บเมื่อต้องการความเร็ว · **เบรกแรงจะตั้งปีก 90° เป็น airbrake** · ขอบปีกหน้าเอียงได้ถึง 80° — [EVXL](https://evxl.co/2026/10/16/tesla-roadster-everything-we-know/) → เอาไปทำแอนิเมชันปีกตอนเบรก/ดริฟต์ได้สวยมาก
- **หลังคา T-top**: กระจกส่วนบนของประตูถอดออกได้ (เก็บในท้าย) · ประตูเปิดขึ้น (butterfly) — [InsideEVs](https://insideevs.com/news/812242/tesla-roadster-2026-specs/)
- **ไฟหน้าพับเก็บ (pop-down)** สูงแค่ ~15 มม. รวมไฟต่ำ/สูงในชุดเดียว — [EVXL](https://evxl.co/2026/10/16/tesla-roadster-everything-we-know/), [Carbuzz](https://carbuzz.com/new-tesla-roadster-debut-features-specs/)
- **ฝาชาร์จคาร์บอน** มุมท้ายซ้าย หลังปีก — [EVXL](https://evxl.co/2026/10/16/tesla-roadster-everything-we-know/)
- **เสียง**: รถไฟฟ้า — ไม่มีเสียงเครื่อง · หัวพ่นเป็นเสียงแก๊สพ่นแรง (ฟู่/ระเบิดลม) · พัดลมดูดเป็นเสียงหวีดแบบเทอร์ไบน์ — ไม่มีข้อมูลเสียงทางการ **[ยังไม่ยืนยัน]** แนะนำให้ sound designer ฟังจากคลิปทางการ

## 3. ข่าวขัดกัน (เลือกใช้อย่างระวัง)

| ประเด็น | ตัวเลขที่เจอ | ข้อเสนอ |
|---|---|---|
| 0–60 Thrust | 0.55 วิ (rollout, Moravy) · 0.81 วิ (โชว์สด) · ~0.85 วิ (Top Gear) · < 0.9 (ทางการ) | ใช้ "< 0.9 วิ" |
| กำลัง | > 1 MW / 1,341 hp (Moravy) vs 1,500 hp (MotorTrend, Detroit News, AutoGuide) | ใช้ 1,000 kW |
| ท็อปสปีด | 210 (Performance, Hagerty) / 214 (ตอนนี้) / > 230 (ทางการ) / เป้า 330 / Musk 383 mph | ใช้ 230 mph = 370 กม./ชม. |
| เวลาเติมถัง | 2–6 ชม. vs 6–7 ชม. vs เติมเองได้ (Musk) | ไม่สำคัญกับเกม |
| จำนวนพัดลม | 4 (ภาพทางการ + Hagerty) vs 2 (Detroit News) | **4** — เห็นชัดในภาพทางการ |
| จำนวนหัวพ่นท้าย | 4 หัว (Thrust) vs "10 หัวใน diffuser" (บางสำนักสับสนกับ Rocket) | ภาพทางการเห็น 4 หัวเหนือพัดลม + มีหัวใต้ซุ้มล้อหลัง 2 หัว (น่าจะเป็นของ Rocket) |
| มัดจำ | $50k (เว็บจอง) vs $5k + $45k ใน 10 วัน (Electrek) | ไม่เกี่ยวกับเกม |
| ฐานล้อ | 2,825 มม. (Wikipedia อ้าง Top Gear — เปิดต้นทางไม่ได้, 403) | ภาพด้านข้างวัดได้ ~2,800 มม. ใกล้เคียง → ใช้ได้แต่ติด [ยังไม่ยืนยัน] |

## 4. รูปทรงสำหรับปั้นโมเดล (สรุป — รายละเอียดตัวเลขใน `blueprint.md`)

ภาพรวม: **ลิ่มเหลี่ยมต่ำ** แรงบันดาลใจ SR-71 / F-35 (Tesla) — นักข่าวเทียบ Lotus Esprit (The Spy Who Loved Me) และ Lamborghini · ภาษาออกแบบ Cybertruck/Cybercab · พื้นผิวเรียบ (flush) เส้นพับคม ไม่มีโค้งมน — [TechCrunch](https://techcrunch.com/2026/10/15/tesla-reveals-spacex-powered-roadster-that-flies-and-falls-with-style/), [Electrek](https://electrek.co/2026/10/15/tesla-unveils-cyberfied-new-roadster-kickflip/) **ดีมากสำหรับ low-poly** (ทรงเหลี่ยมอยู่แล้ว)

| มุม | ต้องมี (จากภาพทางการใน `refs/car/`) |
|---|---|
| **ท้าย (สำคัญสุด)** | แถบไฟแดง **เต็มความกว้าง** เส้นเดียวบาง ๆ (มีเส้นแดงจาง ๆ ชั้นล่างอีกเส้นในภาพ close-up) · **ปีกหลังใหญ่** ตั้งบนขาคอห่าน (swan-neck) 2 ขา กว้างเกือบเท่าตัวรถ แผ่นปีกโทนทองแดง/ทองสะท้อน · ใต้ไฟท้ายมีป้าย `RDSTR` สีเงินกลางท้าย · **กล่อง diffuser สีดำ** กว้าง ~60% ของตัวรถ แบ่ง 4 ช่องด้วยครีบตั้ง แต่ละช่องมี**พัดลมกลม** · แถวบนกล่องมี **หัวพ่น 4 หัวขอบสีทอง/ไทเทเนียม** เรียงแนวนอน · ข้างกล่อง (หลังล้อหลัง) มีหัวพ่นชี้ลงอีก 1 หัวต่อข้าง · ยางหลังใหญ่โผล่ให้เห็นชัดจากด้านหลัง |
| **ข้าง** | ลิ่มยาว จมูกแหลมต่ำมาก → เส้นขอบหน้าต่างไล่ขึ้นเป็นเส้นตรงถึงหลังคา → หลังคายาวเกือบแบนแล้วลาดลงท้ายเป็นแผ่นตรง (fastback เหลี่ยม) · กระจกบานใหญ่สีทอง/ชาซ่อนเสาเกือบหมด · เส้นตัดประตูเอียง · **แผงล่าง (sill) สีดำ** ยาวตลอดระหว่างล้อ ตัดกับตัวถังขาว · ซุ้มล้อตัดเหลี่ยม · ไฟเลี้ยวส้มเล็กหลังซุ้มล้อหน้า |
| **หน้า** | ฝากระโปรงแบนกว้างเป็นแผ่นสี่เหลี่ยมคางหมู · ขอบบนกันชนมี **แถบไฟขาวบางเต็มความกว้าง** · **ไฟหน้าสามเหลี่ยมเล็ก** ที่มุมบนสองข้าง (ซ่อน/พับได้) · บังโคลนหน้าเป็นแผ่นเหลี่ยมพับลง · ใต้แถบไฟเป็นช่องดำกว้าง + สปลิตเตอร์ |
| **3/4 หลัง** | (มุมกล้องเกม) — เห็นไฟแดงเต็มแถบ + ปีก + เงาด้านข้างลิ่ม + ล้อหลังใหญ่ · ไม่มีภาพทางการมุมนี้ใน refs → ปั้นจากการผสมภาพข้าง+ท้าย |
| **บน** | ไม่มีภาพทางการ · จากภาพบินกลางอากาศ: กระจกหลังคายาวต่อเนื่องเป็นแผ่นเดียว ตัวถังขาวรอบ · ใต้ท้องรถแบนเรียบ มีช่อง diffuser ด้านหลัง |
| **ล้อ** | **6 ก้านบางสีดำ** วางบนจานหลังสีเทาอ่อนเรียบ (aero disc) — "super-light wheels with thin spokes" ([Teslarati](https://www.teslarati.com/tesla-roadster-specs-configurations/)) · หน้าเล็กกว่าหลังเล็กน้อย |
| **สี** | **Ano White** (ขาวด้านกึ่งเงา แรงบันดาลใจสารเคลือบจรวด) · กระจก **Gold Glazed** (ทอง/ชา เหมือนหน้ากากชุดอวกาศ) · ขอบไทเทเนียม · ล่างดำ/คาร์บอน — [Teslarati](https://www.teslarati.com/tesla-roadster-specs-configurations/), [Electrek](https://electrek.co/2026/10/15/tesla-unveils-cyberfied-new-roadster-kickflip/) |
| ภายใน (ไม่ใช้ในเกม) | yoke ขาว จอกลาง จอเล็กหน้าคนขับ เบาะติดตัวถัง |

**3 อย่างที่ต้องมีถึงจะดูออกว่าเป็นรุ่นนี้:** (1) แถบไฟแดงเต็มความกว้าง + ปีกใหญ่บนขาคอห่าน (2) กล่อง diffuser พัดลม 4 ตัว + หัวพ่น 4 หัว (3) ลิ่มเหลี่ยมสีขาวกับกระจกทอง

## 5. ภาพอ้างอิง (`refs/car/` — gitignored, ห้ามใช้เป็น texture)

| ไฟล์ | มุม | URL ต้นทาง | เครดิต |
|---|---|---|---|
| `side-profile-tesla-via-electrek.jpg` | ข้างซ้ายเต็มคัน (3440×1024) | https://electrek.co/wp-content/uploads/sites/3/2026/10/roadster-02-pilot-tesla-roadster-2026.jpg | Tesla |
| `front-tesla-via-electrek.jpg` | หน้าตรง | https://electrek.co/wp-content/uploads/sites/3/2026/10/roadster-03-carousel-slide-1-tesla-roadster-2026.jpg | Tesla |
| `rear-upright-and-inverted-tesla-via-electrek.jpg` | ท้ายตรง (คว่ำ/หงาย + หัวพ่นทำงาน) | https://electrek.co/wp-content/uploads/sites/3/2026/10/roadster-06-gravity-tesla-roadster-2026.jpg | Tesla |
| `rear-closeup-taillight-wing-nozzles-tesla-via-electrek.jpg` | ท้ายใกล้: ไฟ ปีก หัวพ่น พัดลม | https://electrek.co/wp-content/uploads/sites/3/2026/10/roadster-07-augments-tesla-roadster-2026.jpg | Tesla |
| `flight-kickflip-over-semi-electrek.jpg` | กลางอากาศข้าม Semi (ใช้ประเมินความสูง) | https://electrek.co/wp-content/uploads/sites/3/2026/10/Tesla-Roadster-kick-flips-through-the-air.jpeg | Tesla livestream via Electrek |
| `interior-yoke-electrek.jpg` | ภายใน | https://electrek.co/wp-content/uploads/sites/3/2026/10/SCR-20261015-snqs.jpeg | Tesla livestream via Electrek |

- ขาด: มุม 3/4 หลัง และมุมบน → ถ้าจำเป็นให้ pane Chrome แคปจากคลิปทางการ (YouTube/X ของ Tesla) เพิ่ม
- **Wikimedia Commons**: ค้นแล้วไม่พบภาพ CC ของรุ่น 2026 (เจอแต่รุ่นแรกปี 2008) → ไม่มีอะไรเพิ่มใน `research/CREDITS.md`

## 6. ข้อเสนอสำหรับเกม

แนวคิด: **รถผู้เล่น = สเปก "Rocket"** (รุ่นเดียวที่ทั้งกระโดดและพ่นออกตัวได้) แต่ปั้นแบบ 2 ที่นั่งตามภาพ (ภายนอกต่างกันแค่หัวพ่นเพิ่ม 6 หัว) — ตัวเลขทั้งหมดอยู่ใน `specs.json` → `game`

**ฟิสิกส์ (arcade, ปรับให้สนุกบนแผนที่เล็ก ~1.4 กม.)**
- มวล 1,700 กก. · ขับล้อหลัง · จุดศูนย์ถ่วงต่ำมาก (แบตใต้พื้น) ~0.40 ม.
- ความเร่งพื้นฐาน: 0–100 ใน ~2.5 วิ (ช้ากว่าจริง 1.6 วิ เพื่อให้รู้สึกถึงความต่างตอนกด boost) · ท็อปสปีดปกติ 280 กม./ชม. · ตอน boost ปลดเพดานไป 370 กม./ชม. (= ตัวเลขทางการ)
- ถนนรอบลานย่าโมเป็นวงเวียน/ทางตรงสั้น → ความเร็วเฉลี่ยจริงในเกมจะอยู่ 80–200 กม./ชม.
- **Grip mode (พัดลมดูด)** = ทำให้ดริฟต์เข้าโค้งได้ที่ความเร็วต่ำโดยไม่หลุด: grip ปกติ ~1.2 g, ตอนเบรก/เข้าโค้งเปิดพัดลมได้ถึง ~2 g (ตรงของจริง) · โชว์ไฟพัดลมหมุนที่ท้าย
- ปีกหลัง: ขยับตามความเร็ว · กดเบรกแรงปีกตั้ง 90° (airbrake ของจริง)

**เกจ "ถังลม" ใบเดียว (100 หน่วย ≈ ของจริงพ่นได้ 5–6 วิ)**
- **ปุ่ม BOOST (ออกตัวเร็ว)**: ใช้หัวพ่นท้าย 4 หัว · กดค้าง = แรงดันเพิ่ม ~+1.5 g · กินถัง 20 หน่วย/วิ (หมดใน 5 วิ เท่าของจริง) · เอฟเฟกต์ไอขาว 4 ลำ + FOV กว้างขึ้น · ไม่มีไฟ/เปลวเพลิง (cold gas — **ห้ามทำเป็นจรวดไฟพ่น** จะผิดความจริง)
- **ปุ่ม JUMP (กระโดด)**: หัวพ่นใต้รถยกตัวทีเดียว · กินถัง 35 หน่วย · ความสูง ~3.5 ม. (ข้ามรถเก๋ง/รถสองแถวได้) เวลาลอย ~1.6 วิ · ของจริงข้าม Semi ได้ ~7 ม. แต่ในเมืองมีสายไฟ/ป้าย ความสูงที่สูงไปจะชนฉาก → ให้ "กดค้างตอนอยู่กลางอากาศ" เพิ่มเวลาลอยได้ (hover) โดยกินถังต่อ
- ทรงตัวกลางอากาศอัตโนมัติ (ของจริงมี actuator ทรงตัว) → ลงพื้นตรงเสมอ ไม่พลิกคว่ำ · ตีลังกา (kickflip) เป็นท่าโบนัสได้ถ้าอยากทำ
- **เติมถัง**: ของจริงใช้เป็นชั่วโมง → เกมใช้การเติมเองช้า ๆ (~4 หน่วย/วิ ตาม claim ของ Musk ว่าอัดลมเองได้) + จุด "สถานีอัดลม" นีออนบนถนน
- ห้ามใช้ JUMP/BOOST ใกล้อนุสาวรีย์ท้าวสุรนารีให้ข้ามหรือชน (ตามกฎ CLAUDE.md) → ตั้ง no-jump zone รอบลานย่าโม

**ไฟ/สไตล์ cyberpunk** — ตัวรถจริงเข้ากับธีมมาก: ไฟท้ายแดงเต็มแถบ + ไฟหน้าแถบขาว = เส้นนีออนพร้อม bloom · แต่งเพิ่มได้ (ไฟใต้ท้อง, หัวพ่นเรืองแสงตอน boost) โดยไม่เปลี่ยนรูปทรง

## 7. เครื่องหมายการค้า (ให้ Tle ตัดสินใจ)

- "Tesla", "Roadster" (ในบริบทรถ Tesla) และโลโก้ T เป็นเครื่องหมายการค้าของ Tesla · การทำเกมที่ใช้ชื่อ/โลโก้แบรนด์รถ เกมเชิงพาณิชย์ปกติต้องได้ใบอนุญาตจากผู้ผลิต · การเลียนรูปทรงรถ (trade dress) ก็อาจเข้าข่ายได้ แต่ความเสี่ยงต่ำกว่าใช้โลโก้
- ภาพทางการ**ไม่มีโลโก้ T ด้านท้าย** มีแค่ป้าย `RDSTR` → ปั้นตามจริงโดยไม่ใส่โลโก้ได้เลย
- ตัวเลือก:
  1. **(แนะนำ)** ไม่ใส่โลโก้ · ป้ายท้ายใช้ชื่อในเกม (เช่น ป้ายทะเบียนไทยสไตล์โคราช) · ในเมนูเรียกชื่อกลาง ๆ หรือชื่อเล่นที่ตั้งเอง + เขียนในหน้าเครดิตว่า "ได้แรงบันดาลใจจาก Tesla Roadster (2026) ไม่มีส่วนเกี่ยวข้องกับ Tesla, Inc."
  2. ใช้ชื่อ "Tesla Roadster" ตรง ๆ (เล่าเรื่องบน madebytle.com ได้แรงกว่า) — ความเสี่ยงสูงขึ้นถ้าเกมเผยแพร่สาธารณะ
  3. ใส่ทั้งชื่อ + โลโก้ — ไม่แนะนำ
- ภาพข่าวทุกภาพ **ใช้อ้างอิงปั้นเท่านั้น** ห้ามแปะเป็น texture / ห้าม commit (อยู่ `refs/` แล้ว)

## 8. แหล่งข้อมูลทั้งหมด

- TechCrunch 15 ต.ค. 2026 — https://techcrunch.com/2026/10/15/tesla-reveals-spacex-powered-roadster-that-flies-and-falls-with-style/
- Electrek 15 ต.ค. 2026 — https://electrek.co/2026/10/15/tesla-unveils-cyberfied-new-roadster-kickflip/
- Electrek 13 ต.ค. 2026 — https://electrek.co/2026/10/13/tesla-roadster-event-thursday-nine-years-delays/
- Fox Business — https://www.foxbusiness.com/technology/teslas-new-roadster-makes-flying-debut-hitting-60-mph-under-second
- CNBC (วิดีโอ) — https://www.cnbc.com/video/2026/10/16/tesla-unveils-its-next-generation-roadster-flying-car.html
- CNN (เปิดไม่ได้ HTTP 451, อ้างผ่านผลค้นหา) — https://www.cnn.com/2026/10/15/business/tesla-unveils-what-it-says-is-a-flying-car
- Teslarati — https://www.teslarati.com/tesla-roadster-specs-configurations/
- InsideEVs สเปกเต็ม (Moravy + von Holzhausen ในคลิป Top Gear) — https://insideevs.com/news/812242/tesla-roadster-2026-specs/
- InsideEVs ถังลม — https://insideevs.com/news/812205/tesla-roadster-replenishes-air-tanks/
- EVXL รวมทุกแหล่ง — https://evxl.co/2026/10/16/tesla-roadster-everything-we-know/
- Car and Driver via Yahoo — https://autos.yahoo.com/ev-and-future-tech/articles/explained-tesla-roadster-flies-flips-004630568.html
- AutoGuide — https://www.autoguide.com/auto/manufacturers/tesla-manufacturers/the-reality-behind-tesla-s-roadster-thruster-system-44640505
- Carbuzz — https://carbuzz.com/new-tesla-roadster-debut-features-specs/
- carwow — https://www.carwow.co.uk/tesla/news/11408/new-tesla-roadster-revealed-performance-specs-design
- Not a Tesla App — https://www.notateslaapp.com/news/4837/tesla-roadster-event-recap-it-flies-flips-and-hits-0-60-in-081s
- Detroit News — https://www.detroitnews.com/story/business/autos/2026/10/15/tesla-roadster-second-generation-revealed/92272421007/
- Wikipedia — https://en.wikipedia.org/wiki/Tesla_Roadster_(second_generation)
- Top Gear (403 เปิดไม่ได้ — อ้างผ่าน InsideEVs/EVXL) — https://www.topgear.com/car-news/first-look/wow-new-tesla-roadster-can-actually-fly
- tesla.com/roadster (403 เปิดไม่ได้ — ข้อความทางการอ้างผ่าน Teslarati/Electrek)
