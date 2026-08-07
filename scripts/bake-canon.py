#!/usr/bin/env python3
# Bake an in-app .json export into hinterlands-seed.js (the default/canon map).
# Usage: python scripts/bake-canon.py <export.json> > hinterlands-seed.js
import json, sys

OLD_REGION = "The Bastion at Stonefall"
NEW_REGION = "The Bastion"

def r1(v):  # round coord to 1 decimal, drop trailing .0
    v = round(float(v), 1)
    return int(v) if v == int(v) else v

def clean_settlements(arr):
    out = []
    for s in (arr or []):
        s = s or {}
        o = {k: s.get(k, "") for k in ("name", "type", "conflict")}
        if any(o.values()):
            out.append({k: v for k, v in o.items() if v})
    return out

def clean_sites(arr):
    out = []
    for s in (arr or []):
        s = s or {}
        o = {k: s.get(k, "") for k in ("name", "type", "condition", "opposition", "treasure")}
        if any(o.values()):
            out.append({k: v for k, v in o.items() if v})
    return out

def hex_min(v):
    """Keep only the meaningful, non-empty fields for a seed hex."""
    h = {}
    region = v.get("region") or ""
    if region == OLD_REGION:
        region = NEW_REGION
    if region and region != "Unassigned":
        h["region"] = region
    if v.get("terrain"):
        h["terrain"] = v["terrain"]
    if v.get("icon"):
        h["icon"] = v["icon"]          # always carry a set icon so it's exact
    if v.get("iconPinned"):
        h["iconPinned"] = True
    if v.get("name"):
        h["name"] = v["name"]
    if v.get("canon"):
        h["canon"] = True
    st = clean_settlements(v.get("settlements"))
    if st:
        h["settlements"] = st
    si = clean_sites(v.get("sites"))
    if si:
        h["sites"] = si
    if v.get("factions"):
        fac = [f for f in v["factions"] if f]
        if fac:
            h["factions"] = fac
    if v.get("notes"):
        h["notes"] = v["notes"]
    return h

src = json.load(open(sys.argv[1], encoding="utf-8"))
cfg = src.get("config", {})
hexes_in = src.get("hexes", {})

# hexes: keep only those that carry something worth seeding
hexes = {}
for hid, v in hexes_in.items():
    hm = hex_min(v)
    if hm:  # non-empty record
        hexes[hid] = hm

regions = []
for reg in cfg.get("regions", []):
    name = reg.get("name")
    if name == OLD_REGION:
        name = NEW_REGION
    regions.append({"name": name, "color": reg.get("color"), "prefer": list(reg.get("prefer", []))})

rivers = [[[r1(x), r1(y)] for (x, y) in line] for line in cfg.get("rivers", [])]
labels = [{"x": r1(l["x"]), "y": r1(l["y"]), "text": l.get("text", "")} for l in cfg.get("labels", [])]

# --- canon corrections applied on top of the export -----------------------
HEX_MILES = 24  # the Hinterlands' default scale (a big frontier)
for l in labels:
    if l["text"] == "The Meltands":
        l["text"] = "The Meltlands"           # typo fix
for h in hexes.values():
    for s in h.get("settlements", []):
        if s.get("name") == "The Bastion at Stonefall":
            s["name"] = "Fort Stonefall"       # match the renamed hex/fort

seed = {
    "name": cfg.get("name", "The Hinterlands"),
    "cols": cfg.get("cols"),
    "rows": cfg.get("rows"),
    "hexMiles": HEX_MILES,
    "regions": regions,
    "rivers": rivers,
    "labels": labels,
    "hexes": hexes,
}

header = (
    "// hinterlands-seed.js — the default (canon) Hinterlands map.\n"
    "//\n"
    "// Baked from an in-app .json export (scripts/bake-canon.py): the full authored\n"
    "// map — regions, terrain, feature icons, the six canon towns, the rivers, and\n"
    "// the map labels. createStarterAtlas() rebuilds the starter atlas from this, so\n"
    "// a fresh visitor lands straight on it. Regenerate by re-exporting and re-baking.\n\n"
)
out = header + "export const HINTERLANDS_SEED = " + json.dumps(seed, ensure_ascii=False, separators=(",", ":")) + ";\n"
sys.stdout.buffer.write(out.encode("utf-8"))
