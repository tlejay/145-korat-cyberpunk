// Frame-time metrics for QA stats() (TEST-HOOKS §2) — fixed-size rings, no per-frame allocation.
export class Metrics {
  private frames = new Float32Array(600);
  private fi = 0; private fn = 0;
  private secFps = new Float32Array(60);
  private si = 0; private sn = 0;
  private secAcc = 0; private secFrames = 0;
  fps = 0;
  longFrames = 0;
  private scratch = new Float32Array(600);

  frame(dtMs: number) {
    this.frames[this.fi] = dtMs;
    this.fi = (this.fi + 1) % this.frames.length;
    this.fn = Math.min(this.fn + 1, this.frames.length);
    if (dtMs > 50) this.longFrames++;
    this.secAcc += dtMs; this.secFrames++;
    if (this.secAcc >= 1000) {
      this.fps = (this.secFrames * 1000) / this.secAcc;
      this.secFps[this.si] = this.fps;
      this.si = (this.si + 1) % 60; this.sn = Math.min(this.sn + 1, 60);
      this.secAcc = 0; this.secFrames = 0;
    }
  }
  resetLong() { this.longFrames = 0; }
  pct(p: number): number {
    if (!this.fn) return 0;
    const a = this.scratch.subarray(0, this.fn);
    a.set(this.frames.subarray(0, this.fn));
    a.sort();
    return a[Math.min(this.fn - 1, Math.floor(p * this.fn))];
  }
  fpsP5(): number {
    if (!this.sn) return this.fps;
    const a = Array.from(this.secFps.subarray(0, this.sn)).sort((x, y) => x - y);
    return a[Math.floor(0.05 * (this.sn - 1))];
  }
  // Mean fps over the last n seconds (low-fps detector).
  recentFps(n: number): number {
    if (this.sn < n) return Infinity;
    let s = 0;
    for (let k = 1; k <= n; k++) s += this.secFps[(this.si - k + 60) % 60];
    return s / n;
  }
}
