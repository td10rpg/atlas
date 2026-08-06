# td10 Atlas — backlog

## Status

- [x] **1. Match td10.pw** — EB Garamond, the Tiny d10 palette (slate `#284b63` /
  sage `#84a59d`), teal water, terrain hues from the WAG terrain key. *(First
  pass; revisit with the site's exact theming + item 14's toggle.)*
- [x] **2. Lock canon hexes** — canon hexes accept only WAG rolls + notes;
  name/region/terrain/icon/places fixed; paint & erase refuse them.
- [x] **10. Weight against Urban** — Urban never comes up on a random terrain
  roll; author-placed only. *(Defers to the canonical WAG table — item 5.)*
- [x] **11. Stamp toggle** — clicking a stamp that's already there removes it;
  dragging only adds.
- [x] **13. Active-hex outline** — single inset overlay polygon, non-scaling
  stroke; no more doubling on the shared edge.
- [x] **14. Dark / light toggle** — Auto / Light / Dark control in the top bar,
  persisted, driven by `data-theme` on the root (overrides the OS both ways).
- [x] **16. Markers** — a party marker on its own overlay layer; the marker tool
  places / moves / picks it up (any hex, canon included); stored in `atlas.json`.
- [x] **17. Hex scale** — miles-per-hex control in the HUD with derived area
  (`~0.866·w²` sq mi); persisted in the config.
- [x] **9. Fillable Site/Settlement** — each place has an editable name + editable
  rolled lines; add rolled or blank; re-roll keeps the name; canon = read-only.
- [x] **12. Multiple places per hex** — sites/settlements are arrays; stamp adds,
  inspector removes; map badge shows ×N. File format now stores them as JSON in
  the frontmatter + `### name` body subsections, with legacy flat files migrated.
- [x] **3. The Hinterlands as native hexes** — the starter atlas IS the Fort world
  map converted to hexes (`scripts/gen-seed.mjs` → `hinterlands-seed.js`): teal
  sea → Ocean-or-Coast hexes, the continent partitioned into the five regions by
  nearest anchor, the six canon towns placed and locked. **Not a background
  layer.** Regions are a Voronoi approximation — refine by hand. (26×16.)
- [x] **7. Icon polish** — refined the weaker glyphs (twin-peak mountains with snow
  caps, a cleaner tundra flake); set kept coherent. *(More can follow.)*
- [x] **8. Naturalistic hexes** — open sea is a continuous teal expanse (no wave
  glyph per hex); land terrain and region get a stable per-hex value jitter;
  unsurveyed land is softly tinted by its region so the five regions read as
  zones. *(Textured fills / feathered coastlines still possible later.)*
- [ ] **R. River tool** — *shelved.* Tried several designs — hex-centre paths
  (lattice-snap → adjacent-hex winding → Chaikin-smoothed), then freehand
  drag-to-draw rendered as a tapered ribbon (bold, then restyled to a low-opacity
  sea-coloured channel with a thin bank line). None sat right on the hex map: a
  smooth free-curve reads as a different visual language than the quantized hexes,
  and a hex-centre worm reads mechanical. Removed entirely for now to keep the map
  clean. If revisited, the promising direction is **hex-edge routing** — rivers that
  follow the shared edges between hexes (the classic Worldographer/Hexographer look),
  drawn thin in the map's own line weight/palette so they belong to the grid by
  construction. Drawing input could stay freehand and snap the stroke onto the edge
  network.
- [x] **18. Undo / redo** — Ctrl/Cmd-Z and Shift-Z (plus HUD ↶ ↷), covering
  paint, stamps, generate, edits, erase, markers, and grid/scale. Bounded
  debounced full-atlas snapshots (a drag or a burst of typing = one step); undo
  re-persists only the hex files that changed.
- [x] **4. Editable WAG tables** — each result card's table label is clickable and
  opens a per-atlas editor: edit rows, add your own, reset to default. New rows are
  reachable (weight 1) while defaults keep their 1d10 odds. Stored in `atlas.json`
  (`customTables`), undo-aware. *(Weather/Sign/Discovery + Site/Settlement tables;
  Feature/Encounter tie to terrain flavor and are not yet editable.)*
- [x] **5. Neighbour-aware terrain** — Generate / Roll-terrain now bias a hex's
  terrain toward its revealed neighbours (continuity, ~39% adjacency vs ~14%
  random). **The blend weight is a PLACEHOLDER** — drop in the canonical WAG
  terrain table (via item 4) to replace it; nothing invented is presented as canon.
- [x] **6. Import a map → native hexes** — "Map image" imports any picture,
  samples each hex, and assigns the nearest terrain (WAG terrain-key palette);
  content stays blank, refine with the brush. General version of the Hinterlands
  bake.
- [x] **15. Random terrain map** — "Random map" fills the grid with coherent
  terrain (grown via the neighbour-aware roll), content blank, respecting the
  current grid size; content is still yours to survey.

**All backlog items to date are done.** Open follow-ups noted inline: the
canonical WAG terrain table (item 5) and content reconcile, the extra icon/hex
polish (7/8), and the shelved river tool (R — dropped for now; hex-edge routing
is the direction if revisited).

Assets pulled from `td10rpg/td10` for the remaining items live in `assets/`
(`the-fort-world-map.png`, `wag-terrain-key.png`). The canonical WAG tool is at
`td10 → quartz/static/tools/wag.html` (tables + bestiary) for items 4/5 and the
content reconcile.

---

## Naming (decided)

The **tool** is **td10 Atlas** — a setting-agnostic, WAG-driven hex atlas for
Tiny d10. **The Hinterlands** is the first *setting/atlas* built in it, not the
tool's name. This reframes the backlog features (custom tables, bring-your-own
map) as general capabilities, with the Hinterlands as the flagship content.

## Content: reconcile the tables with the canonical WAG

