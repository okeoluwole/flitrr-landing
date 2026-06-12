import { defineConfig } from 'vitest/config';

/**
 * Minimal Vitest config (M7.2 to M7.4 testing). Pure-logic tests only, in
 * tests/, run under Node: no UI tooling, no E2E, no network, no DOM.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
