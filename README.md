# td10 Atlas

A **WAG-driven hex atlas** — a little map-maker for Tiny d10. Survey hexes with
the *Worldwide Adventure Generator*, let terrain set each hex's icon, stamp sites
and settlements, and keep Markdown notes per hex.

## Publishing a range

A *range* is a 19-hex card's worth of country, published at its own link so the
person it was made for can open it in ATLAS. Loading one is non-destructive: it
takes an editable in-memory copy, never touches the localStorage mirror, and
never prompts for a folder, so a visitor's own atlas survives the visit.

To publish one:

1. Survey the range in ATLAS and **Export** the `.json`.
2. Bake it, picking the slug that will appear in the URL:

   ```
   python scripts/bake-range.py <export.json> "The Dry Sea" > ranges/dry-sea.js
   ```

3. Add one line to `ranges.js`:

   ```js
   import { RANGE as DRY_SEA } from './ranges/dry-sea.js';
   export const RANGES = { 'dry-sea': DRY_SEA };
   ```

4. In `td10rpg/td10`, add `content/Ranges/<Name>.md` with
   `permalink: atlas/<slug>` and the full-bleed iframe onto
   `/static/tools/atlas/#<slug>` (copy an existing range page).

The slug must be plain kebab-case. Quartz rewrites iframe `src` attributes and
strips `?` and `=` out of them, so a bare `#<slug>` anchor is the one form that
survives; the app accepts `?range=<slug>` too, for links typed by hand.

The site bakes ATLAS from this repo at build time, so a range goes live on the
next `td10rpg/td10` build. Range pages are kept out of the site's nav by an
Explorer filter in `quartz.layout.ts` — the links are unlisted, not private:
anyone with the URL can open one, and `ranges.js` ships in the public bundle.
