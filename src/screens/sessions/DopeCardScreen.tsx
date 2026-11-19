import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { Share2, Copy, Check, Crosshair, Gauge, MapPin, Loader } from 'lucide-react'
import { Screen, ScreenHeader, Card, Button, Field, TextInput, Select, Row, EmptyState, SectionLabel } from '../../ui/kit'
import { TurretDivider } from '../../ui/TurretDivider'
import { useRifle, useAmmunition, useBarrels, useSessionsForRifle } from '../../hooks/useData'
import { buildDopeCard } from '../../domain/dope'
import {
  canSolve,
  buildPredictedCard,
  trueUpFromSessions,
  type PredictedCard,
} from '../../domain/dopePredict'
import { densityAltitudeFt, type Atmosphere } from '../../domain/ballistics'
import { updateAmmunition } from '../../db/repositories/ammunition'
import { fetchCurrentWeather } from '../../lib/weather'
import { formatDate, numOrUndef } from '../../lib/format'
import type { AngularUnit } from '../../domain/types'

const ALL = 'all'
const UNSPEC = 'none'

export function DopeCardScreen() {
  const { rifleId } = useParams()
  const rifle = useRifle(rifleId)
  const loads = useAmmunition(rifleId) ?? []
  const barrels = useBarrels(rifleId) ?? []
  const sessions = useSessionsForRifle(rifleId) ?? []
  const [loadId, setLoadId] = useState<string>(ALL)
  const [unit, setUnit] = useState<AngularUnit>('MIL')
  const [copied, setCopied] = useState(false)
  const [savedMv, setSavedMv] = useState(false)
  // A4 — solve for standard vs. current conditions.
  const [condMode, setCondMode] = useState<'standard' | 'current'>('standard')
  const [cTemp, setCTemp] = useState('')
  const [cPressure, setCPressure] = useState('')
  const [cHumidity, setCHumidity] = useState('')
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoErr, setGeoErr] = useState<string | null>(null)

  // Default to the rifle's turret unit and the first load once data loads.
  useEffect(() => {
    if (rifle?.zeroUnit) setUnit(rifle.zeroUnit)
  }, [rifle?.zeroUnit])
  useEffect(() => {
    if (loadId === ALL && loads.length > 0) setLoadId(loads[0].id)
  }, [loads, loadId])

  const selectedLoad = loads.find((l) => l.id === loadId)
  const twistDir = barrels.find((b) => b.twistDir)?.twistDir
  const solvable = canSolve(selectedLoad)

  const atmosphere: Atmosphere | undefined =
    condMode === 'current'
      ? {
          tempF: numOrUndef(cTemp),
          pressureInHg: numOrUndef(cPressure),
          humidityPct: numOrUndef(cHumidity),
          pressureType: 'station',
        }
      : undefined
  const densityAlt =
    condMode === 'current' && (cTemp || cPressure || cHumidity)
      ? Math.round(densityAltitudeFt(atmosphere!))
      : null

  async function useConditions() {
    setGeoBusy(true)
    setGeoErr(null)
    try {
      const w = await fetchCurrentWeather()
      if (w.temp != null) setCTemp(String(w.temp))
      if (w.pressure != null) setCPressure(String(w.pressure))
      if (w.humidity != null) setCHumidity(String(w.humidity))
      setCondMode('current')
    } catch (e) {
      setGeoErr(e instanceof Error ? e.message : 'Weather lookup failed.')
    } finally {
      setGeoBusy(false)
    }
  }

  const filtered = useMemo(() => {
    if (loadId === ALL) return sessions
    if (loadId === UNSPEC) return sessions.filter((s) => !s.ammunitionId)
    return sessions.filter((s) => s.ammunitionId === loadId)
  }, [sessions, loadId])

  const predicted: PredictedCard | null = useMemo(() => {
    if (!rifle || !selectedLoad || !solvable) return null
    return buildPredictedCard({
      rifle,
      load: selectedLoad,
      sessions: filtered,
      outputUnit: unit,
      atmosphere,
      twistDir,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rifle, selectedLoad, solvable, filtered, unit, twistDir, condMode, cTemp, cPressure, cHumidity])

  const trueUp = useMemo(() => {
    if (!rifle || !selectedLoad || !solvable) return null
    return trueUpFromSessions({ rifle, load: selectedLoad, sessions: filtered, outputUnit: unit, atmosphere, twistDir })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rifle, selectedLoad, solvable, filtered, unit, twistDir, condMode, cTemp, cPressure, cHumidity])

  const legacy = useMemo(() => buildDopeCard(filtered), [filtered])
  const loadLabel =
    loadId === ALL ? 'All loads' : loadId === UNSPEC ? 'Unspecified' : selectedLoad?.label

  if (rifle === undefined) return null
  if (!rifle) {
    return (
      <Screen>
        <ScreenHeader title="DOPE Card" back />
        <EmptyState title="Rifle not found" />
      </Screen>
    )
  }

  const shareText = predicted
    ? buildPredictedShareText(rifle.name, loadLabel, predicted)
    : buildLegacyShareText(rifle.name, loadLabel, legacy)

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `DOPE — ${rifle!.name}`, text: shareText })
        return
      } catch {
        /* cancelled or unsupported — fall back to copy */
      }
    }
    await copy()
  }

  async function applyTrueUp() {
    if (!trueUp || !selectedLoad) return
    await updateAmmunition(selectedLoad.id, { muzzleVelocity: trueUp.muzzleVelocityFps })
    setSavedMv(true)
    setTimeout(() => setSavedMv(false), 2000)
  }

  const unitToggle = (
    <div style={{ display: 'flex', gap: 4 }}>
      {(['MIL', 'MOA'] as const).map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => setUnit(u)}
          style={{ ...unitBtn, ...(unit === u ? unitBtnOn : null) }}
        >
          {u}
        </button>
      ))}
    </div>
  )

  return (
    <Screen>
      <ScreenHeader eyebrow={rifle.name} title="DOPE Card" back />
      <TurretDivider />

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Field label="Load">
            <Select value={loadId} onChange={(e) => setLoadId(e.target.value)}>
              <option value={ALL}>All loads</option>
              {loads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
              <option value={UNSPEC}>Unspecified</option>
            </Select>
          </Field>
        </div>
        <div style={{ marginBottom: 12 }}>{unitToggle}</div>
      </div>

      {predicted ? (
        <>
          <div style={{ color: 'var(--text-faint)', fontSize: 11, margin: '0 2px 10px' }}>
            Predicted from this load's BC &amp; muzzle velocity
            {condMode === 'current' ? ' at the conditions below' : ' at standard conditions (sea level, 59°F)'}.
            Wind column = {predicted.referenceWindMph} mph full-value.
          </div>

          <SectionLabel
            right={
              <Button small variant="ghost" onClick={() => void useConditions()} disabled={geoBusy}>
                {geoBusy ? <Loader size={13} /> : <MapPin size={13} />} Use location
              </Button>
            }
          >
            Conditions
          </SectionLabel>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {(['standard', 'current'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setCondMode(m)}
                style={{ ...condBtn, ...(condMode === m ? condBtnOn : null) }}
              >
                {m === 'standard' ? 'Standard' : 'Current'}
              </button>
            ))}
            {densityAlt != null && (
              <div style={daBox} title="Density altitude">
                DA <strong style={{ color: 'var(--brass)' }}>{densityAlt.toLocaleString()} ft</strong>
              </div>
            )}
          </div>
          {geoErr && <div style={{ color: 'var(--danger)', fontSize: 12, margin: '-4px 2px 10px' }}>{geoErr}</div>}
          {condMode === 'current' && (
            <Row>
              <Field label="Temp (°F)">
                <TextInput inputMode="decimal" value={cTemp} onChange={(e) => setCTemp(e.target.value)} placeholder="59" />
              </Field>
              <Field label="Pressure (inHg)" hint="Station (actual) pressure.">
                <TextInput inputMode="decimal" value={cPressure} onChange={(e) => setCPressure(e.target.value)} placeholder="29.92" />
              </Field>
            </Row>
          )}
          {condMode === 'current' && (
            <Field label="Humidity (%)">
              <TextInput inputMode="numeric" value={cHumidity} onChange={(e) => setCHumidity(e.target.value)} placeholder="50" />
            </Field>
          )}

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ ...rowStyle, ...headRow }}>
              <span style={{ ...cell, ...distCell }}>DIST</span>
              <span style={cell}>ELEV</span>
              <span style={cell}>&Delta;</span>
              <span style={cell}>W{predicted.referenceWindMph}</span>
              <span style={{ ...cell, ...velCell }}>VEL</span>
            </div>
            {predicted.rows.map((r, i) => {
              const confirmed = r.confirmedElevation != null
              return (
                <div
                  key={r.distance}
                  style={{
                    ...rowStyle,
                    borderTop: i === 0 ? 'none' : '1px solid var(--line-soft)',
                    opacity: r.supersonic ? 1 : 0.5,
                  }}
                >
                  <span style={{ ...cell, ...distCell, color: 'var(--brass)' }}>
                    {confirmed && <span style={confDot} title={`confirmed · last ${formatDate(r.lastDate)}`} />}
                    {r.distance}
                  </span>
                  <span style={{ ...cell, color: '#f2f4f0' }}>{fmt(r.elevation, unit)}</span>
                  <span style={{ ...cell, color: deltaColor(r.elevationDelta) }}>
                    {r.elevationDelta != null ? fmtSigned(r.elevationDelta, unit) : '—'}
                  </span>
                  <span style={{ ...cell, color: 'var(--text-dim)' }}>{fmt(r.windage, unit)}</span>
                  <span style={{ ...cell, ...velCell }}>{r.velocityFps}</span>
                </div>
              )
            })}
          </Card>

          <div style={{ color: 'var(--text-faint)', fontSize: 11, margin: '8px 2px 0' }}>
            &#9679; = confirmed from your log. &Delta; = your hold &minus; predicted (in {unit}).
            {predicted.transonicYd != null && ` Rows past ${predicted.transonicYd} yd are transonic/subsonic (dimmed).`}
          </div>

          {trueUp && (
            <>
              <SectionLabel>True my DOPE</SectionLabel>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Gauge size={18} style={{ color: 'var(--brass)', flex: 'none' }} />
                  <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                    From {trueUp.pointsUsed} confirmed distances, a muzzle velocity of{' '}
                    <strong style={{ color: '#f2f4f0' }}>{trueUp.muzzleVelocityFps} fps</strong>{' '}
                    (now {trueUp.previousFps}) best fits your holds — residual{' '}
                    {fmt(trueUp.rmsError, unit)} {unit}.
                  </div>
                </div>
                <Button
                  full
                  variant="secondary"
                  style={{ marginTop: 12 }}
                  disabled={savedMv || trueUp.muzzleVelocityFps === trueUp.previousFps}
                  onClick={() => void applyTrueUp()}
                >
                  {savedMv ? <Check size={15} /> : <Crosshair size={15} />}{' '}
                  {savedMv ? 'Saved to load' : `Save ${trueUp.muzzleVelocityFps} fps to this load`}
                </Button>
              </Card>
            </>
          )}

          <div style={{ display: 'flex', gap: 10, margin: '16px 0 24px' }}>
            <Button variant="secondary" full onClick={() => void copy()}>
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button full onClick={() => void share()}>
              <Share2 size={15} /> Share
            </Button>
          </div>
        </>
      ) : (
        <>
          {selectedLoad && !solvable && (
            <Card style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Add this load's <strong style={{ color: '#f2f4f0' }}>BC</strong> and{' '}
                <strong style={{ color: '#f2f4f0' }}>muzzle velocity</strong> (and the rifle's zero
                range) to get a predicted card that extends to distances you haven't shot yet. Until
                then, here are your logged holds.
              </div>
            </Card>
          )}
          {legacy.length === 0 ? (
            <EmptyState
              title="No DOPE yet"
              hint="Log courses of fire with a distance and elevation/windage holds to build this card."
            />
          ) : (
            <>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ ...rowStyle, ...headRow }}>
                  <span style={{ ...cell, ...distCell }}>DIST</span>
                  <span style={cell}>ELEV</span>
                  <span style={cell}>WIND</span>
                  <span style={{ ...cell, ...nCell }}>N</span>
                </div>
                {legacy.map((e, i) => (
                  <div key={e.distance} style={{ ...rowStyle, borderTop: i === 0 ? 'none' : '1px solid var(--line-soft)' }}>
                    <span style={{ ...cell, ...distCell, color: 'var(--brass)' }}>{e.distance}</span>
                    <span style={{ ...cell, color: '#f2f4f0' }}>{e.elevation || '—'}</span>
                    <span style={{ ...cell, color: '#f2f4f0' }}>{e.windage || '—'}</span>
                    <span style={{ ...cell, ...nCell }} title={e.lastDate ? `last ${formatDate(e.lastDate)}` : ''}>
                      {e.samples}
                    </span>
                  </div>
                ))}
              </Card>
              <div style={{ color: 'var(--text-faint)', fontSize: 11, margin: '8px 2px 0' }}>
                Distances in yards. Holds are the most recently logged at each distance; N = confirming sessions.
              </div>
              <div style={{ display: 'flex', gap: 10, margin: '16px 0 24px' }}>
                <Button variant="secondary" full onClick={() => void copy()}>
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button full onClick={() => void share()}>
                  <Share2 size={15} /> Share
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </Screen>
  )
}

