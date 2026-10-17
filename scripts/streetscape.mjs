// M2 streetscape for build-track.mjs: building styles (shophouse kit), street furniture
// (lamps, utility poles + cable spans, traffic signals, crosswalks, street-name signs, trees,
// footbridges, side-street stubs with parked cars) and M3 anchor lists (blade signs, gold
// shops, lanterns, neon, billboards). Everything is placed from real data:
// research/streetview/REPORT-track-A.md (§1 table, §5 junctions), segments.json and OSM.
//
// Angles: `ang` = three.js rotation.y that turns local +z to face (sin ang, cos ang) in x/z.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const norm = (a) => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const angOf = (d) => Math.atan2(d[0], d[1]);

// Building style codes (client: src/track/facade-atlas.ts rows)
export const ST = { SHOP: 0, OLD: 1, HOTEL: 2, MALL: 3, MESH: 4, CIVIC: 5, HOUSE: 6, THAI: 7 };

// Thai colour words in segments.json → paint tint (first match wins)
const COLOR_WORDS = [
  ['ส้มแซลมอน', 0xe8a088], ['แซลมอน', 0xe8a088], ['เขียวอ่อน', 0xb8d2a2], ['ส้มอิฐ', 0xb0603e], ['แดงอิฐ', 0xa85a3e],
  ['พาสเทล', 0xd8b8d8], ['เทอร์ควอยซ์', 0x7cc8c0], ['ครีม', 0xe6d8b4], ['เบจ', 0xd8c6a4], ['ขาว', 0xe8e5dc],
  ['เหลือง', 0xe6cc6a], ['ชมพู', 0xe4a6b2], ['ฟ้า', 0xa6c8de], ['ส้ม', 0xe0985a], ['แดง', 0xb8463c], ['ม่วง', 0x8a6aa8],
  ['น้ำตาล', 0x8e6c4c], ['ไม้', 0x9a7048], ['สนิม', 0x8a5a3a], ['น้ำเงิน', 0x5070a8], ['เทา', 0x9c9ca0], ['เขียว', 0x8fb08a], ['อิฐ', 0xa85a3e],
];
// Common shophouse paints seen around the old town (REPORT §ภาพรวมสไตล์ 1: white, cream, yellow, pink, light blue)
const STREET_PAINT = [0xe8e5dc, 0xe6d8b4, 0xe6cc6a, 0xe4a6b2, 0xa6c8de, 0xd8c6a4, 0xe8e5dc, 0xc8c4bc];

function tintFrom(text) {
  if (!text) return null;
  let best = null;
  for (const [w, c] of COLOR_WORDS) {
    const k = text.indexOf(w);
    if (k >= 0 && (!best || k < best.k)) best = { k, c };
  }
  return best?.c ?? null;
}

function styleFrom(type = '', floors = 0) {
  if (/ตาข่าย/.test(type)) return ST.MESH;
  if (/โรงเรียน|อาคารเรียน|ร\.ร\./.test(type)) return ST.CIVIC;
  if (/ทรงไทย|หลังคาจั่ว|^วัด|กำแพงวัด/.test(type)) return ST.THAI;
  if (/ห้องแถวไม้|ไม้\+ปูน|ไม้เก่า|ฝาไม้|ตึกแถวไม้|สังกะสี|ห้องแถวเก่า/.test(type)) return ST.OLD;
  if (/โรงแรม|คอนโด|อพาร์ตเมนต์|ยุค 6|ยุค 7|ครีบ/.test(type) || floors >= 6) return ST.HOTEL;
  if (/ห้าง|กล่อง|ตลาด|พาณิชย์|โรงหนัง/.test(type)) return ST.MALL;
  if (/ราชการ|ธนาคาร|ธ\.ก\.ส|สำนักงาน|สถานบริบาล/.test(type)) return ST.CIVIC;
  if (/ทาวน์โฮม|บ้าน|คลินิก/.test(type)) return ST.HOUSE;
  if (/ตึกแถว|ร้าน/.test(type)) return ST.SHOP;
  return null;
}

