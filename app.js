// app.js — td10 Atlas.
//
// Boots the atlas (reconnecting to your folder if it can), renders the hex map as
// SVG, and drives the per-hex inspector where the WAG populates a hex and sets its
// icon from the terrain. Storage is a folder of Markdown files (see storage.js);
// a localStorage mirror is kept as a safety net and for browsers without the File
// System Access API. No dependencies, no build step.

import {
  createStarterAtlas, createAtlas, createRandomAtlas, getHex, ensureHex, applyTerrainIcon,
  REGIONS, generateHex, rollTerrain, rollTerrainForHex, normalizeConfig, loadHexes,
} from './map.js';
import {
  TERRAINS, rerollField, rollSite, rollSettlement, rollSiteFields, rollSettlementFields,
  EDITABLE_TABLES, defaultTable, setTableOverrides,
} from './wag.js';
import {
  hexId, hexCenter, hexPoints, boardSize, neighbors, isPopulated, hasSite, hasSettlement,
  emptyHex, emptySite, emptySettlement, serializeHex,
} from './hex.js';
import * as store from './storage.js';
import { TERRAIN_ICONS, terrainGlyph, overlayGlyph, dieGlyph, svgIcon } from './icons.js';
import { render as mdRender } from './md.js';

// ---- constants ------------------------------------------------------------

const SIZE = 34; // hex radius in board units; zoom controls apparent size.
const LS_KEY = 'td10-atlas-backup';

// Terrain fills, drawn from the canonical WAG terrain key (Forest/Mountains/Open/
// Water/Tundra/Desert…), harmonized with td10.pw's teal water and sage/slate.
const TERRAIN_COLOR = {
  'Forest or Jungle': '#4f8f4a', 'Hills or Mountains': '#8a6a45', 'Plains': '#9fbf63',
  'Swamp or Wetlands': '#5f8f78', 'Ocean or Coast': '#6f9a9a', 'Tundra': '#a9c4d6',
  'Desert': '#d9c07f', 'Urban': '#8f7a6a',
};

const BRAND_SVG = '<path d="M12 2l3 6 6 .5-4.5 4.2 1.4 6.3L12 16.9 6.1 19l1.4-6.3L3 8.5 9 8z" fill="none" stroke="currentColor" stroke-width="1.4"/>';
const TOOL_ICONS = {
  inspect: '<path d="M5 3l14 8-6 1.6L10 19z"/>',
  terrain: '<path d="M3 21l6-2 9-9-4-4-9 9z"/><path d="M13.5 6.5l4 4"/>',
  region: '<path d="M6 3v18"/><path d="M6 4h11l-2.5 3.5L17 11H6"/>',
  settlement: '<path d="M4 20V11l8-6 8 6v9z"/><path d="M9.5 20v-5h5v5"/>',
  site: '<path d="M7 21V4l10 3-10 3"/>',
  erase: '<path d="M4 15l7-7 7 7-4 4H8z"/><path d="M8 21h10"/>',
  marker: '<path d="M12 21s6-5.7 6-11a6 6 0 0 0-12 0c0 5.3 6 11 6 11z"/><circle cx="12" cy="10" r="2.2"/>',
};
const WAG_LINES = [
  { key: 'weather', tag: 'Weather · Table A' },
  { key: 'feature', tag: 'Feature · Table B' },
  { key: 'sign', tag: 'Sign or Omen · Table C' },
  { key: 'encounter', tag: 'Encounter · Tables D & E' },
  { key: 'discovery', tag: 'Discovery · Table F' },
];

// ---- state ----------------------------------------------------------------

const S = {
  atlas: createAtlas(),
  dir: null,            // FileSystemDirectoryHandle, or null (in-memory / localStorage)
  selected: null,       // hex id
  tool: 'inspect',
  brushTerrain: 'Forest or Jungle',
  brushRegion: 'The Pine Expanse',
  showLabels: true,
  notesTab: 'write',
  theme: 'auto',        // 'auto' | 'light' | 'dark' (backlog 14)
  view: { x: 0, y: 0, w: 100, h: 100 },
};

// ---- theme (auto / light / dark) ------------------------------------------

