/**
 * Wipe this device's local user data (multi-account safety). The local Dexie DB
 * is a single unpartitioned store shared by whoever signs in on this browser and
 * is NOT owner-scoped. If one account's rows were left behind when a different
 * account signed in, the next push() would upsert them and the server's
 * `owner_id = auth.uid()` default would re-stamp them into the NEW owner's
 * account — leaking data between accounts.
 *
 * This clears every Dexie table and the sync cursors/tombstones so the next
 * account starts empty with a clean pull cursor. The Dexie instance is left open
 * (tables emptied, not the database deleted) so the very next boot pull() can
 * repopulate it without a reload.
 */

import { db } from '../db/schema';
import { push } from './engine';
import { supabaseGateway } from './gateway';
import { resetSyncState } from './localState';

export interface ResetLocalOptions {
  /**
   * Upload pending local changes before wiping. Use ONLY while the owning
   * session is still active (i.e. on sign-out), so the signed-out user's last
   * offline edits reach their own account. Never pass this when a DIFFERENT user
   * is already the active session.
   */
  pushFirst?: boolean;
}

export async function resetLocalUserData(opts: ResetLocalOptions = {}): Promise<void> {
  const name = db.name;

  if (opts.pushFirst) {
    try {
      await push(db, supabaseGateway);
    } catch {
      // Offline or push failed — proceed with the wipe. Cloud already holds
      // everything synced during the session; only unsynced offline edits made
      // right before sign-out are dropped.
    }
  }

  try {
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map((t) => t.clear()));
    });
  } catch {
    // Best-effort: the boot-time user-change guard is a second line of defense.
  }

  resetSyncState(name);
}
