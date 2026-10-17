// Car tuning — every number the physics/camera read. Sources: docs/dev/GAMEPLAY.md §2/§3/§7 and
// docs/dev/PHYSICS.md §1.6 (real value → game value → why). Proven headless by
// scripts/physics-sim.mjs and scripts/test-car-physics.mjs. Read every step, never cached,
// so the ?tune=1 panel can edit it live.
export const G = 9.81; // tyre loads + every "g" readout
export const KMH = 3.6;
export const DEG = Math.PI / 180;

export const TUNING = {
  // ── chassis (PHYSICS §1.3, research/car/blueprint.md) ──
  massKg: 2000, // 1,700 car + 225 air + 75 driver
  wheelbaseM: 2.82,
  rearShare: 0.58, // static weight on the rear axle
  cgHeightM: 0.4,
  trackM: 1.72,
  yawInertiaK: 1.2, // Iz = m·k²
  thrustHeightM: 0.5, // rear nozzles: just above the CG → no extra nose-up moment
  collideRadiusM: 1.0, // three circles along the body (front / mid / rear)
  collideOffsetM: 1.25,

  // ── tyres (PHYSICS §1.4) ──
  muTyre: 1.26, // Trofeo RS (exec interview)
  pacejkaB: 14,
  pacejkaC: 1.4, // peak at α ≈ 8.5°
  fanStreet: 0.27, // suction downforce / weight while cruising → μ_eff 1.6
  fanFull: 0.75, // braking / drifting / launch / hard accel → μ_eff 2.2
  fanMaxKmh: 160,
  fanSpoolS: 0.5,
  fanFrontShare: 0.3,
  wetMul: 0.85, // real wet asphalt ≈ 0.65 — softened because it rains all game
  curbMul: 0.9,
  hydroplaneKmh: 100, // Horne formula at 36 psi
  hydroGrip: 0.35,

  // ── drive (GAMEPLAY §2.2) ──
  accelA0: 12.5, // m/s² at 0, net of drag (curve a·(1 − (v/vLim)^k))
  accelExp: 2.2,
  vMaxKmh: 240,
  vBoostMaxKmh: 320,
  coastG: 0.12,
  dragK: 0.0004, // = ½ρCdA/m with real CdA 1.38 m² (0.000414)
  brakeG: 1.3,
  brakeFanG: 2.0, // fans full below fanMaxKmh
  brakeFrontShare: 0.6,
  reverseMaxKmh: 40,
  reverseAccel: 6,
  reverseHoldS: 0.3,
  boostG: 1.5,
  boostMinS: 0.25,

  // ── steering (GAMEPLAY §1.3) ──
  steerMaxDeg: 32,
  steerAt120Deg: 14,
  steerAt240Deg: 7,
  lowSpeedBlendMs: [1, 3] as [number, number], // kinematic → tyre model

  // ── drift (GAMEPLAY §2.4 + PHYSICS §4) ──
  driftMinKmh: 50,
  driftSteerMin: 0.5,
  driftRearGrip: 0.85, // was 0.35 in GAMEPLAY v1 — that made drifting slower than gripping
  driftBaseDeg: 18,
  driftSteerDeg: 22,
  driftMaxDeg: 40,
  driftKp: 6,
  driftKd: 0.8,
  driftDecelG: 0.25,
  driftExitTau: 0.35,
  driftExitReleaseS: 0.2,
  driftExitKmh: 35,
  driftExitDeg: 8,
  antiSpinDeg: 55,
  escBetaDeg: 6, // grip mode: stability control keeps the slip angle under this
  escKp: 30,
  escKd: 4,
  yawAssistMaxNm: 23500, // real rear torque vectoring limit (PHYSICS §1.3)
  tcShare: 0.6, // traction control while steering
  driftCountDeg: 15,

  // ── launch control (PHYSICS §3) ──
  launchG: 4.64, // 0–60 mph in 0.59 s (official Rocket)
  launchS: 0.6,
  launchArmS: 0.3, // fans must spool at least this long
  launchMaxKmh: 5,
  launchCost: 28, // free for the first launch after reset() (race start)

  // ── jump / air (GAMEPLAY §2.6 + PHYSICS §2.4) ──
  gravity: 12, // vertical only, while airborne
  jumpVy: 9.2, // apex 3.53 m, 1.53 s
  hoverGravity: 2.5,
  hoverMaxS: 1.2,
  jumpCooldownS: 0.5,
  airSteerRate: 1.2, // rad/s yaw from thrusters at full steer (≈ 40 % of ground)
  airLevelRate: 3, // attitude control, rad/s max
  landingBurnH: 1.5,
  landingVy: 3,
  landingSkewDeg: 15,
  landingCrashDeg: 35,
  zoneLookaheadS: 1.53,

  // ── air tank, 0..100 (PHYSICS §1 "1 unit = 1.46 kN·s") ──
  tankStart: 100,
  boostDrain: 20,
  jumpCost: 35,
  hoverDrain: 25,
  regen: 3,
  regenDelayS: 1.5,
  driftRegen: 10,

  // ── suspension (PHYSICS §1.5) ──
  springK: 79000, // N/m per wheel → 2 Hz at quarter mass
  damperBump: 0.35, // damping ratio, compression
  damperRebound: 0.7,
  springRestM: 0.2,
  springBumpM: 0.16, // bump stop compression
  pitchInertia: 3000,
  rollInertia: 700,

  // ── collisions (GAMEPLAY §2.5) ──
  wallRestitution: 0.25,
  glancingKeep: 0.85,
  headOnKeep: 0.3,
  glancingDeg: 30,
  headOnDeg: 60,
  lowWallH: 1.0, // moat railing / low barriers near the moat jump (PHYSICS §1.6)
  moatCorridorM: 14,

  // ── camera (GAMEPLAY §3 + PHYSICS §3.3) ──
  camDist: 5.5,
  camDistMax: 6.3,
  camBoostDist: 0.8,
  camJumpDist: 0.5,
  camHeight: 2.0,
  camLookUp: 1.0,
  camLookAhead: 3,
  fovBase: 55,
  fovMax: 62,
  fovBoost: 8,
  fovPerG: 2,
  fovPerGMax: 10,
  fovCap: 72,
  camOmegaXZ: 8,
  camOmegaY: 4,
  camYawOmega: 6,
  camDriftVelMix: 0.35,
  camPullPerG: 0.25,
  camPullMax: 1.2,
  camJumpPitchDeg: 6,
  camMinDist: 2.2,
  camMaxRaise: 4,
  camReturnS: 0.4,
  camMaxStep: 1.5,
  shakeScale: 1,

  // ── weather ──
  rain: 0, // 0 dry … 1 wet (M3 turns the rain on)
};
export type Tuning = typeof TUNING;
