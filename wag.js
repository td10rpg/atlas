// wag.js — the Worldwide Adventure Generator, tinted for the Hinterlands.
//
// A pure module: it rolls dice and returns results, no DOM, no storage. The WAG is
// the *Local (hex) scale* of Tiny d10's Scale Stack — read a hex's terrain, tint
// the generic tables with frontier flavor, and roll the loop (Weather → Feature →
// Sign → Encounter → Discovery → Site/Settlement). Tables follow the house style:
// lean 1d10 tables, plain result names, a full descriptive sentence per row, and
// rollable quantities (1d5+2 days of food, not "some food").
//
// The tint here is Glacia / The Fort in the Hinterlands — an arctic frontier of
// gold-rush camps, wilderfolk tribes, and the thing that dreams below. Reskin the
// tables and the loop goes anywhere.

// ---- dice -----------------------------------------------------------------

export function d(n) { return 1 + Math.floor(Math.random() * n); }
export const d10 = () => d(10);
export const d5 = () => d(5);

/** Pick the row of a [{ lo, hi, ... }] table that a 1d10 lands in. */
function rowFor(table, roll) {
  return table.find((r) => roll >= r.lo && roll <= r.hi) || table[table.length - 1];
}
/** Roll 1d10 against a banded table and return { roll, ...row }. */
export function rollTable(table) {
  const roll = d10();
  return { roll, ...rowFor(table, roll) };
}
/** Uniform pick from a flat list. */
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

// ---- terrain --------------------------------------------------------------
// The eight terrains of the WAG hex stat-block. `icon` is the auto-set glyph key
// (see icons.js). `regionsPrefer` biases the weighted terrain roll per region.

export const TERRAINS = [
  { key: 'Forest or Jungle',    icon: 'forest' },
  { key: 'Hills or Mountains',  icon: 'mountain' },
  { key: 'Plains',              icon: 'plains' },
  { key: 'Swamp or Wetlands',   icon: 'swamp' },
  { key: 'Ocean or Coast',      icon: 'coast' },
  { key: 'Tundra',              icon: 'tundra' },
  { key: 'Desert',              icon: 'desert' },
  { key: 'Urban',               icon: 'urban' },
];

export function iconForTerrain(terrainKey) {
  const t = TERRAINS.find((x) => x.key === terrainKey);
  return t ? t.icon : 'unknown';
}

// The five Hinterland regions, each an Old-West archetype, and the terrains that
// dominate them. `null` region = unassigned frontier (roll anything). Urban is
// deliberately excluded from every `prefer` list: towns are scarce and
// author-placed (canon seed or a deliberate settlement), never rolled at random
// (backlog 10). NOTE: this weighting is a placeholder for the canonical WAG
// terrain-generation table — see BACKLOG item 5.
const NON_URBAN = TERRAINS.map((t) => t.key).filter((k) => k !== 'Urban');
// Each region's `prefer` list IS its terrain palette: a WAG-discovered hex in the
// region only ever rolls one of these, so terrain always reads as consistent with the
// region (see rollTerrainForHex). The signature terrain is repeated so it dominates.
// Ocean is left out of every land region (the sea is seed-placed, never rolled).
export const REGIONS = [
  { name: 'Unassigned',              color: '#6b7280', prefer: NON_URBAN },
  { name: 'The River Settlements',   color: '#2f7d8f', prefer: ['Swamp or Wetlands', 'Swamp or Wetlands', 'Plains'] },
  { name: 'The Pine Expanse',        color: '#2f7d4f', prefer: ['Forest or Jungle', 'Forest or Jungle', 'Forest or Jungle', 'Hills or Mountains'] },
  { name: 'The Bastion at Stonefall', color: '#9a6b3f', prefer: ['Hills or Mountains', 'Hills or Mountains', 'Hills or Mountains', 'Plains'] },
  { name: 'The Meltlands',           color: '#8f7d2f', prefer: ['Swamp or Wetlands', 'Swamp or Wetlands', 'Tundra', 'Plains'] },
  { name: 'The White March',         color: '#5a6f9a', prefer: ['Tundra', 'Tundra', 'Tundra', 'Hills or Mountains', 'Forest or Jungle'] },
];