const THEME_KEY = 'td10-atlas-theme';
const THEME_LABEL = { auto: '◐ Auto', light: '☀ Light', dark: '☾ Dark' };
function applyTheme() {
  if (S.theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = S.theme;
}
function cycleTheme() {
  S.theme = S.theme === 'auto' ? 'light' : S.theme === 'light' ? 'dark' : 'auto';
  try { localStorage.setItem(THEME_KEY, S.theme); } catch { /* ignore */ }
  applyTheme();
  renderConn();
}

// ---- element refs ---------------------------------------------------------

const $ = (sel) => document.querySelector(sel);
const mapEl = $('#map');
const mapWrap = $('#mapwrap');
const inspectorEl = $('#inspector');
const toolsEl = $('#tools');
const connEl = $('#conn');
const hudEl = $('#map-hud');
const nameInput = $('#atlas-name');
const importInput = $('#import-file');
$('#brand-mark').innerHTML = svgIcon(BRAND_SVG, { size: 22 });

// ---- boot -----------------------------------------------------------------

async function boot() {
  try { S.theme = localStorage.getItem(THEME_KEY) || 'auto'; } catch { S.theme = 'auto'; }
  applyTheme();
  buildTools();
  wireEvents();

  // 0) Demo mode (e.g. a bundled single-file build): skip file access entirely
  //    and boot straight into a seeded in-memory atlas so there's something to poke.
  if (globalThis.__HA_INMEMORY__) {
    startInMemory('In-memory demo — connect a folder in the hosted app to save real files.');
    return;
  }

  // 1) Try to reconnect a remembered folder without prompting.
  const handle = store.supported() ? await store.restoreHandle() : null;
  if (handle) {
    if (await store.hasPermission(handle)) {
      try {
        S.dir = handle;
        S.atlas = await store.readAtlas(handle);
        afterLoad();
        return;
      } catch { /* fall through to landing */ }
    } else {
      // Have a handle but need a gesture to re-grant — offer Reconnect.
      renderShell();
      showLanding({ reconnect: handle });
      return;
    }
  }

  // 2) No folder — fall back to the localStorage mirror if one exists.
  const local = loadLocal();
  if (local) {
    S.atlas = local;
    afterLoad();
    toast('Working from a local backup. Connect a folder to save real files.');
    return;
  }

  // 3) Fresh start.
  renderShell();
  showLanding({});
}

function startInMemory(msg) {
  S.atlas = createStarterAtlas(true);
  S.dir = null;
  afterLoad();
  if (msg) toast(msg);
}

function afterLoad() {
  removeLanding();
  setTableOverrides(S.atlas.customTables || {}); // apply per-atlas WAG table edits (backlog 4)
  renderShell();
  renderMap();
  fitView();
  renderInspector();
  saveLocal();
  resetHistory();
}

// ---- top-bar / connection -------------------------------------------------

function renderShell() {
  nameInput.value = S.atlas.name || '';
  renderConn();
  renderHud();
}

function renderConn() {
  const supported = store.supported();
  const connected = !!S.dir;
  const dot = connected ? 'on' : (supported ? 'off' : '');
  const label = connected ? 'Folder connected' : (supported ? 'Not connected' : 'In-memory (no file access)');
  connEl.innerHTML =
    `<span class="status"><span class="dot ${dot}"></span>${label}</span>` +
    (supported && !globalThis.__HA_INMEMORY__
      ? `<button class="btn small" data-action="new-folder">New folder</button>` +
        `<button class="btn small" data-action="open-folder">Open folder</button>`
      : '') +
    `<button class="btn small ghost" data-action="import-map" title="Import an image and convert it to native hexes">Map image</button>` +
    `<button class="btn small ghost" data-action="random" title="Generate a random terrain map (content stays blank)">Random map</button>` +
    `<button class="btn small ghost" data-action="theme" title="Theme: auto / light / dark">${THEME_LABEL[S.theme]}</button>` +
    `<button class="btn small ghost" data-action="export">Export</button>` +
    `<button class="btn small ghost" data-action="import">Import</button>`;
}

// ---- tools rail -----------------------------------------------------------

function buildTools() {
  const tool = (key, title) =>
    `<button class="tool ${S.tool === key ? 'active' : ''}" data-tool="${key}" title="${title}">` +
    svgIcon(TOOL_ICONS[key], { size: 22 }) +
    (key === 'terrain' ? `<span class="swatch" style="background:${TERRAIN_COLOR[S.brushTerrain]}"></span>` : '') +
    (key === 'region' ? `<span class="swatch" style="background:${REGIONS.find((r) => r.name === S.brushRegion)?.color}"></span>` : '') +
    `</button>`;
  toolsEl.innerHTML =
    tool('inspect', 'Inspect / select (drag to pan)') +
    '<div class="sep"></div>' +
    tool('terrain', 'Paint terrain') +
    tool('region', 'Paint region') +
    '<div class="sep"></div>' +
    tool('settlement', 'Stamp a settlement (WAG)') +
    tool('site', 'Stamp a site (WAG)') +
    '<div class="sep"></div>' +
    tool('marker', 'Party marker — click a hex to place / move it') +
    tool('erase', 'Erase hex');
}

function setTool(key) {
  S.tool = key;
  buildTools();
  renderHud();
  mapEl.classList.toggle('painting', key !== 'inspect');
}

// ---- HUD (zoom, labels, grid size, brush context) -------------------------

function renderHud() {
  const count = Object.values(S.atlas.hexes).filter(isPopulated).length;
  let brush = '';
  if (S.tool === 'terrain') {
    brush = `<span class="sep2">|</span> Brush ` +
      `<select data-hud="brush-terrain">` +
      TERRAINS.map((t) => `<option ${t.key === S.brushTerrain ? 'selected' : ''}>${t.key}</option>`).join('') +
      `</select>`;
  } else if (S.tool === 'region') {
    brush = `<span class="sep2">|</span> Brush ` +
      `<select data-hud="brush-region">` +
      REGIONS.map((r) => `<option ${r.name === S.brushRegion ? 'selected' : ''}>${r.name}</option>`).join('') +
      `</select>`;
  }
  hudEl.innerHTML =
    `<button class="btn small" data-action="zoom-out" title="Zoom out">−</button>` +
    `<button class="btn small" data-action="fit" title="Fit map">Fit</button>` +
    `<button class="btn small" data-action="zoom-in" title="Zoom in">+</button>` +
    `<span class="sep2">|</span>` +
    `<button class="btn small" data-action="undo" title="Undo (Ctrl/Cmd-Z)" ${history.length < 2 ? 'disabled' : ''}>↶</button>` +
    `<button class="btn small" data-action="redo" title="Redo (Ctrl/Cmd-Shift-Z)" ${future.length ? '' : 'disabled'}>↷</button>` +
    `<span class="sep2">|</span>` +
    `<label><input type="checkbox" data-hud="labels" ${S.showLabels ? 'checked' : ''}/> labels</label>` +
    `<span class="sep2">|</span> Map ` +
    `<input type="number" data-hud="cols" min="1" max="60" value="${S.atlas.cols}" style="width:46px" title="columns"/>×` +
    `<input type="number" data-hud="rows" min="1" max="60" value="${S.atlas.rows}" style="width:46px" title="rows"/>` +
    `<span class="sep2">|</span> Scale ` +
    `<input type="number" data-hud="hexmiles" min="1" max="100" value="${S.atlas.hexMiles}" style="width:42px" title="miles across a hex"/>` +
    ` mi/hex (~${Math.round(0.8660254 * S.atlas.hexMiles * S.atlas.hexMiles)} sq&nbsp;mi)` +
    brush +
    `<span class="sep2">|</span> ${count} hex${count === 1 ? '' : 'es'}`;
}

// ---- map render -----------------------------------------------------------

function buildHex(col, row) {
  const id = hexId(col, row);
  const rec = getHex(S.atlas, id);
  const { x: cx, y: cy } = hexCenter(col, row, SIZE);
  const pts = hexPoints(cx, cy, SIZE);

  const region = rec && rec.region ? REGIONS.find((r) => r.name === rec.region) : null;
  const stroke = region && region.name !== 'Unassigned' ? region.color : 'var(--hex-line)';
  const isOcean = rec && rec.terrain === 'Ocean or Coast';
  const terrColor = rec && rec.terrain ? TERRAIN_COLOR[rec.terrain] : null;

  // Naturalistic fills (backlog 8): open sea is a continuous teal expanse with no
  // per-hex glyph; land terrain gets a small deterministic value jitter so a band
  // of one terrain doesn't read as a flat block of colour.
  let fill, fillOp;
  if (isOcean) { fill = terrColor; fillOp = (0.5 + hexJitter(id) * 0.6).toFixed(3); }
  else if (terrColor) { fill = terrColor; fillOp = (0.32 + hexJitter(id)).toFixed(3); }
  else if (region && region.name !== 'Unassigned') { fill = region.color; fillOp = (0.13 + hexJitter(id) * 0.5).toFixed(3); } // unsurveyed land, tinted by region
  else { fill = 'var(--hex-blank)'; fillOp = '1'; }

  const cls = 'hex' + (rec && rec.canon ? ' canon' : '');
  let inner = `<polygon points="${pts}" fill="${fill}" fill-opacity="${fillOp}" stroke="${stroke}"/>`;

  if (rec && rec.icon && !isOcean) {
    const gs = SIZE * 0.86;
    const gx = cx - gs / 2, gy = cy - gs / 2 - (rec.name ? 3 : 0);
    inner += `<g class="glyph" transform="translate(${gx.toFixed(1)},${gy.toFixed(1)})" style="color:${terrColor || 'var(--ink)'}">` +
      terrainGlyph(rec.icon, { size: gs }) + `</g>`;
  }
  if (rec && hasSettlement(rec)) {
    const n = rec.settlements.filter((s) => s && (s.name || s.type || s.conflict)).length;
    inner += badge(cx + SIZE * 0.34, cy - SIZE * 0.5, 'settlement', '#d8b25a', n);
  }
  if (rec && hasSite(rec)) {
    const n = rec.sites.filter((s) => s && (s.name || s.type || s.condition || s.opposition || s.treasure)).length;
    inner += badge(cx - SIZE * 0.62, cy - SIZE * 0.5, 'site', '#c98a8a', n);
  }
  if (rec && rec.canon) {
    inner += `<text class="canon-star" x="${cx}" y="${(cy + SIZE * 0.52).toFixed(1)}" text-anchor="middle" fill="var(--accent)" font-size="9">★</text>`;
  }
  if (S.showLabels) {
    inner += `<text class="hex-label" x="${cx}" y="${(cy - SIZE * 0.58).toFixed(1)}" text-anchor="middle">${id}</text>`;
    if (rec && rec.name) {
      inner += `<text class="hex-name" x="${cx}" y="${(cy + SIZE * 0.78).toFixed(1)}" text-anchor="middle">${escapeXml(clip(rec.name, 14))}</text>`;
    }
  }
  return `<g class="${cls}" data-id="${id}">${inner}</g>`;
}

function badge(x, y, kind, color, count) {
  const s = SIZE * 0.42;
  const countMark = count > 1
    ? `<text x="${(s + 1).toFixed(1)}" y="${(s * 0.35).toFixed(1)}" text-anchor="middle" font-size="${(s * 0.62).toFixed(1)}" font-weight="700" fill="${color}" stroke="var(--map-bg)" stroke-width="0.6" paint-order="stroke">×${count}</text>`
    : '';
  return `<g transform="translate(${(x - s / 2).toFixed(1)},${(y - s / 2).toFixed(1)})" style="color:${color}">` +
    `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 + 1}" fill="var(--map-bg)" stroke="${color}" stroke-width="0.8"/>` +
    `<g transform="translate(${s * 0.16},${s * 0.16}) scale(${(s * 0.68 / 24).toFixed(3)})">` +
    overlayGlyph(kind, { size: 24 }) + `</g>${countMark}</g>`;
}

function renderMap() {
  const { w, h } = boardSize(S.atlas.cols, S.atlas.rows, SIZE);
  mapEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  let cells = '';
  for (let col = 0; col < S.atlas.cols; col++) {
    for (let row = 0; row < S.atlas.rows; row++) {
      cells += buildHex(col, row);
    }
  }
  // Layers, bottom to top: hexes, then the overlay (selection outline + markers),
  // so nothing overpaints the top affordances.
  mapEl.innerHTML = `<g id="hex-layer">${cells}</g><g id="overlay"></g>`;
  mapEl.dataset.bw = w; mapEl.dataset.bh = h;
  drawOverlay();
}

function refreshHex(id) {
  const node = mapEl.querySelector(`.hex[data-id="${id}"]`);
  if (!node) return;
  const { col, row } = parseId(id);
  node.outerHTML = buildHex(col, row);
}

// The overlay layer, drawn above every hex: the active-hex highlight (a single
// inset polygon with a non-scaling stroke, so it never doubles on the shared edge —
// backlog 13) plus any markers (backlog 16).
function drawOverlay() {
  const ov = mapEl.querySelector('#overlay');
  if (!ov) return;
  let s = '';
  if (S.selected) {
    const { col, row } = parseId(S.selected);
    const { x, y } = hexCenter(col, row, SIZE);
    s += `<polygon class="sel-outline" points="${hexPoints(x, y, SIZE - 2.6)}"/>`;
  }
  (S.atlas.markers || []).forEach((m) => {
    const { col, row } = parseId(m.hexId);
    if (col < 0 || row < 0 || col >= S.atlas.cols || row >= S.atlas.rows) return;
    const { x, y } = hexCenter(col, row, SIZE);
    s += markerGlyph(m, x, y);
  });
  ov.innerHTML = s;
}

function markerGlyph(m, x, y) {
  const sz = SIZE * 0.62;
  const color = m.type === 'party' ? '#d9694e' : 'var(--accent)';
  // A filled pin with a white keyline + white dot so it reads on any terrain.
  return `<g transform="translate(${(x - sz / 2).toFixed(1)},${(y - sz).toFixed(1)})">` +
    `<g transform="scale(${(sz / 24).toFixed(3)})" fill="${color}" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round">` +
    `<path d="M12 22s6.5-6.1 6.5-11.5a6.5 6.5 0 0 0-13 0C5.5 15.9 12 22 12 22z"/>` +
    `<circle cx="12" cy="10.5" r="2.4" fill="#ffffff" stroke="none"/></g></g>`;
}

function parseId(id) {
  return { col: parseInt(id.slice(0, 2), 10) - 1, row: parseInt(id.slice(2), 10) - 1 };
}

/** The terrains of a hex's already-surveyed neighbours (for neighbour-aware rolls). */
function neighbourTerrainsOf(id) {
  const { col, row } = parseId(id);
  return neighbors(col, row)
    .map((n) => { const h = getHex(S.atlas, hexId(n.col, n.row)); return h && h.terrain ? h.terrain : null; })
    .filter(Boolean);
}

// ---- view (pan / zoom) ----------------------------------------------------

function applyView() {
  const v = S.view;
  mapEl.setAttribute('viewBox', `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}`);
}
function fitView() {
  const { w, h } = boardSize(S.atlas.cols, S.atlas.rows, SIZE);
  const rect = mapWrap.getBoundingClientRect();
  const ar = rect.width / Math.max(1, rect.height);
  const pad = SIZE;
  const bw = w + pad, bh = h + pad;
  let vw, vh;
  if (bw / bh > ar) { vw = bw; vh = bw / ar; } else { vh = bh; vw = bh * ar; }
  S.view = { x: -pad / 2 - (vw - bw) / 2, y: -pad / 2 - (vh - bh) / 2, w: vw, h: vh };
  applyView();
}
function zoom(factor, clientX, clientY) {
  const rect = mapEl.getBoundingClientRect();
  const fx = (clientX - rect.left) / rect.width;
  const fy = (clientY - rect.top) / rect.height;
  const v = S.view;
  const bx = v.x + fx * v.w, by = v.y + fy * v.h;
  const { w: bw } = boardSize(S.atlas.cols, S.atlas.rows, SIZE);
  let nw = v.w / factor;
  nw = Math.max(SIZE * 4, Math.min(bw * 5, nw));
  const s = nw / v.w;
  const nh = v.h * s;
  S.view = { x: bx - fx * nw, y: by - fy * nh, w: nw, h: nh };
  applyView();
}
function pan(dxPx, dyPx) {
  const rect = mapEl.getBoundingClientRect();
  S.view.x -= dxPx * (S.view.w / rect.width);
  S.view.y -= dyPx * (S.view.h / rect.height);
  applyView();
}

// ---- pointer interaction --------------------------------------------------

let pointer = null;
function wirePointer() {
  mapEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    mapEl.setPointerCapture(e.pointerId);
    const hex = e.target.closest('.hex');
    const downId = hex ? hex.dataset.id : null;
    // Paint tools stamp on drag; Inspect pans.
    const mode = (S.tool !== 'inspect' && downId) ? 'paint' : 'pan';
    pointer = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, downId, moved: false, mode, last: downId };
    if (mode === 'paint') paintHex(downId, true);
    mapEl.classList.add('grabbing');
  });
  mapEl.addEventListener('pointermove', (e) => {
    if (!pointer) return;
    if (pointer.mode === 'pan') {
      pan(e.clientX - pointer.lx, e.clientY - pointer.ly);
    } else {
      const hex = document.elementFromPoint(e.clientX, e.clientY);
      const g = hex && hex.closest ? hex.closest('.hex') : null;
      const id = g ? g.dataset.id : null;
      if (id && id !== pointer.last) { paintHex(id, false); pointer.last = id; }
    }
    if (Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 4) pointer.moved = true;
    pointer.lx = e.clientX; pointer.ly = e.clientY;
  });
  const end = (e) => {
    if (!pointer) return;
    if (pointer.mode === 'pan' && !pointer.moved && pointer.downId) setSelected(pointer.downId);
    mapEl.classList.remove('grabbing');
    try { mapEl.releasePointerCapture(e.pointerId); } catch {}
    pointer = null;
  };
  mapEl.addEventListener('pointerup', end);
  mapEl.addEventListener('pointercancel', end);

  mapEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
  }, { passive: false });

  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      const rect = mapWrap.getBoundingClientRect();
      const ar = rect.width / Math.max(1, rect.height);
      const v = S.view; const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
      v.h = v.w / ar; v.x = cx - v.w / 2; v.y = cy - v.h / 2; applyView();
    }, 120);
  });
}