> **Status (2026-08-05):** Tables A–L in `wag.js` have been **swapped to the
> canonical WAG content** (ported from `td10 → quartz/static/tools/wag.html`).
> The previous authored Hinterlands flavor is **archived verbatim at the bottom
> of this file** ("Archived: authored Hinterlands table flavor") — nothing was
> lost. The hand-curation below is now: walk the archived rows and reintegrate
> the keepers as per-atlas custom rows (item 4) on top of the canonical tables.
> Still unported: the encounter **resolve types** (bestiary / faction / dungeon
> sub-generators) and the extra canonical tables (Tension, Hidden motive, NPC,
> Faction, Traps, Dungeon size) — those are separate subsystems, not A–L.

The original intent, retained for reference:

All WAG tables currently in `wag.js` (Weather, Feature, Sign, Encounter,
Discovery, Site/Settlement, terrain, etc.) were written in-voice as a working
stand-in. Bring in the **canonical WAG document** as the base — but this is a
**merge, not a wipe**:

- **Don't dump the authored entries wholesale.** Some are good and specifically
  Hinterlands-flavored and should be preserved.
- **The author curates by hand.** Aaron will walk through and choose which
  authored results to keep, adapt, or drop — don't auto-delete them; present them
  alongside the canonical rows so they can be picked over.
- Where the canonical WAG has a table (e.g. the terrain-generation table, item
  5), that governs the *procedure/weights*; the authored flavor can still supply
  Hinterlands-specific result rows that live on top of it (see item 4 — custom
  rows on canonical tables).

A rename pass (later — likely folded into the td10.pw look-and-feel work) should
update: the product title in `index.html` / top bar (`app.js`), the landing
copy, `README.md`, the `createdWith` string and default atlas name in `map.js`,
and the folder/IndexedDB identifiers in `storage.js`. Keep "Hinterlands" only
where it refers to the setting/canon seed, not the app.

## 1. Match the look & feel of td10.pw

The tool currently uses its own frontier-ledger palette (`styles.css`). When
merging into `td10rpg/td10`, adopt td10.pw's visual language instead of this
standalone theme.

- Pull td10.pw's design tokens: typeface(s), color palette, heading style,
  spacing, button/treatment conventions. (Design font for the books is
  Garamond — confirm what the *site* uses.)
- Refactor `styles.css` to reference shared td10 CSS/variables rather than the
  self-contained `:root` tokens here, so the atlas reads as part of the site.
- Keep the map-specific styles (hex fills, glyphs, inspector) but reskin chrome
  (top bar, tool rail, buttons, inspector) to the site system.
- Revisit the light/dark handling so it follows however td10.pw does theming.

## 2. Canon (seeded) hexes should be locked

The pre-populated ~5% (Fort Caspar and the five region anchors — and, going
forward, any canon hex with defining terrain features like the mountains, plus
their settlements) should be **immutable except for notes and WAG generation**.

Today `canon: true` is only a flag + a badge; nothing is actually protected.

Intended behavior:
- **Editable on a canon hex:** GM Notes, and rolling/re-rolling the WAG tables
  (weather, feature, sign, encounter, discovery — the transient survey layer).