export function regionByName(name) {
  return REGIONS.find((r) => r.name === name) || REGIONS[0];
}

/** Weighted terrain roll for a region (or uniform for the unassigned frontier). */
export function rollTerrain(regionName) {
  return pick(regionByName(regionName).prefer);
}

// Neighbour-aware terrain roll (backlog 5): a hex's terrain is biased toward the
// terrains of its already-revealed neighbours, so ranges and coasts read as
// continuous country rather than confetti. The base weighting is the region's
// prefer list; each neighbour adds NEIGHBOUR_BIAS to its own terrain.
//
// NOTE: NEIGHBOUR_BIAS and this blend are a PLACEHOLDER. The canonical WAG
// terrain-generation table should replace these weights (see BACKLOG item 5); the
// numbers here are wiring, not invented canon. Once the editable-tables work
// (item 4) can hold a terrain table, point this at it.
const NEIGHBOUR_BIAS = 3;
const REGION_WEIGHT = 2; // each prefer entry counts this much, so the region dominates
export function rollTerrainForHex(regionName, neighbourTerrains = []) {
  const region = regionByName(regionName);
  const palette = new Set(region.prefer); // the only terrains this region may roll
  const weights = {};
  region.prefer.forEach((t) => { weights[t] = (weights[t] || 0) + REGION_WEIGHT; });
  // Neighbours nudge for continuity, but only ever reinforce terrain that already
  // belongs to the region — they can never introduce a foreign terrain (e.g. an
  // Ocean neighbour won't turn a Pine Expanse hex into sea). This keeps every
  // WAG-discovered hex consistent with its region.
  neighbourTerrains.filter(Boolean).forEach((t) => {
    if (t === 'Urban' || !palette.has(t)) return;
    weights[t] = (weights[t] || 0) + NEIGHBOUR_BIAS;
  });
  const entries = Object.entries(weights);
  if (!entries.length) return rollTerrain(regionName);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [t, w] of entries) { r -= w; if (r <= 0) return t; }
  return entries[entries.length - 1][0];
}

// ---- Table A: Weather -----------------------------------------------------
// Arctic frontier weather — Alaska/Yukon. The description carries the play effect.

export const WEATHER = [
  { lo: 1, hi: 1,  name: 'Clear and biting',   desc: 'A hard blue sky; the cold itself is the hazard. Exposed travel taxes the unprepared.' },
  { lo: 2, hi: 3,  name: 'Overcast',           desc: 'Flat grey light, no shadows. Distances lie and landmarks blur.' },
  { lo: 4, hi: 4,  name: 'River fog',          desc: 'A cold fog off the water; sight drops to a stone’s throw. Ambush and losing the trail both grow likely.' },
  { lo: 5, hi: 6,  name: 'Falling snow',       desc: 'Steady snow softens sound and buries sign. Tracks made now last only an hour.' },
  { lo: 7, hi: 7,  name: 'Cutting wind',       desc: 'A wind that finds every seam. Fires gutter; a careless watch loses fingers.' },
  { lo: 8, hi: 8,  name: 'Sleet and glaze',    desc: 'Freezing rain lacquers the world. Every slope becomes a Reflex Challenge.' },
  { lo: 9, hi: 9,  name: 'Whiteout',           desc: 'Wind-driven snow erases the land. Travel halts or the party scatters; hole up if you can.' },
  { lo: 10, hi: 10, name: 'False thaw',         desc: 'A warm, wrong wind rots the ice and wakes the bog. The ground you crossed this morning will not hold tonight.' },
];

// ---- Table B: Feature -----------------------------------------------------
// A feature *kind* (1d10), then a terrain-tinted sentence. "Read terrain, tint it."

export const FEATURE_KINDS = [
  { lo: 1, hi: 1,  name: 'Landmark' },
  { lo: 2, hi: 2,  name: 'Water' },
  { lo: 3, hi: 3,  name: 'Old work' },
  { lo: 4, hi: 4,  name: 'Hazard' },
  { lo: 5, hi: 5,  name: 'Resource' },
  { lo: 6, hi: 6,  name: 'Lair sign' },
  { lo: 7, hi: 7,  name: 'Crossing' },
  { lo: 8, hi: 8,  name: 'Vantage' },
  { lo: 9, hi: 9,  name: 'Marker' },
  { lo: 10, hi: 10, name: 'Anomaly' },
];

