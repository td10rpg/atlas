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
- [ ] 4, 5, 6, 15, 18 — see below. (Item 6 = a *general* in-app importer for any
  map; the Hinterlands is baked via the build script above.)

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
