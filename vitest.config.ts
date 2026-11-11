import { defineConfig } from 'vitest/config'

// jsdom gives Dexie + localStorage (sync cursors/tombstones) a home under Node;
// fake-indexeddb (installed in setup) backs Dexie's IndexedDB calls.
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
})
