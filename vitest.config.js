import { defineConfig } from 'vitest/config';

/**
 * Minimal Vitest config (M7.2 to M7.4 testing). Pure-logic tests only, in
 * tests/, run under Node: no UI tooling, no E2E, no network, no DOM.
 *
 * The oxc block exists for the page render smoke suite (Session L,
 * tests/pageSmoke.test.js): the app writes JSX in .js files (Next's SWC
 * handles that in the build), and Vite 8's oxc transform excludes .js by
 * default, so page modules cannot be imported at all without it. lang 'jsx'
 * is a strict superset of plain JS, so the pure-logic suites compile exactly
 * as before.
 */
export default defineConfig({
  oxc: {
    include: /\.js$/,
    exclude: [],
    lang: 'jsx',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
