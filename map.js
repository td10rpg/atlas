// map.js — the atlas model.
//
// Pure shapes and helpers, no DOM and no storage. An atlas is a grid config plus a
// dictionary of populated hexes keyed by id ("0102"). Only populated hexes are kept
// (and only those get a file on disk); the blank 95% of the frontier is implied by
// the grid. normalize() coerces anything loaded from disk into a valid atlas so a
// half-written folder degrades gracefully instead of crashing.

import { REGIONS, iconForTerrain, rollTerrain, rollTerrainForHex, generateHex, EDITABLE_TABLES } from './wag.js';
import { emptyHex, isPopulated, hexId, neighbors } from './hex.js';
import { HINTERLANDS_SEED } from './hinterlands-seed.js';

export const VERSION = 1;
export const DEFAULT_COLS = 16;
export const DEFAULT_ROWS = 12;
export const DEFAULT_HEX_MILES = 6; // the classic 6-mile hex

export function createAtlas(name = 'The Hinterlands') {
  return {
    version: VERSION,
    name,
    cols: DEFAULT_COLS,
    rows: DEFAULT_ROWS,
    hexMiles: DEFAULT_HEX_MILES,
    orientation: 'flat-odd-q',
    createdWith: 'td10 Atlas',
    hexes: {},      // id -> hex record (populated only)
    markers: [],    // atlas-level overlay: [{ type, hexId, label }] (backlog 16)
    rivers: [],     // atlas-level overlay: [ [[x,y], …], … ] — polylines of snapped
                    //   sub-hex-lattice vertices in board units (the river tool)
    labels: [],     // atlas-level overlay: [{ x, y, text }] — free text on the map
    customTables: {}, // per-atlas WAG table overrides: { tableKey: [{name, desc}] } (backlog 4)
  };
}

/** Coerce a raw labels array into clean { x, y, text } records. */
export function normalizeLabels(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((l) => (l && Number.isFinite(+l.x) && Number.isFinite(+l.y) && typeof l.text === 'string'
      ? { x: +l.x, y: +l.y, text: l.text } : null))
    .filter((l) => l && l.text.trim());
}

/** Coerce a raw rivers array into clean polylines of [x, y] board points. */
export function normalizeRivers(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((line) => (Array.isArray(line) ? line
      .map((p) => (Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1]) ? [+p[0], +p[1]] : null))
      .filter(Boolean) : []))
    .filter((line) => line.length >= 2);
}

const EDITABLE_KEYS = new Set(EDITABLE_TABLES.map((t) => t.key));
/** Coerce raw customTables into { tableKey: [{name, desc}] } for known tables only. */
export function normalizeCustomTables(raw) {
  const out = {};
  if (raw && typeof raw === 'object') {
    Object.keys(raw).forEach((k) => {
      if (!EDITABLE_KEYS.has(k) || !Array.isArray(raw[k])) return;
      const rows = raw[k]
        .map((r) => ({ name: typeof r?.name === 'string' ? r.name : '', desc: typeof r?.desc === 'string' ? r.desc : '' }))
        .filter((r) => r.name || r.desc);
      if (rows.length) out[k] = rows;
    });
  }
  return out;
}

/** Coerce a raw markers array into clean marker records. */
export function normalizeMarkers(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((m) => m && m.hexId && m.type)
    .map((m) => ({ type: String(m.type), hexId: String(m.hexId), label: typeof m.label === 'string' ? m.label : '' }));
}

export function getHex(atlas, id) {
  return atlas.hexes[id] || null;
}
/** The record for a hex, creating a blank in-memory one if absent (not yet saved). */
export function ensureHex(atlas, id) {
  return atlas.hexes[id] || (atlas.hexes[id] = emptyHex(id));
}
/** Drop a hex that's been emptied back to nothing. */
export function pruneHex(atlas, id) {
  const h = atlas.hexes[id];
  if (h && !isPopulated(h)) { delete atlas.hexes[id]; return true; }
  return false;
}

/** Auto-set the terrain icon whenever terrain changes, unless the user pinned one. */
export function applyTerrainIcon(h) {
  if (!h.iconPinned) h.icon = h.terrain ? iconForTerrain(h.terrain) : '';
  return h;
}

// ---- normalization --------------------------------------------------------

function clampInt(v, lo, hi, dflt) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}