// Per-terrain flavor for each feature kind. Kept short; the prose lives here, the
// table above stays scannable.
const FEATURE_FLAVOR = {
  'Forest or Jungle': {
    Landmark: 'a lightning-split giant of a pine, seen for miles', Water: 'a black tarn ringed with deadfall',
    'Old work': 'a trapper’s line of rotted deadfalls', Hazard: 'a blowdown tangle no horse will cross',
    Resource: 'a stand of straight timber and good fur-sign', 'Lair sign': 'a den worn into a root-throw, and old bones',
    Crossing: 'a game trail worn to bare earth', Vantage: 'a fire-scar ridge open to the sky',
    Marker: 'blazes cut fresh into the bark', Anomaly: 'a stand where every tree leans the same wrong way',
  },
  'Hills or Mountains': {
    Landmark: 'a black-basalt tor that shows above the treeline', Water: 'a cold spring that never freezes',
    'Old work': 'a caved adit and a spoil-heap gone to moss', Hazard: 'a scree slope that shifts underfoot',
    Resource: 'quartz float in the talus — color, maybe', 'Lair sign': 'a cave mouth, and drag-marks going in',
    Crossing: 'a saddle pass, the only way over for a day’s ride', Vantage: 'a crag that owns the whole valley',
    Marker: 'a cairn, lately added to', Anomaly: 'a hollow that swallows sound',
  },
  'Plains': {
    Landmark: 'a lone erratic boulder on the flat', Water: 'a slough the color of old tea',
    'Old work': 'a ring of stones where a lodge once stood', Hazard: 'ground that hides a sink beneath the grass',
    Resource: 'good grazing and a herd’s wide trail', 'Lair sign': 'a burrow-town and a raptor’s plucking-post',
    Crossing: 'a worn track, the long road north', Vantage: 'a low rise that sees to the horizon',
    Marker: 'a surveyor’s stake, claim number burned in', Anomaly: 'a circle where nothing grows',
  },
  'Swamp or Wetlands': {
    Landmark: 'a drowned forest of grey snags', Water: 'a maze of black channels and quaking mat',
    'Old work': 'a rotted corduroy road sunk to the axles', Hazard: 'quaking bog that will not bear weight',
    Resource: 'a beaver-works and good pelt-country', 'Lair sign': 'a mound of dragged reeds, and a stink',
    Crossing: 'a beaver-dam bridge, one misstep from the drink', Vantage: 'a hummock that rides above the mire',
    Marker: 'withies bent into a wilderfolk sign', Anomaly: 'water that lies still against the current',
  },
  'Ocean or Coast': {
    Landmark: 'a sea-stack white with birds', Water: 'a tide-race between two heads of rock',
    'Old work': 'a wrecked barge broken on the shingle', Hazard: 'a cliff of rotten shale above the surf',
    Resource: 'a beach of driftwood and a run of fish', 'Lair sign': 'a sea-cave and a slick of blood on the rocks',
    Crossing: 'a tidal bar passable only at the ebb', Vantage: 'a headland that watches the whole shore',
    Marker: 'a stone beacon, its wood laid ready', Anomaly: 'a cove the tide never seems to reach',
  },
  'Tundra': {
    Landmark: 'a frost-heaved pingo like a buried hill', Water: 'a thaw-pond skinned with new ice',
    'Old work': 'a fallen mission cross, half in the snow', Hazard: 'a field of frost-boils and hidden ice',
    Resource: 'a caribou trace and clean windswept moss', 'Lair sign': 'a snow-den with a breathing-hole',
    Crossing: 'a wind-scoured ridge, the only bare footing', Vantage: 'a rise that shows the aurora early',
    Marker: 'an inukshuk of piled stone, pointing on', Anomaly: 'a patch of green warmth in the white',
  },
  'Desert': {
    Landmark: 'a wind-carved arch of pale stone', Water: 'a bitter seep, barely drinkable',
    'Old work': 'a dry sluice and tailings gone to dust', Hazard: 'a pan of crust over sucking mud',
    Resource: 'a vein of color bared by the wind', 'Lair sign': 'a burrow under a shelf of rock',
    Crossing: 'a wash that is the only shade for miles', Vantage: 'a butte that owns the barrens',
    Marker: 'a heap of bleached bones set as a sign', Anomaly: 'a stretch the wind refuses to cross',
  },
  'Urban': {
    Landmark: 'a black gate and a bell against the cold', Water: 'a cistern, and a queue for it',
    'Old work': 'a burned quarter no one has rebuilt', Hazard: 'a lane where the wrong crew collects a toll',
    Resource: 'a market, a forge, a mission poor-box', 'Lair sign': 'a cellar door that is watched too closely',
    Crossing: 'the one bridge, and the men who hold it', Vantage: 'a watchtower over the whole works',
    Marker: 'a notice-board thick with bounties', Anomaly: 'a house every dog gives a wide berth',
  },
};