// ---- painting -------------------------------------------------------------

// allowToggle is true on a deliberate click (pointerdown) and false while dragging
// a stroke — so a click on a hex that already has that stamp removes it (backlog 11),
// but dragging across hexes only ever adds. Canon hexes refuse all paint (backlog 2).
function paintHex(id, allowToggle) {
  // The party marker may sit on any hex, canon included; every other paint tool
  // refuses canon hexes.
  if (S.tool === 'marker') { if (allowToggle) toggleParty(id); return; }
  const existing = getHex(S.atlas, id);
  if (existing && existing.canon) {
    if (allowToggle) toast('Canon hex is locked — roll the WAG or edit notes in the inspector.');
    return;
  }
  switch (S.tool) {
    case 'terrain': mutate(id, (h) => { h.terrain = S.brushTerrain; applyTerrainIcon(h); }); break;
    case 'region': mutate(id, (h) => { h.region = S.brushRegion; }); break;
    case 'settlement': mutate(id, (h) => stampPlace(h, 'settlements', allowToggle)); break;
    case 'site': mutate(id, (h) => stampPlace(h, 'sites', allowToggle)); break;
    case 'erase': eraseHex(id); break;
  }
}

// Stamp a WAG place onto a hex. A deliberate click on a hex holding exactly one of
// that kind removes it (backlog 11); otherwise (or while dragging) it adds one —
// so a hex can carry several (backlog 12).
function stampPlace(h, key, allowToggle) {
  const arr = h[key] || (h[key] = []);
  if (allowToggle && arr.length === 1) { arr.length = 0; return; }
  arr.push(key === 'settlements' ? rollSettlement() : rollSite());
}

