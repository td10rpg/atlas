#!/usr/bin/env python3
# Bake an in-app .json export into a published range module (ranges/<slug>.js).
# Usage: python scripts/bake-range.py <export.json> "<Range name>" [corrections.json]
#          > ranges/<slug>.js
#
# Unlike bake-canon.py, this keeps the WAG survey fields (weather, feature, sign,
# encounter, discovery) on every hex — for a range those ARE the content. The
# output is the export itself, so ?range=<slug> loads through the same
# normalizeConfig + loadHexes path as Import, and the schema can't drift.
#
# The optional corrections file carries whatever the printed card knows and the
# export does not, so a re-export can be re-baked without redoing it by hand:
#
#   { "swap":  [["1307", "1407"]],          # exchange two hexes' survey records
#     "names": { "1309": "Whalebone" } }    # hex name, and its site/settlement's
import json, sys

src = json.load(open(sys.argv[1], encoding="utf-8"))
name = sys.argv[2] if len(sys.argv) > 2 else None
fixes = json.load(open(sys.argv[3], encoding="utf-8")) if len(sys.argv) > 3 else {}

cfg = dict(src.get("config", {}))
if name:
    cfg["name"] = name

# Drop hexes the survey never touched, so a range carries only its own country.
hexes = {hid: v for hid, v in src.get("hexes", {}).items()
         if any(v.get(k) for k in ("terrain", "weather", "feature", "sign",
                                   "encounter", "discovery", "sites",
                                   "settlements", "notes", "name"))}

# Exchange two hexes' survey records, keeping each one's id where it is.
for a, b in fixes.get("swap", []):
    if a in hexes and b in hexes:
        ha, hb = hexes[a], hexes[b]
        ha["id"], hb["id"] = hb["id"], ha["id"]
        hexes[a], hexes[b] = hb, ha

# Name the hex, and the site or settlement the name refers to. A hex carrying
# both (a town beside a ruin) names only the settlement — the card names the
# place people live, and inventing a name for the other is not ours to do.
# A block already carrying the hex's old name is renamed along with it, so a
# later pass over an export that was baked once already still lands.
for hid, label in fixes.get("names", {}).items():
    h = hexes.get(hid)
    if not h:
        continue
    was = h.get("name") or ""
    h["name"] = label
    blocks = h.get("settlements") or h.get("sites") or []
    if len(blocks) == 1 and blocks[0].get("name", "") in ("", was):
        blocks[0]["name"] = label

# Retire a faction: drop it wherever it is tagged, for when the printed sheet
# stops recognizing one the survey had.
for gone in fixes.get("drop_factions", []):
    for h in hexes.values():
        if gone in h.get("factions", []):
            h["factions"] = [f for f in h["factions"] if f != gone]

seed = {"version": src.get("version", 1), "config": cfg, "hexes": hexes}

header = (
    "// %s — a published range, addressable at ?range=<slug>.\n"
    "//\n"
    "// Baked from an in-app .json export (scripts/bake-range.py). Loaded as an\n"
    "// editable in-memory copy: no folder prompt, and never mirrored to\n"
    "// localStorage, so a visitor's own atlas survives the visit. Regenerate by\n"
    "// re-exporting from ATLAS and re-baking.\n\n" % cfg.get("name", "Range")
)
out = header + "export const RANGE = " + json.dumps(seed, ensure_ascii=False, separators=(",", ":")) + ";\n"
sys.stdout.buffer.write(out.encode("utf-8"))
