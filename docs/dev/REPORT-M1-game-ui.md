# REPORT M1 — 🎮 game-ui (integrator) · 2026-10-17

> ## สรุป
> 1. ✅ **เล่นได้ครบวงจร** เมนู → สอนเล่น (ครั้งแรก) → intro กวาดรอบลาน → 3-2-1-ไป! → แข่ง 2 รอบ → สรุป → ส่งแต้ม/ตั้งชื่อ → แข่งอีกครั้ง 1 แตะ · version **v0.2.0-build002** + CHANGELOG
> 2. ✅ **ต่อของจริงครบทุก pane** (โหลดเองเมื่อไฟล์มา ไม่มีก็ใช้ stub): สนาม world · โมเดล car-model · ฟิสิกส์ car-physics · เสียง audio-dev → `__game.modules()` = real ทั้ง 4
> 3. ✅ Playwright headless (Chromium + SwiftShader) 844×390 + touch: **autopilot ขับครบ 2 รอบบนสนามจริง + ฟิสิกส์จริง** (98.5 / 96.6 วิ, พลาดจุดตรวจ 0, respawn 0) · **ไม่มี console error / dialog** · draw calls 27 · triangles 20k
> 4. ✅ multi-touch (เร่ง+เลี้ยวพร้อมกัน `activePointers` 2 · ปล่อยแล้วคืน 0) · ปุ่ม+HUD = **19.0%** ของจอ 844×390 · **19.4%** ที่ 667×375 (MOB-02 ≤ 20%) · ปุ่ม pause ทุกปุ่ม 52 px
> 5. ✅ error ไทยครบ: WebGL ไม่รองรับ · โหลดแผนที่ไม่ได้ (ลองใหม่ได้โดยไม่รีโหลด — ทดสอบด้วยการบล็อก `/data/`) · จอแนวตั้ง · fps ต่ำ (ปุ่มลดคุณภาพ) · WebGL context lost
> 6. ✅ `window.__game` ครบ TEST-HOOKS + PHYSICS §8 (อ่าน `telemetry` ของ car-physics) + `modules()` · `?qa=1&hud=1` · `?skip=1&laps=N` · `?quality=` · `?stub=track,car,audio` (บังคับ stub)
> 7. ✅ ทำตามที่ conductor ส่งต่อ: เวลาขั้นต่ำกันโกง **54.4 วิ/รอบ** + ถังกระโดด 35 + ความยาว 3,311 (`src/net/score.ts` แก้เฉพาะค่า) · คูมนัส = **ท่าโชว์ "ข้ามคูเมือง"** ไม่ใช่ทางลัด (ไฟเขียวที่ปุ่มกระโดดเมื่อ 90–115 กม./ชม. + ถัง ≥ 50) · หน้า `?qa=1&view=top|car|audio` · field แบริเออร์ `h/kind/style` ใน `src/types.ts`
> 8. ⚠️ **ยังไม่ได้ลองบนมือถือจริง** (iPhone/Android) — ความรู้สึกปุ่ม/ดริฟต์/กล้อง ต้องให้ QA หรือ Tle ลอง · fps จาก headless ใช้ตัดสินไม่ได้
> 9. ⚠️ เวลา autopilot (~97 วิ/รอบ) ช้ากว่า par 78 เพราะ autopilot เบรกเผื่อมาก — ใช้เทสต์ "ขับครบได้" เท่านั้น ไม่ใช่วัดความเร็วรถ
> 10. `pnpm typecheck && pnpm build` ผ่าน · ไม่ได้ commit / deploy · ไม่ได้เพิ่ม dependency (Playwright ติดตั้งใน scratchpad)

## ไฟล์ (ของ game-ui)