/** Coerce a raw atlas.json (config only) into a valid config. Hexes load separately. */
export function normalizeConfig(raw) {
  const a = createAtlas();
  if (raw && typeof raw === 'object') {
    if (typeof raw.name === 'string' && raw.name.trim()) a.name = raw.name;
    a.cols = clampInt(raw.cols, 1, 60, DEFAULT_COLS);
    a.rows = clampInt(raw.rows, 1, 60, DEFAULT_ROWS);
    a.hexMiles = clampInt(raw.hexMiles, 1, 100, DEFAULT_HEX_MILES);
    a.markers = normalizeMarkers(raw.markers);
    a.rivers = normalizeRivers(raw.rivers);
    a.labels = normalizeLabels(raw.labels);
    a.customTables = normalizeCustomTables(raw.customTables);
  }
  return a;
}

/** Fold an array of parsed hex records into the atlas, keyed and de-duped by id. */
export function loadHexes(atlas, records) {
  (records || []).forEach((h) => {
    if (!h || !h.id) return;
    if (!Array.isArray(h.sites)) h.sites = [];
    if (!Array.isArray(h.settlements)) h.settlements = [];
    if (!Array.isArray(h.factions)) h.factions = [];
    if (!isPopulated(h)) return;
    applyTerrainIcon(h);
    atlas.hexes[h.id] = h;
  });
  return atlas;
}

// ---- the Hinterlands seed -------------------------------------------------
// The starter atlas IS the Hinterlands, converted from the canonical Fort world
// map into native hexes (see hinterlands-seed.js / scripts/gen-seed.mjs): the sea
// as Ocean-or-Coast hexes, the continent partitioned into the five regions, and
// the six canon towns placed and locked. Land hexes carry a region but no survey
// content — that's still yours to roll with the WAG.

function hexFromSeed(id, s) {
  const h = emptyHex(id);
  h.name = s.name || '';
  h.region = s.region || 'Unassigned';
  h.terrain = s.terrain || '';
  h.icon = s.icon || '';
  h.canon = !!s.canon;
  h.settlements = Array.isArray(s.settlements)
    ? s.settlements.map((x) => ({ name: x.name || '', type: x.type || '', conflict: x.conflict || '' })) : [];
  h.sites = Array.isArray(s.sites) ? s.sites : [];
  h.factions = Array.isArray(s.factions) ? s.factions : [];
  h.notes = s.notes || '';
  if (!h.icon) applyTerrainIcon(h);
  return h;
}

/** Build the Hinterlands hex records from the baked seed. */
export function seedHinterlands() {
  const out = {};
  const src = (HINTERLANDS_SEED && HINTERLANDS_SEED.hexes) || {};
  Object.keys(src).forEach((id) => {
    const h = hexFromSeed(id, src[id]);
    if (isPopulated(h)) out[id] = h; // skip blank 'Beyond the Frontier' cells
  });
  return out;
}

/** A brand-new atlas — the Hinterlands map, or (withHinterlands=false) a blank grid. */
export function createStarterAtlas(withHinterlands = true) {
  const a = createAtlas();
  if (withHinterlands && HINTERLANDS_SEED) {
    a.name = HINTERLANDS_SEED.name || a.name;
    a.cols = HINTERLANDS_SEED.cols || a.cols;
    a.rows = HINTERLANDS_SEED.rows || a.rows;
    a.hexMiles = HINTERLANDS_SEED.hexMiles || a.hexMiles;
    a.hexes = seedHinterlands();
  }
  return a;
}

// ---- random terrain map (backlog 15) --------------------------------------
// Fill a whole grid with *coherent* terrain (ranges cluster, coasts run in lines)
// by growing outward with the neighbour-aware roll — but leave every hex's survey
// content blank. Rolling a hex per already-placed neighbours (row-major order, so
// left/up neighbours are set) gives believable country rather than noise.

export function createRandomAtlas(cols, rows) {
  const a = createAtlas();
  a.name = 'Random Frontier';
  a.cols = clampInt(cols, 1, 60, DEFAULT_COLS);
  a.rows = clampInt(rows, 1, 60, DEFAULT_ROWS);
  const hexes = {};
  for (let col = 0; col < a.cols; col++) {
    for (let row = 0; row < a.rows; row++) {
      const id = hexId(col, row);
      const nbr = neighbors(col, row)
        .map((n) => { const nh = hexes[hexId(n.col, n.row)]; return nh ? nh.terrain : null; })
        .filter(Boolean);
      const h = emptyHex(id);
      h.terrain = rollTerrainForHex('Unassigned', nbr);
      applyTerrainIcon(h);
      hexes[id] = h;
    }
  }
  a.hexes = hexes;
  return a;
}

// Re-exports so app.js has one import surface for model concerns.
export { REGIONS, rollTerrain, rollTerrainForHex, generateHex };
