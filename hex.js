// hex.js — hex geometry and the on-disk hex file format.
//
// Two concerns, both pure. GEOMETRY: flat-top hexes in offset columns ("odd-q" —
// odd columns nudged down half a hex), the layout every classic hex atlas uses.
// Given a column/row it returns the pixel center and the six corner points; it
// also knows a hex's neighbors and its atlas label.
//
// FILE FORMAT: each populated hex is one Markdown file with a flat YAML
// frontmatter (the machine-readable record) followed by the canonical Tiny d10
// hex stat-block and the user's notes. Frontmatter is the source of truth; the
// stat-block body below it is regenerated on every save, so only the notes are
// ever hand-edited. Flat scalar keys keep the parser tiny and bomb-proof.

// ---- geometry -------------------------------------------------------------

/** Zero-padded atlas label, e.g. col 1,row 2 → "0102". */
export function hexId(col, row) {
  const p = (n) => String(n + 1).padStart(2, '0'); // 1-based, like a real atlas
  return p(col) + p(row);
}
export function parseHexId(id) {
  return { col: parseInt(id.slice(0, 2), 10) - 1, row: parseInt(id.slice(2), 10) - 1 };
}

/** Pixel center of a flat-top odd-q hex of the given size (center→corner radius). */
export function hexCenter(col, row, size) {
  const x = size * 1.5 * col;
  const y = size * Math.sqrt(3) * (row + 0.5 * (col & 1));
  return { x: x + size, y: y + size }; // + size margin so col/row 0 isn't clipped
}

/** The six corner points "x,y x,y …" for an SVG <polygon>, flat-top. */
export function hexPoints(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    pts.push((cx + size * Math.cos(a)).toFixed(2) + ',' + (cy + size * Math.sin(a)).toFixed(2));
  }
  return pts.join(' ');
}

/** Total svg canvas size for a cols×rows board of the given hex size. */
export function boardSize(cols, rows, size) {
  const w = size * 1.5 * (cols - 1) + size * 2 + size; // last center + radius + margin
  const h = size * Math.sqrt(3) * (rows + 0.5) + size;
  return { w: Math.ceil(w), h: Math.ceil(h) };
}

const ODD_Q_DIRS = [ // neighbor deltas differ between even/odd columns (redblobgames)
  [[+1, 0], [+1, -1], [0, -1], [-1, -1], [-1, 0], [0, +1]], // even col
  [[+1, +1], [+1, 0], [0, -1], [-1, 0], [-1, +1], [0, +1]], // odd col
];
export function neighbors(col, row) {
  return ODD_Q_DIRS[col & 1].map(([dc, dr]) => ({ col: col + dc, row: row + dr }));
}

// ---- the hex record -------------------------------------------------------
// A plain object with these fields. All strings default to ''. `site`/`settlement`
// exist iff their *Type field is non-empty.

export const HEX_FIELDS = [
  'id', 'name', 'region', 'terrain', 'icon',
  'weather', 'feature', 'featureDesc', 'sign', 'encounter', 'discovery',
  'siteType', 'siteCondition', 'siteOpposition', 'siteTreasure',
  'settlementType', 'settlementConflict',
  'canon', 'generatedAt',
];

export function emptyHex(id) {
  const h = { id, factions: [], notes: '' };
  HEX_FIELDS.forEach((k) => { if (!(k in h)) h[k] = k === 'canon' ? false : ''; });
  h.id = id;
  return h;
}

export function hasSite(h) { return !!(h && h.siteType); }
export function hasSettlement(h) { return !!(h && h.settlementType); }
/** A hex is "populated" (worth a file on disk) once it has any surveyed content. */
export function isPopulated(h) {
  if (!h) return false;
  return !!(h.terrain || h.weather || h.feature || h.notes || h.name ||
    hasSite(h) || hasSettlement(h) || (h.region && h.region !== 'Unassigned'));
}

// ---- serialize ------------------------------------------------------------

