/**
 * Theme switching. EDB ships a dark tactical scheme and a high-contrast
 * "daylight" scheme for bright-sun range use. The choice is per-device (a UI
 * preference, so localStorage is the right home) and defaults to the OS color
 * scheme on first run. A matching inline script in index.html applies the saved
 * choice before first paint to avoid a flash.
 */

export type ThemeMode = 'dark' | 'day'

const KEY = 'edb-theme'
const THEME_COLOR: Record<ThemeMode, string> = { dark: '#171d1a', day: '#e6e8e2' }

export function getTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'day' || v === 'dark') return v
  } catch {
    /* storage blocked */
  }
  try {
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'day'
  } catch {
    /* unsupported */
  }
  return 'dark'
}

export function applyTheme(mode: ThemeMode): void {
  const el = document.documentElement
  if (mode === 'day') el.setAttribute('data-theme', 'day')
  else el.removeAttribute('data-theme')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[mode])
}

export function setTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* storage blocked */
  }
  applyTheme(mode)
}
