# TEST-HOOKS — สิ่งที่เกมต้องเปิดให้ QA ตรวจอัตโนมัติ (ข้อกำหนดให้ dev pane)

> เจ้าของ: QA · ผู้ทำ: dev pane · สถานะ: ข้อกำหนด v1 (2026-10-17) — ยังไม่มีโค้ดเกม
> ถ้าเกมไม่มี hook ตามนี้ QA จะวัดข้อ 🔴 หลายข้อไม่ได้ = **ถือว่าไม่ผ่าน gate** (ดู `RELEASE-GATE.md`)

## 1. หลักการ

1. **เปิดด้วย query `?qa=1` เท่านั้น** — มีใน build production ด้วย (QA ต้องตรวจตัวที่จะขึ้นจริง ไม่ใช่ตัว dev) แต่ถ้าไม่มี `?qa=1`:
   - ไม่มี `window.__game` · ไม่ทำงานเพิ่มแม้แต่เฟรมเดียว (ไม่เก็บ log, ไม่วัด) · โค้ด hook แยกเป็น chunk ที่ `import()` เฉพาะตอน `?qa=1`
2. **ใช้ทางเดินเดียวกับผู้เล่นจริง** — `setInput()` ต้องเข้าระบบ input เดียวกับปุ่มสัมผัส (ไม่ใช่เซ็ตความเร็วรถตรง ๆ) เพื่อให้ทดสอบ latency และ game feel ได้จริง
3. **อ่านอย่างเดียวเป็นค่าเริ่มต้น** — ฟังก์ชันที่เปลี่ยนสถานะ (teleport, forceError, step) อยู่ใต้ `__game.qa.*` แยกชัด
4. **หน่วย:** ระยะ = เมตร · ความเร็ว = กม./ชม. · เวลา = ms · มุม = องศา · พิกัดโลก x = ตะวันออก, z = **ใต้** (three.js), y = ขึ้น — origin = จุดศูนย์กลางอนุสาวรีย์ (`research/osm/stats.json` → `origin`, way/549315244) · ให้ `world().toLatLng(x,z)` / `fromLatLng(lat,lng)` ไว้เทียบกับ OSM
5. ทุก hook ต้องเรียกได้ภายใน < 1 ms และไม่ allocate ทุกเฟรม (ไม่ทำให้ fps ที่วัดเพี้ยน)
6. ไม่มี `console.log` จาก hook ยกเว้นตอนเรียก `__game.qa.dump()`

## 2. API ที่ต้องมี

