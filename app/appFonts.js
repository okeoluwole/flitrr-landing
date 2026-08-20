import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

/**
 * Geist + Geist Mono are the Instrument faces for the authenticated product:
 * Geist carries the voice, Geist Mono the numeric instrument voice (money,
 * dates, stage numerals, criticality scores). Bundled locally via the geist
 * package (Next 14.2's Google font data predates Geist).
 *
 * They hang here rather than on the root layout so the marketing routes never
 * download them. next/font emits its CSS into the route entries that import
 * the module, so only the three product layouts that import this one carry
 * the @font-face and its preload: /dashboard, /pulse/app and /stack/app.
 *
 * The .variable classes expose --font-geist-sans / --font-geist-mono. The
 * --app-font-* tokens that read them are declared on .app-scope in
 * globals.css, not at :root, and that pairing is load-bearing: a custom
 * property whose var() reference is undefined where it is DECLARED computes
 * to the guaranteed-invalid value and inherits down broken. The tokens have
 * to sit on the same element that carries these classes, which is why the
 * class name ships joined to them here rather than being applied separately.
 *
 * Imported only by layouts, which the page render smoke suite excludes by
 * design: the next/font call resolves inside the Next build, not in vitest.
 */
export const appFontClass = `app-scope ${GeistSans.variable} ${GeistMono.variable}`;
