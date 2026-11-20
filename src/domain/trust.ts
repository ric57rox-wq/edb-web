/**
 * Trust assessment for a predicted DOPE card. A solver you can't gauge is unsafe:
 * this turns the confirmed-vs-predicted deltas already on each row into an
 * honest summary (how well the prediction fits your real holds, and over what
 * distance band it has actually been confirmed) and classifies each row as
 * confirmed / interpolated / extrapolated so an un-vetted 1200 yd row doesn't
 * look as solid as a confirmed 600 yd one. Pure — no I/O.
 */

import type { PredictedRow, PredictedCard } from './dopePredict'
import type { AngularUnit } from './types'

export interface TrustSummary {
  /** Rows carrying a confirmed hold. */
  confirmedCount: number
  minConfirmedYd?: number
  maxConfirmedYd?: number
  /** RMS of (confirmed − predicted) over confirmed rows, in the card's unit. */
  rmsResidual?: number
  /** Mean signed (confirmed − predicted); >0 means you hold MORE than predicted. */
  bias?: number
  maxAbsResidual?: number
  /** Most recent confirmed date (YYYY-MM-DD). */
  lastDate?: string
  unit: AngularUnit
}

export type RowConfidence = 'confirmed' | 'interpolated' | 'extrapolated'

/** Summarize how well the predicted card fits the shooter's confirmed holds. */
export function summarizeTrust(card: PredictedCard): TrustSummary {
  const confirmed = card.rows.filter((r) => r.confirmedElevation != null && r.elevationDelta != null)
  if (confirmed.length === 0) return { confirmedCount: 0, unit: card.outputUnit }

  const deltas = confirmed.map((r) => r.elevationDelta!)
  const sumSq = deltas.reduce((s, d) => s + d * d, 0)
  const rms = Math.sqrt(sumSq / deltas.length)
  const bias = deltas.reduce((s, d) => s + d, 0) / deltas.length
  const maxAbs = Math.max(...deltas.map((d) => Math.abs(d)))
  const dists = confirmed.map((r) => r.distance)
  const sortedDates = confirmed
    .map((r) => r.lastDate)
    .filter((d): d is string => !!d)
    .sort()
  const lastDate = sortedDates.length ? sortedDates[sortedDates.length - 1] : undefined

  return {
    confirmedCount: confirmed.length,
    minConfirmedYd: Math.min(...dists),
    maxConfirmedYd: Math.max(...dists),
    rmsResidual: rms,
    bias,
    maxAbsResidual: maxAbs,
    lastDate,
    unit: card.outputUnit,
  }
}

/** Classify one row's trust given the confirmed envelope. */
export function rowConfidence(row: PredictedRow, summary: TrustSummary): RowConfidence {
  if (row.confirmedElevation != null) return 'confirmed'
  if (summary.minConfirmedYd == null || summary.maxConfirmedYd == null) return 'extrapolated'
  if (row.distance >= summary.minConfirmedYd && row.distance <= summary.maxConfirmedYd) return 'interpolated'
  return 'extrapolated'
}
