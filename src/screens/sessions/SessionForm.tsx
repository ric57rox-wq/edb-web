import { useMemo, useState, type ReactNode, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapPin, Loader, X, Undo2, ChevronDown, ChevronRight } from 'lucide-react'
import { Screen, ScreenHeader, Button, Field, TextInput, TextArea, Select, Row, SectionLabel } from '../../ui/kit'
import { useRifle, useBarrels, useAmmunition, useSession } from '../../hooks/useData'
import { useWakeLock } from '../../hooks/useWakeLock'
import { createSession, updateSession } from '../../db/repositories/sessions'
import { fetchCurrentWeather } from '../../lib/weather'
import { numOrUndef, today } from '../../lib/format'
import { groupStats } from '../../domain/group'
import type { Session, AngularUnit } from '../../domain/types'

type FormState = Record<string, string>

const TEXT = (v?: string) => v ?? ''
const NUM = (v?: number) => (v != null ? String(v) : '')

/** New (`/rifles/:rifleId/sessions/new`) or edit (`/sessions/:sessionId/edit`). */
export function SessionForm() {
  const params = useParams()
  const editing = params.sessionId != null
  const existing = useSession(params.sessionId)
  const rifleId = editing ? existing?.rifleId : params.rifleId
  const rifle = useRifle(rifleId)

  // Wait for the data needed to seed the form.
  if (editing && existing === undefined) return null
  if (rifle === undefined) return null
  if (!rifleId || rifle === null) {
    return (
      <Screen>
        <ScreenHeader title="Course of Fire" back />
        <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Rifle not found.</div>
      </Screen>
    )
  }

  return (
    <SessionFormBody
      key={existing?.id ?? 'new'}
      rifleId={rifleId}
      rifleScope={rifle.scope}
      rifleSuppressor={rifle.suppressor}
      rifleZeroUnit={rifle.zeroUnit}
      existing={existing ?? undefined}
    />
  )
}

