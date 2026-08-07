# td10 Atlas

A **WAG-driven hex atlas** — a little map-maker for Tiny d10. Survey hexes with
the *Worldwide Adventure Generator*, let terrain set each hex's icon, stamp sites
and settlements, and keep Markdown notes per hex. Your map is a real folder of
files you own (the *eddy* method): one Markdown stat-block per hex, written
straight to a local directory by the browser.

**This repo is the tool.** The *Atlas of the Hinterlands* — the actual mapped
setting that deploys to [td10.pw](https://td10.pw) under the Land of Glacia — is
content built *with* this tool and lives elsewhere. td10 Atlas ships with the
Hinterlands as a starter/canon seed, but it's setting-agnostic: reskin the WAG
tables and it maps anywhere.

## Storage — real files, not localStorage

You pick a folder once; the browser writes into it and reconnects on its own next
session (the directory handle is remembered in IndexedDB, re-granted with a
click). Nothing leaves your machine.

```
<your atlas folder>/
  atlas.json          grid config (name, cols, rows, hex scale)
  hexes/0806.md       one Markdown stat-block per populated hex
```

Browsers without the File System Access API (Firefox, Safari) still work fully
in-memory, with Export / Import of a single `.json` backup.

## Running

The File System Access API needs a secure context, so serve over http
(localhost counts):

```
python3 -m http.server 8000
# open http://localhost:8000
```

## Using it

| Tool (rail / hotkey) | What it does |
|---|---|
| **Inspect** `v` | Click a hex to select; drag to pan; wheel to zoom. |
| **Terrain** `t` | Paint terrain (icon follows); pick the brush in the bottom bar. |
| **Region** `r` | Paint one of the Hinterland regions (tints the hex border). |
| **Settlement** `s` | Stamp / toggle a WAG settlement. |
| **Site** `d` | Stamp / toggle a WAG site. |
| **Erase** `e` | Clear a hex. |

In the inspector: **Generate (WAG)** `g` rolls the whole hex; each line re-rolls
with its die; **Copy stat-block** puts the Markdown on your clipboard.

## Design

Vanilla HTML/CSS/ES modules — zero dependencies, no build step. Each file is
small and single-purpose: `wag.js` (tables + generator), `hex.js` (geometry +
file format), `map.js` (model), `storage.js` (the folder), `icons.js` (glyphs),
`md.js` (a safe Markdown renderer, adapted from
[eddy](https://github.com/m00minpappa/eddy)), `app.js` (the UI). Styled to match
[td10.pw](https://td10.pw) (EB Garamond; the Tiny d10 palette).

See [`BACKLOG.md`](BACKLOG.md) for the roadmap.

Fan tooling for Tiny d10 (CC BY-SA 4.0). *"A gift from my family to yours."*
