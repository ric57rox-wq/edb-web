/**
 * Vitest global setup. Installs a fake IndexedDB so Dexie works under Node,
 * letting the data-layer and sync tests run headless.
 */
import 'fake-indexeddb/auto'