// Junction knowledge (REPORT-track-A §1/§5): signalised crossroads and the colour of the
// street-name plate seen on the corner (green only where Street View showed green).
const SIGNAL_ROADS = new Set(['โพธิ์กลาง', 'จักรี', 'ยมราช', 'อัษฎางค์', 'จอมพล', 'มหาดไทย', 'จอมสุรางค์ยาตร์']);
const SIGNAL_CORNERS = new Set(['ราชสีมา-โชคชัย', 'มนัส', 'วัชรสฤษดิ์']);
export const SIGN_NAMES = ['โพธิ์กลาง', 'สุรนารี', 'ชุมพล', 'ราชดำเนิน', 'ราชสีมา-โชคชัย', 'จักรี', 'มนัส', 'พลแสน',
  'ยมราช', 'อัษฎางค์', 'จอมพล', 'มหาดไทย', 'สรรพสิทธิ์', 'วัชรสฤษดิ์', 'กำแหงสงคราม', 'จอมสุรางค์ยาตร์'];
export const SIGN_GREEN = new Set(['ราชดำเนิน', 'สรรพสิทธิ์']);
const short = (n) => (n ?? '').replace(/^ถนน/, '').replace(/^ถ\.\s*/, '').trim();

export function buildStreetscape(ctx) {
  const { C, T, N, ds, L, W, MED, W2, WL, extR, rightOf, project, cellCls, pads, buildings, svSides, mouths, corners,
    nameSpans, carRoads, inZone, pointInRing, hash, researchMap, segsAll, P } = ctx;
  const S = (i) => i * ds;
  const idxOf = (s) => ((Math.round(s / ds) % N) + N) % N;
  const roadAt = (s) => short(nameSpans.find((n) => s >= n.s0 && s < n.s1)?.name ?? nameSpans.at(-1).name);
  const inPad = (p) => pads.some((pd) => pd.cls === 1 && pointInRing(p[0], p[1], pd.ring));
  const nearPad = (p, r) => pads.some((pd) => pd.cls === 1 && (pointInRing(p[0], p[1], pd.ring) || pd.ring.some((q) => dist(q, p) < r)));
  const inBuilding = (p) => buildings.some((b) => pointInRing(p[0], p[1], b.ring));
  const nearMouth = (p, r) => mouths.some((m) => dist(m.p, p) < r + m.len / 2);
  // research track_m → game s (researchMap rows every 50 m; wraps once at the finish)
  const rs = (m) => {
    let k = researchMap.findIndex((r) => r[0] > m) - 1;
    if (k < 0) k = researchMap.length - 2;
    const [m0, s0] = researchMap[k], [m1, s1r] = researchMap[k + 1];
    const s1 = s1r < s0 ? s1r + L : s1r;
    return ((s0 + ((s1 - s0) * (m - m0)) / (m1 - m0)) % L + L) % L;
  };
  // left / right sidewalk positions (inset from the outer edge of the walk)
  const leftEdge = (i) => -(W[i] / 2 + WL[i]);
  const posAt = (i, off) => add(C[i], mul(rightOf(T[i]), off));
  const walkL = (i, inset) => posAt(i, leftEdge(i) + inset);
  const walkR = (i, inset) => posAt(i, extR(i) - inset);
  const blocked = (p) => cellCls(p) === 0;
  const water = (p) => cellCls(p) === 3;

  // ── 0. gap filler: shophouse rows where Street View shows buildings but OSM has none ──
  // (e.g. the gold-shop west side of Ratchadamnoen). 4.2 m units, depth 14 m, floors from the
  // nearest same-side Street View note ±1 so the row has the real jagged roofline.
  const OPEN = /คู|ลาน|สวน|เกาะ|สนาม|น้ำ|ทางแยก|ถนน|ทางเท้า|ต้นไม้|โรงเรียน|รั้ว|กำแพง|ซุ้ม|ศาลา|ราวลูกกรง|ลานโล่ง/;
  const gapBuildings = [];
  {
    const UNIT = 4.2, DEPTH = 14;
    for (const side of [-1, 1]) {
      let lastPlaced = -1e9;
      for (let s = 0; s < L; s += 1) {
        if (s - lastPlaced < UNIT) continue;
        const i = idxOf(s), road = roadAt(s);
        const note = (() => { let best = null; for (const v of svSides) { if (v.side !== side) continue; const d = Math.min(Math.abs(v.s - s), L - Math.abs(v.s - s)); if (d < 70 && (!best || d < best.d)) best = { d, v }; } return best?.v; })();
        const westRatchadamnoen = /ราชดำเนิน/.test(road) && side < 0;
        if (!westRatchadamnoen && (!note || OPEN.test(note.type ?? '') || !(note.floors > 0))) continue;
        if (westRatchadamnoen && note && /โรงเรียน|วัด|ราชการ|กำแพง|รั้ว/.test(note.type ?? '')) continue;
        const r = rightOf(T[i]), out = mul(r, side), t = T[i];
        const edge = side < 0 ? W[i] / 2 + WL[i] : extR(i);
        const near = edge + 0.35, far = near + DEPTH;
        const base = (o) => add(C[i], mul(out, o));
        const ring = [add(base(near), mul(t, -UNIT / 2)), add(base(near), mul(t, UNIT / 2)), add(base(far), mul(t, UNIT / 2)), add(base(far), mul(t, -UNIT / 2))];
        const probe = [...ring, base((near + far) / 2), base(near + 1), add(base(near + 0.2), mul(t, -UNIT / 2 + 0.2)), add(base(near + 0.2), mul(t, UNIT / 2 - 0.2))];
        if (probe.some((p) => cellCls(p) !== 0 || inZone(p) || nearPad(p, 3))) continue;
        if (mouths.some((m) => dist(m.p, base(near)) < m.len / 2 + 3)) continue;
        if (probe.some((p) => inBuilding(p)) || gapBuildings.some((g) => dist(g.c, base((near + far) / 2)) < UNIT * 0.95)) continue;
        const f0 = note?.floors > 0 ? note.floors : 3;
        const floors = Math.max(2, Math.min(6, f0 + (hash(Math.round(s) * 3 + side) < 0.25 ? -1 : hash(Math.round(s) * 5 + side) < 0.3 ? 1 : 0)));
        const ccw = ring; // orientation fixed below
        let a = 0; for (let k = 0; k < 4; k++) a += ccw[k][0] * ccw[(k + 1) % 4][1] - ccw[(k + 1) % 4][0] * ccw[k][1];
        const b = { ring: a < 0 ? ccw.slice().reverse() : ccw, h: floors * 3.4 + 0.8, src: 'gap', s, tags: { building: 'terrace' }, area: UNIT * DEPTH, c: base((near + far) / 2) };
        gapBuildings.push(b);
        buildings.push(b);
        lastPlaced = s;
      }
    }
  }

  const propWalls = []; // [a, b, kind=5, side=1, h]
  const collider = (p, r, h = 0) => {
    const c = [[-r, -r], [r, -r], [r, r], [-r, r]].map((d) => add(p, d));
    for (let k = 0; k < 4; k++) propWalls.push([c[k], c[(k + 1) % 4], 5, 1, h]);
  };

  // ── 1. building styles, tints, street-facing edges ──
  function svNear(s, side, maxD) {
    let best = null;
    for (const v of svSides) {
      if (v.side !== side) continue;
      const d = Math.min(Math.abs(v.s - s), L - Math.abs(v.s - s));
      if (d < maxD && (!best || d < best.d)) best = { d, v };
    }
    return best?.v ?? null;
  }
  const buildingMeta = [];
  buildings.forEach((b, bi) => {
    const pr = project(b.ring.reduce((a, p) => add(a, mul(p, 1 / b.ring.length)), [0, 0]));
    const floors = Math.max(1, Math.round((b.h - 0.8) / 3.4));
    const sv = svNear(pr.s, pr.side, 70), svClose = svNear(pr.s, pr.side, 30);
    const svInfo = sv ? { type: sv.type, color: sv.color } : null;
    const closeInfo = svClose ? { type: svClose.type, color: svClose.color } : null;
    const tags = b.tags ?? {};
    let st = null;
    if (b.src === 'gap') { const g = styleFrom(closeInfo?.type, 0); st = g === ST.OLD || g === ST.MESH || g === ST.HOUSE ? g : ST.SHOP; }
    else if (b.src === 'synthetic') st = styleFrom(svInfo?.type, floors);
    else if (tags.amenity === 'place_of_worship') st = ST.THAI;
    else if (tags.tourism === 'hotel' || tags.building === 'hotel' || tags.building === 'apartments') st = ST.HOTEL;
    else if (tags.amenity === 'school' || tags.building === 'school' || tags.office || tags.government || tags.amenity === 'bank') st = ST.CIVIC;
    else if (tags.building === 'house') st = ST.HOUSE;
    else if (tags.shop === 'mall' || tags.shop === 'department_store' || tags.amenity === 'marketplace') st = ST.MALL;
    if (st === null && closeInfo) st = styleFrom(closeInfo.type, floors);
    if (st === null && floors >= 6) st = ST.HOTEL;
    if (st === null && tags.building === 'terrace') st = ST.SHOP;
    if (st === null && b.area > 1500) st = ST.MALL;
    if (st === null && svInfo) st = styleFrom(svInfo.type, floors);
    if (st === null) {
      const road = roadAt(pr.s);
      // old-town commercial streets are shophouse rows; the school / government side streets less so
      st = /ราชดำเนิน|มนัส/.test(road) ? (hash(bi * 5 + 1) < 0.12 ? ST.OLD : ST.SHOP) : (hash(bi * 5 + 2) < 0.55 ? ST.SHOP : ST.HOUSE);
    }
    const tint = tintFrom(closeInfo?.color) ?? STREET_PAINT[Math.floor(hash(bi * 11 + 7) * STREET_PAINT.length)];
    // Street-facing edges: walk outward from the edge midpoint until we hit the drivable surface.
    const front = [];
    const r = b.ring;
    for (let k = 0; k < r.length; k++) {
      const p = r[k], q = r[(k + 1) % r.length], el = dist(p, q);
      if (el < 2.5) continue;
      const m = mul(add(p, q), 0.5), t = norm(sub(q, p));
      let n = [t[1], -t[0]];
      if (pointInRing(m[0] + n[0] * 0.3, m[1] + n[1] * 0.3, r)) n = mul(n, -1);
      for (let d = 0.5; d <= 26; d += 1) {
        const c = cellCls(add(m, mul(n, d)));
        if (c === 1 || c === 2) { front.push(k); break; }
        if (d > 2 && inBuilding(add(m, mul(n, d)))) break;
      }
    }
    buildingMeta.push({ st, tint, front, floors, s: pr.s, road: roadAt(pr.s) });
  });

  // ── 2. junctions (corners + named side-road mouths) ──
  const junctions = corners.map((c) => {
    const next = roadAt(c.s + 25);
    return { s: c.s, half: 14, corner: c, names: [next], signal: SIGNAL_CORNERS.has(next), xwalk: true, mouths: [] };
  });
  const CONNECTOR = new Set(['way/1228197025', 'way/1228197026']); // Ya Mo north link → Chumphon Rd (REPORT §5 116–129)
  for (const m of mouths) {
    let nm = m.roads.map((r) => (CONNECTOR.has(r) ? 'ชุมพล' : short(r))).find((r) => SIGN_NAMES.includes(r) || r === 'มิตรภาพ');
    if (!nm) continue;
    if (nm === 'มิตรภาพ') nm = 'ราชสีมา-โชคชัย';
    const near = junctions.find((j) => Math.min(Math.abs(j.s - m.s), L - Math.abs(j.s - m.s)) < 30);
    if (near) {
      if (!near.names.includes(nm) && nm !== roadAt(m.s)) near.names.push(nm);
      if (!near.corner) near.half = Math.max(near.half, m.len / 2 + 2);
      near.mouths.push(m);
      continue;
    }
    junctions.push({ s: m.s, half: m.len / 2 + 2, names: nm === roadAt(m.s) ? [] : [nm], signal: SIGNAL_ROADS.has(nm), xwalk: true, mouths: [m] });
  }
  for (const j of junctions) j.mouths ??= [];
  junctions.sort((a, b) => a.s - b.s);

  const signals = [], xwalks = [], signs = [];
  const signSlot = (nm) => SIGN_NAMES.indexOf(nm);
  for (const j of junctions) {
    const sStop = (j.s - j.half - 1 + L) % L, iStop = idxOf(sStop);
    if (j.xwalk && !inPad(C[iStop])) xwalks.push({ s: +(sStop - 4).toFixed(1), stop: 1 });
    if (j.signal) {
      const back = mul(T[iStop], -1);
      const p = walkL(iStop, 0.5);
      if (!inPad(p) && !inZone(p)) {
        signals.push({ p, ang: angOf(back), arm: Math.min(W[iStop] * 0.55, 7.5), kind: 1 });
        collider(p, 0.22);
      }
      const sFar = (j.s + j.half + 1) % L, iFar = idxOf(sFar);
      const pf = walkL(iFar, 0.5);
      if (!j.corner && !inPad(pf) && !inZone(pf)) { signals.push({ p: pf, ang: angOf(mul(T[iFar], -1)), arm: 0, kind: 2 }); collider(pf, 0.15); }
      if (!j.corner && !inPad(C[iFar])) xwalks.push({ s: +(sFar + 0.5).toFixed(1), stop: 0 });
    }
    // street-name plates: corners name the road you turn into (outer corner, in view through the turn),
    // crossroads name the side road on the near corner of each mouth side.
    if (j.corner) {
      const i = idxOf(j.s), outDir = mul(rightOf(T[i]), j.corner.dir === 'R' ? -1 : 1);
      let outer = j.corner.dir === 'R' ? walkL(i, 0.6) : walkR(i, 0.6);
      // open junction pads are asphalt: push the plate out to the far kerb
      for (let k = 0; k < 60 && cellCls(outer) === 1; k++) outer = add(outer, mul(outDir, 0.5));
      if (cellCls(outer) === 1 || cellCls(outer) === 3) continue;
      outer = add(outer, mul(outDir, 0.6));
      if (cellCls(outer) === 1 || cellCls(outer) === 3) outer = add(outer, mul(outDir, -0.6));
      const look = C[idxOf(j.s - 30)];
      const slot = signSlot(j.names[0]);
      if (slot >= 0 && !inZone(outer)) { signs.push({ p: outer, ang: angOf(norm(sub(look, outer))), slot }); if (cellCls(outer) === 2) collider(outer, 0.1); }
    } else {
      for (const nm of j.names) {
        const slot = signSlot(nm);
        if (slot < 0) continue;
        const m = j.mouths.find((mm) => mm.roads.some((r) => short(r) === nm || (CONNECTOR.has(r) && nm === 'ชุมพล') || (short(r) === 'มิตรภาพ' && nm === 'ราชสีมา-โชคชัย'))) ?? j.mouths[0];
        const pm = project(m.p), i = idxOf(pm.s - m.len / 2 - 1.2);
        const p = pm.side > 0 ? walkR(i, 0.6) : walkL(i, 0.6);
        if (inZone(p) || inPad(p)) continue;
        const look = C[idxOf(pm.s - 30)];
        signs.push({ p, ang: angOf(norm(sub(look, p))), slot });
        collider(p, 0.1);
      }
    }
  }

  // ── 3. lamps ──
  const causeway = (i) => water(posAt(i, leftEdge(i) - 2.5)) && water(posAt(i, extR(i) + 2.5));
  const moatWindow = (p) => p[0] > 478 && p[0] < 507 && p[1] < -540 && p[1] > -600; // PHYSICS §2.1: keep the jump gap clear
  const lamps = [];
  const placeLamp = (p, faceDir, type) => {
    if (inPad(p) || inZone(p) || moatWindow(p) || nearMouth(p, 2)) return;
    lamps.push({ p, ang: angOf(faceDir), type });
    collider(p, type === 2 ? 0.25 : 0.18);
  };
  for (let s = 6; s < L; s += 2.5) {
    const i = idxOf(s), road = roadAt(s), r = rightOf(T[i]);
    if (causeway(i)) { // Manat causeway: ornate cast-iron lamps on both sides (Street View A-12)
      if (Math.round(s / 2.5) % 6 === 0) { placeLamp(walkL(i, 0.35), r, 3); placeLamp(walkR(i, 0.35), mul(r, -1), 3); }
      continue;
    }
    if (Math.round(s / 2.5) % 12 !== 0) continue; // every 30 m
    if (/ราชดำเนิน/.test(road)) placeLamp(walkR(i, 0.6), mul(r, -1), 1);
    else if (MED[i] >= 1.6) placeLamp(posAt(i, W[i] / 2 + MED[i] / 2), r, 2);
    else if (road === 'ราชสีมา-โชคชัย') placeLamp(walkL(i, 0.6), r, 1);
    else if (Math.round(s / 30) % 2) placeLamp(walkR(i, 0.5), mul(r, -1), 1);
  }

  // ── 4. utility poles + cable spans ──
  const heavy = (s) => (s > rs(1300) && s < rs(1720));        // Manat: "สายไฟหนาแน่นมาก + หม้อแปลง" (A-13..A-16)
  const coilZone = (s) => s > rs(2530) && s < rs(2830);        // Watcharasarit–Kamhaeng coils (A-27, A-29, A-30)
  const poles = [];
  const placePole = (i, side, s) => {
    const p = side < 0 ? walkL(i, 0.45) : walkR(i, 0.45);
    if (inPad(p) || inZone(p) || nearMouth(p, 3) || causeway(i) || moatWindow(p) || water(p)) return null;
    if (lamps.some((l) => dist(l.p, p) < 3) || signals.some((g) => dist(g.p, p) < 3) || signs.some((g) => dist(g.p, p) < 2)) return null;
    const out = mul(rightOf(T[i]), side); // away from the road
    const flags = (hash(i * 3 + side + 9) < (heavy(s) ? 0.45 : 0.15) ? 1 : 0) | (coilZone(s) || (heavy(s) && hash(i + 77) < 0.4) ? 2 : 0);
    const pole = { p, ang: angOf(out), flags, side, s, i };
    poles.push(pole);
    collider(p, 0.2);
    return pole;
  };
  const leftRow = [], rightRow = [];
  for (let s = 18; s < L; s += 36) {
    const i = idxOf(s), road = roadAt(s);
    const lp = placePole(i, -1, s);
    if (lp) leftRow.push(lp);
    // the heavy Manat stretch has poles on both sides with spans across the street
    if (heavy(s) || /สรรพสิทธิ์|วัชรสฤษดิ์|กำแหงสงคราม/.test(road) && Math.round(s / 36) % 2) {
      const j = idxOf(s + 3), rp = placePole(j, 1, s + 3);
      if (rp) rightRow.push(rp);
    }
  }
  const cables = [];
  const ATT = [[-0.7, 8.2], [-0.25, 8.25], [0.25, 8.25], [0.7, 8.2], [-0.3, 6.9], [0.3, 6.9]]; // crossarm offsets (along road normal), height
  const attach = (pole, k) => { const o = ATT[k]; const n = rightOf(T[pole.i]); return [pole.p[0] + n[0] * o[0], o[1], pole.p[1] + n[1] * o[0]]; };
  const span = (a, b, sag) => cables.push([...a, ...b, +sag.toFixed(2)]);
  for (const row of [leftRow, rightRow]) {
    for (let k = 0; k + 1 < row.length; k++) {
      const A = row[k], B = row[k + 1], d = dist(A.p, B.p);
      if (d > 48 || d < 8) continue;
      const nWires = heavy(A.s) ? 6 : coilZone(A.s) ? 5 : 4;
      for (let w = 0; w < nWires; w++) span(attach(A, w), attach(B, w), (coilZone(A.s) ? 1.5 : 0.55 + hash(k * 7 + w) * 0.35) * (d / 36));
    }
  }
  // spans across the street (PHYSICS §5.5): every Manat pair, two on Ratchasima–Chok Chai, one at the causeway
  const crossSpan = (A, B, n, sag) => { for (let w = 0; w < n; w++) span(attach(A, w), attach(B, w % 4), sag + w * 0.12); };
  for (const A of leftRow) {
    const B = rightRow.find((r) => Math.abs(r.s - A.s) < 12);
    if (B) crossSpan(A, B, heavy(A.s) ? 3 : 2, 0.9);
  }
  // Ratchasima–Chok Chai: median transformer poles on twin posts (A-05) with spans to the school side
  for (const m of [745, 820]) {
    const s = rs(m), i = idxOf(s);
    if (MED[i] < 1.2) continue;
    const p = posAt(i, W[i] / 2 + MED[i] / 2 + 0.4);
    if (lamps.some((l) => dist(l.p, p) < 4)) continue;
    const med = { p, ang: angOf(rightOf(T[i])), flags: 1, side: 1, s, i };
    poles.push(med); collider(p, 0.25);
    const A = leftRow.reduce((b, l) => (Math.abs(l.s - s) < Math.abs(b.s - s) ? l : b), leftRow[0]);
    if (A && Math.abs(A.s - s) < 30) crossSpan(A, med, 2, 1.0);
  }
  { // Manat causeway entrance: one span you fly under on the jump line (PHYSICS §5.5 row 1200)
    let i = idxOf(rs(1200));
    while (causeway(i)) i = (i - 1 + N) % N;
    const A = placePole((i - 2 + N) % N, -1, S(i)), B = placePole((i - 2 + N) % N, 1, S(i));
    if (A && B) crossSpan(A, B, 2, 0.7);
  }

  // ── 5. trees ──
  const trees = [];
  const tree = (p, type, scale, withCollider) => {
    if (inPad(p) || inZone(p) || water(p) || inBuilding(p) || moatWindow(p)) return;
    if ([...lamps, ...poles, ...signals].some((o) => dist(o.p, p) < 2.5)) return;
    if (!withCollider && !blocked(p)) return;
    trees.push({ p, type, scale });
    if (withCollider) collider(p, 0.3);
  };
  for (let s = 4; s < L; s += 1) {
    const i = idxOf(s), road = roadAt(s), jit = hash(Math.round(s) * 13 + 5);
    if (/ราชดำเนิน/.test(road)) {
      // moat-side walk: palms in the south rows (A-31, A-32 "แถวต้นตาล"), rain trees / frangipani along the north
      const palms = s > rs(2840) && s < rs(3160);
      if (Math.round(s) % (palms ? 9 : 13) === 0) tree(walkR(i, 0.9), palms ? 1 : 0, 0.75 + jit * 0.5, true);
    } else if (road === 'ราชสีมา-โชคชัย') {
      // school side: big rain trees behind the fence (A-06 "ต้นจามจุรีใหญ่", A-09)
      if (Math.round(s) % 17 === 0) tree(walkL(i, -3.2 - jit * 3), 0, 1.1 + jit * 0.5, false);
      // trimmed hedges on the wide median (A-03/A-04 "ไม้พุ่มตัดแต่ง") — low, visual only
      if (MED[i] >= 3 && Math.round(s) % 4 === 0) tree(posAt(i, W[i] / 2 + MED[i] / 2 + (jit - 0.5) * 1.2), 2, 0.8 + jit * 0.4, false);
    } else if (road === 'สรรพสิทธิ์' && s < rs(2240)) {
      if (Math.round(s) % 9 === 0) tree(walkL(i, -2.5 - jit * 4), s < rs(2150) ? 1 : 0, 0.9 + jit * 0.4, false);
    } else if (road === 'กำแหงสงคราม' && s > rs(2700)) {
      if (Math.round(s) % 10 === 0) tree(walkR(i, -2.5 - jit * 3), 1, 0.9 + jit * 0.4, false);
    }
  }
  // median hedges are on the drivable curb: drop the low-hedge check (visual only, 0.35 m tall)
  for (const t of trees) if (t.type === 2) t.scale = Math.min(t.scale, 1);

  // ── 6. footbridges over the 224 (A-03 orange steel, A-08 roofed) ──
  const bridges = [];
  for (const [m, roof] of [[683, 0], [978, 1]]) {
    const i = idxOf(rs(m));
    const a = walkL(i, -1.6), b = posAt(i, extR(i) - 0.2);
    bridges.push({ a, b, roof });
    collider(b, 0.25);
  }

  // ── 7. side-street stubs + parked cars (outside the closed course, seen through the mouths) ──
  const stubs = [], parked = [];
  mouths.forEach((m, mi) => {
    if (m.len < 3) return;
    let best = null;
    for (const r of carRoads) for (let k = 0; k < r.pts.length - 1; k++) {
      const a = r.pts[k], b = r.pts[k + 1], ab = sub(b, a);
      const t = Math.max(0, Math.min(1, dot(sub(m.p, a), ab) / (dot(ab, ab) || 1)));
      const d = dist(m.p, add(a, mul(ab, t)));
      if (d < 6 && (!best || d < best.d)) best = { d, r, k, t };
    }
    if (!best) return;
    const pr = project(m.p), outward = norm(sub(m.p, C[pr.i]));
    // walk the polyline away from the track
    const pts = best.r.pts;
    const start = add(pts[best.k], mul(sub(pts[best.k + 1], pts[best.k]), best.t));
    const dirFwd = dot(norm(sub(pts[best.k + 1], pts[best.k])), outward) > 0;
    const out = [start];
    let acc = 0, k = dirFwd ? best.k + 1 : best.k;
    while (acc < 46 && k >= 0 && k < pts.length) {
      const q = pts[k], d = dist(out.at(-1), q);
      if (acc + d > 46) { out.push(add(out.at(-1), mul(norm(sub(q, out.at(-1))), 46 - acc))); acc = 46; break; }
      out.push(q); acc += d; k += dirFwd ? 1 : -1;
    }
    if (out.length < 2 || acc < 6) return;
    const w = Math.min(12, Math.max(5, best.r.w));
    stubs.push({ pts: out, w });
    // parked cars along the kerbs of the closed side street (Street View: "รถจอดสองฝั่ง")
    let along = 0;
    for (let q = 0; q < out.length - 1; q++) {
      const a = out[q], b = out[q + 1], seg = dist(a, b), dir = norm(sub(b, a)), nrm = [dir[1], -dir[0]];
      for (let u = 0; u < seg; u += 5.4) {
        const dd = along + u;
        if (dd < 9 || w < 6) continue;
        for (const side of [-1, 1]) {
          const h = hash(mi * 131 + Math.round(dd) * 7 + side);
          if (h > 0.62) continue;
          const p = add(add(a, mul(dir, u)), mul(nrm, side * (w / 2 - 1.1)));
          if (!blocked(p) || inBuilding(p) || water(p)) continue;
          parked.push({ p, ang: angOf(dir) + (h < 0.31 ? Math.PI : 0), color: Math.floor(hash(mi * 17 + dd) * 8), type: h < 0.12 ? 1 : 0 });
        }
      }
      along += seg;
    }
  });

  // ── 8. M3 anchors on street-facing facades ──
  const anchors = { blade: [], gold: [], lantern: [], neon: [], billboard: [] };
  buildings.forEach((b, bi) => {
    const meta = buildingMeta[bi];
    if (![ST.SHOP, ST.OLD, ST.HOTEL, ST.MALL, ST.MESH].includes(meta.st)) return;
    const r = b.ring;
    let goldDone = false;
    for (const k of meta.front) {
      const p = r[k], q = r[(k + 1) % r.length], el = dist(p, q), t = norm(sub(q, p));
      let n = [t[1], -t[0]];
      const m = mul(add(p, q), 0.5);
      if (pointInRing(m[0] + n[0] * 0.3, m[1] + n[1] * 0.3, r)) n = mul(n, -1);
      const bays = Math.max(1, Math.round(el / 3.8));
      const old = /ราชดำเนิน|มนัส/.test(meta.road);
      // gold shop (red fascia, gold letters) — the signature of every street round the plaza (REPORT สรุป)
      if (!goldDone && meta.st === ST.SHOP && old && el > 4 && hash(bi * 19 + k) < (/ราชดำเนิน/.test(meta.road) ? 0.4 : 0.2)) {
        const w = Math.min(el - 0.6, 6.5), c = add(m, mul(n, 0.12));
        anchors.gold.push([c[0], 4.0, c[1], angOf(n), w, 1.1]);
        goldDone = true;
      }
      for (let j = 0; j < bays; j++) {
        const u = (j + 0.5) / bays, c = add(p, mul(t, u * el)), h = hash(bi * 97 + k * 13 + j);
        if (meta.floors >= 2 && h < (old ? 0.3 : 0.18)) {
          const top = Math.min(b.h - 0.6, 4.4 + Math.min(meta.floors - 1, 3) * 3.4);
          const hh = Math.max(2, Math.min(5.5, top - 4.4));
          const bc = add(c, mul(n, 0.75));
          anchors.blade.push([bc[0], 4.4 + hh / 2, bc[1], angOf(t), 0.7, hh]);
        } else if (meta.floors >= 2 && h > 0.86) {
          const nc = add(c, mul(n, 0.08));
          anchors.neon.push([nc[0], Math.min(b.h - 1.2, 5.6 + hash(bi + j) * 2), nc[1], angOf(n), Math.min(el / bays, 3.2), 0.9]);
        }
        if (/มนัส/.test(meta.road) && meta.st !== ST.MALL && hash(bi * 7 + j * 3 + 1) < 0.35) {
          const lc = add(c, mul(n, 1.0));
          anchors.lantern.push([lc[0], 3.1, lc[1], 0, 0.4, 0.55]);
        }
      }
    }
  });
  // rooftop billboards where Street View shows them (R1-02, A-00, A-01, A-02, A-33)
  for (const sg of segsAll.filter((g) => ['02', 'A-00', 'A-01', 'A-02', 'A-33'].includes(g.segment) && /ราชดำเนิน|224|north/.test(g.road_key + g.road))) {
    const pt = P([sg.lng, sg.lat]);
    let best = null;
    buildings.forEach((b, bi) => {
      if (!buildingMeta[bi].front.length) return;
      const c = b.ring.reduce((a, p) => add(a, mul(p, 1 / b.ring.length)), [0, 0]), d = dist(c, pt);
      if (d < 45 && b.h > 7 && (!best || d < best.d)) best = { d, b, c };
    });
    if (!best) continue;
    const pr = project(best.c), face = norm(sub(C[pr.i], best.c));
    anchors.billboard.push([best.c[0], best.b.h + 0.6, best.c[1], angOf(face), 10, 4]);
  }

  return {
    buildingMeta, propWalls, junctions,
    streetscape: { lamps, poles, signals, xwalks, signs, trees, bridges, stubs, parked, cables },
    anchors,
  };
}
