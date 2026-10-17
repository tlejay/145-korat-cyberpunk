# REPORT — 🏁 sponsors: ป้ายสปอนเซอร์แบบสนาม F1 + ป้ายทะเบียน MADEBYTLE

1. **ครบ 7 ข้อตามบรีฟ + ส่วนเพิ่ม 20:27** · `pnpm typecheck && pnpm build` ผ่าน · ไม่ได้ commit / push / deploy · ไม่ได้เพิ่ม dependency
2. **ป้ายทะเบียน** = `MADEBYTLE` พื้นขาว ตัวดำหนา + แถบ gradient แบรนด์ (`src/car/model-plate.ts`) อ่านได้ชัดจากกล้องหลัง
3. **ซุ้มเส้นชัย** คร่อมราชดำเนินตรง `finishLine` (ผังใหม่ใต้ลาน: x −19, z +131) · คานจอ LED ด้านใต้ "made by tle" ด้านเหนือ NDA · เสา 2 ต้น (เสาฝั่งตะวันตกมีจอแนวตั้ง) · ห่างขอบลานย่าโม (OSM) **85 ม.** ห่างอนุสาวรีย์ 133 ม. · มองจากถนนไม่บังอนุสาวรีย์ (ภาพ 5)
4. **ไฟสตาร์ท 5 ดวง × 2 แถว** แบบ F1 ที่ซุ้ม + **ชุดไฟซ้ำ (repeater) ข้างหน้ากริด 20 ม.** — จำเป็นเพราะกริดอยู่เลยเส้นชัย 10 ม. กล้องหันหนีซุ้ม · กางไฟห่าง 1.1 ม. ให้พ้นตัวเลข HUD กลางจอ · **game-ui/visuals ต่อ API แล้ว** ทดสอบนับถอยหลังจริง: 1→2→3→5 ดวง → เขียวตอน "ไป!" → ดับ
5. **ป้ายเลียบแบริเออร์ 25 แผ่น** (8 × 1 ม. ติดหน้าราว/หน้าตึก ชุดละ 3 แผ่น สลับ MADEBYTLE/NDA): ทางตรงก่อนเส้นชัย 6 · ราชดำเนินหลังเส้นชัย 10 · มนัส 9 · ทุกแผ่นห่างขอบลาน ≥ 45 ม. ไม่อยู่ใกล้วัด/ประตู/ซุ้มพระบรมฉายาลักษณ์ ไม่ทับแบริเออร์นีออนปากซอย
6. **ป้ายบนสะพานลอย 224 ทั้ง 2 ตัว** (หน้า+หลัง) · **บิลบอร์ดหลังคา 5 จุด** ส่ง texture ให้ visuals: MBT / NDA / MBT / NDA / ร่วม 2 แบรนด์ — ใช้พื้นหลังจาก art pane (`sponsor-bg-*.webp`) วางโลโก้ทับด้วย canvas
7. **โลโก้ NDA**: แปลงจากไฟล์จริงด้วย `scripts/sponsor-logos.py` → `nda-h-dark.png` (พื้นใส ตัวอักษรขาว **ตารางส้มคงสีเดิมทุกพิกเซล** ไม่บิดสัดส่วน) + `nda-h-color.png` (สีเดิม ใช้บนบิลบอร์ดพื้นส้มอ่อน) + `nda-v-dark.png` (แนวตั้ง เผื่อหน้าเครดิต)
8. **LED**: เปลี่ยนสปอนเซอร์บนป้ายเลียบทาง/เสาทุก 7 วิ (หรี่-สว่าง 1 ครั้ง) + แสงกวาดช้า 1 รอบ/4 วิ → **≤ 0.3 ครั้ง/วิ** (เกณฑ์ ≤ 3) · tier low ปิดแสงกวาด
9. **งบ:** **3 draw calls / 530 สามเหลี่ยม** ทั้งระบบ (เกณฑ์ ≤ 12) · texture ใหม่ 1 ใบ 1024×256 = **1.4 MB GPU รวม mip** + ป้ายทะเบียนขนาดเท่าเดิม (แทนของเก่า) · ไฟล์ดาวน์โหลดใหม่ 66 KB
10. **ต้องให้ conductor ส่งต่อ:** หน้าเครดิต (`src/ui/**`) เพิ่ม "สนับสนุนโดย สมาคมดิจิทัลนครราชสีมา · MADEBYTLE" (หัวข้อ 5)
11. ภาพเทียบ 8 มุม `refs/m3/sponsors-*.png` (gitignored) · สคริปต์แคปซ้ำอยู่หัวข้อ 6

