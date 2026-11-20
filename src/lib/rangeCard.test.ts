import { describe, it, expect } from 'vitest'
import { rangeCardCsv, rangeCardHtml } from './rangeCard'
import type { PredictedCard, PredictedRow } from '../domain/dopePredict'

function row(distance: number, elevation: number, confirmed?: number, supersonic = true): PredictedRow {
  return {
    distance,
    elevation,
    windage: 0.4,
    velocityFps: 2000,
    supersonic,
    confirmedElevation: confirmed,
    elevationDelta: confirmed != null ? confirmed - elevation : undefined,
  }
}

const card: PredictedCard = {
  rows: [row(100, 0.2), row(600, 3.1, 3.2), row(1000, 7.4, undefined, false)],
  outputUnit: 'MIL',
  referenceWindMph: 10,
  transonicYd: 1000,
}

describe('rangeCard', () => {
  it('CSV has a header and one line per row, confirmed flagged', () => {
    const csv = rangeCardCsv('Tikka T3x', '168 ELD-M', card)
    const lines = csv.split('\n')
    expect(lines[0]).toContain('Tikka T3x')
    expect(lines[1]).toBe('Distance (yd),Elevation (MIL),Wind10 (MIL),Velocity (fps),Confirmed')
    expect(lines).toHaveLength(2 + card.rows.length)
    expect(lines[3]).toBe('600,3.1,0.4,2000,Y') // confirmed row flagged
    expect(lines[4]).toBe('1000,7.4,0.4,2000,') // not confirmed
  })

  it('HTML is a standalone doc with the rows and a print button', () => {
    const html = rangeCardHtml('Tikka T3x', '168 ELD-M', card)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('EDB DOPE — Tikka T3x')
    expect(html).toContain('window.print()')
    expect(html).toContain('>600<') // a distance cell
    expect(html).toContain('class="sub"') // transonic row dimmed
  })
})
