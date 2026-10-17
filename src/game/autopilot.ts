// QA autopilot (TEST-HOOKS qa.autopilot): pure-pursuit along the centerline with
// curvature-based speed control. Output goes through the normal input pipeline.
import type { CarState, InputState } from '../types.js';
import { LoopPath, angleDiff, headingOf } from './path.js';

export function autopilotInput(path: LoopPath, car: CarState, progressM: number): Partial<InputState> {
  const v = car.speedKmh / 3.6;
  const look = 7 + v * 0.45;
  const t = path.at(progressM + look);
  const want = headingOf(t.x - car.pose.x, t.z - car.pose.z);
  const err = angleDiff(want, car.pose.heading);
  const steer = Math.max(-1, Math.min(1, err * 2.2));
  // Sharpest upcoming turn within braking distance decides target speed.
  let maxTurn = 0;
  for (let d = 10; d <= 20 + v * 2.2; d += 10) maxTurn = Math.max(maxTurn, Math.abs(path.turnAhead(progressM, d, 15)));
  const target = maxTurn > 60 ? 55 : maxTurn > 35 ? 85 : maxTurn > 18 ? 120 : 175;
  const throttle = car.speedKmh < target ? 1 : 0;
  const brake = car.speedKmh > target + 12 && Math.abs(steer) < 0.4 ? 1 : 0; // no brake-tap drift
  return { steer, throttle, brake, boost: false, jump: false };
}
