/** Data-layer entry point: the db instance, its schema class, and repositories. */

export { db, EdbDB } from './schema';
export { newUuid } from './syncStamp';
export * from './repositories';