function yamlScalar(v) {
  const s = String(v == null ? '' : v);
  // Quote anything that could confuse a naive line parser.
  if (s === '' || /[:#\-?\[\]{}",\n]/.test(s) || /^\s|\s$/.test(s)) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  return s;
}
function yamlList(arr) {
  return '[' + (arr || []).map((x) => yamlScalar(x)).join(', ') + ']';
}

/** Turn a hex record into its Markdown file text. */
export function serializeHex(h) {
  const fm = ['---'];
  HEX_FIELDS.forEach((k) => {
    if (k === 'canon') fm.push(`${k}: ${h.canon ? 'true' : 'false'}`);
    else fm.push(`${k}: ${yamlScalar(h[k])}`);
  });
  fm.push(`factions: ${yamlList(h.factions)}`);
  fm.push('---');

  const body = [];
  const title = h.name ? `Hex ${h.id} — ${h.name}` : `Hex ${h.id}`;
  body.push(`# ${title}`);
  if (h.canon) body.push('*Hinterlands canon.*');
  body.push('');
  if (h.region) body.push(`**Region:** ${h.region}`);
  if (h.terrain) body.push(`**Terrain:** ${h.terrain}`);
  if (h.weather) body.push(`**Weather (Table A):** ${h.weather}`);
  if (h.feature) body.push(`**Feature (Table B):** ${h.feature}${h.featureDesc ? ` — *${h.featureDesc}*` : ''}`);
  if (h.sign) body.push(`**Sign or Omen (Table C):** ${h.sign}`);
  if (h.encounter) body.push(`**Encounter (Tables D & E):** ${h.encounter}`);
  if (h.discovery) body.push(`**Discovery (Table F):** ${h.discovery}`);

  if (hasSite(h)) {
    body.push('', '## Site');
    body.push(`**Type (Table I):** ${h.siteType}`);
    if (h.siteCondition) body.push(`**Condition (Table J):** ${h.siteCondition}`);
    if (h.siteOpposition) body.push(`**Opposition (Table K):** ${h.siteOpposition}`);
    if (h.siteTreasure) body.push(`**Treasure (Table L):** ${h.siteTreasure}`);
  }
  if (hasSettlement(h)) {
    body.push('', '## Settlement');
    body.push(`**Type (Table G):** ${h.settlementType}`);
    if (h.settlementConflict) body.push(`**Conflict or Hook (Table H):** ${h.settlementConflict}`);
  }
  if (h.factions && h.factions.length) {
    body.push('', `**Factions:** ${h.factions.join(' | ')}`);
  }

  body.push('', '## Notes', '', (h.notes || '').trim());
  return fm.join('\n') + '\n\n' + body.join('\n') + '\n';
}

// ---- parse ----------------------------------------------------------------

function unquote(v) {
  const s = v.trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return s;
}
function parseList(v) {
  const s = v.trim();
  if (!(s.startsWith('[') && s.endsWith(']'))) return [];
  const inner = s.slice(1, -1).trim();
  if (!inner) return [];
  // split on commas not inside quotes
  const out = []; let cur = ''; let q = false;
  for (const c of inner) {
    if (c === '"') { q = !q; cur += c; }
    else if (c === ',' && !q) { out.push(unquote(cur)); cur = ''; }
    else cur += c;
  }
  if (cur.trim()) out.push(unquote(cur));
  return out.filter(Boolean);
}

/** Parse a hex file's text back into a record. Never throws. */
export function parseHex(text, fallbackId) {
  const src = String(text || '').replace(/\r\n?/g, '\n');
  const rec = emptyHex(fallbackId || '');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) { rec.notes = src.trim(); return rec; }

  m[1].split('\n').forEach((line) => {
    const kv = /^([A-Za-z][A-Za-z0-9]*):\s?(.*)$/.exec(line);
    if (!kv) return;
    const key = kv[1]; const raw = kv[2];
    if (key === 'factions') rec.factions = parseList(raw);
    else if (key === 'canon') rec.canon = /^true$/i.test(raw.trim());
    else if (HEX_FIELDS.includes(key)) rec[key] = unquote(raw);
  });
  if (fallbackId && !rec.id) rec.id = fallbackId;

  // Notes = everything under the final "## Notes" heading in the body.
  const body = src.slice(m[0].length);
  const nm = /(^|\n)##\s+Notes\s*\n([\s\S]*)$/.exec(body);
  rec.notes = nm ? nm[2].trim() : '';
  return rec;
}