function fmt(v: number, unit: AngularUnit): string {
  return unit === 'MOA' ? v.toFixed(2) : v.toFixed(1)
}
function fmtSigned(v: number, unit: AngularUnit): string {
  const s = fmt(Math.abs(v), unit)
  return v >= 0 ? `+${s}` : `-${s}`
}
function deltaColor(delta?: number): string {
  if (delta == null) return 'var(--text-faint)'
  const a = Math.abs(delta)
  if (a < 0.15) return 'var(--ok)'
  if (a < 0.4) return 'var(--warn)'
  return 'var(--danger)'
}

function buildPredictedShareText(rifleName: string, loadLabel: string | undefined, card: PredictedCard): string {
  const head = `EDB DOPE — ${rifleName}${loadLabel && loadLabel !== 'All loads' ? ` · ${loadLabel}` : ''} (${card.outputUnit})`
  const lines = card.rows.map((r) => {
    const conf = r.confirmedElevation != null ? '*' : ' '
    return `${conf}${String(r.distance).padStart(4)} yd   ${fmt(r.elevation, card.outputUnit).padStart(6)}   W${card.referenceWindMph} ${fmt(r.windage, card.outputUnit).padStart(5)}   ${r.velocityFps} fps${r.supersonic ? '' : ' (sub)'}`
  })
  return [head, '─'.repeat(head.length), ...lines, '', '* = confirmed from log'].join('\n')
}

