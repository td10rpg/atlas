# td10 Atlas

A **WAG-driven hex atlas** — a little map-maker for Tiny d10. Survey hexes with
the *Worldwide Adventure Generator*, let terrain set each hex's icon, stamp sites
and settlements, and keep Markdown notes per hex.

## Publishing a range

A range is a 19-hex map served at `td10.org/atlas/<slug>`, where it opens as an
editable copy that is never saved.

1. Export the range from ATLAS as `.json`.
2. Bake it:
   `python scripts/bake-range.py <export.json> "<Name>" [ranges/<slug>.corrections.json] > ranges/<slug>.js`
3. Register it in `ranges.js`.
4. In `td10rpg/td10`, add `content/Ranges/<Name>.md` with `permalink: atlas/<slug>`
   and an iframe onto `/static/tools/atlas/#<slug>`, then push.