function SessionFormBody({
  rifleId,
  rifleScope,
  rifleSuppressor,
  rifleZeroUnit,
  existing,
}: {
  rifleId: string
  rifleScope?: string
  rifleSuppressor?: string
  rifleZeroUnit?: AngularUnit
  existing?: Session
}) {
  const navigate = useNavigate()
  const barrels = useBarrels(rifleId) ?? []
  const loads = useAmmunition(rifleId) ?? []
  const [busy, setBusy] = useState(false)
  // Keep the screen awake while logging a course of fire.
  useWakeLock(true)

  const initial = useMemo<FormState>(
    () => ({
      barrelId: TEXT(existing?.barrelId),
      ammunitionId: TEXT(existing?.ammunitionId),
      target: TEXT(existing?.target),
      date: existing?.date ?? today(),
      time: TEXT(existing?.time),
      distance: NUM(existing?.distance),
      targetType: TEXT(existing?.targetType),
      timeLimit: TEXT(existing?.timeLimit),
      position: TEXT(existing?.position),
      barricade: TEXT(existing?.barricade),
      scope: existing ? TEXT(existing.scope) : TEXT(rifleScope),
      suppressor: existing ? TEXT(existing.suppressor) : TEXT(rifleSuppressor),
      velocity: NUM(existing?.velocity),
      dopeElevation: TEXT(existing?.dopeElevation),
      dopeWindage: TEXT(existing?.dopeWindage),
      elevationValue: NUM(existing?.elevationValue),
      elevationUnit: existing?.elevationUnit ?? rifleZeroUnit ?? 'MIL',
      windageValue: NUM(existing?.windageValue),
      windageUnit: existing?.windageUnit ?? rifleZeroUnit ?? 'MIL',
      hits: existing ? String(existing.hits ?? 0) : '0',
      misses: existing ? String(existing.misses ?? 0) : '0',
      shotSequence: TEXT(existing?.shotSequence),
      weatherTemp: NUM(existing?.weatherTemp),
      windSpeed: NUM(existing?.windSpeed),
      windDir: TEXT(existing?.windDir),
      humidity: NUM(existing?.humidity),
      pressure: NUM(existing?.pressure),
      pressureType: existing?.pressureType ?? 'station',
      light: TEXT(existing?.light),
      notes: TEXT(existing?.notes),
    }),
    [existing, rifleScope, rifleSuppressor, rifleZeroUnit],
  )

  const [f, setF] = useState<FormState>(initial)
  const set = (k: string) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }))

  // --- Shot logging: one ordered list of entries. A fast H/M tap is a
  // position-less entry; tapping the target pad adds a positioned impact. Both
  // auto-tally hits/misses/shotSequence; positioned entries also feed group/zero.
  const [entries, setEntries] = useState<Entry[]>(() => parseInitialEntries(existing))
  const [spanMoa, setSpanMoa] = useState(String(existing?.targetSpanMoa ?? 10))
  const [plotMode, setPlotMode] = useState<'H' | 'M'>('H')
  function applyEntries(next: Entry[]) {
    setEntries(next)
    const h = next.filter((e) => e.hit).length
    const m = next.length - h
    const seq = next.map((e) => (e.hit ? 'H' : 'M')).join(' ')
    setF((s) => ({ ...s, hits: String(h), misses: String(m), shotSequence: seq }))
  }
  const addTally = (hit: boolean) => {
    buzz(hit ? 18 : [8, 40, 8])
    applyEntries([...entries, { hit }])
  }
  const addImpact = (x: number, y: number) => {
    buzz(plotMode === 'H' ? 18 : [8, 40, 8])
    applyEntries([...entries, { hit: plotMode === 'H', x, y }])
  }
  const undoShot = () => applyEntries(entries.slice(0, -1))
  const clearShots = () => applyEntries([])

  const [autoWeather, setAutoWeather] = useState(existing?.weatherSource === 'auto')
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoErr, setGeoErr] = useState<string | null>(null)
  // Manually editing a weather field flips the source back to manual.
  const setW = (k: string) => (e: { target: { value: string } }) => {
    setAutoWeather(false)
    setF((s) => ({ ...s, [k]: e.target.value }))
  }

  async function useLocation() {
    setGeoBusy(true)
    setGeoErr(null)
    try {
      const w = await fetchCurrentWeather()
      setF((s) => ({
        ...s,
        weatherTemp: w.temp != null ? String(w.temp) : s.weatherTemp,
        windSpeed: w.windSpeed != null ? String(w.windSpeed) : s.windSpeed,
        windDir: w.windDir ?? s.windDir,
        humidity: w.humidity != null ? String(w.humidity) : s.humidity,
        pressure: w.pressure != null ? String(w.pressure) : s.pressure,
      }))
      setAutoWeather(true)
    } catch (e) {
      setGeoErr(e instanceof Error ? e.message : 'Weather lookup failed.')
    } finally {
      setGeoBusy(false)
    }
  }

  async function save() {
    if (busy) return
    setBusy(true)
    const positionedImpacts = entries
      .filter((e) => e.x != null && e.y != null)
      .map((e) => ({ x: e.x!, y: e.y!, hit: e.hit }))
    const weatherTouched = [f.weatherTemp, f.windSpeed, f.windDir, f.humidity, f.pressure, f.light].some(
      (v) => v.trim() !== '',
    )
    const data = {
      rifleId,
      barrelId: f.barrelId || undefined,
      ammunitionId: f.ammunitionId || undefined,
      target: f.target.trim() || undefined,
      date: f.date || undefined,
      time: f.time || undefined,
      distance: numOrUndef(f.distance),
      targetType: f.targetType.trim() || undefined,
      timeLimit: f.timeLimit.trim() || undefined,
      position: f.position.trim() || undefined,
      barricade: f.barricade.trim() || undefined,
      scope: f.scope.trim() || undefined,
      suppressor: f.suppressor.trim() || undefined,
      velocity: numOrUndef(f.velocity),
      dopeElevation: f.dopeElevation.trim() || undefined,
      dopeWindage: f.dopeWindage.trim() || undefined,
      elevationValue: numOrUndef(f.elevationValue),
      elevationUnit: numOrUndef(f.elevationValue) != null ? (f.elevationUnit as AngularUnit) : undefined,
      windageValue: numOrUndef(f.windageValue),
      windageUnit: numOrUndef(f.windageValue) != null ? (f.windageUnit as AngularUnit) : undefined,
      hits: numOrUndef(f.hits) ?? 0,
      misses: numOrUndef(f.misses) ?? 0,
      shotSequence: f.shotSequence.trim() || undefined,
      impacts: positionedImpacts.length ? positionedImpacts : undefined,
      targetSpanMoa: positionedImpacts.length ? (numOrUndef(spanMoa) ?? 10) : undefined,
      weatherTemp: numOrUndef(f.weatherTemp),
      windSpeed: numOrUndef(f.windSpeed),
      windDir: f.windDir.trim() || undefined,
      humidity: numOrUndef(f.humidity),
      pressure: numOrUndef(f.pressure),
      pressureType: numOrUndef(f.pressure) != null ? (f.pressureType as 'station' | 'absolute') : undefined,
      light: f.light.trim() || undefined,
      weatherSource: autoWeather ? ('auto' as const) : weatherTouched ? ('manual' as const) : undefined,
      notes: f.notes.trim() || undefined,
    }
    let id: string
    if (existing) {
      await updateSession(existing.id, data)
      id = existing.id
    } else {
      id = await createSession(data)
    }
    buzz([12, 30, 12]) // eyes-free "saved" confirmation
    navigate(`/sessions/${id}`, { replace: true, state: { justSaved: true } })
  }

  return (
    <Screen>
      <ScreenHeader title={existing ? 'Edit Course of Fire' : 'New Course of Fire'} back />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <SectionLabel>Setup</SectionLabel>
        <Row>
          <Field label="Barrel">
            <Select value={f.barrelId} onChange={set('barrelId')}>
              <option value="">— none —</option>
              {barrels.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label || 'Barrel'}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Load">
            <Select value={f.ammunitionId} onChange={set('ammunitionId')}>
              <option value="">— none —</option>
              {loads.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
        </Row>
        <Row>
          <Field label="Date">
            <TextInput type="date" value={f.date} onChange={set('date')} />
          </Field>
          <Field label="Time">
            <TextInput type="time" value={f.time} onChange={set('time')} />
          </Field>
        </Row>
        <Field label="Target / stage">
          <TextInput value={f.target} onChange={set('target')} placeholder="e.g. UKD steel, stage 3" />
        </Field>
        <Row>
          <Field label="Distance (yd)">
            <TextInput inputMode="numeric" value={f.distance} onChange={set('distance')} placeholder="600" />
          </Field>
          <Field label="Target type">
            <TextInput value={f.targetType} onChange={set('targetType')} placeholder="IPSC steel" />
          </Field>
        </Row>

        <Collapsible title="Stage &amp; gear">
          <Row>
            <Field label="Position">
              <TextInput value={f.position} onChange={set('position')} placeholder="Prone" />
            </Field>
            <Field label="Barricade">
              <TextInput value={f.barricade} onChange={set('barricade')} placeholder="Bipod" />
            </Field>
          </Row>
          <Row>
            <Field label="Time limit">
              <TextInput value={f.timeLimit} onChange={set('timeLimit')} placeholder="90 sec" />
            </Field>
            <Field label="Velocity (fps)">
              <TextInput inputMode="numeric" value={f.velocity} onChange={set('velocity')} placeholder="2710" />
            </Field>
          </Row>
          <Row>
            <Field label="Scope">
              <TextInput value={f.scope} onChange={set('scope')} />
            </Field>
            <Field label="Suppressor">
              <TextInput value={f.suppressor} onChange={set('suppressor')} />
            </Field>
          </Row>
        </Collapsible>

        <SectionLabel>Results</SectionLabel>
        <ShotLogger
          entries={entries}
          spanMoa={spanMoa}
          onSpanChange={setSpanMoa}
          plotMode={plotMode}
          onPlotMode={setPlotMode}
          distance={numOrUndef(f.distance)}
          onHit={() => addTally(true)}
          onMiss={() => addTally(false)}
          onPlot={addImpact}
          onUndo={undoShot}
          onClear={clearShots}
        />
        <Row>
          <Field label="Elevation hold" hint="Confirmed dial/hold — feeds the DOPE card.">
            <div style={{ display: 'flex', gap: 6 }}>
              <TextInput inputMode="decimal" value={f.elevationValue} onChange={set('elevationValue')} placeholder="4.2" />
              <Select value={f.elevationUnit} onChange={set('elevationUnit')} style={{ width: 86, flex: 'none' }}>
                <option value="MIL">MIL</option>
                <option value="MOA">MOA</option>
              </Select>
            </div>
          </Field>
          <Field label="Windage hold">
            <div style={{ display: 'flex', gap: 6 }}>
              <TextInput inputMode="decimal" value={f.windageValue} onChange={set('windageValue')} placeholder="0.3" />
              <Select value={f.windageUnit} onChange={set('windageUnit')} style={{ width: 86, flex: 'none' }}>
                <option value="MIL">MIL</option>
                <option value="MOA">MOA</option>
              </Select>
            </div>
          </Field>
        </Row>
        <Row>
          <Field label="DOPE notes" hint="Optional freeform, e.g. hold calls.">
            <TextInput value={f.dopeElevation} onChange={set('dopeElevation')} placeholder="4.2 MIL up" />
          </Field>
          <Field label="Wind notes">
            <TextInput value={f.dopeWindage} onChange={set('dopeWindage')} placeholder="0.3 L" />
          </Field>
        </Row>
        <Collapsible
          title="Weather"
          defaultOpen={autoWeather || existing?.weatherSource != null}
          right={
            <Button small variant="ghost" onClick={() => void useLocation()} disabled={geoBusy}>
              {geoBusy ? <Loader size={13} /> : <MapPin size={13} />} {autoWeather ? 'Auto' : 'Use location'}
            </Button>
          }
        >
          {geoErr && (
            <div style={{ color: 'var(--danger)', fontSize: 12, margin: '-4px 2px 10px' }}>{geoErr}</div>
          )}
          <Row>
            <Field label="Temp (°F)">
            <TextInput inputMode="numeric" value={f.weatherTemp} onChange={setW('weatherTemp')} />
          </Field>
          <Field label="Wind (mph)">
            <TextInput inputMode="numeric" value={f.windSpeed} onChange={setW('windSpeed')} />
          </Field>
        </Row>
        <Row>
          <Field label="Wind dir">
            <TextInput value={f.windDir} onChange={setW('windDir')} placeholder="NW / 3 o'clock" />
          </Field>
          <Field label="Humidity (%)">
            <TextInput inputMode="numeric" value={f.humidity} onChange={setW('humidity')} />
          </Field>
        </Row>
        <Row>
          <Field label="Pressure (inHg)" hint="Station = raw gauge; absolute = sea-level/altimeter.">
            <div style={{ display: 'flex', gap: 6 }}>
              <TextInput inputMode="decimal" value={f.pressure} onChange={setW('pressure')} />
              <Select value={f.pressureType} onChange={set('pressureType')} style={{ width: 104, flex: 'none' }}>
                <option value="station">Station</option>
                <option value="absolute">Absolute</option>
              </Select>
            </div>
          </Field>
          <Field label="Light">
            <TextInput value={f.light} onChange={setW('light')} placeholder="Overcast" />
          </Field>
        </Row>
        </Collapsible>

        <Collapsible title="Notes" defaultOpen={!!existing?.notes}>
          <Field label="Notes">
            <TextArea value={f.notes} onChange={set('notes')} />
          </Field>
        </Collapsible>

        <div style={{ display: 'flex', gap: 10, margin: '8px 0 24px' }}>
          <Button variant="secondary" full onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" full disabled={busy}>
            {existing ? 'Save' : 'Log It'}
          </Button>
        </div>
      </form>
    </Screen>
  )
}

