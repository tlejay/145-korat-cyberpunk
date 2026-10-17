// Light rigid bodies for the checkpoint props (cones, A-frame signs, steel barricades).
// Pure TypeScript (no three.js, no parameter properties) so it runs headless in Node.
// Each body = convex hull points around its centre of mass + one capsule for body-body contact.
// Ground: impulse per penetrating hull point (restitution + Coulomb friction) → bodies tip, roll,
// bounce, slide and stop for real instead of playing canned animations.

export type PropKind = 'cone' | 'aframe' | 'barricade';

export interface PropDef {
  kind: PropKind;
  mass: number;                 // kg (real: cone 1–3, A-frame 8–15, barricade 10–20 — BRIEF §3)
  comY: number;                 // centre of mass above the base (m)
  hull: number[];               // xyz triples relative to the COM (x = sign width, z = depth)
  inertia: [number, number, number]; // principal moments (kg·m²) about the COM, body axes
  capsule: [number, number, number, number, number, number, number]; // ax ay az bx by bz r (COM frame)
  height: number;               // top above the base (m) — jump clearance
  dragArea: number;             // Cd·A (m²) for jet wind
  restitution: number;
  friction: number;
  carPenalty: number;           // game speed loss when the car smashes it (fraction, PHYSICS-style amplification)
}

const boxI = (m: number, w: number, h: number, d: number): [number, number, number] =>
  [(m / 12) * (h * h + d * d), (m / 12) * (w * w + d * d), (m / 12) * (w * w + h * h)];

// ── cone: 70 cm traffic cone on a 38 cm rubber base, 2.5 kg (heavy base → COM low) ──
const CONE_COMY = 0.17;
const coneHull = (): number[] => {
  const h: number[] = [], b = 0.19, y0 = -CONE_COMY;
  for (const [x, z] of [[b, b], [-b, b], [-b, -b], [b, -b]]) h.push(x, y0, z);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; h.push(Math.cos(a) * 0.1, 0.36 - CONE_COMY, Math.sin(a) * 0.1); }
  h.push(0, 0.7 - CONE_COMY, 0);
  return h;
};

// ── A-frame "หยุดตรวจ" sign: 1.1 m wide base, 1.25 m frame + 0.18 m siren, 12 kg ──
const AF_COMY = 0.5;
const aframeHull = (): number[] => {
  const h: number[] = [], y0 = -AF_COMY, y1 = 1.25 - AF_COMY;
  for (const [x, z] of [[0.55, 0.32], [-0.55, 0.32], [-0.55, -0.32], [0.55, -0.32]]) h.push(x, y0, z);
  for (const [x, z] of [[0.17, 0.05], [-0.17, 0.05], [-0.17, -0.05], [0.17, -0.05]]) h.push(x, y1, z);
  h.push(0.36, 0.62 - AF_COMY, 0.19, -0.36, 0.62 - AF_COMY, 0.19, 0.36, 0.62 - AF_COMY, -0.19, -0.36, 0.62 - AF_COMY, -0.19);
  h.push(0, 1.43 - AF_COMY, 0);
  return h;
};

// ── steel barricade "จุดสกัด": 2.0 m × 1.1 m panel on two 0.5 m feet with castors, 16 kg ──
const BR_COMY = 0.5;
const barricadeHull = (): number[] => {
  const h: number[] = [];
  for (const x of [-1, 1]) for (const z of [-0.25, 0.25]) h.push(x * 0.95, -BR_COMY, z);
  for (const x of [-1, -0.5, 0, 0.5, 1]) h.push(x, 0.3 - BR_COMY, 0, x, 1.1 - BR_COMY, 0);
  return h;
};

export const PROPS: Record<PropKind, PropDef> = {
  cone: {
    kind: 'cone', mass: 2.5, comY: CONE_COMY, hull: coneHull(), inertia: boxI(2.5, 0.3, 0.55, 0.3),
    capsule: [0, 0.03 - CONE_COMY, 0, 0, 0.5 - CONE_COMY, 0, 0.15], height: 0.7,
    dragArea: 0.12, restitution: 0.35, friction: 0.55, carPenalty: 0.012,
  },
  aframe: {
    kind: 'aframe', mass: 12, comY: AF_COMY, hull: aframeHull(), inertia: boxI(12, 1.0, 1.3, 0.5),
    capsule: [0, 0.2 - AF_COMY, 0, 0, 1.1 - AF_COMY, 0, 0.32], height: 1.43,
    dragArea: 0.18, restitution: 0.25, friction: 0.5, carPenalty: 0.05,
  },
  barricade: {
    kind: 'barricade', mass: 16, comY: BR_COMY, hull: barricadeHull(), inertia: boxI(16, 2.0, 1.1, 0.3),
    capsule: [-0.85, 0.55 - BR_COMY, 0, 0.85, 0.55 - BR_COMY, 0, 0.3], height: 1.1,
    dragArea: 0.25, restitution: 0.2, friction: 0.45, carPenalty: 0.065,
  },
};