// The party marker: a single atlas-level overlay token. Click a hex to place it,
// click its current hex to pick it up (backlog 16). Never touches hex records.
function toggleParty(id) {
  const list = S.atlas.markers || (S.atlas.markers = []);
  const m = list.find((x) => x.type === 'party');
  if (m) { if (m.hexId === id) S.atlas.markers = list.filter((x) => x !== m); else m.hexId = id; }
  else list.push({ type: 'party', hexId: id, label: 'Party' });
  persistConfig();
  drawOverlay();
  recordChange();
}

/** Ensure the hex, mutate it, then persist + repaint + refresh the inspector. */
function mutate(id, fn) {
  const h = ensureHex(S.atlas, id);
  fn(h);
  persistHex(id);
  refreshHex(id);
  if (S.selected === id) renderInspector();
  renderHud();
  recordChange();
}

function eraseHex(id) {
  const h = getHex(S.atlas, id);
  if (h && h.canon) { toast('Canon hex is locked and can’t be cleared.'); return; }
  delete S.atlas.hexes[id];
  if (S.dir) store.removeHex(S.dir, id).catch(() => {});
  refreshHex(id);
  saveLocal();
  if (S.selected === id) renderInspector();
  renderHud();
  recordChange();
}

// ---- persistence ----------------------------------------------------------

let saveTimers = {};
function persistHex(id) {
  const h = getHex(S.atlas, id);
  if (!h) return;
  if (!isPopulated(h)) {
    delete S.atlas.hexes[id];
    if (S.dir) store.removeHex(S.dir, id).catch(() => {});
  } else if (S.dir) {
    store.saveHex(S.dir, h).catch((err) => toast('Could not write hex file: ' + err.message, true));
  }
  saveLocal();
}
function persistHexDebounced(id) {
  clearTimeout(saveTimers[id]);
  saveTimers[id] = setTimeout(() => persistHex(id), 500);
}
function persistConfig() {
  if (S.dir) store.saveConfig(S.dir, S.atlas).catch(() => {});
  saveLocal();
}

function saveLocal() {
  try {
    const hexes = {};
    Object.values(S.atlas.hexes).forEach((h) => { if (isPopulated(h)) hexes[h.id] = h; });
    localStorage.setItem(LS_KEY, JSON.stringify({
      config: { name: S.atlas.name, cols: S.atlas.cols, rows: S.atlas.rows, hexMiles: S.atlas.hexMiles, markers: S.atlas.markers || [], customTables: S.atlas.customTables || {} },
      hexes,
    }));
  } catch { /* quota or private mode — ignore */ }
}
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw);
    const atlas = normalizeConfig(b.config);
    loadHexes(atlas, Object.values(b.hexes || {}));
    return atlas;
  } catch { return null; }
}

// ---- undo / redo (backlog 18) ---------------------------------------------
// Bounded, debounced full-atlas snapshots. recordChange() is called after every
// mutation; rapid edits (typing) coalesce into one snapshot. Undo/redo restore a
// snapshot and re-persist only the hex files that actually differ.

const UNDO_CAP = 40;
let history = [];   // snapshots; the last is always the current committed state
let future = [];    // snapshots undone, available to redo
let recordTimer = null;

const clone = (x) => JSON.parse(JSON.stringify(x == null ? null : x));
function snapshot() {
  return {
    name: S.atlas.name, cols: S.atlas.cols, rows: S.atlas.rows, hexMiles: S.atlas.hexMiles,
    markers: clone(S.atlas.markers || []),
    customTables: clone(S.atlas.customTables || {}),
    hexes: clone(S.atlas.hexes || {}),
  };
}
/** Reset history to the current state — call after a fresh load/open/import. */
function resetHistory() { history = [snapshot()]; future = []; renderHud(); }
/** Note that the model changed; debounced so a burst of edits is one undo step. */
function recordChange() {
  clearTimeout(recordTimer);
  recordTimer = setTimeout(commitHistory, 350);
}
function commitHistory() {
  clearTimeout(recordTimer); recordTimer = null;
  history.push(snapshot());
  if (history.length > UNDO_CAP + 1) history.shift();
  future = [];
  renderHud();
}
function applySnapshot(snap) {
  const oldHexes = S.atlas.hexes || {};
  S.atlas.name = snap.name; S.atlas.cols = snap.cols; S.atlas.rows = snap.rows; S.atlas.hexMiles = snap.hexMiles;
  S.atlas.markers = clone(snap.markers);
  S.atlas.customTables = clone(snap.customTables || {}); setTableOverrides(S.atlas.customTables);
  const newHexes = clone(snap.hexes);
  S.atlas.hexes = newHexes;
  if (S.dir) { // write only the hex files that changed; delete removed ones
    const ids = new Set([...Object.keys(oldHexes), ...Object.keys(newHexes)]);
    ids.forEach((id) => {
      const o = oldHexes[id], n = newHexes[id];
      if (n && (!o || serializeHex(o) !== serializeHex(n))) store.saveHex(S.dir, n).catch(() => {});
      else if (!n && o) store.removeHex(S.dir, id).catch(() => {});
    });
    store.saveConfig(S.dir, S.atlas).catch(() => {});
  }
  saveLocal();
  nameInput.value = S.atlas.name || '';
  if (S.selected && !getHex(S.atlas, S.selected)) { /* keep selection; inspector shows a blank */ }
  renderMap(); applyView(); renderInspector(); renderHud();
}
function undo() {
  if (recordTimer) commitHistory();
  if (history.length < 2) { toast('Nothing to undo'); return; }
  future.push(history.pop());
  applySnapshot(history[history.length - 1]);
  toast('Undo');
}
function redo() {
  if (!future.length) { toast('Nothing to redo'); return; }
  const snap = future.pop();
  history.push(snap);
  applySnapshot(snap);
  toast('Redo');
}

// ---- inspector ------------------------------------------------------------

function setSelected(id) {
  S.selected = id;
  drawOverlay();
  renderInspector();
}

