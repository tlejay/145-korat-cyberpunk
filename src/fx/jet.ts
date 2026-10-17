// Cold-gas jet physics for the white thruster plume (BRIEF-fx "เพิ่ม 20:12", REPORT-M3-fx §2).
// Pure maths, no three.js — every number is derived from the car's real thrust, not hand-tuned:
//   ṁ = F / vₑ                      mass flow per nozzle (vₑ = 650 m/s, PHYSICS §1)
//   d_eq = √(4ṁ / (π ρₐ vₑ))        momentum-equivalent diameter (jet momentum ṁvₑ in ambient-density terms)
//   u(x) = 6 · d_eq · vₑ / x          far-field centreline speed of a round turbulent jet (x > 6 d_eq)
//   → x(t) = √(x₀² + 2Kt), K = 6 d_eq vₑ   distance a parcel has travelled after t seconds
//   D(x) = 1 + 0.32 · x / d_eq         dilution: kg of mixture per kg of jet gas (Ricou–Spalding entrainment)
// The plume is white because the expanded gas is ~90 K: mixing it with humid night air cools the
// mixture below its dew point and the vapour condenses into droplets. LWC(D) below is that liquid
// water content from an adiabatic mixing line + Tetens saturation — the plume is transparent at the
// nozzle (pure dry gas, D≈1), densest a few metres out, and evaporates once D passes ~100.

export const JET = {
  ve: 650,            // m/s exhaust speed (PHYSICS §1: 225 kg air × 650 m/s = 146 kN·s per tank)
  T0: 300,            // K tank gas temperature
  cp: 1005,           // J/(kg·K)
  rhoAir: 1.17,       // kg/m³ at 25 °C
  airT: 298,          // K — Korat night in October ≈ 25 °C
  rhDry: 0.85,        // relative humidity, clear night
  rhRain: 0.95,       // relative humidity, raining
  halfAngleDeg: 12,   // turbulent jet spreading half-angle (r ≈ 0.21·x)
  jumpImpulseNs: 28_600, // PHYSICS §2.4 take-off impulse (20 units × 1.43 kN·s)
  jumpBurnS: 0.4,        // PHYSICS §2.4 visual burn time → 71.5 kN for 0.4 s
};

/** Exit static temperature from the energy equation: T = T₀ − vₑ²/(2cₚ) ≈ 90 K. */
export const exitTempK = () => JET.T0 - (JET.ve * JET.ve) / (2 * JET.cp);
/** Ideal isentropic limit from 380 bar (5,500 psi) to 1 bar, for the REPORT. */
export const isentropicVe = (p0Bar = 379) => {
  const g = 1.4, Tr = Math.pow(1 / p0Bar, (g - 1) / g);
  return Math.sqrt(2 * JET.cp * JET.T0 * (1 - Tr));
};

export const massFlow = (thrustN: number) => Math.max(0, thrustN) / JET.ve;
export const eqDiameter = (mdot: number) => Math.sqrt((4 * mdot) / (Math.PI * JET.rhoAir * JET.ve));
export const jetK = (dEq: number) => 6 * dEq * JET.ve;
/** Distance travelled along the jet axis after t seconds from the core end x0. */
export const jetDist = (K: number, x0: number, t: number) => Math.sqrt(x0 * x0 + 2 * K * t);
export const dilution = (x: number, dEq: number) => 1 + (0.32 * x) / Math.max(dEq, 1e-3);

// Tetens saturation vapour pressure (hPa) and specific humidity (kg/kg) at 1013 hPa.
const es = (Tk: number) => { const c = Tk - 273.15; return 6.112 * Math.exp((17.67 * c) / (c + 243.5)); };
const qs = (Tk: number) => { const e = es(Tk); return (0.622 * e) / (1013 - 0.378 * e); };

/** Liquid water content (g/m³) of a jet/air mixture at dilution D (mass of mixture / mass of jet gas). */
export function lwc(D: number, rh: number, airT = JET.airT): number {
  if (D <= 1) return 0;
  const Tj = exitTempK();
  const qa = rh * qs(airT);
  const f = 1 / D; // jet mass fraction (jet gas is dry)
  const T = f * Tj + (1 - f) * airT; // equal cp mixing line
  const q = (1 - f) * qa;
  const liquid = q - qs(T);
  if (liquid <= 0) return 0;
  const rho = (1013e2) / (287 * T);
  return liquid * rho * 1000;
}

/** LWC lookup over log-spaced dilution, normalised to 0..1 (opacity) — rebuilt when humidity changes. */
export class CondensationTable {
  readonly n = 96;
  readonly table = new Float32Array(this.n);
  readonly maxD = 400;
  peakLwc = 0;
  visibleUntilD = 0;
  rh = -1;
  build(rh: number) {
    if (Math.abs(rh - this.rh) < 1e-3) return;
    this.rh = rh;
    let peak = 0;
    for (let i = 0; i < this.n; i++) { const v = lwc(this.dAt(i), rh); this.table[i] = v; peak = Math.max(peak, v); }
    this.peakLwc = peak;
    this.visibleUntilD = 1;
    for (let i = 0; i < this.n; i++) {
      this.table[i] /= peak || 1;
      if (this.table[i] > 0.02) this.visibleUntilD = this.dAt(i);
    }
  }
  private dAt(i: number) { return Math.exp((i / (this.n - 1)) * Math.log(this.maxD)); }
  /** 0..1 cloud density at dilution D. */
  at(D: number) {
    if (D <= 1) return 0;
    const u = (Math.log(D) / Math.log(this.maxD)) * (this.n - 1);
    if (u >= this.n - 1) return 0;
    const i = u | 0, f = u - i;
    return this.table[i] * (1 - f) + this.table[i + 1] * f;
  }
}
