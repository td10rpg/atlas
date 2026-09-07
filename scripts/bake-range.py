#!/usr/bin/env python3
# Bake an in-app .json export into a published range module (ranges/<slug>.js).
# Usage: python scripts/bake-range.py <export.json> "<Range name>" > ranges/<slug>.js
#
# Unlike bake-canon.py, this keeps the WAG survey fields (weather, feature, sign,
# encounter, discovery) on every hex — for a range those ARE the content. The
# output is the export itself, so ?range=<slug> loads through the same
# normalizeConfig + loadHexes path as Import, and the schema can't drift.
import json, sys

src = json.load(open(sys.argv[1], encoding="utf-8"))
name = sys.argv[2] if len(sys.argv) > 2 else None

cfg = dict(src.get("config", {}))
if name:
    cfg["name"] = name

# Drop hexes the survey never touched, so a range carries only its own country.
hexes = {hid: v for hid, v in src.get("hexes", {}).items()
         if any(v.get(k) for k in ("terrain", "weather", "feature", "sign",
                                   "encounter", "discovery", "sites",
                                   "settlements", "notes", "name"))}

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