function buildLegacyShareText(
  rifleName: string,
  loadLabel: string | undefined,
  entries: ReturnType<typeof buildDopeCard>,
): string {
  const head = `EDB DOPE — ${rifleName}${loadLabel && loadLabel !== 'All loads' ? ` · ${loadLabel}` : ''}`
  const lines = entries.map(
    (e) =>
      `${String(e.distance).padStart(4)} yd   E ${(e.elevation || '—').padEnd(8)} W ${(e.windage || '—').padEnd(8)} (n=${e.samples})`,
  )
  return [head, '─'.repeat(head.length), ...lines].join('\n')
}

const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', padding: '11px 14px' }
const headRow: CSSProperties = { background: 'var(--panel-2)' }
const cell: CSSProperties = {
  flex: 1,
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 13,
  color: 'var(--text-dim)',
  letterSpacing: 0.5,
}
const distCell: CSSProperties = { flex: 0.8, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }
const velCell: CSSProperties = { flex: 0.9, textAlign: 'right', color: 'var(--text-faint)', fontSize: 12 }
const nCell: CSSProperties = { flex: 0.4, textAlign: 'right', color: 'var(--text-faint)' }
const confDot: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: 'var(--brass)',
  flex: 'none',
}
const unitBtn: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: 0.5,
  padding: '9px 12px',
  borderRadius: 7,
  border: '1px solid var(--line)',
  background: 'var(--panel)',
  color: 'var(--text-dim)',
  cursor: 'pointer',
}
const unitBtnOn: CSSProperties = {
  background: 'var(--brass)',
  color: '#201200',
  borderColor: 'var(--brass)',
}
const condBtn: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: 0.5,
  padding: '9px 14px',
  borderRadius: 7,
  border: '1px solid var(--line)',
  background: 'var(--panel)',
  color: 'var(--text-dim)',
  cursor: 'pointer',
}
const condBtnOn: CSSProperties = { background: 'var(--brass)', color: '#201200', borderColor: 'var(--brass)' }
const daBox: CSSProperties = {
  marginLeft: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11.5,
  color: 'var(--text-dim)',
  alignSelf: 'center',
}