export function rollFeature(terrainKey) {
  const kind = rollTable(FEATURE_KINDS);
  const bank = FEATURE_FLAVOR[terrainKey] || FEATURE_FLAVOR['Plains'];
  return { roll: kind.roll, name: kind.name, desc: bank[kind.name] || '' };
}

// ---- Table C: Sign or Omen ------------------------------------------------

export const SIGN = [
  { lo: 1, hi: 1,  name: 'Fresh tracks',      desc: 'Sign in the new snow, not an hour old, and more of them than there should be.' },
  { lo: 2, hi: 2,  name: 'Carrion birds',     desc: 'Ravens turning low over the next fold of ground. Something died, or is dying.' },
  { lo: 3, hi: 3,  name: 'Distant smoke',     desc: 'A thread of smoke where the map shows nothing — a camp, a signal, or a burning.' },
  { lo: 4, hi: 4,  name: 'A horn at dusk',     desc: 'A long note carries on the cold air. It is answered, once, from another quarter.' },
  { lo: 5, hi: 5,  name: 'Blood on snow',      desc: 'A dragging trail of red leads off the path and does not come back.' },
  { lo: 6, hi: 6,  name: 'Left offerings',     desc: 'A shrine or a stone with fresh gifts — someone came through recently, and was afraid.' },
  { lo: 7, hi: 7,  name: 'A painted mark',     desc: 'A Vargoth glyph in ochre, matching no known band. It is coordinating with something.' },
  { lo: 8, hi: 8,  name: 'The game gone',      desc: 'No birds, no tracks, no sound. The country has emptied itself ahead of you.' },
  { lo: 9, hi: 9,  name: 'The aurora wrong',   desc: 'The lights move against the wind and hold a shape too long. Old folk look away.' },
  { lo: 10, hi: 10, name: 'A child’s boot', desc: 'One small boot, alone in the waste, laces still tied. There is no other sign at all.' },
];

// ---- Table D: Encounter check ---------------------------------------------

export const ENCOUNTER_CHECK = [
  { lo: 1, hi: 5,  name: 'None',        detail: 'Only the sign; the country keeps its distance for now.', encounter: false, count: 0, disadvantage: false },
  { lo: 6, hi: 8,  name: 'Encounter',   detail: 'Something crosses the party’s path (roll Table E).', encounter: true, count: 1, disadvantage: false },
  { lo: 9, hi: 9,  name: 'Ambush',      detail: 'An encounter that has the party at a disadvantage — surprise, ground, or numbers.', encounter: true, count: 1, disadvantage: true },
  { lo: 10, hi: 10, name: 'Two things',  detail: 'Two encounters at once, or one that draws a second (roll Table E twice).', encounter: true, count: 2, disadvantage: false },
];

// ---- Table E: Encounter (per terrain) -------------------------------------
// Draws on the Hinterlands cast: wilderfolk (Karvi/Drevin/Vargoth), the Fort,
// gangs, prospectors, predators, and what climbs up out of the Cold Caverns.

