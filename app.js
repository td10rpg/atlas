// app.js — td10 Atlas.
//
// Boots the atlas (reconnecting to your folder if it can), renders the hex map as
// SVG, and drives the per-hex inspector where the WAG populates a hex and sets its
// icon from the terrain. Storage is a folder of Markdown files (see storage.js);
// a localStorage mirror is kept as a safety net and for browsers without the File
// System Access API. No dependencies, no build step.

import {
  createStarterAtlas, createAtlas, getHex, ensureHex, applyTerrainIcon,
  REGIONS, generateHex, rollTerrain, normalizeConfig, loadHexes,
} from './map.js';
import { TERRAINS, rerollField, rollSite, rollSettlement } from './wag.js';
import {
  hexId, hexCenter, hexPoints, boardSize, isPopulated, hasSite, hasSettlement,
  emptyHex, serializeHex,
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
  view: { x: 0, y: 0, w: 100, h: 100 },
};

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
  renderShell();
  renderMap();
  fitView();
  renderInspector();
  saveLocal();
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
    `<label><input type="checkbox" data-hud="labels" ${S.showLabels ? 'checked' : ''}/> labels</label>` +
    `<span class="sep2">|</span> Map ` +
    `<input type="number" data-hud="cols" min="1" max="60" value="${S.atlas.cols}" style="width:46px" title="columns"/>×` +
    `<input type="number" data-hud="rows" min="1" max="60" value="${S.atlas.rows}" style="width:46px" title="rows"/>` +
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
  const terrColor = rec && rec.terrain ? TERRAIN_COLOR[rec.terrain] : null;
  const fill = terrColor || 'var(--hex-blank)';
  const fillOp = terrColor ? '0.32' : '1';

  const cls = 'hex' + (rec && rec.canon ? ' canon' : '');
  let inner = `<polygon points="${pts}" fill="${fill}" fill-opacity="${fillOp}" stroke="${stroke}"/>`;

  if (rec && rec.icon) {
    const gs = SIZE * 0.86;
    const gx = cx - gs / 2, gy = cy - gs / 2 - (rec.name ? 3 : 0);
    inner += `<g class="glyph" transform="translate(${gx.toFixed(1)},${gy.toFixed(1)})" style="color:${terrColor || 'var(--ink)'}">` +
      terrainGlyph(rec.icon, { size: gs }) + `</g>`;
  }
  if (rec && hasSettlement(rec)) {
    inner += badge(cx + SIZE * 0.34, cy - SIZE * 0.5, 'settlement', '#d8b25a');
  }
  if (rec && hasSite(rec)) {
    inner += badge(cx - SIZE * 0.62, cy - SIZE * 0.5, 'site', '#c98a8a');
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

function badge(x, y, kind, color) {
  const s = SIZE * 0.42;
  return `<g transform="translate(${(x - s / 2).toFixed(1)},${(y - s / 2).toFixed(1)})" style="color:${color}">` +
    `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 + 1}" fill="var(--map-bg)" stroke="${color}" stroke-width="0.8"/>` +
    `<g transform="translate(${s * 0.16},${s * 0.16}) scale(${(s * 0.68 / 24).toFixed(3)})">` +
    overlayGlyph(kind, { size: 24 }) + `</g></g>`;
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
  // Overlay layer sits above every hex — selection outline (and, later, markers)
  // live here so nothing overpaints them and z-order is deterministic.
  mapEl.innerHTML = `<g id="hex-layer">${cells}</g><g id="overlay"></g>`;
  mapEl.dataset.bw = w; mapEl.dataset.bh = h;
  drawSelection();
}

function refreshHex(id) {
  const node = mapEl.querySelector(`.hex[data-id="${id}"]`);
  if (!node) return;
  const { col, row } = parseId(id);
  node.outerHTML = buildHex(col, row);
}

// The active-hex highlight: a single inset polygon in the overlay, drawn last, with
// a non-scaling stroke — so it never doubles up on the shared hex edge (backlog 13).
function drawSelection() {
  const ov = mapEl.querySelector('#overlay');
  if (!ov) return;
  if (!S.selected) { ov.innerHTML = ''; return; }
  const { col, row } = parseId(S.selected);
  const { x, y } = hexCenter(col, row, SIZE);
  ov.innerHTML = `<polygon class="sel-outline" points="${hexPoints(x, y, SIZE - 2.6)}"/>`;
}

function parseId(id) {
  return { col: parseInt(id.slice(0, 2), 10) - 1, row: parseInt(id.slice(2), 10) - 1 };
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
    const paintTool = S.tool !== 'inspect';
    pointer = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, downId, moved: false, mode: (paintTool && downId) ? 'paint' : 'pan', last: downId };
    if (pointer.mode === 'paint') { paintHex(downId, true); mapEl.classList.add('grabbing'); }
    else mapEl.classList.add('grabbing');
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
  const existing = getHex(S.atlas, id);
  if (existing && existing.canon) {
    if (allowToggle) toast('Canon hex is locked — roll the WAG or edit notes in the inspector.');
    return;
  }
  switch (S.tool) {
    case 'terrain': mutate(id, (h) => { h.terrain = S.brushTerrain; applyTerrainIcon(h); }); break;
    case 'region': mutate(id, (h) => { h.region = S.brushRegion; }); break;
    case 'settlement': mutate(id, (h) => { if (hasSettlement(h)) { if (allowToggle) clearSettlement(h); } else Object.assign(h, rollSettlement()); }); break;
    case 'site': mutate(id, (h) => { if (hasSite(h)) { if (allowToggle) clearSite(h); } else Object.assign(h, rollSite()); }); break;
    case 'erase': eraseHex(id); break;
  }
}