function renderInspector() {
  if (!S.selected) {
    inspectorEl.innerHTML =
      `<div class="insp-empty"><h3>No hex selected</h3>` +
      `<p>Click a hex to survey it. Then:</p>` +
      `<ul>` +
      `<li><b>Generate (WAG)</b> rolls the whole hex — weather, feature, sign, encounter, discovery.</li>` +
      `<li>The <b>terrain</b> auto-sets the icon; paint terrain with the brush, or set it here.</li>` +
      `<li>Re-roll any single line with its die.</li>` +
      `<li>Add a <b>Site</b> or <b>Settlement</b> for the discovered layer.</li>` +
      `<li>Keep GM <b>notes</b> in Markdown at the bottom.</li>` +
      `</ul></div>`;
    return;
  }
  const id = S.selected;
  const h = getHex(S.atlas, id) || emptyHex(id);
  const locked = !!h.canon; // canon hexes: notes + WAG rolls only (backlog 2)
  const wagLine = (key, tag) => {
    const has = !!h[key];
    const text = key === 'feature'
      ? (has ? `${escapeHtml(h.feature)}${h.featureDesc ? ` — <em>${escapeHtml(h.featureDesc)}</em>` : ''}` : '—')
      : (has ? escapeHtml(h[key]) : '—');
    return `<div class="wagline ${has ? '' : 'empty'}">` +
      `<div class="wl-head">${tableTag(tag, TABLE_FOR[key])}` +
      `<span class="wl-roll"><button class="iconbtn" data-action="reroll" data-field="${key}" title="Re-roll">${dieGlyph({ size: 15 })}</button></span></div>` +
      `<div class="wl-text">${text}</div></div>`;
  };

  inspectorEl.innerHTML =
    `<div class="insp-head">` +
      `<div class="row"><span class="hid">Hex ${id}</span>` +
      (h.canon ? `<span class="canon-tag">canon 🔒</span>` : '') +
      `<span class="terr">${h.terrain || 'unsurveyed'}</span></div>` +
      `<input class="insp-name" name="hexname" type="text" placeholder="Name this hex (optional)" value="${escapeHtml(h.name || '')}" ${locked ? 'disabled' : ''} />` +
    `</div>` +
    `<div class="insp-body">` +
      (locked ? `<div class="lock-note">Canon hex — its name, terrain, and places are fixed. You can still roll the WAG survey and take notes.</div>` : '') +
      `<div class="two-col">` +
        `<div class="field"><label>Region</label><select name="region" ${locked ? 'disabled' : ''}>` +
          REGIONS.map((r) => `<option ${r.name === (h.region || 'Unassigned') ? 'selected' : ''}>${r.name}</option>`).join('') +
        `</select></div>` +
        `<div class="field"><label>Terrain</label><select name="terrain" ${locked ? 'disabled' : ''}>` +
          `<option value="" ${!h.terrain ? 'selected' : ''}>— unsurveyed —</option>` +
          TERRAINS.map((t) => `<option ${t.key === h.terrain ? 'selected' : ''}>${t.key}</option>`).join('') +
        `</select></div>` +
      `</div>` +

      `<div class="gen-row">` +
        `<button class="btn primary" data-action="generate">${dieGlyph({ size: 15 })} Generate (WAG)</button>` +
        (locked ? '' : `<button class="btn" data-action="roll-terrain" title="Roll a terrain for this region">Roll terrain</button>`) +
      `</div>` +

      WAG_LINES.map((l) => wagLine(l.key, l.tag)).join('') +

      placesBlock(h, 'settlement', locked) +
      placesBlock(h, 'site', locked) +

      (locked ? '' :
        `<div class="field"><span class="field-label">Icon <button class="btn small ghost" data-action="icon-auto" title="Match the terrain">auto</button></span>` +
        `<div class="icon-picker">` +
          Object.keys(TERRAIN_ICONS).map((k) =>
            `<button class="icon-opt ${h.icon === k ? 'active' : ''}" data-action="icon" data-icon="${k}" title="${TERRAIN_ICONS[k].label}">${terrainGlyph(k, { size: 24 })}</button>`).join('') +
        `</div></div>`) +

      notesBlock(h) +

      `<div class="danger-row">` +
        `<button class="btn small" data-action="copy" title="Copy the Markdown stat-block">Copy stat-block</button>` +
        (locked ? '' : `<button class="btn small danger" data-action="clear" title="Erase this hex">Clear hex</button>`) +
      `</div>` +
    `</div>`;

  // Reflect the just-rendered notes tab.
  syncNotesTab();
}

// Sites and settlements are arrays of named, editable places (backlog 9 + 12). A
// card per entry: an editable name, editable rolled lines, a die to re-roll the
// lines (keeps the name), and Remove. Add either a rolled one or a blank to fill
// in by hand. On a canon hex everything is read-only.
// Which editable table (backlog 4) backs each survey line / place field. Lines
// whose tag maps to a table get a clickable, editable label.
const TABLE_FOR = { weather: 'weather', sign: 'sign', discovery: 'discovery' };
function tableTag(label, tableKey) {
  return tableKey
    ? `<button class="wl-tag wl-tag-btn" data-action="edit-table" data-table="${tableKey}" title="Edit this table — add your own results">${label}</button>`
    : `<span class="wl-tag">${label}</span>`;
}
const PLACE_FIELDS = {
  site: [['Type · Table I', 'type', 'siteType'], ['Condition · Table J', 'condition', 'siteCondition'], ['Opposition · Table K', 'opposition', 'opposition'], ['Treasure · Table L', 'treasure', 'treasure']],
  settlement: [['Type · Table G', 'type', 'settlementType'], ['Conflict or Hook · Table H', 'conflict', 'settlementConflict']],
};
function placesBlock(h, kind, locked) {
  const arr = kind === 'site' ? (h.sites || []) : (h.settlements || []);
  const Label = kind === 'site' ? 'Site' : 'Settlement';
  const tables = kind === 'site' ? 'I–L' : 'G–H';
  if (!arr.length && locked) return '';
  let cards = '';
  arr.forEach((s, i) => {
    const die = locked ? '' : `<button class="iconbtn" data-action="reroll-${kind}" data-idx="${i}" title="Re-roll the lines (keeps the name)">${dieGlyph({ size: 15 })}</button>`;
    const rm = locked ? '' : `<button class="iconbtn danger" data-action="rm-${kind}" data-idx="${i}" title="Remove">✕</button>`;
    const name = `<input class="place-name" data-place="${kind}" data-idx="${i}" data-field="name" value="${escapeHtml(s.name || '')}" placeholder="${Label} name" ${locked ? 'disabled' : ''}/>`;
    let lines = '';
    PLACE_FIELDS[kind].forEach(([lab, f, tkey]) => {
      lines += `<div class="place-line">${tableTag(lab, tkey)}` +
        `<textarea class="place-field" rows="2" data-place="${kind}" data-idx="${i}" data-field="${f}" placeholder="—" ${locked ? 'readonly' : ''}>${escapeHtml(s[f] || '')}</textarea></div>`;
    });
    cards += `<div class="subblock place"><div class="place-head">${name}<span class="sp">${die}${rm}</span></div>${lines}</div>`;
  });
  const add = locked ? '' :
    `<div class="place-add">` +
    `<button class="btn small" data-action="add-${kind}">＋ Roll ${Label.toLowerCase()} (${tables})</button>` +
    `<button class="btn small ghost" data-action="add-${kind}-blank">＋ Blank</button></div>`;
  const title = arr.length > 1 ? `${Label}s` : Label;
  return `<div class="place-section"><div class="place-title">${title}</div>${cards}${add}</div>`;
}

function notesBlock(h) {
  return `<div class="notes-head"><h4>Notes</h4>` +
    `<div class="tabs"><button class="tab ${S.notesTab === 'write' ? 'active' : ''}" data-tab="write">Write</button>` +
    `<button class="tab ${S.notesTab === 'preview' ? 'active' : ''}" data-tab="preview">Preview</button></div></div>` +
    `<textarea id="notes-edit" name="notes" placeholder="GM notes — Markdown. Read-aloud, secrets, faction ties…">${escapeHtml(h.notes || '')}</textarea>` +
    `<div class="notes-preview md" id="notes-preview"></div>`;
}

function syncNotesTab() {
  const ta = $('#notes-edit'); const pv = $('#notes-preview');
  if (!ta || !pv) return;
  const write = S.notesTab === 'write';
  ta.style.display = write ? '' : 'none';
  pv.style.display = write ? 'none' : '';
  if (!write) pv.innerHTML = mdRender(ta.value);
}

// ---- inspector actions ----------------------------------------------------