const ENC_COMMON = [
  'a Fort Caspar patrol, cold and short-tempered',
  'Drevin hunters, watchful, not yet decided about you',
  'Karvi trappers running a trapline, willing to trade',
  'a lone peddler with a sledge and too much to say',
  'prospectors, half-starved and jealous of their claim',
  'gang toughs (the Frostmelt Boys) collecting a "toll"',
];
const ENC_TERRAIN = {
  'Forest or Jungle': ['a dire wolf pack shadowing the party', 'a wolverine on a kill, and it will not yield', 'a Vargoth scouting-party painting trees'],
  'Hills or Mountains': ['a white bear come down to hunt', 'a rockslide, and something that started it', 'a thing from the Cold Caverns, testing the light'],
  'Plains': ['a herd stampeding ahead of an unseen driver', 'raptors mantling a fresh kill', 'a Vargoth outrider on a stolen horse'],
  'Swamp or Wetlands': ['a hunting cat in the reeds', 'leeches, fever, and a body in the water', 'smugglers of the Black Sluice moving cargo'],
  'Ocean or Coast': ['a wrecked crew, desperate and armed', 'something in the surf that shouldn’t swim', 'a revenue-boat pretending to be friendly'],
  'Tundra': ['a starving pack driven ahead of the cold', 'pilgrims to Mons Albus, lost and freezing', 'a Dreamer-touched sleeper walking in the waste'],
  'Desert': ['a rattling nest of stone-adders', 'a claim-jumper crew watching the wash', 'a mirage-thing that is not a mirage'],
  'Urban': ['Hollander’s Crew running a shakedown', 'a Fort press-gang looking for bodies', 'a preacher and the mob he has half-turned'],
};

export function rollEncounter(terrainKey) {
  const check = rollTable(ENCOUNTER_CHECK);
  if (!check.encounter) return { check, parties: [] };
  const bank = (ENC_TERRAIN[terrainKey] || []).concat(ENC_COMMON);
  const parties = [];
  for (let i = 0; i < check.count; i++) parties.push(pick(bank));
  return { check, parties };
}

// ---- Table F: Discovery ---------------------------------------------------

export const DISCOVERY = [
  { lo: 1, hi: 1,  name: 'A cache',           desc: 'A cold-cellar or hollow tree holding supplies — food for 1d5+2 days, and someone’s intent to return.' },
  { lo: 2, hi: 2,  name: 'A body and a story', desc: 'A dead traveler, and enough on them to say how they died and who might care.' },
  { lo: 3, hi: 3,  name: 'A map fragment',     desc: 'A torn chart marking a place off the known trails, with one word underlined.' },
  { lo: 4, hi: 4,  name: 'A survivor',         desc: 'Someone alive who should not be — half-frozen, half-mad, and carrying news.' },
  { lo: 5, hi: 5,  name: 'A claim marker',     desc: 'A staked claim, freshly worked, its owner nowhere in sight.' },
  { lo: 6, hi: 6,  name: 'A relic',            desc: 'A church-thing lost in the wild; the reliquary at the Fort would pay to have it back.' },
  { lo: 7, hi: 7,  name: 'Gold color',         desc: 'Dust in the gravel — 1d10×10 gp of it, and the question of who else knows.' },
  { lo: 8, hi: 8,  name: 'A Vargoth work',     desc: 'A painted shrine to the thing below, lately used, the paint not yet dry.' },
  { lo: 9, hi: 9,  name: 'A sleeper',          desc: 'One who heard the Dreamer’s Call and lay down in the snow, breathing still.' },
  { lo: 10, hi: 10, name: 'Nothing but cold',   desc: 'Whatever was here is gone, and took the warmth with it. The party has lost the day.' },
];

// ---- Table G: Settlement type / H: Conflict -------------------------------

export const SETTLEMENT_TYPE = [
  { lo: 1, hi: 1,  name: 'Barge landing',    desc: 'A river stop of pilings and tar — a store, a saloon, and rough men off the water.' },
  { lo: 2, hi: 3,  name: 'Trapper camp',     desc: 'A cluster of cabins and drying-racks; furs are law and coin here.' },
  { lo: 4, hi: 5,  name: 'Mining claim',     desc: 'A sluice, a tent town, and the fever of easy gold that is never easy.' },
  { lo: 6, hi: 6,  name: 'Mission station',  desc: 'A cross, a bell, and a handful of the faithful holding a line against the dark.' },
  { lo: 7, hi: 7,  name: 'Roadhouse',        desc: 'A waystation on the long trail — beds, oats, and every rumor for a hundred miles.' },
  { lo: 8, hi: 8,  name: 'Fort outpost',     desc: 'A palisade and a few soldiers of Fort Caspar, under-supplied and watchful.' },
  { lo: 9, hi: 9,  name: 'Wilderfolk village', desc: 'A Drevin or Karvi settlement, guarded, that decides daily whether you are welcome.' },
  { lo: 10, hi: 10, name: 'Ghost camp',       desc: 'A settlement gone silent — doors open, fires cold, and no bodies to explain it.' },
];

