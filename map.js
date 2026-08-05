// map.js — the atlas model.
//
// Pure shapes and helpers, no DOM and no storage. An atlas is a grid config plus a
// dictionary of populated hexes keyed by id ("0102"). Only populated hexes are kept
// (and only those get a file on disk); the blank 95% of the frontier is implied by
// the grid. normalize() coerces anything loaded from disk into a valid atlas so a
// half-written folder degrades gracefully instead of crashing.

import { REGIONS, iconForTerrain, rollTerrain, generateHex } from './wag.js';
import { hexId, emptyHex, isPopulated } from './hex.js';

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

// ---- the canon seed (the pre-populated ~5%) -------------------------------
// The handful of hexes that anchor Hinterlands canon: Fort Caspar at the center,
// the five region anchors around it. Placed plausibly (canonical coordinates
// aren't published) and flagged canon:true. Written only into a fresh atlas.

const CANON = [
  {
    col: 8, row: 6, name: 'Fort Caspar', region: 'Unassigned', terrain: 'Urban',
    settlementType: 'Fort stronghold — a black-basalt fort at the confluence of two rivers, atop a continental cliff; some 200 souls under an iron-willed Warrior.',
    settlementConflict: 'The Dreamer stirs — each night, 1-in-5 a Fort NPC hears the Call and turns on another. Order is reactive; the party is the only initiative the good guys have.',
    factions: ['Fort Caspar', 'The Church of the Northern Light', 'The Sunless Court'],
    notes: 'The gate to the Hinterlands. Tavern, church (Bishop + 2 deacons), forge, reliquary, library (a hobbit Wizard curator and quiet occult scholar), a Level 4 elven Cleric healer (resurrection, 50 gp), the master-at-arms, and the rumored Black Cells beneath.',
  },
  {
    col: 4, row: 9, name: 'Three Branches Landing', region: 'The River Settlements', terrain: 'Swamp or Wetlands',
    settlementType: 'Barge landing — the anchor of the delta and barge country, a Mississippi-steamboat world of pilings and tar.',
    settlementConflict: 'Sheriff Toby Vell keeps a fraying peace; the Black Sluice moves cargo the law pretends not to see.',
    factions: ['The Black Sluice'],
    notes: 'Anchor town of the River Settlements.',
  },
  {
    col: 6, row: 3, name: 'Hollowpine', region: 'The Pine Expanse', terrain: 'Forest or Jungle',
    settlementType: 'Trapper town — the anchor of the vast boreal Pine Expanse (a Pacific-Northwest / Cascades wood).',
    settlementConflict: 'Sheriff Aelwyn Greyscale holds the line where the Long Pine Whistle gang runs the timber trails.',
    factions: ['The Long Pine Whistle'],
    notes: 'Anchor town of the Pine Expanse. The Cold Caverns are a peer region below this country, not a dungeon.',
  },
  {
    col: 11, row: 8, name: 'The Bastion at Stonefall', region: 'The Bastion at Stonefall', terrain: 'Hills or Mountains',
    settlementType: 'Walled town — a Tombstone/Dodge in a basalt gorge.',
    settlementConflict: 'Sheriff Garrick Holm, a former Fort officer, has not smiled since; the Frostmelt Boys test his walls nightly.',
    factions: ['The Frostmelt Boys'],
    notes: 'Anchor town of the Bastion region.',
  },
  {
    col: 12, row: 4, name: 'Sodwater', region: 'The Meltlands', terrain: 'Swamp or Wetlands',
    settlementType: 'Mining camp — the anchor of the gold-rush bog country (California 1849 / Klondike 1898).',
    settlementConflict: '"Wandering" Cay Roeber rides a circuit for law; claim-jumping and the false thaw kill in equal measure.',
    factions: ['Hollander’s Crew'],
    notes: 'Anchor camp of the Meltlands.',
  },
  {
    col: 3, row: 3, name: 'Mons Albus', region: 'The White March', terrain: 'Tundra',
    settlementType: 'Mission station — the anchor of the northwestern foothills, snow nine months a year (mission-station country, the Jesuit reductions).',
    settlementConflict: 'Brother Halvard is sheriff and cleric both; the Mission Spreads, and the Vargoth paint marks that match no known band.',
    factions: ['The Church of the Northern Light', 'The Vargoth'],
    notes: 'Anchor station of the White March.',
  },
];

/** Build the canon hex records for a fresh atlas. */
export function seedCanon() {
  const out = {};
  CANON.forEach((c) => {
    const id = hexId(c.col, c.row);
    const h = emptyHex(id);
    Object.assign(h, {
      name: c.name, region: c.region, terrain: c.terrain,
      settlements: c.settlementType
        ? [{ name: c.name, type: c.settlementType, conflict: c.settlementConflict || '' }]
        : [],
      sites: [],
      factions: c.factions || [], notes: c.notes || '',
      canon: true, generatedAt: '',
    });
    applyTerrainIcon(h);
    out[id] = h;
  });
  return out;
}

/** A brand-new atlas seeded (or not) with Hinterlands canon. */
export function createStarterAtlas(withCanon = true) {
  const a = createAtlas();
  if (withCanon) a.hexes = seedCanon();
  return a;
}

// Re-exports so app.js has one import surface for model concerns.
export { REGIONS, rollTerrain, generateHex };