```ts
interface Vec3 { x: number; y: number; z: number }

interface GameQA {
  version: string;                       // ตรงกับ src/version.ts เช่น "v0.1.0-build001"
  ready: Promise<void>;                  // resolve เมื่อโหลดข้อมูลแผนที่ + asset จำเป็นครบ
  state(): 'loading' | 'menu' | 'countdown' | 'racing' | 'paused' | 'finished' | 'error';
  error(): null | { code: 'webgl' | 'webgl_lost' | 'mapload' | 'asset' | 'portrait' | 'lowfps' | 'unknown'; shownText: string };

  stats(): {
    fps: number;            // เฉลี่ย 1 วิล่าสุด
    fpsP5: number;          // เปอร์เซ็นไทล์ 5 ของ fps ราย 1 วิ ในช่วง 60 วิล่าสุด
    frameMsP50: number; frameMsP95: number; frameMsP99: number;  // จาก rAF delta 600 เฟรมล่าสุด
    longFrames: number;     // จำนวนเฟรม > 50 ms นับจากเริ่มรอบ
    drawCalls: number; triangles: number;          // renderer.info.render (ของเฟรมล่าสุด รวม post-processing)
    geometries: number; textures: number; programs: number;   // renderer.info.memory / programs.length
    jsHeapMB: number | null;                       // performance.memory (Chrome) ไม่มี = null
    dpr: number; renderWidth: number; renderHeight: number;
    quality: 'low' | 'medium' | 'high';
    uptimeMs: number;
  };

  car(): {
    pos: Vec3; yawDeg: number; velocity: Vec3;
    speedKmh: number;                 // ค่าเดียวกับที่ HUD แสดง
    wheelsOnGround: number;           // 0–4
    slipAngleDeg: number; drifting: boolean;
    boost: { active: boolean; charge: number /*0..1*/; cooldownMs: number };
    jump:  { active: boolean; heightM: number; airtimeMs: number; cooldownMs: number };
    lastCollision: null | { atMs: number; impulse: number; objectId: string; objectKind: 'building' | 'wall' | 'monument' | 'prop' | 'barrier' };
    stuckMs: number;                  // เวลาที่ throttle > 0.5 แต่ speed < 3 กม./ชม. ต่อเนื่อง
  };

  camera(): {
    pos: Vec3; lookAt: Vec3; fovDeg: number;
    distanceToCarM: number;
    occluded: boolean;                // raycast กล้อง→รถ ชน mesh ทึบไหม (เฟรมล่าสุด)
    insideMesh: boolean;              // ตัวกล้องอยู่ในตึก/กำแพงไหม
    occludedFrames: number; totalFrames: number;   // สะสมตั้งแต่เริ่มรอบ
  };

  track(): {
    id: 'A' | 'B' | 'C' | string;
    lengthM: number;
    centerline: [number, number][];   // [x, z] เมตร จุดห่าง ≤ 5 ม. — ใช้เทียบกับ research/osm/track-*.geojson
    progressM: number; lap: number; totalLaps: number;
    lapTimeMs: number; lapTimesMs: number[];
    checkpoint: { next: number; total: number; missed: number };
    offTrack: boolean; distanceFromCenterlineM: number;
  };

  world(): {
    boundsM: { minX: number; maxX: number; minZ: number; maxZ: number };
    monument: { pos: Vec3; collider: 'static' };   // ต้องเป็น static เสมอ
    respawnCount: number; outOfBoundsCount: number;
    roadNames: { osmWayId: string; nameTh: string; shownText: string }[];  // ป้ายชื่อถนนที่เรนเดอร์ในเกม
    toLatLng(x: number, z: number): { lat: number; lng: number };
    fromLatLng(lat: number, lng: number): { x: number; z: number };
  };

  input(): {
    source: 'touch' | 'keyboard' | 'gamepad' | 'qa';
    throttle: number; brake: number; steer: number; jump: boolean; boost: boolean;
    activePointers: number;              // จำนวนนิ้วที่ระบบ input รับอยู่
    lastLatencyMs: number;               // event.timeStamp ของ input ล่าสุด → เวลาเฟรมแรกที่ส่งค่านั้นเข้า physics และเรนเดอร์
  };

  audio(): {
    contextState: 'suspended' | 'running' | 'closed' | 'none';
    unlocked: boolean; muted: boolean; musicVolume: number; sfxVolume: number;
    engineRate: number;                  // playbackRate หรือความถี่ oscillator ปัจจุบัน
    playing: string[];                   // id เสียงที่กำลังเล่น
  };

  on(event: 'lap' | 'checkpoint' | 'collision' | 'respawn' | 'jump' | 'land' | 'boost' | 'error' | 'state', cb: (e: unknown) => void): () => void;

  qa: {
    start(trackId: string, opts?: { laps?: number; seed?: number; skipCountdown?: boolean }): Promise<void>;
    restart(): Promise<void>;
    toMenu(): Promise<void>;
    pause(): void; resume(): void;
    setInput(i: Partial<{ throttle: number; brake: number; steer: number; jump: boolean; boost: boolean }>): void;  // ใส่ผ่าน input pipeline เดียวกับ touch
    clearInput(): void;
    teleport(x: number, z: number, yawDeg: number, speedKmh?: number): void;
    setQuality(q: 'low' | 'medium' | 'high'): void;
    fixedStep(enabled: boolean, dtMs?: number): void;   // โหมด deterministic: แช่ dt คงที่ เพื่อเทสต์ฟิสิกส์ซ้ำได้
    step(frames: number): Promise<void>;               // ใช้คู่ fixedStep
    forceError(code: 'webgl' | 'webgl_lost' | 'mapload' | 'asset' | 'lowfps'): void;  // ให้ QA เห็นหน้าจอ error จริง
    autopilot(enabled: boolean): void;                 // ขับตาม centerline เอง (ใช้เทสต์ memory leak 10 รอบ / soak)
    dump(): void;                                      // console.log สถานะทั้งหมดเป็น JSON
  };
}
declare global { interface Window { __game?: GameQA } }
```

## 3. สิ่งที่ dev ต้องทำเพิ่มนอกจาก API