| ไฟล์ | ทำอะไร |
|---|---|
| `src/types.ts` | สัญญากลาง M1 + optional extras: `centerline/lengthM/altGroup/roadNames` ของ Track · barrier `h/kind/style` · Car `addGas/lastImpact/debug/qa` · `PhysicsCarDebug` (PHYSICS §8) |
| `src/game/quality.ts` | tier `low/mid/high` (DPR ≤ 1.25/1.75/2, ระยะมอง 260/420/650) · `?quality=` · จำใน localStorage |
| `src/game/engine.ts` | renderer, loop step 120 Hz, state machine, launch ตอนนับถอยหลัง, ล็อกปุ่มในเขตลาน/ถังไม่พอ, ตัวช่วยจัดแนวถนน, HUD, ghost 2 คัน, ส่งแต้ม, auto-pause (สลับแอป/หมุนจอ), fps ต่ำ |
| `src/game/race.ts` | checkpoint/รอบ/เวลา (เวลาจำลอง — pause ไม่นับ), split 34 จุดให้ server (แบ่งตามระยะ ไม่ผูกกับจำนวน checkpoint ของสนาม), respawn 0.5 วิ, ผิดทาง, สถิติสไตล์, ข้ามคูเมือง, ประตูเติมลม |
| `src/game/modules.ts` | `import.meta.glob` โหลด `src/track/index.ts`, `src/car/model.ts`, `src/car/index.ts`, `src/audio/index.ts` ถ้ามี · ไม่มีก็ stub |
| `src/game/stub-*.ts`, `path.ts`, `collide.ts`, `ghost.ts`, `autopilot.ts`, `metrics.ts`, `submit.ts` | stub · เส้นกลาง/โปรเจกชัน · ghost บันทึก/เล่น · autopilot QA · fps ring · คิวส่งแต้มซ้ำ |
| `src/input/index.ts`, `touch.ts` | pipeline เดียวกันทุกแหล่ง (touch/คีย์บอร์ด/จอย/QA) · ramp เลี้ยว GAMEPLAY §1.3 · ปุ่มตามผัง §1.2 |
| `src/ui/hud.ts`, `screens.ts`, `results.ts`, `settings.ts` | HUD · เมนู/สอนเล่น/pause/ตั้งค่า/เครดิต · หน้าสรุป + ฟอร์มชื่อ · ตั้งค่า + haptics |
| `src/qa/hooks.ts`, `types.ts` · `src/main.ts` · `src/style.css` | hooks · จุดเข้า + view=top/car/audio · สไตล์ |

## ตัดสินใจเอง (บอกไว้ให้ตรวจ)

- **launch ตอนนับถอยหลัง** ใช้กติกา GAMEPLAY §3.2 (กดค้างสายฟ้า ปล่อยตอน "ไป!") — car-physics รองรับแบบเดียวกัน · ปล่อยก่อน > 0.15 วิ = ล้อฟรี 0.5 วิ · launch กลางเกมหลัง respawn ไม่ฟรี (`physics.freeLaunch = false`)
- **ข้ามคูเมือง** นับเมื่อ "ลอยผ่านน้ำแล้วลงบนพื้น" (ใช้ `surfaceAt`) → ส่งในฟิลด์ `shortcuts` ของ RunResult ตามชื่อเดิมฝั่ง server (server นับเป็นแต้มสไตล์อยู่แล้ว ไม่แก้ API) · ถ้าตัดโค้งข้าม checkpoint ≤ 3 จุดภายใน 3 วิหลังลง ไม่นับพลาด
- **โหมด `?qa=1` ไม่เรียก API เลย** (ไม่ขอ token / ghost) เพื่อไม่ให้มี console error บน vite dev และไม่ส่งแต้มทดสอบ · ใส่ `&net=1` ถ้าอยากทดสอบ API ใน QA
- ghost ของตัวเองเก็บ `localStorage ghost.A.v1` เฉพาะ build เดียวกัน · ยังไม่มี "ghost เป้าหมาย" ของทีม (FEEL-21) — ไม่มีไฟล์ ghost par
- หน้าเครดิตอ่าน `research/CREDITS.md` ตอน build (ทุกแถวในตาราง) — pane ไหนเพิ่มเครดิตในไฟล์นั้น หน้าเกมอัปเดตเอง

## ยังไม่ได้ทำ / ข้อจำกัด

- แผงปรับค่า `?tune=1` (GAMEPLAY §8) ยังไม่ทำ — `physics().tuning` คืน object สดของ car-physics แล้ว · `stats().tuned` ยังไม่มี
- จอยเสมือน / เอียงเครื่อง / สลับฝั่งปุ่ม / ขนาดปุ่ม (MOB-17 🟢) ยังไม่ทำ · intro กวาดกล้องแบบง่าย
- `camera().occluded/insideMesh` ใช้ raycast ทุก 6 เฟรม (เฉพาะ `?qa=1`) — insideMesh เป็นค่าประมาณ (ยิงขึ้นแล้วเจอหลังคาจากด้านใต้)
- ลูกศรเลี้ยวคำนวณจากความโค้งของ centerline (ยังไม่ใช้ `corners` ของ world)

## ทดสอบ (สคริปต์ใน scratchpad ไม่ได้ commit)

- `run.mjs`: เมนู → แตะเริ่ม → สอนเล่น → intro → นับถอยหลัง → touch 2 นิ้ว → autopilot 2 รอบ fixedStep 60 Hz → หน้าสรุป "รอบทดสอบ (โหมด QA)"
- `ui.mjs`: ขนาดปุ่ม/พื้นที่ HUD 2 ขนาดจอ · pause · เครดิต (OSM / Tesla / ElevenLabs) · lowfps · แนวตั้ง · mapload · ไม่มี WebGL
- `extra.mjs`: บล็อก `/data/` → ข้อความไทย → ลองใหม่เข้าเมนูได้ · view=top/car/audio เปิดได้ไม่มี error