---

## 1. ไฟล์

| ไฟล์ | ทำอะไร |
|---|---|
| `src/sponsors/index.ts` | `buildSponsors(track)` วางทุกอย่าง + `getStartLights()` + re-export `getSponsorTexture` |
| `src/sponsors/textures.ts` | วาดโลโก้/ป้ายด้วย canvas + ฟอนต์จริง · atlas ป้าย (แถว MBT / แถว NDA) · บิลบอร์ด 5 แบบ · โหลดพื้นหลังจาก art-manifest |
| `src/sponsors/geo.ts` | ตัวรวม geometry (กล่อง/แผ่น) ให้เหลือ 1 draw call ต่อวัสดุ |
| `src/car/model-plate.ts` | ป้ายทะเบียน MADEBYTLE |
| `scripts/sponsor-logos.py` | `python3 scripts/sponsor-logos.py` สร้างโลโก้ NDA พื้นมืด/สีเดิม จาก `~human/nda logo/` |
| `public/assets/sponsors/` | `nda-h-dark.png` · `nda-h-color.png` · `nda-v-dark.png` · `madebytle-logo.svg` (โลโก้ตามสเปก BRAND §3–4 เผื่อใช้หน้าเครดิต) |

**สลับโลโก้ NDA = แก้ไฟล์เดียว:** วางไฟล์ใหม่ทับ `public/assets/sponsors/nda-h-dark.png` (ถ้าลบไฟล์ทิ้ง ป้ายจะกลับไปใช้ตัวอักษรไทย "สมาคมดิจิทัลนครราชสีมา" อัตโนมัติ)

## 2. การวางตำแหน่ง (อ่านจากข้อมูลสนาม ไม่ตั้งตัวเลขตายตัว)

- **ระหว่างทำงาน world สร้าง `track-A.json` ใหม่ (เส้นชัยย้ายไปใต้ลาน commit a17e0ef)** → ช่วงวางป้ายจึงอิง `corners` / `roadNames` แทนค่า s: ก่อนเส้นชัย = โค้งสุดท้าย +190 ม. ถึงเส้นชัย · หลังเส้นชัย = s 15 ถึงโค้งแยก 224 −40 ม. · มนัส = ต้นถนน +130 ม. (พ้นคันดิน) ถึงปลาย −35 ม. · repeater = `startGrid.s` + 20 ม.
- **ป้ายติดผนังชนจริง:** หาขอบที่ขับไม่ได้ด้วย `surfaceAt` แล้ว snap ปลายป้ายเข้ากับเส้น collider (`extras.walls`) ชนิด ราว/ราวคู/หน้าตึก · ป้ายยื่นหน้าราว 4 ซม. (ราวของ world วาดอยู่หลังเส้น collider) · ขาซุ้มอยู่หลังผนังชน รถชนไม่ถึง
- **ตัวกรอง (ทุกจุดของแผ่น 5 จุด):** `sacredFilter` ของ neon (อนุสาวรีย์ 75 ม. + วัด/ประตู/ซุ้มพระบรมฉายาลักษณ์/ศาลากลาง +18 ม.) · เขต `noBoostNoJump` +30 ม. (= ≥ 45 ม. จากขอบลาน) · ห่างแบริเออร์นีออนปากซอย/ราวลาน ≥ 2.5 ม. · ทางตรง (หักเลี้ยว < 6°) · ระยะขอบนิ่ง (±0.7 ม.)
- **ทางตรงก่อนเส้นชัย** เริ่มหลังโค้งกำแหงสงคราม 190 ม. เพราะช่วงแรกผ่านซุ้มประตู + กำแพงลูกกรงวัดสุทธจินดา (research A-30/A-31)
- ขาซุ้มฝั่งที่อยู่ในเขตกันชนลาน (ถ้ามี) จะเป็นเสาเหล็กเปล่า ไม่มีจอโลโก้ — ผังปัจจุบันไม่โดน

## 3. API ไฟสตาร์ท (ต่อแล้วโดย game-ui/visuals — ข้อมูลอ้างอิง)