export const GRAVITY = 9.81;

export class Body {
  def: PropDef;
  px = 0; py = 0; pz = 0; vx = 0; vy = 0; vz = 0; wx = 0; wy = 0; wz = 0;
  qx = 0; qy = 0; qz = 0; qw = 1;
  R = new Float64Array(9);      // body → world rotation (row-major)
  awake = false;
  sleepT = 0;
  grounded = true;
  hitThisPass = false;
  fx = 0; fy = 0; fz = 0;       // external force accumulator (jet wind), cleared each step
  home = { x: 0, y: 0, z: 0, yaw: 0 };

  constructor(def: PropDef) { this.def = def; this.updateR(); }

  place(x: number, ground: number, z: number, yaw: number) {
    this.home.x = x; this.home.y = ground + this.def.comY; this.home.z = z; this.home.yaw = yaw;
    this.resetHome();
  }

  resetHome() {
    this.px = this.home.x; this.py = this.home.y; this.pz = this.home.z;
    this.vx = this.vy = this.vz = this.wx = this.wy = this.wz = 0;
    // yaw about +y; heading convention: rotation.y = −yaw is done by the caller, here yaw is the three.js angle
    this.qx = 0; this.qy = Math.sin(this.home.yaw / 2); this.qz = 0; this.qw = Math.cos(this.home.yaw / 2);
    this.awake = false; this.sleepT = 0; this.grounded = true; this.hitThisPass = false;
    this.updateR();
  }

  wake() { this.awake = true; this.sleepT = 0; }

  updateR() {
    const { qx: x, qy: y, qz: z, qw: w } = this, R = this.R;
    R[0] = 1 - 2 * (y * y + z * z); R[1] = 2 * (x * y - z * w); R[2] = 2 * (x * z + y * w);
    R[3] = 2 * (x * y + z * w); R[4] = 1 - 2 * (x * x + z * z); R[5] = 2 * (y * z - x * w);
    R[6] = 2 * (x * z - y * w); R[7] = 2 * (y * z + x * w); R[8] = 1 - 2 * (x * x + y * y);
  }

  /** Local point (COM frame) → world offset r (relative to COM). Writes into out[o..o+2]. */
  rot(lx: number, ly: number, lz: number, out: Float64Array, o = 0) {
    const R = this.R;
    out[o] = R[0] * lx + R[1] * ly + R[2] * lz;
    out[o + 1] = R[3] * lx + R[4] * ly + R[5] * lz;
    out[o + 2] = R[6] * lx + R[7] * ly + R[8] * lz;
  }

  /** Iw⁻¹·(a) = R·diag(1/I)·Rᵀ·a → out. */
  invIw(ax: number, ay: number, az: number, out: Float64Array) {
    const R = this.R, I = this.def.inertia;
    const bx = (R[0] * ax + R[3] * ay + R[6] * az) / I[0];
    const by = (R[1] * ax + R[4] * ay + R[7] * az) / I[1];
    const bz = (R[2] * ax + R[5] * ay + R[8] * az) / I[2];
    out[0] = R[0] * bx + R[1] * by + R[2] * bz;
    out[1] = R[3] * bx + R[4] * by + R[5] * bz;
    out[2] = R[6] * bx + R[7] * by + R[8] * bz;
  }

  /** Impulse J (world) at offset r from the COM. */
  applyImpulse(jx: number, jy: number, jz: number, rx: number, ry: number, rz: number) {
    const im = 1 / this.def.mass;
    this.vx += jx * im; this.vy += jy * im; this.vz += jz * im;
    this.invIw(ry * jz - rz * jy, rz * jx - rx * jz, rx * jy - ry * jx, T3);
    this.wx += T3[0]; this.wy += T3[1]; this.wz += T3[2];
  }

  /** 1 / effective mass along unit n at offset r: 1/m + n·((Iw⁻¹(r×n))×r). */
  kAlong(nx: number, ny: number, nz: number, rx: number, ry: number, rz: number) {
    this.invIw(ry * nz - rz * ny, rz * nx - rx * nz, rx * ny - ry * nx, T3);
    const cx = T3[1] * rz - T3[2] * ry, cy = T3[2] * rx - T3[0] * rz, cz = T3[0] * ry - T3[1] * rx;
    return 1 / this.def.mass + nx * cx + ny * cy + nz * cz;
  }