/* ----------------------------------------------------------- shot logging */

/** One logged shot: a tally (hit only) or a positioned impact (hit + x/y). */
type Entry = { hit: boolean; x?: number; y?: number }

/**
 * Seed the entry list: from the saved impacts when present (so positions edit),
 * else position-less from the shot sequence, else from the hit/miss counts.
 */
function parseInitialEntries(existing?: Session): Entry[] {
  if (existing?.impacts && existing.impacts.length > 0) {
    return existing.impacts.map((i) => ({ hit: i.hit, x: i.x, y: i.y }))
  }
  const tokens = ((existing?.shotSequence ?? '').toUpperCase().match(/[HM]/g) ?? []) as ('H' | 'M')[]
  if (tokens.length > 0) return tokens.map((t) => ({ hit: t === 'H' }))
  const h = existing?.hits ?? 0
  const m = existing?.misses ?? 0
  if (h + m > 0)
    return [
      ...Array.from({ length: h }, () => ({ hit: true })),
      ...Array.from({ length: m }, () => ({ hit: false })),
    ]
  return []
}

/** Fire a short haptic buzz where supported (no-op otherwise). */
function buzz(pattern: number | number[]) {
  try {
    ;(navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.(pattern)
  } catch {
    /* unsupported / blocked */
  }
}

function ShotLogger({
  entries,
  spanMoa,
  onSpanChange,
  plotMode,
  onPlotMode,
  distance,
  onHit,
  onMiss,
  onPlot,
  onUndo,
  onClear,
}: {
  entries: Entry[]
  spanMoa: string
  onSpanChange: (v: string) => void
  plotMode: 'H' | 'M'
  onPlotMode: (m: 'H' | 'M') => void
  distance?: number
  onHit: () => void
  onMiss: () => void
  onPlot: (x: number, y: number) => void
  onUndo: () => void
  onClear: () => void
}) {
  const h = entries.filter((e) => e.hit).length
  const total = entries.length
  const m = total - h
  const rate = total ? Math.round((h / total) * 100) : 0
  const canEdit = total > 0
  const impacts = entries.filter((e) => e.x != null && e.y != null).map((e) => ({ x: e.x!, y: e.y!, hit: e.hit }))
  const span = Number(spanMoa) || 10
  const stats = groupStats(impacts, span, distance)
  const [plotOpen, setPlotOpen] = useState(impacts.length > 0)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={tallyRow}>
        <div style={tallyBox}>
          <div style={{ ...tallyNum, color: 'var(--ok)' }}>{h}</div>
          <div style={tallyLbl}>HITS</div>
        </div>
        <div style={tallyBox}>
          <div style={{ ...tallyNum, color: 'var(--text-dim)' }}>{m}</div>
          <div style={tallyLbl}>MISS</div>
        </div>
        <div style={tallyBox}>
          <div style={{ ...tallyNum, color: 'var(--brass)' }}>{total ? `${rate}%` : '—'}</div>
          <div style={tallyLbl}>HIT RATE</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <button type="button" onClick={onHit} style={{ ...bigTap, ...hitTap }}>
          HIT
        </button>
        <button type="button" onClick={onMiss} style={{ ...bigTap, ...missTap }}>
          MISS
        </button>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button type="button" onClick={onUndo} disabled={!canEdit} style={{ ...minorTap, opacity: canEdit ? 1 : 0.4 }}>
          <Undo2 size={14} /> Undo
        </button>
        <button type="button" onClick={onClear} disabled={!canEdit} style={{ ...minorTap, opacity: canEdit ? 1 : 0.4 }}>
          <X size={14} /> Clear
        </button>
      </div>
      {total > 0 && (
        <div style={chipWrap}>
          {entries.map((e, i) => (
            <span
              key={i}
              style={{ ...chip, ...(e.hit ? chipHit : chipMiss), ...(e.x != null ? chipPlotted : null) }}
              title={e.x != null ? 'plotted on target' : undefined}
            >
              {e.hit ? 'H' : 'M'}
            </span>
          ))}
        </div>
      )}

      {/* Optional: plot each shot's point of impact for group size & zero. */}
      <div style={{ marginTop: 10 }}>
        <button type="button" onClick={() => setPlotOpen((o) => !o)} style={collToggle}>
          {plotOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span style={collTitle}>Plot impacts on target{impacts.length ? ` · ${impacts.length}` : ' (optional)'}</span>
        </button>
      </div>
      {plotOpen && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(['H', 'M'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onPlotMode(mode)}
                style={{ ...plotModeBtn, ...(plotMode === mode ? (mode === 'H' ? plotModeHitOn : plotModeMissOn) : null) }}
              >
                Plot {mode === 'H' ? 'HIT' : 'MISS'}
              </button>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>Span</span>
              <TextInput
                inputMode="numeric"
                value={spanMoa}
                onChange={(e) => onSpanChange(e.target.value)}
                style={{ width: 54, textAlign: 'center', padding: '6px 4px' }}
              />
              <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>MOA</span>
            </div>
          </div>
          <TargetPad impacts={impacts} onPlot={onPlot} />
          {stats && (
            <div style={groupReadout}>
              <span>
                Group <strong style={{ color: '#f2f4f0' }}>{stats.extremeSpreadMoa.toFixed(1)} MOA</strong>
                {stats.extremeSpreadIn != null && ` · ${stats.extremeSpreadIn.toFixed(1)}"`}
              </span>
              <span>
                Center{' '}
                <strong style={{ color: stats.centerOffsetMoa < 0.25 ? 'var(--ok)' : 'var(--brass)' }}>
                  {stats.centerOffsetMoa.toFixed(1)} MOA
                </strong>{' '}
                off aim
              </span>
            </div>
          )}
          <div style={{ color: 'var(--text-faint)', fontSize: 11, margin: '6px 2px 0' }}>
            Tap the target where each shot landed. Rings are {(span / 4).toFixed(1)} MOA apart. Positioned shots
            also count in the tally above.
          </div>
        </div>
      )}

      <div style={{ color: 'var(--text-faint)', fontSize: 11, margin: '8px 2px 0' }}>
        Tap HIT/MISS as you go, or plot each shot on the target — the tally builds itself.
      </div>
    </div>
  )
}

/** Tap-to-plot target: a square diagram with concentric rings; dots are impacts. */
function TargetPad({
  impacts,
  onPlot,
}: {
  impacts: { x: number; y: number; hit: boolean }[]
  onPlot: (x: number, y: number) => void
}) {
  function handleClick(e: ReactMouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    const x = Math.max(-1, Math.min(1, px * 2 - 1))
    const y = Math.max(-1, Math.min(1, -(py * 2 - 1))) // up-positive
    onPlot(Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000)
  }
  // Group centroid (in diagram fractions) to mark the group center vs. aim.
  const cx = impacts.length ? impacts.reduce((s, i) => s + i.x, 0) / impacts.length : 0
  const cy = impacts.length ? impacts.reduce((s, i) => s + i.y, 0) / impacts.length : 0
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg
        viewBox="-1 -1 2 2"
        onClick={handleClick}
        style={{ width: '100%', maxWidth: 280, aspectRatio: '1 / 1', touchAction: 'manipulation', cursor: 'crosshair' }}
      >
        <rect x={-1} y={-1} width={2} height={2} rx={0.06} fill="var(--panel)" stroke="var(--line)" strokeWidth={0.01} />
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <circle key={r} cx={0} cy={0} r={r} fill="none" stroke="var(--line)" strokeWidth={0.008} />
        ))}
        <line x1={-1} y1={0} x2={1} y2={0} stroke="var(--line-soft)" strokeWidth={0.006} />
        <line x1={0} y1={-1} x2={0} y2={1} stroke="var(--line-soft)" strokeWidth={0.006} />
        {impacts.map((i, idx) => (
          <circle
            key={idx}
            cx={i.x}
            cy={-i.y}
            r={0.05}
            fill={i.hit ? 'var(--impact)' : 'transparent'}
            stroke={i.hit ? 'none' : 'var(--text-dim)'}
            strokeWidth={0.014}
          />
        ))}
        {impacts.length > 1 && (
          <g>
            <line x1={cx - 0.09} y1={-cy} x2={cx + 0.09} y2={-cy} stroke="var(--brass)" strokeWidth={0.012} />
            <line x1={cx} y1={-cy - 0.09} x2={cx} y2={-cy + 0.09} stroke="var(--brass)" strokeWidth={0.012} />
          </g>
        )}
      </svg>
    </div>
  )
}

