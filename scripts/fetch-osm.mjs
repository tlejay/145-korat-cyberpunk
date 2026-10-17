#!/usr/bin/env node
// Fetch real geometry around Thao Suranari Monument (Korat) from OpenStreetMap via Overpass,
// save the raw response and split it into GeoJSON layers.
// Usage: node scripts/fetch-osm.mjs [--offline]   (--offline re-splits an existing raw.json)
// Map data © OpenStreetMap contributors (ODbL)

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'research', 'osm');

// Brief bbox (14.968,102.090,14.982,102.106) widened to cover the whole old-city moat loop
export const BBOX = { south: 14.962, west: 102.084, north: 14.988, east: 102.122 };

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const b = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
const QUERY = `[out:json][timeout:120];
(
  way["highway"](${b});
  way["building"](${b});
  relation["building"](${b});
  way["building:part"](${b});
  way["waterway"](${b});
  way["natural"="water"](${b});
  relation["natural"="water"](${b});
  way["water"](${b});
  node["historic"](${b});
  way["historic"](${b});
  relation["historic"](${b});
  node["tourism"](${b});
  way["tourism"](${b});
  node["memorial"](${b});
  way["memorial"](${b});
  node["amenity"="place_of_worship"](${b});
  way["amenity"="place_of_worship"](${b});
  way["barrier"="city_wall"](${b});
  way["leisure"](${b});
  relation["leisure"](${b});
  way["landuse"](${b});
  relation["landuse"](${b});
);
out body geom;`;

async function fetchOverpass() {
  let lastErr;
  for (const url of ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[osm] POST ${url} (attempt ${attempt})`);
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': '145-korat-cyberpunk/0.1 (research script)',
          },
          body: 'data=' + encodeURIComponent(QUERY),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!Array.isArray(json.elements)) throw new Error('no elements');
        return json;
      } catch (err) {
        lastErr = err;
        console.warn(`[osm] failed: ${err.message}`);
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
  }
  throw lastErr;
}

const toCoords = (geom) => geom.map((p) => [round(p.lon), round(p.lat)]);
const round = (v) => Math.round(v * 1e7) / 1e7;
const isClosed = (c) => c.length > 3 && c[0][0] === c.at(-1)[0] && c[0][1] === c.at(-1)[1];

// Join relation member ways into closed rings (outer/inner)
function assembleRings(members, role) {
  const parts = members
    .filter((m) => m.type === 'way' && m.geometry && (m.role || 'outer') === role)
    .map((m) => toCoords(m.geometry));
  const rings = [];
  while (parts.length) {
    let ring = parts.shift();
    let grown = true;
    while (!isClosed(ring) && grown) {
      grown = false;
      const end = ring.at(-1);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const same = (a, c) => a[0] === c[0] && a[1] === c[1];
        if (same(p[0], end)) ring = ring.concat(p.slice(1));
        else if (same(p.at(-1), end)) ring = ring.concat(p.slice(0, -1).reverse());
        else continue;
        parts.splice(i, 1);
        grown = true;
        break;
      }
    }
    if (isClosed(ring)) rings.push(ring);
  }
  return rings;
}

const AREA_KEYS = ['building', 'building:part', 'landuse', 'leisure', 'natural', 'water', 'amenity', 'historic', 'tourism', 'memorial'];

function toFeature(el) {
  const tags = el.tags || {};
  const props = { osm_id: `${el.type}/${el.id}`, ...tags };
  if (el.type === 'node') {
    return { type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [round(el.lon), round(el.lat)] } };
  }
  if (el.type === 'way' && el.geometry) {
    const coords = toCoords(el.geometry);
    const area = isClosed(coords) && tags.area !== 'no' && !tags.highway && !tags.waterway && tags.barrier !== 'city_wall'
      && AREA_KEYS.some((k) => k in tags);
    const highwayArea = tags.highway && tags.area === 'yes' && isClosed(coords);
    return {
      type: 'Feature',
      properties: props,
      geometry: area || highwayArea ? { type: 'Polygon', coordinates: [coords] } : { type: 'LineString', coordinates: coords },
    };
  }
  if (el.type === 'relation' && el.members) {
    const outers = assembleRings(el.members, 'outer');
    const inners = assembleRings(el.members, 'inner');
    if (!outers.length) return null;
    // Simple assignment: all inners go to the first outer (good enough for research layers)
    const polys = outers.map((o, i) => (i === 0 ? [o, ...inners] : [o]));
    return { type: 'Feature', properties: props, geometry: { type: 'MultiPolygon', coordinates: polys } };
  }
  return null;
}

const fc = (features) => ({
  type: 'FeatureCollection',
  attribution: '© OpenStreetMap contributors (ODbL)',
  bbox: [BBOX.west, BBOX.south, BBOX.east, BBOX.north],
  features,
});

async function main() {
  await mkdir(OUT, { recursive: true });
  const rawPath = join(OUT, 'raw.json');
  let raw;
  if (process.argv.includes('--offline')) {
    raw = JSON.parse(await readFile(rawPath, 'utf8'));
  } else {
    raw = await fetchOverpass();
    raw.query = { bbox: BBOX, fetched_at: new Date().toISOString() };
    await writeFile(rawPath, JSON.stringify(raw));
  }

  const layers = { roads: [], buildings: [], water: [], landmarks: [], areas: [] };
  for (const el of raw.elements) {
    const t = el.tags || {};
    const f = toFeature(el);
    if (!f) continue;
    if (t.highway) layers.roads.push(f);
    else if (t.building || t['building:part']) layers.buildings.push(f);
    else if (t.waterway || t.natural === 'water' || t.water) layers.water.push(f);
    else if (t.historic || t.tourism || t.memorial || t.amenity === 'place_of_worship' || t.barrier === 'city_wall') layers.landmarks.push(f);
    else if (t.leisure || t.landuse) layers.areas.push(f);
    // Buildings that are also landmarks (e.g. temple halls, city gate) are mirrored into landmarks
    if ((t.building || t['building:part']) && (t.historic || t.tourism || t.memorial || t.amenity === 'place_of_worship')) {
      layers.landmarks.push(f);
    }
  }

  for (const [name, feats] of Object.entries(layers)) {
    await writeFile(join(OUT, `${name}.geojson`), JSON.stringify(fc(feats)));
    console.log(`[osm] ${name}.geojson: ${feats.length} features`);
  }
  console.log(`[osm] raw elements: ${raw.elements.length}`);
}

main().catch((err) => {
  console.error('[osm] fatal:', err.message);
  process.exit(1);
});
