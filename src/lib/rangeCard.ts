/**
 * Range-card export — frees the predicted DOPE from the app as a CSV (for a
 * Kestrel/spreadsheet) and as a clean, high-contrast printable card the shooter
 * can save to PDF or laminate. The string builders are pure (unit-testable); the
 * DOM triggers (download / print) live here too but are thin wrappers.
 */

import type { PredictedCard } from '../domain/dopePredict'

function fmt(v: number, unit: 'MIL' | 'MOA'): string {
  return unit === 'MOA' ? v.toFixed(2) : v.toFixed(1)
}

/** CSV of the predicted come-up table. */
export function rangeCardCsv(rifleName: string, loadLabel: string | undefined, card: PredictedCard): string {
  const u = card.outputUnit
  const header = [`Distance (yd)`, `Elevation (${u})`, `Wind${card.referenceWindMph} (${u})`, `Velocity (fps)`, `Confirmed`]
  const lines = card.rows.map((r) =>
    [r.distance, fmt(r.elevation, u), fmt(r.windage, u), r.velocityFps, r.confirmedElevation != null ? 'Y' : ''].join(
      ',',
    ),
  )
  const title = `EDB DOPE,${rifleName}${loadLabel && loadLabel !== 'All loads' ? ` - ${loadLabel}` : ''}`
  return [title, header.join(','), ...lines].join('\n')
}

/** A standalone, print-optimized HTML range card (dark-ink on white, laminate-friendly). */
export function rangeCardHtml(rifleName: string, loadLabel: string | undefined, card: PredictedCard): string {
  const u = card.outputUnit
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)
  const sub = loadLabel && loadLabel !== 'All loads' ? ` · ${esc(loadLabel)}` : ''
  const rows = card.rows
    .map((r) => {
      const conf = r.confirmedElevation != null ? ' class="conf"' : ''
      const sup = r.supersonic ? '' : ' class="sub"'
      return `<tr${sup}><td class="d"${conf}>${r.distance}</td><td>${fmt(r.elevation, u)}</td><td>${fmt(
        r.windage,
        u,
      )}</td><td class="v">${r.velocityFps}</td></tr>`
    })
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>EDB DOPE — ${esc(rifleName)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; color: #111; background: #fff; margin: 0; padding: 18px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th, td { padding: 8px 6px; text-align: right; border-bottom: 1px solid #ddd; font-size: 15px; }
  th { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #666; border-bottom: 2px solid #111; }
  td.d { text-align: left; font-weight: 700; }
  td.d.conf::before { content: "●"; color: #b8860b; font-size: 9px; vertical-align: middle; margin-right: 5px; }
  td.v { color: #777; }
  tr.sub td { color: #999; }
  .note { margin-top: 12px; font-size: 11px; color: #666; }
  button { margin-top: 16px; padding: 10px 16px; font-size: 14px; border: 1px solid #111; background: #111; color: #fff; border-radius: 6px; cursor: pointer; }
  @media print { button { display: none; } body { padding: 0; } }
</style></head><body>
  <h1>EDB DOPE — ${esc(rifleName)}${sub}</h1>
  <div class="meta">${u} · wind ${card.referenceWindMph} mph full-value · ● = confirmed from log${
    card.transonicYd != null ? ` · dim rows past ${card.transonicYd} yd are transonic` : ''
  }</div>
  <table>
    <thead><tr><th style="text-align:left">Dist (yd)</th><th>Elev</th><th>W${card.referenceWindMph}</th><th>Vel</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="note">Predictions — confirm at distance before any shot that matters.</div>
  <button onclick="window.print()">Print / Save PDF</button>
</body></html>`
}

/** Trigger a client-side download of text content. */
export function downloadText(filename: string, mime: string, text: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Open a printable range card in a new window; fall back to downloading the HTML. */
export function openPrintableCard(filename: string, html: string): void {
  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
    w.focus()
  } else {
    downloadText(filename, 'text/html', html)
  }
}