function clearSite(h) { h.siteType = h.siteCondition = h.siteOpposition = h.siteTreasure = ''; }
function clearSettlement(h) { h.settlementType = h.settlementConflict = ''; }

/** Ensure the hex, mutate it, then persist + repaint + refresh the inspector. */
function mutate(id, fn) {
  const h = ensureHex(S.atlas, id);
  fn(h);
  persistHex(id);
  refreshHex(id);
  if (S.selected === id) renderInspector();
  renderHud();
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
      config: { name: S.atlas.name, cols: S.atlas.cols, rows: S.atlas.rows, hexMiles: S.atlas.hexMiles },
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

// ---- inspector ------------------------------------------------------------

function setSelected(id) {
  S.selected = id;
  drawSelection();
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
      `<div class="wl-head"><span class="wl-tag">${tag}</span>` +
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

      siteBlock(h, locked) +
      settlementBlock(h, locked) +

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

function siteBlock(h, locked) {
  if (!hasSite(h)) {
    return locked ? '' : `<button class="btn small" data-action="add-site" style="margin:2px 0 12px">＋ Add site (Tables I–L)</button>`;
  }
  const die = locked ? '' : `<span class="wl-roll"><button class="iconbtn" data-action="reroll" data-field="site" title="Re-roll the site">${dieGlyph({ size: 15 })}</button></span>`;
  const line = (label, field) =>
    `<div class="wagline"><div class="wl-head"><span class="wl-tag">${label}</span>${die}</div>` +
    `<div class="wl-text">${escapeHtml(h[field] || '—')}</div></div>`;
  const rm = locked ? '' : `<span class="sp"><button class="btn small danger" data-action="rm-site">Remove</button></span>`;
  return `<div class="subblock"><h4>Site ${rm}</h4>` +
    line('Type · Table I', 'siteType') +
    line('Condition · Table J', 'siteCondition') +
    line('Opposition · Table K', 'siteOpposition') +
    line('Treasure · Table L', 'siteTreasure') +
    `</div>`;
}

function settlementBlock(h, locked) {
  if (!hasSettlement(h)) {
    return locked ? '' : `<button class="btn small" data-action="add-settlement" style="margin:2px 0 12px">＋ Add settlement (Tables G–H)</button>`;
  }
  const die = locked ? '' : `<span class="wl-roll"><button class="iconbtn" data-action="reroll" data-field="settlement" title="Re-roll the settlement">${dieGlyph({ size: 15 })}</button></span>`;
  const line = (label, field) =>
    `<div class="wagline"><div class="wl-head"><span class="wl-tag">${label}</span>${die}</div>` +
    `<div class="wl-text">${escapeHtml(h[field] || '—')}</div></div>`;
  const rm = locked ? '' : `<span class="sp"><button class="btn small danger" data-action="rm-settlement">Remove</button></span>`;
  return `<div class="subblock"><h4>Settlement ${rm}</h4>` +
    line('Type · Table G', 'settlementType') +
    line('Conflict or Hook · Table H', 'settlementConflict') +
    `</div>`;
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
  const h = getHex(S.atlas, id) || emptyHex(id);
  const locked = !!h.canon;
  // On a canon hex, only the WAG survey lines and notes may change — refuse the
  // structural actions and any site/settlement re-roll (backlog 2).
  const STRUCTURAL = ['roll-terrain', 'add-site', 'rm-site', 'add-settlement', 'rm-settlement', 'icon', 'icon-auto', 'clear'];
  if (locked && (STRUCTURAL.includes(act) || (act === 'reroll' && (btn.dataset.field === 'site' || btn.dataset.field === 'settlement')))) return;
  switch (act) {
    case 'generate': {
      const hx = ensureHex(S.atlas, id);
      if (!hx.terrain) hx.terrain = rollTerrain(hx.region || 'Unassigned');
      // Canon: only re-roll the survey lines; never touch the fixed places or icon.
      Object.assign(hx, generateHex(hx.terrain, { site: !locked && hasSite(hx), settlement: !locked && hasSettlement(hx) }));
      if (!locked) applyTerrainIcon(hx);
      commit(id); break;
    }
    case 'roll-terrain': {
      const hx = ensureHex(S.atlas, id);
      hx.terrain = rollTerrain(hx.region || 'Unassigned');
      applyTerrainIcon(hx);
      commit(id); break;
    }
    case 'reroll': {
      const hx = ensureHex(S.atlas, id);
      const r = rerollField(btn.dataset.field, hx.terrain || 'Plains');
      if (typeof r === 'string') hx[btn.dataset.field] = r; else Object.assign(hx, r);
      commit(id); break;
    }
    case 'add-site': { Object.assign(ensureHex(S.atlas, id), rollSite()); commit(id); break; }
    case 'rm-site': { clearSite(ensureHex(S.atlas, id)); commit(id); break; }
    case 'add-settlement': { Object.assign(ensureHex(S.atlas, id), rollSettlement()); commit(id); break; }
    case 'rm-settlement': { clearSettlement(ensureHex(S.atlas, id)); commit(id); break; }
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
  if (t.name === 'notes') {
    const hx = ensureHex(S.atlas, id); hx.notes = t.value;
    persistHexDebounced(id);
  } else if (t.name === 'hexname') {
    const cur = getHex(S.atlas, id);
    if (cur && cur.canon) return; // name is fixed on canon hexes
    const hx = ensureHex(S.atlas, id); hx.name = t.value;
    persistHexDebounced(id);
    clearTimeout(saveTimers['name-' + id]);
    saveTimers['name-' + id] = setTimeout(() => refreshHex(id), 400);
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
  });
  hudEl.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.hud === 'labels') { S.showLabels = el.checked; renderMap(); applyView(); }
    if (el.dataset.hud === 'brush-terrain') { S.brushTerrain = el.value; buildTools(); }
    if (el.dataset.hud === 'brush-region') { S.brushRegion = el.value; buildTools(); }
    if (el.dataset.hud === 'cols' || el.dataset.hud === 'rows') {
      const v = Math.max(1, Math.min(60, Math.round(Number(el.value)) || 1));
      S.atlas[el.dataset.hud] = v;
      renderMap(); fitView(); persistConfig(); renderHud();
    }
  });

  connEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action;
    if (a === 'new-folder') newFolder();
    if (a === 'open-folder') openFolder();
    if (a === 'export') exportBundle();
    if (a === 'import') importInput.click();
  });

  nameInput.addEventListener('input', () => {
    S.atlas.name = nameInput.value;
    clearTimeout(saveTimers['atlas-name']);
    saveTimers['atlas-name'] = setTimeout(persistConfig, 400);
  });

  importInput.addEventListener('change', onImportFile);

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input,textarea,select')) return;
    const map = { v: 'inspect', t: 'terrain', r: 'region', s: 'settlement', d: 'site', e: 'erase' };
    if (map[e.key]) setTool(map[e.key]);
    if (e.key === 'g' && S.selected) { onInspectorClick({ target: mkFakeBtn('generate') }); }
    if (e.key === 'Escape') setSelected(null);
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
  const data = { version: 1, config: { name: S.atlas.name, cols: S.atlas.cols, rows: S.atlas.rows, hexMiles: S.atlas.hexMiles }, hexes };
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

// ---- go ---------------------------------------------------------------------

boot();