export const SETTLEMENT_CONFLICT = [
  { lo: 1, hi: 1,  name: 'Claim dispute',    desc: 'Two parties swear the same ground is theirs, and both have hired guns.' },
  { lo: 2, hi: 2,  name: 'Missing persons',  desc: 'People vanish in the night. The elders blame wolves; the elders are lying.' },
  { lo: 3, hi: 3,  name: 'Cut off',          desc: 'Weather or a downed bridge has sealed the place in. Stores are running short.' },
  { lo: 4, hi: 4,  name: 'A lynch mood',     desc: 'A stranger is blamed for the town’s troubles, and a rope is being readied.' },
  { lo: 5, hi: 5,  name: 'Sickness',         desc: 'A fever moves house to house. The healer is overworked, or afraid.' },
  { lo: 6, hi: 6,  name: 'Preacher and gang', desc: 'A hard preacher and a harder crew both mean to own the settlement’s soul.' },
  { lo: 7, hi: 7,  name: 'Tribute demanded', desc: 'The Vargoth have named a price in goods or blood, due by the next dark.' },
  { lo: 8, hi: 8,  name: 'A strike',         desc: 'Someone hit color, and half the town means to jump the claim before dawn.' },
  { lo: 9, hi: 9,  name: 'A stranger stays', desc: 'A newcomer who will not leave, and around whom the small accidents gather.' },
  { lo: 10, hi: 10, name: 'A gathering',      desc: 'A wedding, a funeral, a hanging — everyone is in one place, and so is the trouble.' },
];

// ---- Table I: Site / J: Condition / K: Opposition / L: Treasure -----------

export const SITE_TYPE = [
  { lo: 1, hi: 1,  name: 'Old redoubt',      desc: 'A ruined fort or blockhouse from an earlier, failed push into the country.' },
  { lo: 2, hi: 2,  name: 'Mine or adit',     desc: 'A worked hole in the earth, timbered and dark, that someone stopped digging.' },
  { lo: 3, hi: 3,  name: 'Cavern mouth',     desc: 'An opening into the Cold Caverns — the dark below is a region, not a room.' },
  { lo: 4, hi: 4,  name: 'Shrine',           desc: 'A holy place, or an unholy one; the cold keeps its offerings fresh.' },
  { lo: 5, hi: 5,  name: 'Barrow field',     desc: 'Graves under the snow, older than the Fort, and not all of them quiet.' },
  { lo: 6, hi: 6,  name: 'Wreck',            desc: 'A riverboat or sledge-train broken and abandoned, cargo maybe still aboard.' },
  { lo: 7, hi: 7,  name: 'Watchtower',       desc: 'A lone tower that once watched this ground, now held by whatever wants the view.' },
  { lo: 8, hi: 8,  name: 'Trapper’s cabin', desc: 'A single cabin far from any help, its last tenant’s story still on the walls.' },
  { lo: 9, hi: 9,  name: 'Standing stones',  desc: 'A ring of raised stones the wilderfolk will not name and will not approach.' },
  { lo: 10, hi: 10, name: 'A sinkhole',       desc: 'A throat in the ground going straight down into the black and the cold.' },
];

