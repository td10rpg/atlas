// icons.js — the map's visual vocabulary.
//
// Two families. TERRAIN glyphs are the primary hex icon; they are *auto-set* from
// a hex's terrain (see hex.js › ICON_FOR_TERRAIN) but a user can override the
// choice. OVERLAY badges (settlement, site) sit in a corner of the hex when the
// WAG has placed one. All glyphs are inline SVG path data drawn on a 0..24 canvas,
// stroked with currentColor — no external files, so the strict CSP is satisfied.

// Each entry: a label (for the icon picker) and the inner SVG markup. Kept
// monochrome and simple so they read at hex size and tint with the terrain color.
export const TERRAIN_ICONS = {
  forest: {
    label: 'Pines',
    svg: '<path fill="currentColor" d="M12 3l-4 6h2.4L6.5 15H10v3h4v-3h3.5L14 9h2.4z"/><path d="M11 18h2v3h-2z" fill="currentColor" stroke="none"/>',
  },
  mountain: {
    label: 'Mountains',
    svg: '<path fill="currentColor" d="M2 20l6-12 3.6 7 2.4-4L22 20z"/>',
  },
  hills: {
    label: 'Hills',
    svg: '<path fill="currentColor" stroke="none" d="M1 20Q6.5 12 12 20Z"/><path fill="currentColor" stroke="none" d="M9.5 20Q15.5 12.5 22 20Z"/>',
  },
  plains: {
    label: 'Plains',
    svg: '<path d="M5 20v-5M5 15c0-2 1-3 1-3M5 15c0-2-1-3-1-3"/><path d="M12 20v-6M12 14c0-2 1.4-3.5 1.4-3.5M12 14c0-2-1.4-3.5-1.4-3.5"/><path d="M19 20v-5M19 15c0-2 1-3 1-3M19 15c0-2-1-3-1-3"/>',
  },
  swamp: {
    label: 'Wetlands',
    svg: '<path d="M4 20v-7M4 13l-1.5-1.5M4 13l1.5-1.5"/><path d="M11 20v-8M11 12l-1.5-1.5M11 12l1.5-1.5"/><path d="M18 20v-7M18 13l-1.5-1.5M18 13l1.5-1.5"/><path d="M3 20c2-1.4 3.6-1.4 5.5 0S12 21.4 14 20s3.6-1.4 5.5 0" fill="none"/>',
  },
  coast: {
    label: 'Coast / Ocean',
    svg: '<path d="M3 9c2-1.6 3.7-1.6 5.5 0S12 10.6 14 9s3.6-1.6 5.5 0"/><path d="M3 14c2-1.6 3.7-1.6 5.5 0S12 15.6 14 14s3.6-1.6 5.5 0"/><path d="M3 19c2-1.6 3.7-1.6 5.5 0S12 20.6 14 19s3.6-1.6 5.5 0"/>',
  },
  tundra: {
    label: 'Tundra',
    // A proper dendritic snowflake: six arms, each with an outward fork.
    svg: '<path d="M12 3V21M4.2 7.5 19.8 16.5M19.8 7.5 4.2 16.5' +
      'M9.9 4.6 12 6.4 14.1 4.6M9.9 19.4 12 17.6 14.1 19.4' +
      'M6.6 6.5 7.2 9.2 4.5 10.1M17.4 17.5 16.8 14.8 19.5 13.9' +
      'M19.5 10.1 16.8 9.2 17.4 6.5M4.5 13.9 7.2 14.8 6.6 17.5"/>',
  },
  desert: {
    label: 'Barrens',
    svg: '<circle cx="16.5" cy="7.5" r="2.8" fill="currentColor" stroke="none"/><path d="M2 17c2.5 0 3.2-3 5.5-3S10.5 17 13 17"/><path d="M11 17c2 0 2.8-2.5 5-2.5S18.8 17 21 17"/>',
  },
  urban: {
    label: 'Stronghold',
    // A battlemented tower with an arched door (door cut out via even-odd fill).
    svg: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M8 20V6h2v1.6h1V6h2v1.6h1V6h2v14zM10.4 20v-4.6a1.6 1.6 0 0 1 3.2 0V20z"/>',
  },
  unknown: {
    label: 'Unsurveyed',
    svg: '<circle cx="12" cy="12" r="8" fill="none" stroke-dasharray="2 2.6"/><path d="M9.6 9.6a2.4 2.4 0 1 1 3.2 3.1c-.7.5-1 .8-1 1.6" fill="none"/><path d="M12 17.4h.01"/>',
  },
};

// Overlay badges — small marks stamped in a hex corner atop the terrain glyph.
export const OVERLAY_ICONS = {
  settlement: {
    label: 'Settlement',
    svg: '<path d="M4 20V11l8-6 8 6v9z"/><path d="M9.5 20v-5h5v5" fill="none"/>',
  },
  site: {
    label: 'Site of interest',
    svg: '<path d="M7 21V4l10 3-10 3"/><path d="M7 21v-4" fill="none"/>',
  },
};

// A d10 glyph for the "roll" affordances.
export const DIE_SVG =
  '<path d="M12 3l7 4.5v9L12 21l-7-4.5v-9z" fill="none"/><path d="M5 7.5L12 12l7-4.5M12 12v9" fill="none" opacity=".55"/><text x="12" y="10.6" text-anchor="middle" font-size="6.5" fill="currentColor" stroke="none" font-family="Georgia,serif">10</text>';

/** Wrap glyph markup in a sized <svg>. `extra` lets callers add classes/attrs. */
export function svgIcon(inner, { size = 24, cls = '', stroke = 1.6 } = {}) {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" ` +
    `fill="none" stroke="currentColor" stroke-width="${stroke}" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

export function terrainGlyph(key, opts) {
  const e = TERRAIN_ICONS[key] || TERRAIN_ICONS.unknown;
  return svgIcon(e.svg, opts);
}
export function overlayGlyph(key, opts) {
  const e = OVERLAY_ICONS[key];
  return e ? svgIcon(e.svg, opts) : '';
}
export function dieGlyph(opts) {
  return svgIcon(DIE_SVG, opts);
}
