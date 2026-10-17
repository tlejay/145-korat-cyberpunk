# M1 — Vertical slice: สัญญาเชื่อมต่อระหว่าง pane (conductor เขียน)

เป้า M1: เปิด `/koratrocketcar/` บนมือถือแนวนอน → เมนู → นับ 3-2-1 → ขับรถ Roadster บน **สนาม A ถนนจริง** 2 รอบ (มีแบริเออร์ คูเมือง ตึกจาก OSM/Street View, แลนด์มาร์กเป็นกล่องหยาบได้) → จบรอบ → ส่งแต้ม/ตั้งชื่อ/ghost อันดับ 1 → deploy **preview** ให้ QA ตรวจ
ยังไม่ต้องสวย (cyberpunk pass = M3) แต่ **ต้องขับสนุกและลื่นบนมือถือ** · ทุกเรื่องที่ไม่ได้เขียนไว้ที่นี่ ยึด `docs/dev/GAMEPLAY.md` > `docs/dev/PHYSICS.md` > `docs/qa/TEST-HOOKS.md`

## เจ้าของไฟล์ (ห้ามแก้ไฟล์ของ pane อื่น — ถ้าจำเป็นให้เขียนลง REPORT ของตัวเองว่าอยากให้แก้อะไร)

| pane | เป็นเจ้าของ |
|---|---|
| 🛣️ world | `scripts/build-track.mjs`, `public/data/track-A.json`, `src/track/**`, `src/scene/**` |
| 🚗 car-model | `src/car/model.ts`, `src/car/model-*.ts` |
| 🧮 car-physics | `src/car/physics*.ts`, `src/car/config.ts`, `src/car/camera.ts`, `src/car/index.ts` |
| 🎮 game-ui | `src/main.ts`, `src/game/**`, `src/input/**`, `src/ui/**`, `src/qa/**`, `src/style.css`, `index.html` |
| 🔊 audio-dev | `src/audio/**`, `public/assets/audio/**`, `scripts/build-audio.*` |
| ⚙️ (เสร็จแล้ว) | `api/**`, `db/**`, `src/net/**` — แก้ได้เฉพาะ game-ui ถ้าจำเป็นจริง และต้องจดใน REPORT |

`package.json` / lockfile: เพิ่ม dependency ได้เฉพาะที่จำเป็น บอกใน REPORT · ห้ามลบ dependency ของคนอื่น

## พิกัด (ทุก pane)
- หน่วยเมตร · origin = อนุสาวรีย์ (14.974731 N, 102.098117 E) · three.js: **x = ตะวันออก, y = ขึ้น, z = −เหนือ** (เหนือ = −z)
- แปลงจาก OSM: `x = (lon − 102.098117) × 107550` · `z = −(lat − 14.974731) × 110574`

## Interfaces (TypeScript — ใส่ไว้ใน `src/types.ts` โดย game-ui สร้างไฟล์นี้ก่อน ทุกคน import จากที่นี่)

```ts
export type Vec2 = { x: number; z: number };
export type Pose = { x: number; y: number; z: number; heading: number }; // heading rad, 0 = north (−z), clockwise +

export interface Track {
  id: 'A';
  root: THREE.Group;                       // everything visual, already merged/instanced
  startGrid: Pose;                         // outside the Ya Mo plaza no-launch zone (GAMEPLAY §2.5)
  finishLine: { a: Vec2; b: Vec2 };
  checkpoints: { id: number; a: Vec2; b: Vec2; trackM: number }[];  // ordered, includes moat shortcut handling
  barriers: { a: Vec2; b: Vec2 }[];        // 2D wall segments (neon barriers + building fronts + invisible plaza/gate walls)
  heightAt(x: number, z: number): number;  // road surface height (flat 0 is fine except moat embankment)
  surfaceAt(x: number, z: number): 'road' | 'curb' | 'water' | 'blocked';
  zones: { noBoostNoJump: Vec2[][] };      // plaza + gate polygons
  moatJump: { takeoff: Vec2; landing: Vec2; widthM: number };
  update?(dt: number, camera: THREE.Camera): void; // LOD / rain later
}

export interface InputState { steer: number; throttle: number; brake: number; jump: boolean; boost: boolean; }

export interface CarState {
  pose: Pose; speedKmh: number; velocity: { x: number; y: number; z: number };
  gForce: number; gas: number /*0..1*/; airborne: boolean; drifting: boolean; driftAngleDeg: number;
  onSurface: 'road' | 'curb' | 'water' | 'blocked';
}

export interface Car {
  object: THREE.Object3D;
  state: CarState;
  step(dt: number, input: InputState, track: Track): void;   // fixed timestep, called by game loop
  reset(pose: Pose): void;
  camera: { update(dt: number, cam: THREE.PerspectiveCamera): void };
}
// car-model exports: buildCarModel(): { root: THREE.Group; wheels: { fl, fr, rl, rr: THREE.Object3D }; nozzles: THREE.Object3D[]; tailLights: THREE.Mesh[]; fans: THREE.Object3D[] }
// car-physics exports: createCar(model: ReturnType<typeof buildCarModel>): Car
// world exports:       loadTrack(id: 'A', scene: THREE.Scene): Promise<Track>
// audio exports:       createAudio(): { unlock(): Promise<void>; update(car: CarState, dt: number): void; play(event: AudioEvent): void; setVolumes(m: number, s: number): void }
//                      AudioEvent = 'countdown3'|'countdown2'|'countdown1'|'go'|'finalLap'|'newRecord'|'finish'|'boost'|'jump'|'land'|'crash'|'checkpoint'|'drift'|'uiTap'
```

ระหว่างรอกันให้ทำ **stub** ของอีกฝั่งในโฟลเดอร์ตัวเอง (เช่น game-ui ใช้ `src/game/stub-car.ts` รถกล่องวิ่งตรง) แล้วสลับเป็นของจริงเมื่อไฟล์ของ pane อื่นมาถึง

## งบมือถือ (QA PERF — ห้ามเกิน)
draw calls ≤ 150 · triangles ≤ 500k · โหลดแรก ≤ 8 MB · texture รวม ≤ 32 MB GPU · ตึกต้อง merge ต่อบล็อก/instancing · quality tier 3 ระดับ (`low|mid|high`) อ่านจาก `src/game/quality.ts` (game-ui สร้าง)

## กติการ่วม
- ห้าม commit / push / deploy — conductor รวมเอง · ก่อนจบต้อง `pnpm typecheck && pnpm build` ผ่าน (ถ้าพังเพราะไฟล์ pane อื่นกำลังเขียน ให้บอกใน REPORT)
- REPORT ของตัวเองที่ `docs/dev/REPORT-M1-<pane>.md` สรุป ≤ 15 บรรทัดบนสุด
- ความเคารพย่าโม/ประตูชุมพลตาม CLAUDE.md — ไม่มีอะไรชนอนุสาวรีย์ได้