/** A collapsible section so the quick result is logged first, detail on demand. */
function Collapsible({
  title,
  children,
  right,
  defaultOpen = false,
}: {
  title: ReactNode
  children: ReactNode
  right?: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginTop: 8 }}>
      <div style={collHead}>
        <button type="button" onClick={() => setOpen((o) => !o)} style={collToggle}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span style={collTitle}>{title}</span>
        </button>
        {right}
      </div>
      {open && <div style={{ marginTop: 6 }}>{children}</div>}
    </div>
  )
}

const tallyRow: CSSProperties = { display: 'flex', gap: 8 }
const tallyBox: CSSProperties = {
  flex: 1,
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: '10px 4px',
  textAlign: 'center',
}
const tallyNum: CSSProperties = { fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 26, lineHeight: 1 }
const tallyLbl: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9,
  letterSpacing: 0.6,
  color: 'var(--text-faint)',
  marginTop: 4,
}
const bigTap: CSSProperties = {
  flex: 1,
  minHeight: 64,
  borderRadius: 12,
  border: 'none',
  fontFamily: 'Rajdhani, sans-serif',
  fontWeight: 700,
  fontSize: 22,
  letterSpacing: 1,
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
}
const hitTap: CSSProperties = { background: 'var(--impact)', color: '#201200' }
const missTap: CSSProperties = { background: 'var(--panel-2)', color: 'var(--text-dim)', border: '1px solid var(--line)' }
const minorTap: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  minHeight: 40,
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'transparent',
  color: 'var(--text-dim)',
  fontSize: 12.5,
  cursor: 'pointer',
}
const chipWrap: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }
const chip: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 5,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  fontWeight: 700,
}
const chipHit: CSSProperties = { background: 'rgba(255,122,26,0.18)', color: 'var(--impact)' }
const chipMiss: CSSProperties = { background: 'var(--panel-2)', color: 'var(--text-faint)' }
const chipPlotted: CSSProperties = { outline: '1px solid var(--brass)', outlineOffset: -1 }
const plotModeBtn: CSSProperties = {
  flex: '0 0 auto',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--panel)',
  color: 'var(--text-dim)',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: 0.5,
  cursor: 'pointer',
}
const plotModeHitOn: CSSProperties = { background: 'var(--impact)', color: '#201200', borderColor: 'var(--impact)' }
const plotModeMissOn: CSSProperties = { background: 'var(--panel-2)', color: 'var(--text)', borderColor: 'var(--text-dim)' }
const groupReadout: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  marginTop: 8,
  padding: '8px 12px',
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 12,
  color: 'var(--text-dim)',
}
const collHead: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }
const collToggle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--brass)',
  padding: '6px 0',
  flex: 1,
  textAlign: 'left',
}
const collTitle: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: 'var(--brass)',
}
