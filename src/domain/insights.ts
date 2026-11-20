/**
 * Condition-correlated insight. The app already captures temperature, pressure
 * and humidity per session but never tells the shooter anything back — this
 * buckets sessions by temperature and by density altitude and reports hit rate
 * per band, surfacing patterns like "hits fall off below 40°F". Pure — no I/O.
 */

import type { Session } from './types'
import { densityAltitudeFt, type Atmosphere } from './ballistics'

export interface ConditionBand {
  label: string
  sessions: number
  hits: number
  misses: number
  /** Hit rate in [0,1]; 0 when no rounds in the band. */
  hitRate: number
}

export interface ConditionInsights {
  temp: ConditionBand[]
  da: ConditionBand[]
  /** True when at least two temperature bands have rounds (a comparison exists). */
  hasTemp: boolean
  hasDa: boolean
}

const TEMP_BANDS: { label: string; lo: number; hi: number }[] = [
  { label: '< 40°F', lo: -Infinity, hi: 40 },
  { label: '40–59°F', lo: 40, hi: 60 },
  { label: '60–79°F', lo: 60, hi: 80 },
  { label: '80°F +', lo: 80, hi: Infinity },
]

const DA_BANDS: { label: string; lo: number; hi: number }[] = [
  { label: '< 2k ft', lo: -Infinity, hi: 2000 },
  { label: '2–4k ft', lo: 2000, hi: 4000 },
  { label: '4–6k ft', lo: 4000, hi: 6000 },
  { label: '6k ft +', lo: 6000, hi: Infinity },
]

function emptyBands(defs: { label: string }[]): ConditionBand[] {
  return defs.map((d) => ({ label: d.label, sessions: 0, hits: 0, misses: 0, hitRate: 0 }))
}

function finalize(bands: ConditionBand[]): ConditionBand[] {
  for (const b of bands) {
    const total = b.hits + b.misses
    b.hitRate = total > 0 ? b.hits / total : 0
  }
  return bands
}

/** Build hit-rate-by-condition insights across a set of sessions. */
export function buildInsights(sessions: Session[]): ConditionInsights {
  const temp = emptyBands(TEMP_BANDS)
  const da = emptyBands(DA_BANDS)

  for (const s of sessions) {
    const rounds = (s.hits || 0) + (s.misses || 0)
    if (rounds === 0) continue

    if (s.weatherTemp != null) {
      const bi = TEMP_BANDS.findIndex((d) => s.weatherTemp! >= d.lo && s.weatherTemp! < d.hi)
      if (bi >= 0) {
        temp[bi].sessions++
        temp[bi].hits += s.hits || 0
        temp[bi].misses += s.misses || 0
      }
    }

    if (s.weatherTemp != null && s.pressure != null) {
      const atm: Atmosphere = {
        tempF: s.weatherTemp,
        pressureInHg: s.pressure,
        humidityPct: s.humidity,
        pressureType: s.pressureType ?? 'station',
      }
      const daFt = densityAltitudeFt(atm)
      const bi = DA_BANDS.findIndex((d) => daFt >= d.lo && daFt < d.hi)
      if (bi >= 0) {
        da[bi].sessions++
        da[bi].hits += s.hits || 0
        da[bi].misses += s.misses || 0
      }
    }
  }

  finalize(temp)
  finalize(da)
  return {
    temp,
    da,
    hasTemp: temp.filter((b) => b.sessions > 0).length >= 2,
    hasDa: da.filter((b) => b.sessions > 0).length >= 2,
  }
}
