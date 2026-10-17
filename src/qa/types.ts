// QA hook contract — copied from docs/qa/TEST-HOOKS.md §2 (v1) + PHYSICS.md §8 extras. Keep in sync.
import type { PhysicsCarDebug, PhysicsDebug } from '../types.js';
export interface Vec3 { x: number; y: number; z: number }

export interface GameQA {
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
  } & Omit<PhysicsCarDebug, 'wheelsOnGround' | 'boost' | 'jump'>;   // PHYSICS.md §8

  physics(): PhysicsDebug & { source: 'real' | 'stub' };              // PHYSICS.md §8
  modules(): { track: 'real' | 'stub'; model: 'real' | 'stub'; physics: 'real' | 'stub'; audio: 'real' | 'stub' };

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

  on(event: 'lap' | 'checkpoint' | 'collision' | 'respawn' | 'jump' | 'land' | 'boost' | 'error' | 'state' | 'launch' | 'splash' | 'hardLanding' | 'hydroplane' | 'driftStart' | 'driftEnd', cb: (e: unknown) => void): () => void;

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
    setWeather(w: { rain?: number; wind?: number; puddles?: boolean }): void;   // PHYSICS.md §8
    setTank(units: number): void;
    armLaunch(): void;
  };
}
declare global {
  interface Window {
    __game?: GameQA;
  }
}
