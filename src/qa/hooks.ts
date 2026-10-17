// window.__game (docs/qa/TEST-HOOKS.md + PHYSICS.md §8). Loaded only with ?qa=1 as its own chunk.
// Read hooks reuse objects where cheap; mutating helpers live under qa.*.
import * as THREE from 'three';
import { E, advance, pause, qaStep, resume, showLowFps, sources, startRace, toMenu } from '../game/engine.js';
import { fromLatLng, toLatLng } from '../game/path.js';
import { fromQaName, getQuality, setQuality, toQaName } from '../game/quality.js';
import { clearQaInput, inputInfo, lastInput, setQaInput } from '../input/index.js';
import { game, on } from '../state.js';
import { showError } from '../ui/error.js';
import { VERSION } from '../version.js';
import type { PhysicsCarDebug } from '../types.js';
import type { GameQA, Vec3 } from './types.js';

const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const DEG = 180 / Math.PI;

export function installQaHooks(ui: HTMLElement) {
  // Occlusion sampling every 6th frame (raycast camera → car against the track meshes).
  const ray = new THREE.Raycaster();
  const tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let frameNo = 0, occluded = false, inside = false, occludedFrames = 0, totalFrames = 0;
  const sampleOcclusion = () => {
    const car = E.car, track = E.track;
    if (!car || !track || (E.phase !== 'racing' && E.phase !== 'countdown')) return;
    totalFrames++;
    if (frameNo++ % 6 === 0) {
      const cam = E.camera.position;
      tmp.set(car.state.pose.x, car.state.pose.y + 0.8, car.state.pose.z).sub(cam);
      const dist = tmp.length();
      ray.set(cam, tmp.normalize());
      ray.far = Math.max(0, dist - 1.5);
      occluded = ray.intersectObject(track.root, true).some((h) => (h.object as THREE.Mesh).isMesh && h.object.visible);
      ray.set(cam, up);
      ray.far = 200;
      const hit = ray.intersectObject(track.root, true).find((h) => (h.object as THREE.Mesh).isMesh);
      inside = !!hit?.face && hit.face.normal.y > 0.5; // hit a roof from below = inside a building
    }
    if (occluded) occludedFrames++;
  };
  const tick = () => { sampleOcclusion(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  on('state', (s) => { if (s === 'countdown') { occludedFrames = 0; totalFrames = 0; } });

  let bounds: { minX: number; maxX: number; minZ: number; maxZ: number } | null = null;
  const physDefault = {
    stepHz: 120 as const, stepsLastFrame: 0, stepMsP95: 0,
    ropes: { simulatedPoints: 0, activeSpans: 0, msLastFrame: 0 }, pendulums: { simulated: 0 },
    weather: { rain: 0, muMul: 1, windMs: 0 }, tuning: {} as Record<string, number>,
  };

  const api: GameQA = {
    version: VERSION,
    ready: E.ready,
    state: () => game.state,
    error: () => game.error,
    stats: () => {
      const info = E.renderer.info, m = E.metrics;
      const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      const size = E.renderer.getDrawingBufferSize(new THREE.Vector2());
      return {
        fps: m.fps, fpsP5: m.fpsP5(), frameMsP50: m.pct(0.5), frameMsP95: m.pct(0.95), frameMsP99: m.pct(0.99),
        longFrames: m.longFrames, drawCalls: info.render.calls, triangles: info.render.triangles,
        geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0,
        jsHeapMB: mem ? mem.usedJSHeapSize / 1048576 : null,
        dpr: E.renderer.getPixelRatio(), renderWidth: size.x, renderHeight: size.y,
        quality: toQaName(getQuality().tier), uptimeMs: performance.now() - game.startedAt,
      };
    },
    car: () => {
      const c = E.car, s = c?.state;
      // car-physics exposes `telemetry` (PHYSICS §8); stub/other cars may offer debug().
      const tel = (c as { telemetry?: Partial<PhysicsCarDebug> & { contact?: PhysicsCarDebug['contact'] } } | null)?.telemetry;
      const d: Partial<PhysicsCarDebug> = tel ?? c?.debug?.() ?? {};
      const onGround = d.contact ? d.contact.wheels.filter(Boolean).length : undefined;
      const race = E.race;
      const p = s?.pose ?? { x: 0, y: 0, z: 0, heading: 0 };
      const imp = c?.lastImpact;
      return {
        pos: v3(p.x, p.y, p.z), yawDeg: p.heading * DEG,
        velocity: s ? v3(s.velocity.x, s.velocity.y, s.velocity.z) : v3(0, 0, 0),
        speedKmh: s?.speedKmh ?? 0,
        wheelsOnGround: onGround ?? d.wheelsOnGround ?? (s?.airborne ? 0 : 4),
        slipAngleDeg: s?.driftAngleDeg ?? 0, drifting: s?.drifting ?? false,
        boost: { active: lastInput().boost, charge: s?.gas ?? 0, cooldownMs: d.boost?.cooldownMs ?? 0 },
        jump: d.jump ?? { active: s?.airborne ?? false, heightM: d.apexM ?? p.y, airtimeMs: d.airtimeMs ?? 0, cooldownMs: 0 },
        lastCollision: imp ? { atMs: 0, impulse: imp.impulse, objectId: imp.kind, objectKind: imp.kind } : null,
        stuckMs: race?.stuckMs ?? 0,
        g: d.g ?? { long: s?.gForce ?? 0, lat: 0, total: s?.gForce ?? 0, peak: race?.stats.maxG ?? 0 },
        slip: d.slip ?? { betaDeg: s?.driftAngleDeg ?? 0, frontDeg: 0, rearDeg: 0, rearSliding: s?.drifting ?? false },
        tank: d.tank ?? { units: (s?.gas ?? 0) * 100, lastUseUnits: 0, lastUse: null },
        airborne: s?.airborne ?? false, airtimeMs: d.airtimeMs ?? 0, apexM: d.apexM ?? 0,
        contact: d.contact ?? { wheels: [true, true, true, true], compressionM: [0, 0, 0, 0], surface: s?.onSurface === 'water' ? 'water' : 'wet' },
        fans: d.fans ?? { level: 0, spool: 0 }, thrustN: d.thrustN ?? { rear: 0, lift: 0 },
        launch: d.launch ?? { armed: race?.launch.armed ?? false, active: false },
        hydroplaning: d.hydroplaning ?? false, attitudeDeg: d.attitudeDeg ?? { pitch: 0, roll: 0 },
      };
    },
    physics: () => {
      const pc = E.car as { telemetry?: { stepMs: number }; tuning?: Record<string, number> } | null;
      return {
        ...physDefault,
        ...(E.car?.physicsDebug?.() ?? {}),
        // M3 turns rain on in the physics (visuals.ts → setRain(1)) — report the live value, not the default
        ...(typeof pc?.tuning?.rain === 'number' ? { weather: { ...physDefault.weather, rain: pc.tuning.rain, muMul: 1 - pc.tuning.rain * (1 - (pc.tuning.wetMul ?? 1)) } } : {}),
        stepMsP95: pc?.telemetry?.stepMs ?? 0,
        tuning: pc?.tuning ?? {},
        source: sources.physics,
      };
    },
    modules: () => ({ ...sources }),
    camera: () => {
      const cam = E.camera, p = E.car?.state.pose;
      const look = new THREE.Vector3();
      cam.getWorldDirection(look).multiplyScalar(10).add(cam.position);
      return {
        pos: v3(cam.position.x, cam.position.y, cam.position.z), lookAt: v3(look.x, look.y, look.z), fovDeg: cam.fov,
        distanceToCarM: p ? Math.hypot(cam.position.x - p.x, cam.position.y - p.y, cam.position.z - p.z) : 0,
        occluded, insideMesh: inside, occludedFrames, totalFrames,
      };
    },
    track: () => {
      const r = E.race;
      return {
        id: E.track?.id ?? 'A', lengthM: r?.path.length ?? 0,
        centerline: r ? r.path.pts.map((p) => [p.x, p.z] as [number, number]) : [],
        progressM: r?.progressM ?? 0, lap: r?.lap ?? 0, totalLaps: E.laps,
        lapTimeMs: r?.lapTimeMs() ?? 0, lapTimesMs: r?.lapTimes.slice() ?? [],
        checkpoint: { next: r?.nextCp ?? 0, total: E.track?.checkpoints.length ?? 0, missed: r?.missed ?? 0 },
        offTrack: r?.offTrack ?? false, distanceFromCenterlineM: r?.distFromCenter ?? 0,
      };
    },
    world: () => {
      if (!bounds && E.track) {
        const b = new THREE.Box3().setFromObject(E.track.root);
        bounds = { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z };
      }
      return {
        boundsM: bounds ?? { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
        monument: (() => {
          const m = (E.track as { extras?: { monument?: { x: number; y: number; z: number } } } | null)?.extras?.monument;
          return { pos: m ? v3(m.x, m.y, m.z) : v3(0, 0, 0), collider: 'static' as const };
        })(),
        respawnCount: E.race?.respawns ?? 0, outOfBoundsCount: E.race?.outOfBounds ?? 0,
        roadNames: E.track?.roadNames
          ?? ((E.track as { extras?: { roadNames?: { name: string; osm: string }[] } } | null)?.extras?.roadNames ?? [])
            .map((r) => ({ osmWayId: r.osm, nameTh: r.name, shownText: r.name })),
        toLatLng: (x, z) => { const r = toLatLng(x, z); return { lat: r.lat, lng: r.lng }; },
        fromLatLng: (lat, lng) => fromLatLng(lat, lng),
      };
    },
    input: () => {
      const i = lastInput();
      return { source: inputInfo.source, throttle: i.throttle, brake: i.brake, steer: i.steer, jump: i.jump, boost: i.boost, activePointers: inputInfo.activePointers, lastLatencyMs: inputInfo.lastLatencyMs };
    },
    audio: () => {
      const d = (E.audio as { debug?: () => ReturnType<GameQA['audio']> } | null)?.debug?.();
      return d ?? { contextState: 'none', unlocked: false, muted: false, musicVolume: 1, sfxVolume: 1, engineRate: 0, playing: [] };
    },
    on: (event, cb) => on(event, cb),
    qa: {
      async start(_trackId, opts) {
        await E.ready;
        await startRace({ skipCountdown: opts?.skipCountdown ?? false, laps: opts?.laps });
      },
      restart: () => startRace(),
      toMenu: async () => toMenu(),
      pause,
      resume,
      setInput: (i) => setQaInput(i),
      clearInput: () => clearQaInput(),
      wheelClearanceM() {
        // Lowest drawn tyre bottom minus the road under it (< 0 = wheel inside the road). FEEL-05.
        const wb = (E.car as { qa?: { wheelBottoms?: () => { x: number; y: number; z: number }[] } } | null)?.qa?.wheelBottoms?.();
        const track = E.track;
        if (!wb || !track) return null;
        return Math.min(...wb.map((p) => p.y - track.heightAt(p.x, p.z)));
      },
      teleport(x, z, yawDeg, speedKmh) {
        const car = E.car, track = E.track;
        if (!car || !track) return;
        car.reset({ x, y: track.heightAt(x, z), z, heading: yawDeg / DEG });
        if (speedKmh) car.qa?.setSpeed?.(speedKmh);
        E.race?.syncAfterTeleport();
      },
      setQuality: (q) => { const t = fromQaName(q); if (t) setQuality(t, false); },
      fixedStep(enabled, dtMs) { E.fixedMode = enabled; if (dtMs) E.fixedDtMs = dtMs; E.acc = 0; },
      async step(frames) { if (E.fixedMode) qaStep(frames); else for (let i = 0; i < frames; i++) advance(1 / 60); },
      forceError: (code) => (code === 'lowfps' ? showLowFps() : showError(ui, code)),
      autopilot(enabled) { E.autopilot = enabled; },
      dump() {
        console.log(JSON.stringify({ version: VERSION, state: game.state, error: game.error, modules: sources, stats: api.stats(), car: api.car(), track: { ...api.track(), centerline: undefined }, input: api.input() }));
      },
      setWeather(w) {
        const pc = E.car as { setRain?: (r: number) => void } | null;
        if (pc?.setRain && w.rain !== undefined) { pc.setRain(w.rain); physDefault.weather.rain = w.rain; }
        else E.car?.qa?.setWeather?.(w);
      },
      setTank(u) {
        const ph = (E.car as { physics?: { gas: number } } | null)?.physics;
        if (ph) ph.gas = Math.max(0, Math.min(100, u)); else E.car?.qa?.setTank?.(u);
      },
      armLaunch() {
        // Same as a player holding BOOST at standstill ≥ 0.3 s (car-physics REPORT §3).
        if (E.car?.qa?.armLaunch) return E.car.qa.armLaunch();
        setQaInput({ boost: true, throttle: 0 });
      },
    },
  };
  window.__game = api;

  // H-02: ?qa=1&hud=1 perf overlay for real phones.
  if (new URLSearchParams(location.search).get('hud') === '1') {
    const el = document.createElement('div');
    el.className = 'qa-hud';
    ui.append(el);
    setInterval(() => {
      const s = api.stats();
      el.textContent = `fps ${s.fps.toFixed(0)} · p95 ${s.frameMsP95.toFixed(1)} ms · dc ${s.drawCalls} · tri ${(s.triangles / 1000).toFixed(0)}k · ${s.quality}`;
    }, 500);
  }
}