- **Locked on a canon hex:** name, region, terrain (and its auto-icon),
  icon override, and the *defining* site/settlement blocks that make the hex
  canonical (e.g. Fort Caspar's stronghold, a named mountain feature).
- The paint tools (terrain / region / erase) and the "Clear hex" action must
  refuse to modify a canon hex.

Implementation pointers:
- `map.js` seeds canon with `canon: true`; decide which fields are the
  "defining" set to freeze vs. which WAG lines stay rollable.
- In `app.js`: gate `paintHex`, `eraseHex`, and the inspector's structural
  controls (name input, region/terrain selects, icon picker, add/remove
  site/settlement, Clear) on `!hex.canon`; render those controls disabled/hidden
  when canon, while leaving Generate/re-roll and the notes editor active.
- Consider a small "🔒 canon" affordance in the inspector explaining what's
  locked, and possibly an author-only override for editing canon during setup.

## 3. Align the grid to the real Hinterlands map

The default grid is a plausible placeholder. It must be aligned to the canonical
Hinterlands / Fort-world map:
`td10rpg/td10 → content/files/images/the-fort-world-map.png`

Intended work:
- Bring in the real map image as a **reference/background layer** under the hex
  grid (toggleable, adjustable opacity), so hexes overlay the actual geography.
- Calibrate grid origin, hex size, and orientation so the atlas hexes line up
  with the map's features and any existing hex numbering on it.
- Derive the canon seed from the real map: set each anchor's true hex
  coordinates, terrain, and region from the image instead of the current
  placeholder placements in `map.js` (`seedCanon`), and size the default grid
  (`DEFAULT_COLS`/`DEFAULT_ROWS`) to the map's extent.
- Decide how the background travels with the atlas: bundle the image with the
  app (it lives in the td10 repo) vs. store a reference in `atlas.json`.
- Watch the File System Access storage: a background image is a binary asset, so
  either ship it with the app or write it into the atlas folder alongside
  `atlas.json` rather than into a per-hex `.md`.

## 4. User-editable WAG tables (bring your own content)

Let GMs extend the generator with their own results — the whole point of a WAG
is "make it your own."

- In the inspector's result cards, make the **table reference hyperlinkable**
  (each line already carries a tag like `Weather · Table A`). Clicking a table
  name opens that table.
- The table editor lists the rows and lets the user **add rows** (and ideally
  edit/disable/reorder existing ones), following the house table style: a plain
  result name plus a full descriptive sentence.
- New/edited rows feed straight back into rolling and re-rolling for that table.
- Persist custom tables **per atlas** (write them into `atlas.json`, so they
  travel with the folder) rather than globally; consider a "reset to default"
  per table.

Implementation pointers:
- Tables live as banded arrays in `wag.js` (`WEATHER`, `SIGN`, `DISCOVERY`,
  `FEATURE_KINDS`, `SETTLEMENT_*`, `SITE_*`, `OPPOSITION`, `TREASURE`, the
  per-terrain `ENC_*` banks, etc.). Decide how to merge user rows with the
  defaults and how added rows change the 1d10 bands (e.g. shift to 1dN, or a
  weighted pick, so an 11th row is reachable).
- The re-roll plumbing is `rerollField` / `rollTable` in `wag.js` and the die
  buttons in `app.js`; the generator would need to read the atlas's custom
  tables instead of only the module constants.

## 5. Terrain generation follows the WAG terrain table (neighbor-aware)

Terrain should be generated the WAG way, for geographical consistency: when a
newly revealed hex is adjacent to already-revealed hexes, its terrain roll is
biased by those neighbors rather than rolled purely at random.

> **Use the canonical table.** This terrain-generation table **already exists in
> the WAG document** — use that one verbatim. Do **not** invent an
> affinity/transition table; the current `wag.js` terrain handling is a
> placeholder to be replaced with the real WAG table and its exact procedure.

- Use a terrain-generation / transition table: a hex next to Mountains skews
  toward Hills or Mountains, next to Coast toward Ocean or Coast, next to
  Wetlands toward Wetlands/Plains, etc. — so ranges read as continuous country,
  not confetti.
- Applies whenever terrain is auto-set (the "Generate (WAG)" and "Roll terrain"
  paths, and ideally the terrain brush when it fills empties). A hex with no
  revealed neighbors falls back to the current region-weighted roll.
- Keep it a bias, not a lock: still allow the occasional transition (a pass, a
  shoreline, a river cutting through) so borders aren't sterile.

Implementation pointers:
- `wag.js › rollTerrain(regionName)` is currently region-weighted only. Extend it
  (or add `rollTerrainForHex`) to also take the neighbors' terrains and blend the
  region weighting with a per-neighbor terrain-affinity table.
- `hex.js › neighbors(col, row)` already returns the six adjacent coords for the
  odd-q layout; `app.js` can gather each neighbor's revealed terrain from
  `atlas.hexes` and pass the list in.
- Ties into item 4: the terrain-affinity/transition table is another table a GM
  might want to edit.
- Ties into item 3: once aligned to the real map, seeded terrain gives the
  generator honest neighbors to grow from.

## 19. Make regions a first-class Atlas concept (generalize)

Regions are currently **hardcoded for the Hinterlands** in `wag.js › REGIONS`:
each entry bundles a name, a colour, and a terrain palette (its `prefer` list).
Two behaviors ride on that and are, for now, intentionally Hinterlands-specific:

- **Region owns the hex fill.** On land, a hex is tinted by its region colour
  whether or not it's been surveyed (surveyed hexes just a touch stronger), so the
  regions always read as zones; terrain is carried by the glyph, not the fill
  (`app.js › buildHex`). Region-less land (imported / random / Unassigned) still
  falls back to its terrain colour.
- **WAG terrain is region-consistent.** A discovered hex only ever rolls a terrain
  from its region's palette; neighbours bias for continuity but can never introduce
  a foreign terrain (`wag.js › rollTerrainForHex`, `REGION_WEIGHT` / `NEIGHBOUR_BIAS`).

Generalize this into the main Atlas so any atlas — not just the Hinterlands — can
define its own regions:

- Move regions out of the WAG constant into **atlas data** (a `regions` list in
  `atlas.json`: `{ name, color, terrainPalette }`), editable like the WAG tables
  (item 4) — add / rename / recolour regions and set each one's terrain palette.
- A per-hex `region` already exists; wire the fill and the terrain roll to read the
  atlas's region definitions instead of the module constant.
- Ties into item 5 (canonical WAG terrain table): the region palette + neighbour
  blend is the placeholder that the canonical table/procedure should replace; keep
  the "stay within the region's terrains" guarantee when it lands.
- Ties into item 1 (td10.pw look): region colours should come from / harmonize with
  the site palette once themed.

## 6. Import a map and convert it to native hexes

Take an existing map (the Hinterlands image, or any map a GM brings) and turn it
into an editable native `td10 Atlas` — real hexes with terrain, not just a
picture underneath the grid.

- Import a raster (or vector) map, let the user set the grid (origin, hex size,
  orientation) so hexes register to the map, then **bake** each cell into a hex
  record: assign terrain per hex, seed names/settlements where known.
- Terrain assignment options, roughly in order of effort: (a) manual paint over
  the traced image; (b) sample the image under each hex and map dominant
  color → terrain, with the user correcting; (c) both — auto-suggest, then
  hand-fix.
- Output is a normal atlas folder (per-hex `.md` + `atlas.json`), so once
  converted it behaves like any other td10 Atlas and the WAG runs on it.

Implementation pointers:
- Distinct from item 3 (which keeps the image as a background/reference layer);
  this **produces native hexes** from it. They share the grid-registration UI —
  build that once (origin/size/orientation calibration over an imported image)
  and use it for both.
- Colour-sampling can use a `<canvas>` to read pixels under each hex centroid
  (or an averaged patch); keep it optional and correctable — auto-terrain is a
  starting point, not the source of truth.
- Ties into items 3 and 5: the imported/traced map is the honest neighbor data
  that neighbor-aware terrain generation (item 5) grows from.

## 7. Revisit the terrain / overlay icons

The current glyph set (`icons.js`) is a first pass — some read well (pines,
mountains, waves), others are weaker and should be improved. Do a pass over the
whole set for legibility at hex size and a consistent visual weight.

- Review each: `forest, mountain, hills, plains, swamp, coast, tundra, desert,
  urban, unknown`, plus the `settlement` / `site` overlay badges and the die.
- Judge them small (at actual hex scale, both themes) — stroke weight,
  silhouette, and whether they're distinguishable from each other at a glance.
- Keep the set coherent (one drawing style, shared stroke width) and reskin to
  match td10.pw when that pass happens (item 1).
- Consider a couple more overlay badges if the WAG warrants (e.g. a distinct
  ruin vs. active-site mark), and make sure "auto vs. pinned" icon behavior
  still reads once art changes.

## 8. Make the hexes look more naturalistic

Explore options to move the map away from flat single-color hexes toward
something more map-like, while staying lightweight (inline SVG, no deps, still
readable and fast). Options to weigh:

- **Texture within the fill** — subtle SVG patterns per terrain (stipple for
  sand, hatch for swamp, scale-ish marks for hills) instead of a flat tint.
- **Softened/!uniform fills** — a gentle gradient or slight per-hex value
  jitter so a terrain band isn't one solid color.
- **Blended borders** — feather or dither where two terrains meet rather than a
  hard hex edge, so coastlines/treelines read as transitions (pairs with the
  naturalistic look and with item 5's terrain continuity).
- **Multiple glyphs / scatter** — a few smaller terrain marks scattered in a hex
  (a little forest, not one tree) rather than a single centered icon.
- **Elevation/relief hints** — very light shading toward mountains/hills.

Constraints: must stay legible under labels, icons, and overlays; must not tank
performance on large grids (the map re-renders as one SVG string in `app.js`);
and should degrade gracefully in both light and dark themes. Prototype a couple
and compare against the current flat style before committing.

## 9. Settlement / Site should double as fillable fields

Right now a Site or Settlement is only ever the WAG-rolled result (read-only
text in the inspector). It should **also be hand-fillable**: the GM can name and
write their own settlement/site (or edit a rolled one), so a hex can carry a
proper authored place — not just dice output.

- Make the Site and Settlement sub-block fields **editable** (name + each line),
  with the WAG roll as a starting point you can keep, tweak, or overwrite.
- Add a **name** for the settlement/site (e.g. "Fort Caspar", "The Sinkhole")
  distinct from its type — surface it on the map and in the stat-block.
- Support **fill from scratch**: "Add settlement/site" should let you type one in
  without rolling, and re-roll should only replace the rolled lines, not clobber
  a name/notes you wrote.
- Persist the edited values like everything else (frontmatter + regenerated
  stat-block body).

Implementation pointers:
- Fields live in `hex.js` (`siteType/Condition/Opposition/Treasure`,
  `settlementType/Conflict`) as plain strings; the inspector renders them as
  read-only `.wl-text` in `siteBlock` / `settlementBlock` (`app.js`). Swap those
  for editable inputs wired through the existing `onInspectorInput` /
  `onInspectorChange` plumbing, and add a name field per block.
- This is how canon places (item 2) are authored — Fort Caspar's settlement is
  hand-written, not rolled — so the "fillable" path and the "locked canon" path
  should share the same fields.
- Ties into item 4 (bring-your-own content): rolled vs. authored text are two
  ways of filling the same field.

## 10. Weight terrain generation against Urban

Urban is rare on the frontier. Apart from the ~1–3 established population centers
in canon (Fort Caspar and a couple of the region anchors), almost no hex holds
enough people to read as Urban — so random terrain generation should almost never
produce it.

- Heavily suppress (or exclude) **Urban** from the random/neighbor-aware terrain
  roll. Treat Urban as effectively **author-placed**: it arrives via the canon
  seed or a GM deliberately marking a settlement, not from the dice.
- A settlement (from the WAG settlement layer) doesn't necessarily make a hex
  Urban — most settlements sit in wilderness terrain. Keep "has a settlement"
  and "terrain = Urban" independent; reserve Urban for genuine towns/strongholds.

Implementation pointers:
- Today `wag.js › REGIONS[].prefer` includes `Urban` (e.g. in the Unassigned
  region's list), so it can come up on a plain roll. Drop/deweight it there.
- Reconcile with item 5's canonical WAG terrain table: if that table has its own
  Urban frequency, defer to it; this note is the design intent (Urban is scarce)
  in case the tint/weighting is ours to set.

## 11. Re-clicking a stamp removes it (toggle)

The Settlement and Site stamp tools should **toggle**: clicking a hex that
already has that stamp removes just that stamp. Today the stamp is add-only
(re-clicking does nothing), so the only way to remove one is the Erase tool —
which wipes the *entire* hex, not just the settlement or site.

- Settlement tool on a hex with a settlement → remove the settlement (leave
  terrain, region, other stamp, notes intact). Same for Site.
- Keep Erase as the "clear the whole hex" action.

Implementation pointers:
- `app.js › paintHex` currently guards `if (!hasSettlement(h)) …` / `if
  (!hasSite(h)) …` so re-stamping is a no-op. Change to toggle: present →
  clear the block's fields; absent → roll/add.
- Mind drag-painting: a click toggles, but dragging across hexes shouldn't
  flip-flop a hex under the cursor repeatedly. Only act once per hex per stroke
  (the pointer logic already tracks `pointer.last`), and consider that a drag
  should probably only *add*, with removal reserved for a deliberate click.
- Mirrors the inspector, which already has explicit "Remove" buttons on the Site
  and Settlement blocks — this brings the same per-stamp removal to the map.

## 12. Multiple sites / settlements in one hex

Today a hex holds at most one site and one settlement (flat fields on the
record). A single hex can plausibly hold more — a town *and* the ruin on the
ridge above it, or two claims sharing a valley. Support a **list** of each.

Idea / approach:
- Model each hex's `sites` and `settlements` as **arrays of small objects**
  (`{ name, type, condition, opposition, treasure }` / `{ name, type, conflict }`
  — pairs with item 9's named, fillable places). Zero, one, or many.
- Inspector: render each as its own card in a stack, with **＋ Add** appending
  another and a per-card Remove; each card independently rollable/editable.
- Map: show a count or a small cluster when a hex has more than one (e.g. the
  settlement badge with a "×2", or stacked pips) rather than a single badge.
- Stamp tools (item 11): a click adds one; toggle/remove semantics need to pick
  *which* one (probably: click adds, removal happens in the inspector when there
  are several).

File-format consequence (the tricky part):
- The on-disk format (`hex.js`) currently uses **flat YAML scalars**
  (`siteType`, `settlementType`, …) precisely because they're trivial and
  bomb-proof to parse. Arrays break that. Options, cheapest first:
  1. Keep flat scalars for the *first* site/settlement (back-compat) and add a
     structured block for extras.
  2. Parse the repeated `### <name>` subsections under `## Site(s)` /
     `## Settlement(s)` in the Markdown body back into the array (the body is
     already regenerated on save; make it round-trip).
  3. Store `sites: [...]` / `settlements: [...]` as a small JSON block in the
     frontmatter and give `parseHex`/`serializeHex` a real (small) list emitter.
- Whichever path: keep old single-field files loading correctly (normalize a
  legacy `siteType` into a one-element `sites` array), and keep the file
  human-readable and diff-friendly.
- Depends on item 9 (named, fillable site/settlement) landing first — multiples
  only make sense once each place is a proper named object.

## 13. Fix the active-hex outline (it overlaps the hex line)

The selection highlight currently just thickens the selected hex's own polygon
stroke. Because that stroke is centered on the edge — which is shared with
neighbors and drawn as separate polygons — the brass outline straddles the hex
line and reads as a doubled / offset border (and neighbors drawn afterward can
paint over parts of it). It should be a clean, single outline.

Options:
- Draw the selection as a **separate top-most outline** — a dedicated polygon (or
  the selected hex re-drawn) appended to a layer above every hex, so nothing
  overpaints it and z-order is deterministic.
- **Inset it slightly** so the highlight sits just inside the hex edge instead of
  on top of the shared border — no doubling, and it reads as "this hex" rather
  than "this border."
- Consider `vector-effect: non-scaling-stroke` so the outline stays a crisp,
  even weight at any zoom.

Implementation pointers:
- `app.js › buildHex` adds the `selected` class inline among sibling hexes;
  `styles.css › .hex.selected polygon` bumps `stroke-width` to 3. Move the
  highlight out of the per-hex polygon into a single overlay element updated in
  `setSelected` (which already toggles the class) — e.g. a `#selection` polygon
  repositioned to the selected hex, drawn last.

## 14. Dark / light mode toggle

The app already themes both light and dark, but only by **following the OS**
(`color-scheme: light dark` + a `@media (prefers-color-scheme: light)` block in
`styles.css`). Add a **user-facing toggle** so a GM can force light or dark
regardless of system setting.

- Three-way is ideal: **Auto (system) / Light / Dark**, with a control in the
  top bar.
- **Persist** the choice (localStorage, and/or in `atlas.json` if it should
  travel with the atlas).
- Drive it by stamping an attribute on the root (e.g. `data-theme="dark"`) and
  having the CSS honor that over the media query, so the toggle can override the
  OS in both directions.

Implementation pointers:
- Refactor `styles.css`: today the light palette lives only inside
  `@media (prefers-color-scheme: light)`. Split the tokens so they can be set by
  `:root[data-theme="light"]` / `:root[data-theme="dark"]` as well as by the
  media query (auto).
- The map colors are partly JS-side (`TERRAIN_COLOR`, region colors, hex
  fills/badges in `app.js`) — check they read acceptably in both themes when the
  theme is forced, not just when the OS picks it.
- Fold into item 1 (match td10.pw): use whatever theming mechanism the site uses
  so the toggle is consistent with the rest of td10.pw.

## 15. Random map generator (terrain only)

A one-click "generate a whole map" that fills the grid with **coherent terrain**
— a believable landscape of forests, ranges, coasts, wetlands, etc. — but
**leaves the content blank**. The per-hex WAG survey (weather, features, sites,
settlements, notes) is still generated hex-by-hex as play reveals them.

- Produces a full grid of terrain that reads as real geography (ranges cluster,
  coasts run in lines, wetlands pool), not noise.
- Content stays empty: no encounters/sites/settlements auto-rolled — those come
  from surveying a hex with the WAG later.
- Options worth exposing: a **seed** (reproducible maps), landmass vs.
  archipelago / "how much water," ruggedness, and a **respect-canon** switch so
  it grows around seeded hexes instead of overwriting them.

Implementation pointers:
- Built directly on item 5 (neighbor-aware WAG terrain): generate the grid by
  seeding a few hexes and growing outward, each hex's terrain biased by
  already-placed neighbors via the canonical WAG terrain table — so this is
  really "run the terrain generator over the whole board" rather than a separate
  algorithm.
- Honor item 10 (Urban is scarce/author-placed) — a random map should not sprout
  towns; Urban comes from canon or deliberate placement.
- Honor canon (item 2): never overwrite seeded/canon hexes; treat them as fixed
  starting points the landscape grows from.
- Writes normal hex records/files (terrain + auto-icon only), so a generated map
  is immediately a real atlas the WAG can then populate.
- Distinct from item 6 (import + convert a real map): this invents terrain from
  nothing; item 6 derives it from an existing map image.

## 16. General-purpose markers

A layer of movable markers a GM drops on the map for whatever they need — most
importantly **the party's current location**, but also things like a quest
target, a rumor, a "here be dragons," a rendezvous.

- A small palette of marker types/colors (party, objective, danger, note, …),
  placed on a hex and **easily moved** as the party travels.
- Distinct from terrain/site/settlement: markers are a transient GM overlay, not
  part of a hex's canon/content — moving the party marker shouldn't touch the
  hex record's survey data.
- At least a "party" marker with a clear look (a token/pin that reads at a
  glance and stands out from the terrain glyph and site/settlement badges).
- Optional: a short label per marker, and quick "move party here" from a
  selected hex.

Implementation pointers:
- Store markers at the **atlas** level (e.g. `atlas.json` — a small
  `markers: [{ type, hexId, label }]` list), not in per-hex `.md` files, since
  they're a map overlay and move often. Keep one dedicated "party" marker
  singular if that's simpler.
- Render as an overlay layer above the hexes in `app.js` (own group, drawn last,
  like the selection outline in item 13); reuse the icon system (`icons.js`) for
  marker glyphs.
- Give it a light tool/affordance: a marker tool on the rail, or a "move party
  here" button in the inspector — moving = update the marker's `hexId` and
  re-render the overlay, no hex-record write.
- Mind item 11's toggle semantics and the paint tools so dropping/moving a marker
  doesn't collide with stamping.

## 17. Hex scale (1 hex = N miles / sq. mi.)

Make hex scale first-class and visible. The atlas already stores `hexMiles`
(default 6 — the classic 6-mile hex), but nothing surfaces or uses it.

- Let the user set the scale (hex width in miles) and show it — e.g. a legend
  line "1 hex = 6 miles (~31 sq mi)" and/or a small **scale bar** on the map.
- Derive area from the width so it updates with the setting (a regular hex of
  width `w` across the flats ≈ `0.866 · w²` sq mi — ~31 sq mi at 6 miles).
- Use scale for **travel context**: WAG wilderness pace is ~4 hex/day (5–6 forced
  march); with a mile scale the tool can show distance/time between two hexes.
- Consider offering common presets (1 / 5 / 6 / 24-mile hexes) and a unit choice
  (miles vs km) if worth it.

Implementation pointers:
- `map.js` already carries `hexMiles` (in `atlas.json` via `saveConfig`); it's
  just unused. Add a control (top bar or the HUD alongside the grid-size inputs)
  and persist changes through `persistConfig` in `app.js`.
- A scale bar is an overlay element sized from the current view/zoom (relate hex
  board-units to `hexMiles`); pairs with the other overlay layers (selection,
  markers).
- Ties into the Scale Stack framing: the hex is the WAG's Local scale; distance/
  time hooks here could feed later travel or Mountain-Crossing tooling.

## 18. Undo (and ideally redo)

There's no undo today. Destructive or accidental actions — Clear hex, a stray
paint stroke, an overwriting Generate/re-roll, an errant drag with the terrain
brush — are permanent. Add an **undo** (Ctrl/Cmd-Z), and ideally **redo**
(Shift-Ctrl/Cmd-Z).

- Cover the mutating actions: paint (terrain/region), stamps, erase/clear,
  generate, per-line re-rolls, name/notes edits, and grid resize.
- A drag-paint stroke should undo as **one step**, not one hex at a time.
- Show a brief confirmation (toast) on undo/redo so it's clear what reverted.

Implementation pointers:
- All mutations funnel through a few chokepoints in `app.js` (`mutate`,
  `paintHex`, `eraseHex`, `commit`, the inspector handlers) and persist per hex.
  Wrap those in a small history stack.
- Snapshot granularity: simplest is a per-hex before/after snapshot pushed on
  each committed change (cheap — a hex record is a small object); coalesce a
  drag stroke into a single multi-hex entry. A full-atlas snapshot is simpler
  still but heavier on large maps.
- Undo must also **re-persist**: write the restored hex file (or delete it) via
  the same `saveHex`/`removeHex` path, and refresh the map + inspector. Debounced
  text edits (notes/name) should collapse into one undo step, not one per
  keystroke.
- Bound the history depth so memory stays sane on big atlases.

---

## Archived: authored Hinterlands table flavor

On **2026-08-05** Tables A–L in `wag.js` were swapped to the canonical WAG
content. The prior Hinterlands-tinted tables (Glacia / The Fort in the
Hinterlands — arctic frontier, gold-rush camps, wilderfolk, the thing that
dreams below) are preserved verbatim here for **hand-curation and selective
reintegration** as per-atlas custom rows (item 4), per the "merge, not wipe"
plan above. Format: `Name — description`.

### Table A — Weather (authored)
1. **Clear and biting** — A hard blue sky; the cold itself is the hazard. Exposed travel taxes the unprepared. *(1)*
2. **Overcast** — Flat grey light, no shadows. Distances lie and landmarks blur. *(2–3)*
3. **River fog** — A cold fog off the water; sight drops to a stone’s throw. Ambush and losing the trail both grow likely. *(4)*
4. **Falling snow** — Steady snow softens sound and buries sign. Tracks made now last only an hour. *(5–6)*
5. **Cutting wind** — A wind that finds every seam. Fires gutter; a careless watch loses fingers. *(7)*
6. **Sleet and glaze** — Freezing rain lacquers the world. Every slope becomes a Reflex Challenge. *(8)*
7. **Whiteout** — Wind-driven snow erases the land. Travel halts or the party scatters; hole up if you can. *(9)*
8. **False thaw** — A warm, wrong wind rots the ice and wakes the bog. The ground you crossed this morning will not hold tonight. *(10)*

### Table B — Feature (authored: per-terrain flavor)
The authored Feature table was a kind (1d10: Landmark, Water, Old work, Hazard,
Resource, Lair sign, Crossing, Vantage, Marker, Anomaly) crossed with a
**per-terrain flavor bank**. Terrain flavor, by kind:

- **Forest or Jungle** — Landmark: a lightning-split giant of a pine, seen for miles · Water: a black tarn ringed with deadfall · Old work: a trapper’s line of rotted deadfalls · Hazard: a blowdown tangle no horse will cross · Resource: a stand of straight timber and good fur-sign · Lair sign: a den worn into a root-throw, and old bones · Crossing: a game trail worn to bare earth · Vantage: a fire-scar ridge open to the sky · Marker: blazes cut fresh into the bark · Anomaly: a stand where every tree leans the same wrong way
- **Hills or Mountains** — Landmark: a black-basalt tor that shows above the treeline · Water: a cold spring that never freezes · Old work: a caved adit and a spoil-heap gone to moss · Hazard: a scree slope that shifts underfoot · Resource: quartz float in the talus — color, maybe · Lair sign: a cave mouth, and drag-marks going in · Crossing: a saddle pass, the only way over for a day’s ride · Vantage: a crag that owns the whole valley · Marker: a cairn, lately added to · Anomaly: a hollow that swallows sound
- **Plains** — Landmark: a lone erratic boulder on the flat · Water: a slough the color of old tea · Old work: a ring of stones where a lodge once stood · Hazard: ground that hides a sink beneath the grass · Resource: good grazing and a herd’s wide trail · Lair sign: a burrow-town and a raptor’s plucking-post · Crossing: a worn track, the long road north · Vantage: a low rise that sees to the horizon · Marker: a surveyor’s stake, claim number burned in · Anomaly: a circle where nothing grows
- **Swamp or Wetlands** — Landmark: a drowned forest of grey snags · Water: a maze of black channels and quaking mat · Old work: a rotted corduroy road sunk to the axles · Hazard: quaking bog that will not bear weight · Resource: a beaver-works and good pelt-country · Lair sign: a mound of dragged reeds, and a stink · Crossing: a beaver-dam bridge, one misstep from the drink · Vantage: a hummock that rides above the mire · Marker: withies bent into a wilderfolk sign · Anomaly: water that lies still against the current
- **Ocean or Coast** — Landmark: a sea-stack white with birds · Water: a tide-race between two heads of rock · Old work: a wrecked barge broken on the shingle · Hazard: a cliff of rotten shale above the surf · Resource: a beach of driftwood and a run of fish · Lair sign: a sea-cave and a slick of blood on the rocks · Crossing: a tidal bar passable only at the ebb · Vantage: a headland that watches the whole shore · Marker: a stone beacon, its wood laid ready · Anomaly: a cove the tide never seems to reach
- **Tundra** — Landmark: a frost-heaved pingo like a buried hill · Water: a thaw-pond skinned with new ice · Old work: a fallen mission cross, half in the snow · Hazard: a field of frost-boils and hidden ice · Resource: a caribou trace and clean windswept moss · Lair sign: a snow-den with a breathing-hole · Crossing: a wind-scoured ridge, the only bare footing · Vantage: a rise that shows the aurora early · Marker: an inukshuk of piled stone, pointing on · Anomaly: a patch of green warmth in the white
- **Desert** — Landmark: a wind-carved arch of pale stone · Water: a bitter seep, barely drinkable · Old work: a dry sluice and tailings gone to dust · Hazard: a pan of crust over sucking mud · Resource: a vein of color bared by the wind · Lair sign: a burrow under a shelf of rock · Crossing: a wash that is the only shade for miles · Vantage: a butte that owns the barrens · Marker: a heap of bleached bones set as a sign · Anomaly: a stretch the wind refuses to cross
- **Urban** — Landmark: a black gate and a bell against the cold · Water: a cistern, and a queue for it · Old work: a burned quarter no one has rebuilt · Hazard: a lane where the wrong crew collects a toll · Resource: a market, a forge, a mission poor-box · Lair sign: a cellar door that is watched too closely · Crossing: the one bridge, and the men who hold it · Vantage: a watchtower over the whole works · Marker: a notice-board thick with bounties · Anomaly: a house every dog gives a wide berth

### Table C — Sign or Omen (authored)
1. **Fresh tracks** — Sign in the new snow, not an hour old, and more of them than there should be. *(1)*
2. **Carrion birds** — Ravens turning low over the next fold of ground. Something died, or is dying. *(2)*
3. **Distant smoke** — A thread of smoke where the map shows nothing — a camp, a signal, or a burning. *(3)*
4. **A horn at dusk** — A long note carries on the cold air. It is answered, once, from another quarter. *(4)*
5. **Blood on snow** — A dragging trail of red leads off the path and does not come back. *(5)*
6. **Left offerings** — A shrine or a stone with fresh gifts — someone came through recently, and was afraid. *(6)*
7. **A painted mark** — A Vargoth glyph in ochre, matching no known band. It is coordinating with something. *(7)*
8. **The game gone** — No birds, no tracks, no sound. The country has emptied itself ahead of you. *(8)*
9. **The aurora wrong** — The lights move against the wind and hold a shape too long. Old folk look away. *(9)*
10. **A child’s boot** — One small boot, alone in the waste, laces still tied. There is no other sign at all. *(10)*

### Table E — Encounter (authored: Hinterlands cast)
**Common (all terrains):** a Fort Caspar patrol, cold and short-tempered · Drevin hunters, watchful, not yet decided about you · Karvi trappers running a trapline, willing to trade · a lone peddler with a sledge and too much to say · prospectors, half-starved and jealous of their claim · gang toughs (the Frostmelt Boys) collecting a "toll"

**Per-terrain:**
- **Forest or Jungle** — a dire wolf pack shadowing the party · a wolverine on a kill, and it will not yield · a Vargoth scouting-party painting trees
- **Hills or Mountains** — a white bear come down to hunt · a rockslide, and something that started it · a thing from the Cold Caverns, testing the light
- **Plains** — a herd stampeding ahead of an unseen driver · raptors mantling a fresh kill · a Vargoth outrider on a stolen horse
- **Swamp or Wetlands** — a hunting cat in the reeds · leeches, fever, and a body in the water · smugglers of the Black Sluice moving cargo
- **Ocean or Coast** — a wrecked crew, desperate and armed · something in the surf that shouldn’t swim · a revenue-boat pretending to be friendly
- **Tundra** — a starving pack driven ahead of the cold · pilgrims to Mons Albus, lost and freezing · a Dreamer-touched sleeper walking in the waste
- **Desert** — a rattling nest of stone-adders · a claim-jumper crew watching the wash · a mirage-thing that is not a mirage
- **Urban** — Hollander’s Crew running a shakedown · a Fort press-gang looking for bodies · a preacher and the mob he has half-turned

*(Table D — Encounter check — was unchanged by the swap and stays as-is.)*

### Table F — Discovery (authored)
1. **A cache** — A cold-cellar or hollow tree holding supplies — food for 1d5+2 days, and someone’s intent to return. *(1)*
2. **A body and a story** — A dead traveler, and enough on them to say how they died and who might care. *(2)*
3. **A map fragment** — A torn chart marking a place off the known trails, with one word underlined. *(3)*
4. **A survivor** — Someone alive who should not be — half-frozen, half-mad, and carrying news. *(4)*
5. **A claim marker** — A staked claim, freshly worked, its owner nowhere in sight. *(5)*
6. **A relic** — A church-thing lost in the wild; the reliquary at the Fort would pay to have it back. *(6)*
7. **Gold color** — Dust in the gravel — 1d10×10 gp of it, and the question of who else knows. *(7)*
8. **A Vargoth work** — A painted shrine to the thing below, lately used, the paint not yet dry. *(8)*
9. **A sleeper** — One who heard the Dreamer’s Call and lay down in the snow, breathing still. *(9)*
10. **Nothing but cold** — Whatever was here is gone, and took the warmth with it. The party has lost the day. *(10)*

### Table G — Settlement type (authored)
1. **Barge landing** — A river stop of pilings and tar — a store, a saloon, and rough men off the water. *(1)*
2. **Trapper camp** — A cluster of cabins and drying-racks; furs are law and coin here. *(2–3)*
3. **Mining claim** — A sluice, a tent town, and the fever of easy gold that is never easy. *(4–5)*
4. **Mission station** — A cross, a bell, and a handful of the faithful holding a line against the dark. *(6)*
5. **Roadhouse** — A waystation on the long trail — beds, oats, and every rumor for a hundred miles. *(7)*
6. **Fort outpost** — A palisade and a few soldiers of Fort Caspar, under-supplied and watchful. *(8)*
7. **Wilderfolk village** — A Drevin or Karvi settlement, guarded, that decides daily whether you are welcome. *(9)*
8. **Ghost camp** — A settlement gone silent — doors open, fires cold, and no bodies to explain it. *(10)*

### Table H — Settlement conflict (authored)
1. **Claim dispute** — Two parties swear the same ground is theirs, and both have hired guns. *(1)*
2. **Missing persons** — People vanish in the night. The elders blame wolves; the elders are lying. *(2)*
3. **Cut off** — Weather or a downed bridge has sealed the place in. Stores are running short. *(3)*
4. **A lynch mood** — A stranger is blamed for the town’s troubles, and a rope is being readied. *(4)*
5. **Sickness** — A fever moves house to house. The healer is overworked, or afraid. *(5)*
6. **Preacher and gang** — A hard preacher and a harder crew both mean to own the settlement’s soul. *(6)*
7. **Tribute demanded** — The Vargoth have named a price in goods or blood, due by the next dark. *(7)*
8. **A strike** — Someone hit color, and half the town means to jump the claim before dawn. *(8)*
9. **A stranger stays** — A newcomer who will not leave, and around whom the small accidents gather. *(9)*
10. **A gathering** — A wedding, a funeral, a hanging — everyone is in one place, and so is the trouble. *(10)*

### Table I — Site type (authored)
1. **Old redoubt** — A ruined fort or blockhouse from an earlier, failed push into the country. *(1)*
2. **Mine or adit** — A worked hole in the earth, timbered and dark, that someone stopped digging. *(2)*
3. **Cavern mouth** — An opening into the Cold Caverns — the dark below is a region, not a room. *(3)*
4. **Shrine** — A holy place, or an unholy one; the cold keeps its offerings fresh. *(4)*
5. **Barrow field** — Graves under the snow, older than the Fort, and not all of them quiet. *(5)*
6. **Wreck** — A riverboat or sledge-train broken and abandoned, cargo maybe still aboard. *(6)*
7. **Watchtower** — A lone tower that once watched this ground, now held by whatever wants the view. *(7)*
8. **Trapper’s cabin** — A single cabin far from any help, its last tenant’s story still on the walls. *(8)*
9. **Standing stones** — A ring of raised stones the wilderfolk will not name and will not approach. *(9)*
10. **A sinkhole** — A throat in the ground going straight down into the black and the cold. *(10)*

### Table J — Site condition (authored)
1. **Occupied** — Intact and held — there is someone, or something, home. *(1–2)*
2. **Empty** — Intact but abandoned; it waits, and it is not as empty as it looks. *(3)*
3. **Still warm** — Just left — embers, breath-frost, the sense of having missed them by an hour. *(4)*
4. **Ruined** — Fallen in and open to the sky; what it held is scattered or buried. *(5–6)*
5. **Snowed under** — Half-collapsed and choked with drift — digging in is the first challenge. *(7)*
6. **Flooded** — Ice-water fills the lower works; footing and cold both threaten. *(8)*
7. **Defiled** — Marked by dark magic — a permanent -2 Aspect pall hangs over the place. *(9)*
8. **Sealed** — Deliberately shut, from the inside or the out, and for a reason. *(10)*

### Table K — Opposition (authored)
1. **Only the place** — No guard but the cold, the dark, and the ways it can kill you. *(1)*
2. **A predator** — A single hungry beast has made the site its own. *(2)*
3. **Vargoth hold it** — A hostile wilderfolk party keeps the place, in service to the thing below. *(3)*
4. **A gang crew** — Outlaws — the Red Ledger, the Black Sluice — using it as a den. *(4)*
5. **The Dreamer’s own** — Sleepers and worse, drawn here by the Call and no longer wholly people. *(5)*
6. **A rival party** — Another expedition wants exactly what the party wants, and got here first. *(6)*
7. **Traps** — The approach is laid with deadfalls and worse; the place defends itself. *(7)*
8. **Wilderfolk claim** — The Drevin or Karvi hold it sacred and will bargain, or not. *(8)*
9. **A thing from below** — Something climbed up out of the Cold Caverns and stayed. *(9)*
10. **One who needs help** — A captive or castaway begging aid — and it is even money whether that is true. *(10)*

### Table L — Treasure (authored)
1. **Nothing of worth** — Picked clean already, or never worth the trip. The cold was the only reward. *(1–2)*
2. **Supplies** — Stores and food — enough for 1d5+2 days and a warmer night. *(3)*
3. **Furs and goods** — Trade-worth in pelts and gear; heavy to carry, easy to sell. *(4)*
4. **Gold dust** — Color in a poke — 1d10×10 gp of dust, and the trouble that follows it. *(5)*
5. **A coin cache** — Buried silver, 1d10×5 sp, and a reason it was hidden. *(6)*
6. **A useful map** — A chart to somewhere the party has not been and now cannot resist. *(7)*
7. **A relic** — A holy object the Fort’s reliquary would reward — or that should never have been moved. *(8)*
8. **Quality gear** — A weapon or tool of real make (+1 where it counts), better than anything in camp. *(9)*
9. **A cursed artifact** — Black-ice, Dreamer-touched — worth a fortune and a slow doom to the one who keeps it. *(10)*
