/**
 * Synced boot + background sync for the authenticated app:
 *
 *   1. if this device last held a DIFFERENT account, wipe local data first
 *      (no push) so nothing leaks into the new account;
 *   2. pull() remote data so a second device populates before the UI renders;
 *   3. push() any local-only rows (first-run upload / offline edits).
 *
 * Then it keeps syncing on an interval, when the tab regains visibility, and
 * when connectivity returns. Every sync is best-effort: failures (offline) are
 * swallowed so the local-first app keeps working.
 */

import { useEffect, useState } from 'react';
import { db } from '../db/schema';
import { pull, push, syncOnce } from './engine';
import { supabaseGateway } from './gateway';
import { resetLocalUserData } from './resetLocal';
import { isSupabaseConfigured } from '../lib/supabase';

const SYNC_INTERVAL_MS = 30_000;
const LAST_USER_KEY = 'edb:lastUserId';

function readLastUserId(): string | null {
  try {
    return globalThis.localStorage?.getItem(LAST_USER_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeLastUserId(userId: string): void {
  try {
    globalThis.localStorage?.setItem(LAST_USER_KEY, userId);
  } catch {
    // ignore — storage unavailable
  }
}

/**
 * @param userId the signed-in Supabase user id. When it differs from the last
 *   known user on this device, local data is wiped BEFORE the first pull so the
 *   previous user's rows never reach the new account.
 * @returns whether the initial boot sequence has finished (the app may render).
 */
export function useSyncedDatabase(userId?: string): boolean {
  const [ready, setReady] = useState(false);

  // One-time boot: [wipe-if-account-changed →] pull → push.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (userId != null) {
        const last = readLastUserId();
        if (last != null && last !== userId) {
          try {
            await resetLocalUserData();
          } catch (err) {
            console.warn('Account-switch local wipe failed.', err);
          }
        }
        writeLastUserId(userId);
      }

      if (isSupabaseConfigured) {
        try {
          await pull(db, supabaseGateway);
        } catch (err) {
          console.warn('Initial sync pull failed (offline?); continuing local-first.', err);
        }
        try {
          await push(db, supabaseGateway);
        } catch (err) {
          console.warn('Initial sync push failed (offline?); will retry.', err);
        }
      }

      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Ongoing background sync once booted.
  useEffect(() => {
    if (!ready || !isSupabaseConfigured) return;
    const tick = () => {
      void syncOnce(db, supabaseGateway).catch((err) => {
        console.warn('Background sync failed (will retry).', err);
      });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    const id = window.setInterval(tick, SYNC_INTERVAL_MS);
    window.addEventListener('online', tick);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('online', tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ready]);

  return ready;
}
