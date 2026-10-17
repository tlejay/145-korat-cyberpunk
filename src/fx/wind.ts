// Air the car moves (PHYSICS §5.3): near wake + rear thruster cone + jump/landing jets reflected off
// the road, plus the storm. One field shared by cables, lanterns, blade signs and smoke drift.
import { JET, jetK, eqDiameter, massFlow } from './jet.js';

export type V3 = { x: number; y: number; z: number };

export class WindField {
  // car (world)
  x = 0; y = 0; z = 0; vx = 0; vz = 0;
  // rear jets: mean nozzle position, exhaust axis (unit), K and d_eq of one nozzle
  rx = 0; ry = 0; rz = 0; ax = 0; ay = 0; az = 0; rearK = 0; rearD = 0;
  // lift jets: total thrust (N) of the side-down nozzles
  liftN = 0;
  // storm (not amplified): speed m/s toward (dirX, dirZ)
  storm = 0; dirX = 0.6; dirZ = 0.8;
  private t = 0;

  setRear(thrustPerNozzle: number) {
    const md = massFlow(thrustPerNozzle);
    this.rearD = md > 0 ? eqDiameter(md) : 0;
    this.rearK = this.rearD ? jetK(this.rearD) : 0;
  }

  /** Gusty storm speed (m/s) now: 6–12 m/s band of PHYSICS §5.3 when raining. */
  stormNow() { return this.storm * (1 + 0.5 * Math.max(0, Math.sin(this.t * 1.3)) * Math.max(0, Math.sin(this.t * 0.37 + 1))); }
  tick(dt: number) { this.t += dt; }

  /** Car-made wind at a point (m/s). Storm excluded — callers add `stormNow()` along (dirX, dirZ). */
  field = (px: number, py: number, pz: number, out: V3) => {
    out.x = 0; out.y = 0; out.z = 0;
    const dx = px - this.x, dy = py - (this.y + 0.6), dz = pz - this.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > 900) return; // nothing the car does reaches 30 m (jets fade to < 1 m/s by then at cable height)
    // near wake u = 0.35·v·min(1, (1.5/r)²), r from the body surface
    const r = Math.max(0.5, Math.sqrt(d2) - 1.2);
    const k = 0.35 * Math.min(1, (1.5 / r) * (1.5 / r));
    out.x = this.vx * k; out.z = this.vz * k;
    // rear thruster cone: u = K/x on the axis, Gaussian across the 12° spread
    if (this.rearK > 0) {
      const qx = px - this.rx, qy = py - this.ry, qz = pz - this.rz;
      const x = qx * this.ax + qy * this.ay + qz * this.az;
      if (x > 0.3) {
        const cx = qx - this.ax * x, cy = qy - this.ay * x, cz = qz - this.az * x;
        const half = 0.21 * x + this.rearD * 0.5;
        const rr = (cx * cx + cy * cy + cz * cz) / (half * half);
        if (rr < 4) {
          const u = Math.min(60, this.rearK / x) * Math.exp(-2 * rr);
          out.x += this.ax * u; out.y += this.ay * u; out.z += this.az * u;
        }
      }
    }
    // jump / hover / landing-burn jets hit the road and come back up: ~6 m/s within 2.5 m at 71.5 kN
    if (this.liftN > 0) {
      const h = Math.hypot(dx, dz);
      if (h < 2.5 && dy > -0.6) {
        const s = Math.sqrt(this.liftN / (JET.jumpImpulseNs / JET.jumpBurnS));
        out.y += 6 * s * (1 - h / 2.5);
        if (h > 0.1) { out.x += (dx / h) * 3 * s; out.z += (dz / h) * 3 * s; } // radial wall jet
      }
    }
  };
}
