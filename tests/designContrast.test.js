/**
 * Contrast (Session K, Note 15 sub-step 1).
 *
 * Every semantic token pairing must meet WCAG AA against the surface it is
 * used on. The values are read from app/globals.css itself (the screen
 * definitions, not the print remap), so this test judges the real tokens,
 * not a copy that could drift. Translucent fills are composited over the
 * surface beneath them before the ratio is computed, because that composite
 * is what a reader actually sees.
 *
 * Thresholds: the semantic chips and labels are small text, so 4.5:1. The
 * focus ring and other non-text boundaries need 3:1.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SEMANTIC_MAPPINGS } from '../lib/design/semantics.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GLOBALS = readFileSync(path.join(HERE, '..', 'app', 'globals.css'), 'utf8');

/**
 * First definition of each custom property wins: the screen :root blocks
 * come before the @media print remap, so this reads the on-screen values.
 */
const TOKEN_VALUES = (() => {
  const map = new Map();
  for (const m of GLOBALS.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    if (!map.has(m[1])) map.set(m[1], m[2].trim());
  }
  return map;
})();

function parseColour(raw) {
  const value = raw.trim();
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return {
      r: parseInt(hex[1].slice(0, 2), 16),
      g: parseInt(hex[1].slice(2, 4), 16),
      b: parseInt(hex[1].slice(4, 6), 16),
      a: 1,
    };
  }
  const rgba = value.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i
  );
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a: rgba[4] == null ? 1 : Number(rgba[4]),
    };
  }
  return null;
}

function tokenColour(name) {
  const raw = TOKEN_VALUES.get(name);
  expect(raw, `${name} is not defined in globals.css`).toBeTruthy();
  const colour = parseColour(raw);
  expect(colour, `${name} (${raw}) is not a parseable colour`).toBeTruthy();
  return colour;
}

/** src over dst, both fully specified; dst assumed opaque. */
function composite(src, dst) {
  return {
    r: src.r * src.a + dst.r * (1 - src.a),
    g: src.g * src.a + dst.g * (1 - src.a),
    b: src.b * src.a + dst.b * (1 - src.a),
    a: 1,
  };
}

function relativeLuminance({ r, g, b }) {
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(fg, bg) {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** The composite a chip's text actually sits on: fill over surface. */
function seatFor(appearance, surfaceToken) {
  const surface = tokenColour(surfaceToken);
  if (!appearance.fill) return surface;
  return composite(tokenColour(appearance.fill), surface);
}

// The surfaces a semantic chip or label is seated on in the product: the
// panel it usually lives in, the ground, and the sunken well (the
// needs-attention bands seat chips there).
const SEATS = ['--app-surface', '--app-ground', '--app-surface-sunken'];

describe('semantic ink meets AA on every surface it sits on', () => {
  for (const mapping of SEMANTIC_MAPPINGS) {
    for (const value of mapping.values) {
      const a = mapping.appearance(value);
      it(`${mapping.id}:${value} ink ${a.ink} holds 4.5:1`, () => {
        const ink = tokenColour(a.ink);
        for (const surfaceToken of SEATS) {
          const seat = seatFor(a, surfaceToken);
          const ratio = contrast(ink, seat);
          expect(
            ratio,
            `${mapping.id}:${value} ${a.ink} on ${a.fill ?? 'transparent'} over ${surfaceToken} = ${ratio.toFixed(2)}`
          ).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }
});

describe('the text hierarchy holds AA on the app surfaces', () => {
  const inks = ['--app-ink', '--app-ink-secondary', '--app-ink-muted'];
  const surfaces = [
    '--app-surface',
    '--app-ground',
    '--app-surface-sunken',
    '--app-surface-raised',
    '--app-console',
  ];
  for (const inkToken of inks) {
    it(`${inkToken} holds 4.5:1 on every app surface`, () => {
      const ink = tokenColour(inkToken);
      for (const surfaceToken of surfaces) {
        const ratio = contrast(ink, tokenColour(surfaceToken));
        expect(
          ratio,
          `${inkToken} on ${surfaceToken} = ${ratio.toFixed(2)}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it('the primary action pairing holds AA', () => {
    const ratio = contrast(
      tokenColour('--app-primary-ink'),
      tokenColour('--app-primary')
    );
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe('non-text boundaries hold 3:1', () => {
  it('the focus ring is visible on every app surface', () => {
    const focus = tokenColour('--app-focus');
    for (const surfaceToken of SEATS.concat('--app-console')) {
      const ratio = contrast(focus, tokenColour(surfaceToken));
      expect(
        ratio,
        `--app-focus on ${surfaceToken} = ${ratio.toFixed(2)}`
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
