// Shared M1 contracts between panes (docs/dev/M1-CONTRACTS.md). Owner: game-ui.
// Coordinates: metres, origin = Thao Suranari monument, x = east, y = up, z = -north.
import type * as THREE from 'three';

export type Vec2 = { x: number; z: number };
export type Pose = { x: number; y: number; z: number; heading: number }; // heading rad, 0 = north (−z), clockwise +

export type Surface = 'road' | 'curb' | 'water' | 'blocked';

export interface Checkpoint { id: number; a: Vec2; b: Vec2; trackM: number }

export interface Track {
  id: 'A';
  root: THREE.Group;                       // everything visual, already merged/instanced
  startGrid: Pose;                         // outside the Ya Mo plaza no-launch zone (GAMEPLAY §2.5)
  finishLine: { a: Vec2; b: Vec2 };
  checkpoints: Checkpoint[];               // ordered, includes moat shortcut handling
  barriers: {                              // 2D wall segments (neon barriers + building fronts + invisible plaza/gate walls)
    a: Vec2; b: Vec2;
    h?: number;                            // collider height (m): Infinity = cannot jump over · 1.0 = moat rail (PHYSICS §1.6)
    kind?: 'wall' | 'barrier' | 'building' | 'monument';
    style?: 'rail' | 'neon' | 'building' | 'invisible';
  }[];
  heightAt(x: number, z: number): number;  // road surface height (flat 0 is fine except moat embankment)
  surfaceAt(x: number, z: number): Surface;
  zones: { noBoostNoJump: Vec2[][] };      // plaza + gate polygons
  moatJump: { takeoff: Vec2; landing: Vec2; widthM: number };
  update?(dt: number, camera: THREE.Camera): void; // LOD / rain later
  // Optional extras (game-ui uses them when present — autopilot, minimap, QA track()).
  centerline?: Vec2[];                     // ordered loop, points ≤ 5 m apart, starting at the finish line
  lengthM?: number;
  altGroup?: [number, number] | null;      // checkpoint ids skippable by the moat shortcut [first, last]
  roadNames?: { osmWayId: string; nameTh: string; shownText: string }[]; // street signs rendered (QA world())
}

export interface InputState { steer: number; throttle: number; brake: number; jump: boolean; boost: boolean }

export interface CarState {
  pose: Pose; speedKmh: number; velocity: { x: number; y: number; z: number };
  gForce: number; gas: number /*0..1*/; airborne: boolean; drifting: boolean; driftAngleDeg: number;
  onSurface: Surface;
}

export interface Car {
  object: THREE.Object3D;
  state: CarState;
  step(dt: number, input: InputState, track: Track): void;   // fixed timestep, called by game loop
  reset(pose: Pose): void;
  camera: { update(dt: number, cam: THREE.PerspectiveCamera): void };
  // Optional: game-side air-tank economy (drift regen is physics', these are bonuses: landing +5, refill gate +35). fraction of tank.
  addGas?(fraction: number): void;
  // Optional: physics-pane QA extras (PHYSICS.md §8). Returned objects should be reused, not allocated per call.
  debug?(): Partial<PhysicsCarDebug>;
  physicsDebug?(): Partial<PhysicsDebug>;
  qa?: Partial<{ setWeather(w: { rain?: number; wind?: number; puddles?: boolean }): void; setTank(units: number): void; armLaunch(): void; setSpeed(kmh: number): void }>;
  // Optional: physics bumps `seq` on every hit so the game can fire audio/haptics/QA events.
  lastImpact?: { impulse: number /* N·s */; kind: 'building' | 'wall' | 'monument' | 'prop' | 'barrier'; seq: number } | null;
}

export interface CarModel {
  root: THREE.Group;
  wheels: { fl: THREE.Object3D; fr: THREE.Object3D; rl: THREE.Object3D; rr: THREE.Object3D };
  nozzles: THREE.Object3D[];
  tailLights: THREE.Mesh[];
  fans: THREE.Object3D[];
}

export type AudioEvent =
  | 'countdown3' | 'countdown2' | 'countdown1' | 'go' | 'finalLap' | 'newRecord' | 'finish'
  | 'boost' | 'jump' | 'land' | 'crash' | 'checkpoint' | 'drift' | 'uiTap';

export interface GameAudio {
  unlock(): Promise<void>;
  update(car: CarState, dt: number): void;
  play(event: AudioEvent): void;
  setVolumes(music: number, sfx: number): void;
}

// Module signatures each pane exports (game-ui loads them dynamically, stubs until they exist).
export type BuildCarModel = () => CarModel;
export type CreateCar = (model: CarModel) => Car;
export type LoadTrack = (id: 'A', scene: THREE.Scene) => Promise<Track>;
export type CreateAudio = () => GameAudio;

export type Quality = 'low' | 'mid' | 'high';

// PHYSICS.md §8 — extra QA values the physics pane exposes through Car.debug()/physicsDebug().
export interface PhysicsCarDebug {
  g: { long: number; lat: number; total: number; peak: number };
  slip: { betaDeg: number; frontDeg: number; rearDeg: number; rearSliding: boolean };
  tank: { units: number; lastUseUnits: number; lastUse: 'boost' | 'jump' | 'hover' | 'launch' | 'flip' | 'landing' | null };
  airborne: boolean; airtimeMs: number; apexM: number;
  contact: { wheels: [boolean, boolean, boolean, boolean]; compressionM: [number, number, number, number]; surface: 'dry' | 'wet' | 'puddle' | 'grass' | 'water' };
  fans: { level: number; spool: number };
  thrustN: { rear: number; lift: number };
  launch: { armed: boolean; active: boolean };
  hydroplaning: boolean;
  attitudeDeg: { pitch: number; roll: number };
  wheelsOnGround: number;
  boost: { active: boolean; cooldownMs: number };
  jump: { active: boolean; heightM: number; airtimeMs: number; cooldownMs: number };
}

export interface PhysicsDebug {
  stepHz: 120; stepsLastFrame: number; stepMsP95: number;
  ropes: { simulatedPoints: number; activeSpans: number; msLastFrame: number };
  pendulums: { simulated: number };
  weather: { rain: number; muMul: number; windMs: number };
  tuning: Record<string, number>;
}