export const SITE_CONDITION = [
  { lo: 1, hi: 2,  name: 'Occupied',      desc: 'Intact and held — there is someone, or something, home.' },
  { lo: 3, hi: 3,  name: 'Empty',         desc: 'Intact but abandoned; it waits, and it is not as empty as it looks.' },
  { lo: 4, hi: 4,  name: 'Still warm',    desc: 'Just left — embers, breath-frost, the sense of having missed them by an hour.' },
  { lo: 5, hi: 6,  name: 'Ruined',        desc: 'Fallen in and open to the sky; what it held is scattered or buried.' },
  { lo: 7, hi: 7,  name: 'Snowed under',  desc: 'Half-collapsed and choked with drift — digging in is the first challenge.' },
  { lo: 8, hi: 8,  name: 'Flooded',       desc: 'Ice-water fills the lower works; footing and cold both threaten.' },
  { lo: 9, hi: 9,  name: 'Defiled',       desc: 'Marked by dark magic — a permanent -2 Aspect pall hangs over the place.' },
  { lo: 10, hi: 10, name: 'Sealed',        desc: 'Deliberately shut, from the inside or the out, and for a reason.' },
];

export const OPPOSITION = [
  { lo: 1, hi: 1,  name: 'Only the place',  desc: 'No guard but the cold, the dark, and the ways it can kill you.' },
  { lo: 2, hi: 2,  name: 'A predator',      desc: 'A single hungry beast has made the site its own.' },
  { lo: 3, hi: 3,  name: 'Vargoth hold it', desc: 'A hostile wilderfolk party keeps the place, in service to the thing below.' },
  { lo: 4, hi: 4,  name: 'A gang crew',     desc: 'Outlaws — the Red Ledger, the Black Sluice — using it as a den.' },
  { lo: 5, hi: 5,  name: 'The Dreamer’s own', desc: 'Sleepers and worse, drawn here by the Call and no longer wholly people.' },
  { lo: 6, hi: 6,  name: 'A rival party',   desc: 'Another expedition wants exactly what the party wants, and got here first.' },
  { lo: 7, hi: 7,  name: 'Traps',           desc: 'The approach is laid with deadfalls and worse; the place defends itself.' },
  { lo: 8, hi: 8,  name: 'Wilderfolk claim', desc: 'The Drevin or Karvi hold it sacred and will bargain, or not.' },
  { lo: 9, hi: 9,  name: 'A thing from below', desc: 'Something climbed up out of the Cold Caverns and stayed.' },
  { lo: 10, hi: 10, name: 'One who needs help', desc: 'A captive or castaway begging aid — and it is even money whether that is true.' },
];

export const TREASURE = [
  { lo: 1, hi: 2,  name: 'Nothing of worth', desc: 'Picked clean already, or never worth the trip. The cold was the only reward.' },
  { lo: 3, hi: 3,  name: 'Supplies',         desc: 'Stores and food — enough for 1d5+2 days and a warmer night.' },
  { lo: 4, hi: 4,  name: 'Furs and goods',   desc: 'Trade-worth in pelts and gear; heavy to carry, easy to sell.' },
  { lo: 5, hi: 5,  name: 'Gold dust',        desc: 'Color in a poke — 1d10×10 gp of dust, and the trouble that follows it.' },
  { lo: 6, hi: 6,  name: 'A coin cache',     desc: 'Buried silver, 1d10×5 sp, and a reason it was hidden.' },
  { lo: 7, hi: 7,  name: 'A useful map',     desc: 'A chart to somewhere the party has not been and now cannot resist.' },
  { lo: 8, hi: 8,  name: 'A relic',          desc: 'A holy object the Fort’s reliquary would reward — or that should never have been moved.' },
  { lo: 9, hi: 9,  name: 'Quality gear',     desc: 'A weapon or tool of real make (+1 where it counts), better than anything in camp.' },
  { lo: 10, hi: 10, name: 'A cursed artifact', desc: 'Black-ice, Dreamer-touched — worth a fortune and a slow doom to the one who keeps it.' },
];

// ---- the loop -------------------------------------------------------------
// Roll a whole hex. Terrain is passed in (painted or pre-rolled) so the icon can
// be auto-set upstream; everything else follows the WAG play loop. Sites and
// settlements are only rolled when asked for (they're the discovered layer).

// ---- editable tables (backlog 4) ------------------------------------------
// The banded {name, desc} tables can be overridden per-atlas. The app registers
// overrides via setTableOverrides; rolls read the effective table (override or
// default) and weight rows by band width (default rows keep their 1d10 odds; a
// user-added row, having no band, weighs 1 and is reachable).

