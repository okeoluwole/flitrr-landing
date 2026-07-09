/* ─────────────────────────────────────────────────────────
   Design tokens, mirrored 1:1 from the live site.
   Source of truth: app/globals.css (the ink marketing ground,
   the amber signal, the easing + duration system) and
   app/layout.js (Archivo is the marketing-surface face).

   The one rule that governs every colour choice here, quoted
   from globals.css: "Amber is reserved for signal on ink:
   the pulse line, criticality, the primary CTA." Amber means
   one thing. Everything else is ink and cream.
───────────────────────────────────────────────────────── */

import { Easing, interpolate } from 'remotion';
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo';

// Archivo — the "Considered" marketing-surface face (var(--font-archivo)).
export const { fontFamily: ARCHIVO } = loadArchivo('normal', {
  weights: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
});

export const COL = {
  // Ink ramp — the marketing ground.
  ink950: '#0B141E', // page ground
  ink900: '#101C29', // raised band
  ink800: '#142435', // card on ink
  ink700: '#1D3349', // elevated edge / hover

  // Text on ink.
  onInk: '#EDF1F5',
  onInk2: '#A9BCCC',
  onInkFaint: '#6E8499',

  // Hairlines.
  hair: 'rgba(237, 241, 245, 0.12)',
  hairStrong: 'rgba(237, 241, 245, 0.22)',

  // Amber — signal only.
  amber: '#F4C031',
  amberDeep: '#D9A61F',
  amberWash: 'rgba(244, 192, 49, 0.12)',
  ochre: '#8A6A16', // amber's text-safe sibling

  // Brand + cream.
  accent1: '#376183',
  cream: '#F2F0F4',

  // Photo grade (dusk treatment, matches the site).
  gradeBottom: 'rgba(11, 20, 30, 0.72)',
  gradeTop: 'rgba(11, 20, 30, 0.22)',
  gradeAmber: 'rgba(244, 192, 49, 0.07)',

  // Instrument (product) neutrals, for the PULSE card.
  paper: '#F5F8FB',
  surface: '#FFFFFF',
  appInk: '#1B2A3A',
  appInk2: '#51677C',
  appMuted: '#7C93A6',
  appBorder: '#D6DEE7',
  appHair: '#E4E9EF',
  critBg: '#FFFCF4',
  critBorder: 'rgba(212, 165, 39, 0.55)',
} as const;

export const SHADOW_INK = '0 24px 64px rgba(0, 0, 0, 0.45)';

// Easing, from globals.css --ease-out-soft (reveals, larger moves).
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IO = Easing.bezier(0.77, 0, 0.175, 1);

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Rise + fade entrance. dur/dist in frames/px; ~13f ≈ 440ms (--dur-slow). */
export function rise(frame: number, start: number, dur = 13, dist = 18) {
  const opacity = interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing: EASE });
  const y = interpolate(frame, [start, start + dur], [dist, 0], { ...clamp, easing: EASE });
  return { opacity, transform: `translateY(${y.toFixed(2)}px)` };
}

/** Fade a beat's contents out over its final frames, for clean hand-offs. */
export function fadeOut(frame: number, start: number, end: number) {
  return interpolate(frame, [start, end], [1, 0], clamp);
}

/** Fade in only. */
export function fadeIn(frame: number, start: number, dur = 12) {
  return interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing: EASE });
}

/** A number that counts up with an ease-out cubic, for the confidence figure. */
export function countUp(frame: number, start: number, dur: number, to: number) {
  const p = interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing: EASE });
  return Math.round(to * p);
}

// Shared type ramp, sized off composition height so 1:1 and 16:9 match.
export const font = (u: number) => ({
  fontFamily: ARCHIVO,
  WebkitFontSmoothing: 'antialiased' as const,
});

export const TNUM: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '0.01em',
};
