/**
 * Hold a screen wake lock while a screen is mounted and `active`, so the phone
 * doesn't sleep between shots at the range. The lock is released automatically
 * when the tab is hidden, so we re-acquire it when the page becomes visible
 * again. All of it is best-effort: unsupported browsers (notably iOS before
 * 16.4, or a non-HTTPS origin) just no-op.
 */

import { useEffect } from 'react'

type WakeLockSentinelLike = { released: boolean; release: () => Promise<void> }
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
}

export function useWakeLock(active = true): void {
  useEffect(() => {
    if (!active) return
    const nav = navigator as WakeLockNavigator
    if (!nav.wakeLock) return

    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible') return
        sentinel = await nav.wakeLock!.request('screen')
        if (cancelled) {
          void sentinel.release()
          sentinel = null
        }
      } catch {
        /* denied / unsupported — ignore */
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) {
        void acquire()
      }
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (sentinel && !sentinel.released) void sentinel.release()
    }
  }, [active])
}