  /** Velocity of the material point at offset r. */
  pointVel(rx: number, ry: number, rz: number, out: Float64Array) {
    out[0] = this.vx + this.wy * rz - this.wz * ry;
    out[1] = this.vy + this.wz * rx - this.wx * rz;
    out[2] = this.vz + this.wx * ry - this.wy * rx;
  }

  integrate(dt: number) {
    const m = this.def.mass;
    this.vx += (this.fx / m) * dt; this.vy += (this.fy / m - GRAVITY) * dt; this.vz += (this.fz / m) * dt;
    this.fx = this.fy = this.fz = 0;
    // quadratic air drag ½ρ·CdA·v² — a 2.5 kg cone at 40 m/s decelerates ~45 m/s², so it lands
    // tens of metres away, not hundreds
    const v = Math.hypot(this.vx, this.vy, this.vz);
    if (v > 0.5) {
      const k = Math.min(0.9, ((0.5 * 1.2 * this.def.dragArea * v) / m) * dt);
      this.vx -= this.vx * k; this.vy -= this.vy * k; this.vz -= this.vz * k;
    }
    // angular damping (keeps tumbling cones from spinning forever)
    const ad = Math.max(0, 1 - dt * 0.6);
    this.wx *= ad; this.wy *= ad; this.wz *= ad;
    const wm = Math.hypot(this.wx, this.wy, this.wz);
    if (wm > 40) { const k = 40 / wm; this.wx *= k; this.wy *= k; this.wz *= k; }
    this.px += this.vx * dt; this.py += this.vy * dt; this.pz += this.vz * dt;
    const h = dt * 0.5, { wx, wy, wz } = this;
    let { qx, qy, qz, qw } = this;
    const dx = h * (wx * qw + wy * qz - wz * qy), dy = h * (wy * qw + wz * qx - wx * qz);
    const dz = h * (wz * qw + wx * qy - wy * qx), dw = h * (-wx * qx - wy * qy - wz * qz);
    qx += dx; qy += dy; qz += dz; qw += dw;
    const l = Math.hypot(qx, qy, qz, qw) || 1;
    this.qx = qx / l; this.qy = qy / l; this.qz = qz / l; this.qw = qw / l;
    this.updateR();
  }

  /** Ground plane contact at height g (flat around the body — roads here are flat). */
  ground(g: number, dt: number) {
    const hull = this.def.hull, e = this.def.restitution, mu = this.def.friction;
    let deepest = 0, contacts = 0;
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < hull.length; i += 3) {
        this.rot(hull[i], hull[i + 1], hull[i + 2], T1);
        const pen = g - (this.py + T1[1]);
        if (pen <= 0) continue;
        if (iter === 0) { contacts++; if (pen > deepest) deepest = pen; }
        this.pointVel(T1[0], T1[1], T1[2], T2);
        const vn = T2[1];
        let jn = 0;
        if (vn < 0) {
          const k = this.kAlong(0, 1, 0, T1[0], T1[1], T1[2]);
          const ee = vn < -1.2 ? e : 0; // no micro-bounce while resting
          jn = (-(1 + ee) * vn) / k;
          this.applyImpulse(0, jn, 0, T1[0], T1[1], T1[2]);
        }
        // Coulomb friction; the support impulse of gravity is shared by the contacts so resting bodies grip
        this.pointVel(T1[0], T1[1], T1[2], T2);
        const tx = T2[0], tz = T2[2], vt = Math.hypot(tx, tz);
        if (vt > 1e-5) {
          const nxT = tx / vt, nzT = tz / vt;
          const kt = this.kAlong(nxT, 0, nzT, T1[0], T1[1], T1[2]);
          const support = (this.def.mass * GRAVITY * dt) / 3;
          const jt = Math.min(vt / kt, mu * (jn + support));
          this.applyImpulse(-nxT * jt, 0, -nzT * jt, T1[0], T1[1], T1[2]);
        }
      }
    }
    if (deepest > 0) this.py += deepest; // never below the road (QA: "ไม่ทะลุพื้น")
    this.grounded = contacts > 0;
    if (this.grounded) {
      // rolling resistance
      const rr = Math.max(0, 1 - dt * 1.5);
      this.wx *= rr; this.wy *= rr; this.wz *= rr;
    }
  }

  /** Sleep once resting so idle checkpoints cost nothing. */
  trySleep(dt: number) {
    const v2 = this.vx * this.vx + this.vy * this.vy + this.vz * this.vz;
    const w2 = this.wx * this.wx + this.wy * this.wy + this.wz * this.wz;
    if (this.grounded && v2 < 0.012 && w2 < 0.04) {
      this.sleepT += dt;
      if (this.sleepT > 0.5) { this.awake = false; this.vx = this.vy = this.vz = this.wx = this.wy = this.wz = 0; }
    } else this.sleepT = 0;
  }

  /** Capsule endpoints in world space → out[0..5]. */
  capsuleWorld(out: Float64Array) {
    const c = this.def.capsule;
    this.rot(c[0], c[1], c[2], out, 0);
    this.rot(c[3], c[4], c[5], out, 3);
    out[0] += this.px; out[1] += this.py; out[2] += this.pz;
    out[3] += this.px; out[4] += this.py; out[5] += this.pz;
  }
}

