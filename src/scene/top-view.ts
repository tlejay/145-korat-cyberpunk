// QA debug view (?qa=1&view=top): the whole track from above, overlaid with the raw OSM
// reference (red = OSM route incl. the wrong 148° routing, grey = OSM roads, blue = OSM water)
// so the road alignment can be checked against the map (QA REAL-02 ≤ 5 m). Drag = pan,
// wheel / pinch = zoom. Also prints the draw-call / triangle budget of the whole track.
import * as THREE from 'three';
import { loadTrack, getTrackExtras } from '../track/index.js';

interface DebugData {
  osmTrack: number[]; osmRoads: number[][]; osmWater: number[][];
  deviation: { maxM: number; p95M: number; meanM: number; correctedSpanM: [number, number]; maxInCorrectedM: number };
  mouths: { x: number; z: number; s: number; len: number; roads: string[] }[];
}

function lines(rings: number[][], color: number, y: number, closed: boolean, opacity = 1) {
  const pos: number[] = [];
  for (const r of rings) {
    const n = r.length / 2;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const j = (i + 1) % n;
      pos.push(r[i * 2] * 0.1, y, r[i * 2 + 1] * 0.1, r[j * 2] * 0.1, y, r[j * 2 + 1] * 0.1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: false, fog: false }));
}

export async function startTopView(canvas: HTMLCanvasElement, ui?: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const track = await loadTrack('A', scene);
  scene.fog = null;
  const sky = scene.getObjectByName('sky');
  if (sky) sky.visible = false;
  const dbg = (await fetch(`${import.meta.env.BASE_URL}data/track-A.debug.json`).then((r) => r.json())) as DebugData;

  const overlay = new THREE.Group();
  overlay.add(lines(dbg.osmRoads, 0x9a9a9a, 40, false, 0.5));
  overlay.add(lines(dbg.osmWater, 0x3b8cff, 40.5, true, 0.8));
  overlay.add(lines([dbg.osmTrack], 0xff3030, 41, false));
  const cl = (track.centerline ?? []).flatMap((p) => [p.x * 10, p.z * 10]);
  overlay.add(lines([cl], 0x39ff88, 41.5, true));
  const cpPos = track.checkpoints.map((c) => [c.a.x * 10, c.a.z * 10, c.b.x * 10, c.b.z * 10]);
  overlay.add(lines(cpPos, 0xffee44, 42, false));
  overlay.renderOrder = 10;
  scene.add(overlay);

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
  cam.position.set(230, 900, -120);
  cam.up.set(0, 0, -1); // north up
  cam.lookAt(230, 0, -120);
  // optional deep link: &cx=<x>&cz=<z>&zoom=<m per px>
  const qp = new URLSearchParams(location.search);
  let zoom = +(qp.get('zoom') ?? 1.25); // metres per css pixel
  const center = new THREE.Vector2(+(qp.get('cx') ?? 230), +(qp.get('cz') ?? -120));
  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    cam.left = (-w / 2) * zoom; cam.right = (w / 2) * zoom; cam.top = (h / 2) * zoom; cam.bottom = (-h / 2) * zoom;
    cam.position.set(center.x, 900, center.y);
    cam.lookAt(center.x, 0, center.y);
    cam.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch0 = 0, zoom0 = zoom;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', (e) => pointers.delete(e.pointerId));
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (!pinch0) { pinch0 = d; zoom0 = zoom; }
      zoom = Math.max(0.03, Math.min(4, (zoom0 * pinch0) / Math.max(1, d)));
    } else {
      pinch0 = 0;
      center.x -= (e.clientX - p.x) * zoom;
      center.y -= (e.clientY - p.y) * zoom;
    }
    p.x = e.clientX; p.y = e.clientY;
    resize();
  });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom = Math.max(0.03, Math.min(4, zoom * Math.exp(e.deltaY * 0.001))); resize(); }, { passive: false });

  const info = document.createElement('pre');
  info.setAttribute('data-qa', 'topview-info');
  info.style.cssText = 'position:fixed;left:8px;top:8px;margin:0;padding:8px 10px;background:rgba(10,8,20,.8);color:#cfe;font:12px/1.45 monospace;z-index:50;pointer-events:none;border:1px solid #2ef;';
  (ui ?? document.body).appendChild(info);

  // Whole-track budget: render everything once with all chunks visible.
  renderer.render(scene, cam);
  const ex = getTrackExtras()!;
  const full = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  const fmt = (n: number) => n.toLocaleString('th-TH');
  const render = () => {
    renderer.render(scene, cam);
    info.textContent = [
      'สนาม A — มุมบน (QA)  ลาก = เลื่อน · ล้อ/บีบ = ซูม',
      `ความยาว ${fmt(Math.round(track.lengthM ?? 0))} ม. · checkpoint ${track.checkpoints.length} · ผนังชน ${fmt(track.barriers.length)}`,
      `เบี่ยงจาก OSM: สูงสุด ${dbg.deviation.maxM} ม. · p95 ${dbg.deviation.p95M} ม. (ยกเว้นแยก 224 ที่แก้ s ${dbg.deviation.correctedSpanM.join('–')})`,
      `งบทั้งสนาม: draw ${full.calls} · สามเหลี่ยม ${fmt(full.tris)} · mesh ${ex.stats.meshes}`,
      `จอนี้: draw ${renderer.info.render.calls} · สามเหลี่ยม ${fmt(renderer.info.render.triangles)} · ${zoom.toFixed(2)} ม./px`,
      'เขียว = centerline เกม · แดง = OSM เดิม · เหลือง = checkpoint · ฟ้า = น้ำ OSM',
    ].join('\n');
    requestAnimationFrame(render);
  };
  render();
  (window as unknown as { __topView: unknown }).__topView = { full, deviation: dbg.deviation, mouths: dbg.mouths, stats: ex.stats };
}