function onInspectorClick(e) {
  const btn = e.target.closest('[data-action],[data-tab]');
  if (!btn || !S.selected) return;
  const id = S.selected;
  const tab = btn.dataset.tab;
  if (tab) { S.notesTab = tab; document.querySelectorAll('.notes-head .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab)); syncNotesTab(); return; }

  const act = btn.dataset.action;
  if (act === 'edit-table') { openTableEditor(btn.dataset.table); return; } // global; allowed on canon too
  const h = getHex(S.atlas, id) || emptyHex(id);
  const locked = !!h.canon;
  // On a canon hex only the WAG survey lines and notes may change — refuse every
  // structural action, including the place add/remove/re-roll (backlog 2).
  if (locked && act !== 'generate' && act !== 'copy' && !(act === 'reroll' && ['weather', 'feature', 'sign', 'encounter', 'discovery'].includes(btn.dataset.field))) return;
  const idx = btn.dataset.idx != null ? +btn.dataset.idx : -1;
  switch (act) {
    case 'generate': {
      const hx = ensureHex(S.atlas, id);
      if (!hx.terrain) hx.terrain = rollTerrainForHex(hx.region || 'Unassigned', neighbourTerrainsOf(id));
      Object.assign(hx, generateHex(hx.terrain)); // survey lines only; never touches places
      if (!locked) applyTerrainIcon(hx);
      commit(id); break;
    }
    case 'roll-terrain': {
      const hx = ensureHex(S.atlas, id);
      hx.terrain = rollTerrainForHex(hx.region || 'Unassigned', neighbourTerrainsOf(id));
      applyTerrainIcon(hx);
      commit(id); break;
    }
    case 'reroll': {
      const hx = ensureHex(S.atlas, id);
      const r = rerollField(btn.dataset.field, hx.terrain || 'Plains');
      if (typeof r === 'string') hx[btn.dataset.field] = r; else Object.assign(hx, r);
      commit(id); break;
    }
    case 'add-site': { ensureHex(S.atlas, id).sites.push(rollSite()); commit(id); break; }
    case 'add-site-blank': { ensureHex(S.atlas, id).sites.push(emptySite()); commit(id); break; }
    case 'rm-site': { const a = ensureHex(S.atlas, id).sites; if (idx >= 0) a.splice(idx, 1); commit(id); break; }
    case 'reroll-site': { const s = ensureHex(S.atlas, id).sites[idx]; if (s) Object.assign(s, rollSiteFields()); commit(id); break; }
    case 'add-settlement': { ensureHex(S.atlas, id).settlements.push(rollSettlement()); commit(id); break; }
    case 'add-settlement-blank': { ensureHex(S.atlas, id).settlements.push(emptySettlement()); commit(id); break; }
    case 'rm-settlement': { const a = ensureHex(S.atlas, id).settlements; if (idx >= 0) a.splice(idx, 1); commit(id); break; }
    case 'reroll-settlement': { const s = ensureHex(S.atlas, id).settlements[idx]; if (s) Object.assign(s, rollSettlementFields()); commit(id); break; }
    case 'icon': { const hx = ensureHex(S.atlas, id); hx.icon = btn.dataset.icon; hx.iconPinned = true; commit(id); break; }
    case 'icon-auto': { const hx = ensureHex(S.atlas, id); hx.iconPinned = false; applyTerrainIcon(hx); commit(id); break; }
    case 'copy': navigator.clipboard?.writeText(serializeHex(h)).then(() => toast('Stat-block copied')).catch(() => toast('Copy failed', true)); break;
    case 'clear':
      if (confirm(`Clear hex ${id}? This deletes its file.`)) { eraseHex(id); }
      break;
  }
}

/** Apply a structural change: persist, repaint the hex, re-render the inspector. */
function commit(id) {
  persistHex(id);
  refreshHex(id);
  renderInspector();
  renderHud();
  recordChange();
}

function onInspectorChange(e) {
  const t = e.target;
  if (!S.selected) return;
  const id = S.selected;
  const cur = getHex(S.atlas, id);
  if (cur && cur.canon) return; // region/terrain are fixed on canon hexes
  if (t.name === 'region') { const hx = ensureHex(S.atlas, id); hx.region = t.value; commit(id); }
  else if (t.name === 'terrain') { const hx = ensureHex(S.atlas, id); hx.terrain = t.value; applyTerrainIcon(hx); commit(id); }
}

function onInspectorInput(e) {
  const t = e.target;
  if (!S.selected) return;
  const id = S.selected;
  if (t.dataset && t.dataset.place) {
    const cur = getHex(S.atlas, id);
    if (cur && cur.canon) return; // places are fixed on canon hexes
    const hx = ensureHex(S.atlas, id);
    const arr = t.dataset.place === 'site' ? hx.sites : hx.settlements;
    const i = +t.dataset.idx;
    if (arr && arr[i]) {
      arr[i][t.dataset.field] = t.value;
      persistHexDebounced(id);
      clearTimeout(saveTimers['badge-' + id]);
      saveTimers['badge-' + id] = setTimeout(() => refreshHex(id), 400); // badge may appear/vanish
      recordChange();
    }
    return;
  }
  if (t.name === 'notes') {
    const hx = ensureHex(S.atlas, id); hx.notes = t.value;
    persistHexDebounced(id);
    recordChange();
  } else if (t.name === 'hexname') {
    const cur = getHex(S.atlas, id);
    if (cur && cur.canon) return; // name is fixed on canon hexes
    const hx = ensureHex(S.atlas, id); hx.name = t.value;
    persistHexDebounced(id);
    clearTimeout(saveTimers['name-' + id]);
    saveTimers['name-' + id] = setTimeout(() => refreshHex(id), 400);
    recordChange();
  }
}

// ---- global events --------------------------------------------------------

function wireEvents() {
  wirePointer();

  inspectorEl.addEventListener('click', onInspectorClick);
  inspectorEl.addEventListener('change', onInspectorChange);
  inspectorEl.addEventListener('input', onInspectorInput);

  toolsEl.addEventListener('click', (e) => {
    const t = e.target.closest('.tool');
    if (t) setTool(t.dataset.tool);
  });

  hudEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const rect = mapEl.getBoundingClientRect();
    if (b.dataset.action === 'zoom-in') zoom(1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (b.dataset.action === 'zoom-out') zoom(1 / 1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (b.dataset.action === 'fit') fitView();
    if (b.dataset.action === 'undo') undo();
    if (b.dataset.action === 'redo') redo();
  });
  hudEl.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.hud === 'labels') { S.showLabels = el.checked; renderMap(); applyView(); }
    if (el.dataset.hud === 'brush-terrain') { S.brushTerrain = el.value; buildTools(); }
    if (el.dataset.hud === 'brush-region') { S.brushRegion = el.value; buildTools(); }
    if (el.dataset.hud === 'cols' || el.dataset.hud === 'rows') {
      const v = Math.max(1, Math.min(60, Math.round(Number(el.value)) || 1));
      S.atlas[el.dataset.hud] = v;
      renderMap(); fitView(); persistConfig(); renderHud(); recordChange();
    }
    if (el.dataset.hud === 'hexmiles') {
      S.atlas.hexMiles = Math.max(1, Math.min(100, Math.round(Number(el.value)) || 6));
      persistConfig(); renderHud(); recordChange();
    }
  });

  connEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action;
    if (a === 'theme') cycleTheme();
    if (a === 'new-folder') newFolder();
    if (a === 'open-folder') openFolder();
    if (a === 'export') exportBundle();
    if (a === 'import') importInput.click();
    if (a === 'random') randomMap();
    if (a === 'import-map') pickMapImage();
  });

  nameInput.addEventListener('input', () => {
    S.atlas.name = nameInput.value;
    clearTimeout(saveTimers['atlas-name']);
    saveTimers['atlas-name'] = setTimeout(persistConfig, 400);
    recordChange();
  });

  importInput.addEventListener('change', onImportFile);

  document.addEventListener('keydown', (e) => {
    // Escape closes the table editor even from within its inputs.
    if (e.key === 'Escape' && $('#modal')) { closeModal(); return; }
    // Undo / redo work everywhere except inside a text field (which keeps native undo).
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y')) {
      if (e.target.matches('input,textarea,select')) return;
      e.preventDefault();
      if (e.key === 'y' || e.shiftKey) redo(); else undo();
      return;
    }
    if (e.target.matches('input,textarea,select')) return;
    const map = { v: 'inspect', t: 'terrain', r: 'region', s: 'settlement', d: 'site', m: 'marker', e: 'erase' };
    if (map[e.key]) setTool(map[e.key]);
    if (e.key === 'g' && S.selected) { onInspectorClick({ target: mkFakeBtn('generate') }); }
    if (e.key === 'Escape') { if ($('#modal')) closeModal(); else setSelected(null); }
  });
}
function mkFakeBtn(action) {
  const b = document.createElement('button'); b.dataset.action = action;
  b.closest = () => b; return b;
}