export const EDITABLE_TABLES = [
  { key: 'weather', label: 'Weather · Table A' },
  { key: 'sign', label: 'Sign or Omen · Table C' },
  { key: 'discovery', label: 'Discovery · Table F' },
  { key: 'settlementType', label: 'Settlement Type · Table G' },
  { key: 'settlementConflict', label: 'Settlement Conflict · Table H' },
  { key: 'siteType', label: 'Site Type · Table I' },
  { key: 'siteCondition', label: 'Site Condition · Table J' },
  { key: 'opposition', label: 'Opposition · Table K' },
  { key: 'treasure', label: 'Treasure · Table L' },
];
const DEFAULT_TABLES = {
  weather: WEATHER, sign: SIGN, discovery: DISCOVERY,
  settlementType: SETTLEMENT_TYPE, settlementConflict: SETTLEMENT_CONFLICT,
  siteType: SITE_TYPE, siteCondition: SITE_CONDITION, opposition: OPPOSITION, treasure: TREASURE,
};
/** The default rows of a table as plain {name, desc} (for the editor). */
export function defaultTable(key) {
  return (DEFAULT_TABLES[key] || []).map((r) => ({ name: r.name, desc: r.desc }));
}
let OVERRIDES = {};
/** Register per-atlas table overrides: { tableKey: [{name, desc}, …] }. */
export function setTableOverrides(o) { OVERRIDES = (o && typeof o === 'object') ? o : {}; }
function effTable(key) {
  const o = OVERRIDES[key];
  return (Array.isArray(o) && o.length) ? o : (DEFAULT_TABLES[key] || []);
}
function weightedRow(rows) {
  if (!rows.length) return { name: '', desc: '' };
  const w = rows.map((r) => (Number.isFinite(r.lo) && Number.isFinite(r.hi)) ? (r.hi - r.lo + 1) : 1);
  const total = w.reduce((s, x) => s + x, 0) || 1;
  let r = Math.random() * total;
  for (let i = 0; i < rows.length; i++) { r -= w[i]; if (r <= 0) return rows[i]; }
  return rows[rows.length - 1];
}
/** Roll a banded table by key (honouring overrides) and return "Name — desc". */
function rollLine(key) {
  const row = weightedRow(effTable(key));
  return row.desc ? `${row.name} — ${row.desc}` : row.name;
}

export function generateHex(terrainKey) {
  const feature = rollFeature(terrainKey);
  const enc = rollEncounter(terrainKey);

  return {
    terrain: terrainKey,
    weather: rollLine('weather'),
    feature: feature.name,
    featureDesc: feature.desc,
    sign: rollLine('sign'),
    encounter: encounterText(enc),
    discovery: rollLine('discovery'),
    generatedAt: new Date().toISOString(),
  };
}

function encounterText(enc) {
  if (!enc.parties.length) return `${enc.check.name} — ${enc.check.detail}`;
  const who = enc.parties.join('; and ');
  const tag = enc.check.disadvantage ? ' (the party at a disadvantage)' : '';
  return `${enc.check.name}${tag} — ${who}.`;
}

// A place is { name, ...rolled fields }. The name is the author's; rollSiteFields /
// rollSettlementFields roll only the mechanical lines (so a re-roll keeps the name).
export function rollSiteFields() {
  return {
    type: rollLine('siteType'),
    condition: rollLine('siteCondition'),
    opposition: rollLine('opposition'),
    treasure: rollLine('treasure'),
  };
}
export function rollSettlementFields() {
  return {
    type: rollLine('settlementType'),
    conflict: rollLine('settlementConflict'),
  };
}
/** A freshly rolled site / settlement, name left blank for the GM to fill. */
export function rollSite() { return Object.assign({ name: '' }, rollSiteFields()); }
export function rollSettlement() { return Object.assign({ name: '' }, rollSettlementFields()); }

// Re-roll one WAG survey line — powers the per-line dice in the inspector.
export function rerollField(key, terrainKey) {
  switch (key) {
    case 'weather':      return rollLine('weather');
    case 'sign':         return rollLine('sign');
    case 'discovery':    return rollLine('discovery');
    case 'feature':      { const r = rollFeature(terrainKey); return { feature: r.name, featureDesc: r.desc }; }
    case 'encounter':    return encounterText(rollEncounter(terrainKey));
    default:             return '';
  }
}
