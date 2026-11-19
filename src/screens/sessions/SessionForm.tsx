import { useMemo, useState, type ReactNode, type CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapPin, Loader, X, Undo2, ChevronDown, ChevronRight } from 'lucide-react'
import { Screen, ScreenHeader, Button, Field, TextInput, TextArea, Select, Row, SectionLabel } from '../../ui/kit'
import { useRifle, useBarrels, useAmmunition, useSession } from '../../hooks/useData'
import { createSession, updateSession } from '../../db/repositories/sessions'
import { fetchCurrentWeather } from '../../lib/weather'
import { numOrUndef, today } from '../../lib/format'
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

  // --- Shot logging: a tap-to-build H/M sequence that auto-tallies hits/misses.
  const [shots, setShots] = useState<Shot[]>(() => parseInitialShots(existing))
  function applyShots(next: Shot[]) {
    setShots(next)
    const h = next.filter((s) => s === 'H').length
    const m = next.length - h
    setF((s) => ({ ...s, hits: String(h), misses: String(m), shotSequence: next.join(' ') }))
  }
  const addShot = (k: Shot) => {
    buzz(k === 'H' ? 18 : [8, 40, 8])
    applyShots([...shots, k])
  }
  const undoShot = () => applyShots(shots.slice(0, -1))
  const clearShots = () => applyShots([])

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
    navigate(`/sessions/${id}`, { replace: true })
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
          shots={shots}
          onHit={() => addShot('H')}
          onMiss={() => addShot('M')}
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

type Shot = 'H' | 'M'

/** Seed the shot array from an existing session's sequence, or from its counts. */
function parseInitialShots(existing?: Session): Shot[] {
  const tokens = ((existing?.shotSequence ?? '').toUpperCase().match(/[HM]/g) ?? []) as Shot[]
  if (tokens.length > 0) return tokens
  const h = existing?.hits ?? 0
  const m = existing?.misses ?? 0
  if (h + m > 0) return [...(Array(h).fill('H') as Shot[]), ...(Array(m).fill('M') as Shot[])]
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
  shots,
  onHit,
  onMiss,
  onUndo,
  onClear,
}: {
  shots: Shot[]
  onHit: () => void
  onMiss: () => void
  onUndo: () => void
  onClear: () => void
}) {
  const h = shots.filter((s) => s === 'H').length
  const total = shots.length
  const m = total - h
  const rate = total ? Math.round((h / total) * 100) : 0
  const canEdit = total > 0
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
          {shots.map((s, i) => (
            <span key={i} style={{ ...chip, ...(s === 'H' ? chipHit : chipMiss) }}>
              {s}
            </span>
          ))}
        </div>
      )}
      <div style={{ color: 'var(--text-faint)', fontSize: 11, margin: '8px 2px 0' }}>
        Tap each shot as you go — the sequence and hit tally build themselves.
      </div>
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