// ---- folder open / new / import / export ----------------------------------

async function newFolder() {
  const withCanon = confirm('Seed this new atlas with the Hinterlands canon hexes (Fort Caspar and the five region anchors)?\n\nOK = yes, Cancel = start empty.');
  try {
    const { dir, atlas } = await store.createAtlasFolder(withCanon);
    S.dir = dir; S.atlas = atlas;
    afterLoad();
    toast('New atlas folder created.');
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    toast('Could not create folder: ' + err.message, true);
  }
}
async function randomMap() {
  if (!confirm(`Generate a new random terrain map (${S.atlas.cols}×${S.atlas.rows})?\n\nThis replaces the current atlas. Terrain is filled in coherently; every hex's survey content stays blank for you to roll.`)) return;
  S.atlas = createRandomAtlas(S.atlas.cols, S.atlas.rows);
  if (S.dir) { try { await store.saveAll(S.dir, S.atlas); } catch (err) { toast('Could not save: ' + err.message, true); } }
  afterLoad();
  toast('Random terrain map generated.');
}
async function openFolder() {
  try {
    const { dir, atlas } = await store.openAtlasFolder();
    S.dir = dir; S.atlas = atlas;
    afterLoad();
    toast('Atlas opened.');
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    toast('Could not open folder: ' + err.message, true);
  }
}
async function reconnect(handle) {
  try {
    if (!(await store.ensurePermission(handle))) { toast('Permission denied', true); return; }
    S.dir = handle; S.atlas = await store.readAtlas(handle);
    afterLoad();
    toast('Reconnected.');
  } catch (err) { toast('Reconnect failed: ' + err.message, true); }
}

function exportBundle() {
  const hexes = {};
  Object.values(S.atlas.hexes).forEach((h) => { if (isPopulated(h)) hexes[h.id] = h; });
  const data = { version: 1, config: { name: S.atlas.name, cols: S.atlas.cols, rows: S.atlas.rows, hexMiles: S.atlas.hexMiles, markers: S.atlas.markers || [], customTables: S.atlas.customTables || {} }, hexes };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (S.atlas.name || 'hinterlands-atlas').replace(/[^\w.-]+/g, '-') + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function onImportFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const b = JSON.parse(reader.result);
      const atlas = normalizeConfig(b.config);
      loadHexes(atlas, Object.values(b.hexes || {}));
      S.atlas = atlas;
      afterLoad();
      if (S.dir) store.saveAll(S.dir, atlas).catch(() => {});
      toast('Atlas imported.');
    } catch (err) { toast('Import failed: ' + err.message, true); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ---- landing / first run --------------------------------------------------

function showLanding(opts) {
  removeLanding();
  const supported = store.supported();
  const card = document.createElement('div');
  card.className = 'landing';
  card.id = 'landing';
  let actions = '';
  if (opts.reconnect) {
    actions = `<button class="btn primary" data-l="reconnect">Reconnect atlas folder</button>` +
      `<button class="btn" data-l="open">Open a different folder</button>`;
  } else if (supported) {
    actions = `<button class="btn primary" data-l="new">New atlas folder</button>` +
      `<button class="btn" data-l="open">Open atlas folder</button>`;
  } else {
    actions = `<button class="btn primary" data-l="memory">Start in this browser</button>` +
      `<button class="btn" data-l="import">Import a .json</button>`;
  }
  card.innerHTML =
    `<div class="landing-card">` +
      `<h1>td10 Atlas</h1>` +
      `<p class="lede">A little hex-atlas maker for Tiny&nbsp;d10. Survey hexes with the <b>Worldwide Adventure Generator</b>, ` +
      `let terrain set each hex's icon, and keep your notes in Markdown. Your map is a real folder of files you own — ` +
      `one Markdown stat-block per hex.</p>` +
      `<div class="actions">${actions}</div>` +
      (supported
        ? `<p class="fine">Pick an empty folder for a new atlas, or open one you made before. Files are written straight to that folder by the browser — nothing leaves your machine.</p>`
        : `<p class="fine">This browser can't open local folders (that needs Chrome or Edge). You can still work here — the map is kept in this browser and you can Export / Import a <code>.json</code> backup.</p>`) +
    `</div>`;
  mapWrap.appendChild(card);
  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-l]');
    if (!b) return;
    const a = b.dataset.l;
    if (a === 'new') newFolder();
    if (a === 'open') openFolder();
    if (a === 'reconnect') reconnect(opts.reconnect);
    if (a === 'import') importInput.click();
    if (a === 'memory') { startInMemory('Started in-browser. Export often to keep a backup.'); }
  });
}
function removeLanding() { const l = $('#landing'); if (l) l.remove(); }

// ---- WAG table editor (backlog 4) -----------------------------------------
// Clicking a result card's table label opens this. Edit rows, add your own, or
// reset to default; changes are per-atlas (atlas.json) and feed straight into
// rolling. New rows weigh 1 (reachable) while default rows keep their 1d10 odds.
let tableEdit = null; // { key, rows:[{name,desc}] } while open, else null
let tableTimer = null;

function tableLabel(key) { return (EDITABLE_TABLES.find((t) => t.key === key) || {}).label || key; }