| # | ข้อกำหนด | ใช้กับ test |
|---|---|---|
| H-01 | ใส่ `data-qa="<id>"` ให้ทุกปุ่ม/องค์ประกอบ UI: `btn-throttle` `btn-brake` `steer-left` `steer-right` (หรือ `steer-pad`) `btn-jump` `btn-boost` `btn-pause` `btn-mute` `btn-start` `btn-retry` `hud-speed` `hud-lap` `hud-time` `error-box` `rotate-hint` `credits` `version` | MOB-01, UI-01, ERR-* |
| H-02 | `?qa=1&hud=1` = แสดง overlay fps / drawCalls / frameMsP95 มุมจอ — ใช้วัดบน **มือถือจริง** ที่ต่อ Playwright ไม่ได้ | PERF-01..03 |
| H-03 | `?quality=low|medium|high` บังคับระดับกราฟิก | PERF-*, VIS-01 |
| H-04 | `?track=A&laps=1&skip=1` เข้าแข่งทันที ข้ามเมนู/นับถอยหลัง | ทุก test อัตโนมัติ |
| H-05 | ทุกการเรียก `alert/confirm/prompt` ในโค้ด = ห้าม (QA grep + Playwright ดัก `dialog` event) | UI-04 |
| H-06 | error ทุกตัวแสดงใน `[data-qa=error-box][role=alert]` และ `__game.error()` คืนข้อความที่แสดงจริง | ERR-* |
| H-07 | ทุก asset ใน `public/` มีรายการใน `public/assets/manifest.json` → `{ path, bytes, source, license, author, url }` (ให้ QA เทียบกับ `research/CREDITS.md` อัตโนมัติ) | LIC-01 |
| H-08 | build สร้าง `dist/` ที่ไฟล์ asset มี hash ในชื่อ (Vite ทำให้) — ไฟล์ใน `public/data/` ที่ไม่มี hash ต้องตั้ง cache header ใน `vercel.json` | DEP-03 |

## 4. เครื่องมือทดสอบอัตโนมัติที่ QA เลือก

| เครื่องมือ | ใช้ทำ | ข้อจำกัดที่ต้องรู้ |
|---|---|---|
| **Playwright** (`@playwright/test`, dev dep) | E2E: เปิดเกม `?qa=1`, ขับด้วย `setInput`, อ่าน hook, ดัก dialog / console error / request fail, จำลอง touch หลายนิ้ว (CDP `Input.dispatchTouchEvent`) | Playwright WebKit ≠ iOS Safari จริง — ข้อ 🔴 ของ iOS ต้องเทสต์บนเครื่องจริงเสมอ · headless ไม่มี GPU จริง → **ห้ามใช้ fps จาก CI ตัดสิน** (ใช้ได้แค่ drawCalls/triangles/memory) |
| โปรเจค Playwright | `pixel7-landscape` (Chromium, 915×412, dpr 2.625, hasTouch) · `iphone13-landscape` (WebKit, 844×390, dpr 3, hasTouch) · `desktop-chrome` (1440×900) · `portrait` (412×915 ใช้เทสต์ข้อความหมุนจอ) | |
| Chrome DevTools throttling ผ่าน CDP | `Network.emulateNetworkConditions` (Fast 4G = 9 Mbps ลง / 1.5 Mbps ขึ้น / RTT 170 ms · Slow 4G = 1.6 Mbps / 750 kbps / RTT 150 ms ตาม Lighthouse) + `Emulation.setCPUThrottlingRate(4)` | CPU throttle จำลองมือถือได้แค่คร่าว ๆ |
| **Lighthouse CLI** (mobile preset) | เวลาโหลด, ขนาด transfer, cache header | ไม่วัด WebGL ได้ดี ใช้แค่ด้านโหลด |
| **มือถือจริง + remote debugging** | Android: `chrome://inspect` · iOS: Safari Web Inspector · อ่าน `__game.stats()` จาก console หรือ overlay `hud=1` | ต้องมีเครื่องจริง (ดู "ความเสี่ยง" ใน TEST-PLAN) |
| สคริปต์ Node ใน `tests/qa/` | เทียบ centerline กับ OSM, เทียบ manifest กับ CREDITS, grep ตัวอักษรอังกฤษ / `alert(` | |

ไฟล์เทสต์จะอยู่ที่ `tests/qa/*.spec.ts` (QA pane เขียน spec · dev pane ติดตั้ง Playwright + hook) · รัน: `pnpm qa` (=`playwright test`) · `pnpm qa:static` (สคริปต์ Node)

### ตัวอย่างการใช้ hook (ให้ dev เห็นภาพ)

```ts
// MOB-03 multi-touch: throttle + steer at the same time
await page.goto('/?qa=1&track=A&laps=1&skip=1');
await page.evaluate(() => window.__game!.ready);
const cdp = await page.context().newCDPSession(page);
const t = await box(page, 'btn-throttle'), s = await box(page, 'steer-right');
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
  { x: t.x, y: t.y, id: 1 }, { x: s.x, y: s.y, id: 2 } ] });
await page.waitForTimeout(1500);
const i = await page.evaluate(() => window.__game!.input());
expect(i.activePointers).toBe(2);
expect(i.throttle).toBeGreaterThan(0.9);
expect(i.steer).toBeGreaterThan(0.5);
```
