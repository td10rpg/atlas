// map.js — the atlas model.
//
// Pure shapes and helpers, no DOM and no storage. An atlas is a grid config plus a
// dictionary of populated hexes keyed by id ("0102"). Only populated hexes are kept
// (and only those get a file on disk); the blank 95% of the frontier is implied by
// the grid. normalize() coerces anything loaded from disk into a valid atlas so a
// half-written folder degrades gracefully instead of crashing.

import { REGIONS, iconForTerrain, rollTerrain, generateHex } from './wag.js';
import { emptyHex, isPopulated } from './hex.js';
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
  };
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

// Re-exports so app.js has one import surface for model concerns.
export { REGIONS, rollTerrain, generateHex };