function openTableEditor(key) {
  if (!EDITABLE_TABLES.some((t) => t.key === key)) return;
  const cur = S.atlas.customTables && S.atlas.customTables[key];
  const rows = (Array.isArray(cur) && cur.length ? cur : defaultTable(key)).map((r) => ({ name: r.name || '', desc: r.desc || '' }));
  tableEdit = { key, rows };
  renderTableModal();
}
function renderTableModal() {
  let el = $('#modal');
  if (!el) {
    el = document.createElement('div'); el.id = 'modal'; el.className = 'modal';
    document.body.appendChild(el);
    el.addEventListener('click', onModalClick);
    el.addEventListener('input', onModalInput);
  }
  if (!tableEdit) { el.remove(); return; }
  const isCustom = !!(S.atlas.customTables && S.atlas.customTables[tableEdit.key]);
  const rows = tableEdit.rows.map((r, i) =>
    `<div class="trow"><span class="tnum">${i + 1}</span>` +
    `<input class="tname" data-i="${i}" data-f="name" value="${escapeHtml(r.name)}" placeholder="Result name" />` +
    `<textarea class="tdesc" data-i="${i}" data-f="desc" rows="2" placeholder="Description (optional)">${escapeHtml(r.desc)}</textarea>` +
    `<button class="iconbtn danger" data-mact="del" data-i="${i}" title="Delete row">✕</button></div>`).join('');
  el.innerHTML =
    `<div class="modal-card" role="dialog" aria-label="Edit table">` +
      `<div class="modal-head"><h3>${escapeHtml(tableLabel(tableEdit.key))}${isCustom ? ' <span class="custom-tag">customised</span>' : ''}</h3>` +
      `<button class="btn small" data-mact="close">Done</button></div>` +
      `<p class="modal-note">Edit results or add your own — they feed straight into rolling and re-rolling, and are saved with this atlas.</p>` +
      `<div class="trows">${rows || '<p class="modal-note">No rows — add one.</p>'}</div>` +
      `<div class="modal-foot"><button class="btn small" data-mact="add">＋ Add row</button>` +
      `<button class="btn small ghost" data-mact="reset" title="Restore the built-in table">Reset to default</button></div>` +
    `</div>`;
}
function onModalClick(e) {
  const b = e.target.closest('[data-mact]');
  const act = b && b.dataset.mact;
  // import-map modal actions (no tableEdit)
  if (act === 'imp-cancel') { importImg = null; const el = $('#modal'); if (el) el.remove(); return; }
  if (act === 'imp-go') { doImportMap(+($('#imp-cols') ? $('#imp-cols').value : 26) || 26); return; }
  if (e.target.id === 'modal') { if (importImg) { importImg = null; e.currentTarget.remove(); } else closeModal(); return; } // backdrop
  if (!b || !tableEdit) return;
  if (act === 'close') { closeModal(); return; }
  if (act === 'add') { tableEdit.rows.push({ name: '', desc: '' }); commitTable(); renderTableModal(); return; }
  if (act === 'del') { tableEdit.rows.splice(+b.dataset.i, 1); commitTable(); renderTableModal(); return; }
  if (act === 'reset') { tableEdit.rows = defaultTable(tableEdit.key).map((r) => ({ name: r.name, desc: r.desc })); commitTable(); renderTableModal(); }
}
function onModalInput(e) {
  const t = e.target;
  if (!tableEdit || t.dataset.i == null || !t.dataset.f) return;
  const i = +t.dataset.i;
  if (tableEdit.rows[i]) { tableEdit.rows[i][t.dataset.f] = t.value; clearTimeout(tableTimer); tableTimer = setTimeout(commitTable, 300); }
}
function commitTable() {
  clearTimeout(tableTimer); tableTimer = null;
  if (!tableEdit) return;
  const key = tableEdit.key;
  const rows = tableEdit.rows.map((r) => ({ name: (r.name || '').trim(), desc: (r.desc || '').trim() })).filter((r) => r.name || r.desc);
  const def = defaultTable(key).map((r) => ({ name: r.name, desc: r.desc }));
  S.atlas.customTables = S.atlas.customTables || {};
  if (!rows.length || JSON.stringify(rows) === JSON.stringify(def)) delete S.atlas.customTables[key];
  else S.atlas.customTables[key] = rows;
  setTableOverrides(S.atlas.customTables);
  persistConfig();
  recordChange();
}
function closeModal() {
  if (tableTimer) commitTable();
  tableEdit = null;
  const el = $('#modal'); if (el) el.remove();
  renderInspector(); // refresh the "customised" hints on the tags
}

// ---- import a map image → native hexes (backlog 6) ------------------------
// Sample the image per hex and give each hex the nearest terrain by colour. A
// general version of the Hinterlands conversion (scripts/gen-seed.mjs): terrain
// only, content blank, refine with the paint brush after. Reference palette is
// the WAG terrain-key hues; unmatched-dark (ink lines) leaves a hex blank.
const IMPORT_PALETTE = [
  { rgb: [110, 154, 154], t: 'Ocean or Coast' }, { rgb: [63, 121, 176], t: 'Ocean or Coast' },
  { rgb: [79, 143, 74], t: 'Forest or Jungle' }, { rgb: [40, 90, 50], t: 'Forest or Jungle' },
  { rgb: [159, 191, 99], t: 'Plains' }, { rgb: [120, 160, 90], t: 'Plains' },
  { rgb: [138, 106, 69], t: 'Hills or Mountains' }, { rgb: [150, 150, 150], t: 'Hills or Mountains' },
  { rgb: [217, 192, 127], t: 'Desert' }, { rgb: [169, 196, 214], t: 'Tundra' },
  { rgb: [245, 245, 245], t: 'Plains' }, { rgb: [20, 20, 20], t: '' },
];
function classifyColour(r, g, b) {
  let best = IMPORT_PALETTE[0], bd = Infinity;
  for (const p of IMPORT_PALETTE) { const d = (p.rgb[0] - r) ** 2 + (p.rgb[1] - g) ** 2 + (p.rgb[2] - b) ** 2; if (d < bd) { bd = d; best = p; } }
  return best.t;
}
let importImg = null;
function pickMapImage() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => openImportModal(img);
    img.onerror = () => toast('Could not read that image', true);
    img.src = URL.createObjectURL(file);
  };
  inp.click();
}
function openImportModal(img) {
  importImg = img;
  let el = $('#modal');
  if (!el) { el = document.createElement('div'); el.id = 'modal'; el.className = 'modal'; document.body.appendChild(el); el.addEventListener('click', onModalClick); el.addEventListener('input', onModalInput); }
  el.innerHTML =
    `<div class="modal-card"><div class="modal-head"><h3>Import map → hexes</h3><button class="btn small" data-mact="imp-cancel">Cancel</button></div>` +
    `<p class="modal-note">Each hex is sampled and given the nearest terrain — teal → coast, greens → forest / plains, brown &amp; grey → hills, tan → desert, pale blue → tundra. Survey content stays blank; refine terrain with the paint brush afterward.</p>` +
    `<div style="padding:10px 18px;text-align:center"><img id="imp-preview" alt="map preview" style="max-width:100%;max-height:42vh;border:1px solid var(--line);border-radius:8px" /></div>` +
    `<div class="modal-foot"><label>Columns <input type="number" id="imp-cols" min="4" max="60" value="26" style="width:56px" /></label>` +
    `<button class="btn primary" data-mact="imp-go">Convert to hexes</button></div></div>`;
  el.querySelector('#imp-preview').src = img.src;
}
function convertImageToAtlas(img, cols) {
  const maxW = 1000, scale = Math.min(1, maxW / img.naturalWidth);
  const W = Math.max(1, Math.round(img.naturalWidth * scale)), H = Math.max(1, Math.round(img.naturalHeight * scale));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H).data;
  cols = Math.max(4, Math.min(60, cols | 0));
  const rows = Math.max(2, Math.min(60, Math.round(cols * 0.8660254 * H / W)));
  const size = 10, bw = size * 1.5 * (cols - 1) + size * 3, bh = size * Math.sqrt(3) * (rows + 0.5) + size;
  const at = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
  const a = createAtlas(); a.name = 'Imported Map'; a.cols = cols; a.rows = rows;
  const hexes = {};
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const ct = hexCenter(c, r, size);
      const ix = Math.min(W - 1, Math.max(0, Math.round(ct.x / bw * W))), iy = Math.min(H - 1, Math.max(0, Math.round(ct.y / bh * H)));
      let R = 0, G = 0, B = 0, n = 0;
      for (let dx = -2; dx <= 2; dx += 2) for (let dy = -2; dy <= 2; dy += 2) {
        const [rr, gg, bb] = at(Math.min(W - 1, Math.max(0, ix + dx)), Math.min(H - 1, Math.max(0, iy + dy))); R += rr; G += gg; B += bb; n++;
      }
      const terr = classifyColour(R / n, G / n, B / n);
      if (!terr) continue;
      const id = hexId(c, r), h = emptyHex(id); h.terrain = terr; applyTerrainIcon(h); hexes[id] = h;
    }
  }
  a.hexes = hexes;
  return a;
}
async function doImportMap(cols) {
  const img = importImg; importImg = null;
  const el = $('#modal'); if (el) el.remove();
  if (!img) return;
  S.atlas = convertImageToAtlas(img, cols);
  if (S.dir) { try { await store.saveAll(S.dir, S.atlas); } catch (e) { toast('Could not save: ' + e.message, true); } }
  afterLoad();
  toast(`Imported → ${Object.keys(S.atlas.hexes).length} hexes.`);
}

// ---- toast + small utils --------------------------------------------------

let toastTimer;
function toast(msg, isErr) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 2600);
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeXml(s) { return escapeHtml(s); }
function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
// A stable per-hex value in [-0.05, +0.05] from its id — for a natural fill jitter.
function hexJitter(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ((h % 100) / 100 - 0.5) * 0.10;
}

// ---- go ---------------------------------------------------------------------

boot();