// scratch (module-level, never allocated per step)
const T1 = new Float64Array(3), T2 = new Float64Array(3), T3 = new Float64Array(3);
const CA = new Float64Array(6), CB = new Float64Array(6), CP = new Float64Array(6);

/** Closest points between segments p1q1 and p2q2 → CP[0..2] on 1, CP[3..5] on 2. */
function closestSegSeg(s1: Float64Array, s2: Float64Array) {
  const d1x = s1[3] - s1[0], d1y = s1[4] - s1[1], d1z = s1[5] - s1[2];
  const d2x = s2[3] - s2[0], d2y = s2[4] - s2[1], d2z = s2[5] - s2[2];
  const rx = s1[0] - s2[0], ry = s1[1] - s2[1], rz = s1[2] - s2[2];
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  let s = 0, t = 0;
  if (a < 1e-9 && e < 1e-9) { s = t = 0; }
  else if (a < 1e-9) { t = Math.min(1, Math.max(0, f / e)); }
  else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e < 1e-9) { s = Math.min(1, Math.max(0, -c / a)); }
    else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b;
      s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
      else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  CP[0] = s1[0] + d1x * s; CP[1] = s1[1] + d1y * s; CP[2] = s1[2] + d1z * s;
  CP[3] = s2[0] + d2x * t; CP[4] = s2[1] + d2y * t; CP[5] = s2[2] + d2z * t;
}

/** Capsule-vs-capsule push + impulse (props knocking each other over). */
export function collidePair(A: Body, B: Body) {
  const ra = A.def.capsule[6], rb = B.def.capsule[6];
  const dx0 = A.px - B.px, dy0 = A.py - B.py, dz0 = A.pz - B.pz, reach = 1.3 + ra + rb;
  if (dx0 * dx0 + dy0 * dy0 + dz0 * dz0 > reach * reach) return false;
  A.capsuleWorld(CA); B.capsuleWorld(CB);
  closestSegSeg(CA, CB);
  let nx = CP[0] - CP[3], ny = CP[1] - CP[4], nz = CP[2] - CP[5];
  const d = Math.hypot(nx, ny, nz), pen = ra + rb - d;
  if (pen <= 0) return false;
  if (d > 1e-6) { nx /= d; ny /= d; nz /= d; } else { nx = 1; ny = 0; nz = 0; }
  const mx = (CP[0] + CP[3]) / 2, my = (CP[1] + CP[4]) / 2, mz = (CP[2] + CP[5]) / 2;
  const rax = mx - A.px, ray = my - A.py, raz = mz - A.pz, rbx = mx - B.px, rby = my - B.py, rbz = mz - B.pz;
  // positional split by inverse mass
  const ia = 1 / A.def.mass, ib = 1 / B.def.mass, sp = pen / (ia + ib);
  A.px += nx * sp * ia; A.py += Math.max(0, ny) * sp * ia; A.pz += nz * sp * ia;
  B.px -= nx * sp * ib; B.py -= Math.min(0, ny) * sp * ib; B.pz -= nz * sp * ib;
  A.pointVel(rax, ray, raz, T1); B.pointVel(rbx, rby, rbz, T2);
  const vn = (T1[0] - T2[0]) * nx + (T1[1] - T2[1]) * ny + (T1[2] - T2[2]) * nz;
  if (vn < 0) {
    const k = A.kAlong(nx, ny, nz, rax, ray, raz) + B.kAlong(nx, ny, nz, rbx, rby, rbz);
    const j = (-(1 + 0.2) * vn) / k;
    A.applyImpulse(nx * j, ny * j, nz * j, rax, ray, raz);
    B.applyImpulse(-nx * j, -ny * j, -nz * j, rbx, rby, rbz);
  }
  if (!A.awake) A.wake();
  if (!B.awake) B.wake();
  return true;
}