```ts
import { getStartLights } from './sponsors/index.js';
const l = getStartLights();      // หรือ scene.getObjectByName('sponsor-start-lights').parent.userData.startLights
l?.countdown(E.countdownS, GAME.countdownStepS); // ทุก step ช่วง countdown: 3·2·1 → ไฟ 1..5 ดวง
l?.go();                          // GO: เขียว 1.5 วิ แล้วดับเอง
l?.off(); l?.set(n);              // เมนู/รีสตาร์ท · ตั้งเอง 0..5
```
QA: `?qa=1` มี `window.__sponsors = { stats, lights, group }` (stats = จำนวนป้าย, draw calls, ตำแหน่งทุกชิ้น)

## 4. งบ

| | ค่า |
|---|---|
| draw calls | 3 (`sponsor-led` จอ LED ทุกแผ่น · `sponsor-structure` โครงเหล็ก · `sponsor-start-lights` ไฟสตาร์ท+แถบไฟ) |
| สามเหลี่ยม | 530 |
| texture GPU | atlas 1024×256 = 1.4 MB (รวม mip) · ป้ายทะเบียน 512×226 แทนของเดิม · canvas บิลบอร์ด 512×205 ×5 ไม่ขึ้น GPU เอง (visuals คัดลอกลง atlas ของ neon) |
| ไฟล์ใหม่ | โลโก้ NDA 3 ไฟล์ 65 KB + SVG 0.8 KB (พื้นหลังป้ายเป็นงบของ art pane) |
| ในเกม (high, Chromium headless) | 47–104 draw calls ทั้งฉากตามมุม — ส่วนของ sponsors คงที่ 3 |

ไม่ได้ใช้ `sponsor-bg-*-gantry-6x1` ของ art: ซุ้มใช้แถวเดียวกับป้ายเลียบทาง (8:1) เพื่อให้ texture อยู่ใบเดียวในงบ 2 MB

## 5. ขอให้ conductor ส่งต่อ

- **game-ui (`src/ui/screens.ts` หน้าเครดิต):** เพิ่มบรรทัด **"สนับสนุนโดย สมาคมดิจิทัลนครราชสีมา · MADEBYTLE"** (จะวาง `public/assets/sponsors/nda-h-dark.png` + `madebytle-logo.svg` คู่กันก็ได้)
- **QA:** ข้อกะพริบ (VIS-04) ของป้าย LED = 1 ครั้ง/7 วิ · ป้ายเลียบทางไม่มี collider ของตัวเอง (อาศัยผนังชนของ world ซึ่งอยู่หลังหน้าป้าย 4 ซม.)
- **world:** ถ้าย้ายเส้นชัย/กริดอีก ป้ายจะตามเองจากข้อมูล ไม่ต้องแก้ sponsors

## 6. ภาพเทียบ + วิธีแคปซ้ำ

`refs/m3/`: `sponsors-1-grid-start-lights` (ไฟติด 3 ดวงตอนนับ "2") · `2-finish-straight` · `3-manat-boards` · `4-bridge-224` · `5-plaza-pass` (ผ่านลานย่าโม ไม่มีป้ายในเฟรม) · `6-main-straight` · `7-billboard` · `8-gantry-close`

```bash
pnpm exec vite build --outDir <tmp>/dist && pnpm exec vite preview --outDir <tmp>/dist --port 5311   # dev server รีโหลดเมื่อ pane อื่นแก้ไฟล์
node refs/m3/sponsors-shoot.mjs refs/m3 "$(node refs/m3/sponsors-pose.mjs '[{"name":"x","s":3130}]')" high
node refs/m3/sponsors-countdown.mjs     # แคปไฟสตาร์ทระหว่างนับถอยหลังจริง
node refs/m3/sponsors-dump.mjs <dir>    # เซฟ texture atlas + บิลบอร์ดเป็น PNG
```

## 7. ข้อจำกัด

- ภาพจาก SwiftShader (headless) bloom อาจต่างจาก GPU จริง — ควรดูบนมือถือว่าตัวหนังสือบนป้ายไม่บานเกิน (ความสว่างจอปรับที่ `FACE` ใน `src/sponsors/index.ts`)
- โลโก้ NDA สีเดิมบนบิลบอร์ดพื้นส้มอ่อน: ช่องตารางสีอ่อนสุดกลืนกับพื้นบ้าง (ใช้สีทางการตามบรีฟ ไม่ได้ปรับสี)
- ขาซุ้มฝั่งตึกแถวจมเข้าหน้าตึกเล็กน้อย (หน้าตึกอยู่ชิดเส้นผนังชน)
