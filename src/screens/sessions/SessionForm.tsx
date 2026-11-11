import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Screen, ScreenHeader, Button, Field, TextInput, TextArea, Select, Row, SectionLabel } from '../../ui/kit'
import { useRifle, useBarrels, useAmmunition, useSession } from '../../hooks/useData'
import { createSession, updateSession } from '../../db/repositories/sessions'
import { numOrUndef, today } from '../../lib/format'
import type { Session } from '../../domain/types'

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
      existing={existing ?? undefined}
    />
  )
}

function SessionFormBody({
  rifleId,
  rifleScope,
  rifleSuppressor,
  existing,
}: {
  rifleId: string
  rifleScope?: string
  rifleSuppressor?: string
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
      hits: existing ? String(existing.hits ?? 0) : '0',
      misses: existing ? String(existing.misses ?? 0) : '0',
      shotSequence: TEXT(existing?.shotSequence),
      weatherTemp: NUM(existing?.weatherTemp),
      windSpeed: NUM(existing?.windSpeed),
      windDir: TEXT(existing?.windDir),
      humidity: NUM(existing?.humidity),
      pressure: NUM(existing?.pressure),
      light: TEXT(existing?.light),
      notes: TEXT(existing?.notes),
    }),
    [existing, rifleScope, rifleSuppressor],
  )

  const [f, setF] = useState<FormState>(initial)
  const set = (k: string) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }))

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
      hits: numOrUndef(f.hits) ?? 0,
      misses: numOrUndef(f.misses) ?? 0,
      shotSequence: f.shotSequence.trim() || undefined,
      weatherTemp: numOrUndef(f.weatherTemp),
      windSpeed: numOrUndef(f.windSpeed),
      windDir: f.windDir.trim() || undefined,
      humidity: numOrUndef(f.humidity),
      pressure: numOrUndef(f.pressure),
      light: f.light.trim() || undefined,
      weatherSource: existing?.weatherSource ?? (weatherTouched ? ('manual' as const) : undefined),
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

        <SectionLabel>Stage</SectionLabel>
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

        <SectionLabel>Results</SectionLabel>
        <Row>
          <Field label="Hits">
            <TextInput inputMode="numeric" value={f.hits} onChange={set('hits')} />
          </Field>
          <Field label="Misses">
            <TextInput inputMode="numeric" value={f.misses} onChange={set('misses')} />
          </Field>
        </Row>
        <Row>
          <Field label="DOPE elevation">
            <TextInput value={f.dopeElevation} onChange={set('dopeElevation')} placeholder="4.2 MIL" />
          </Field>
          <Field label="DOPE windage">
            <TextInput value={f.dopeWindage} onChange={set('dopeWindage')} placeholder="0.3 L" />
          </Field>
        </Row>
        <Field label="Shot sequence" hint="Per-shot notes, e.g. impact calls.">
          <TextInput value={f.shotSequence} onChange={set('shotSequence')} placeholder="H H M H H" />
        </Field>

        <SectionLabel>Weather</SectionLabel>
        <Row>
          <Field label="Temp (°F)">
            <TextInput inputMode="numeric" value={f.weatherTemp} onChange={set('weatherTemp')} />
          </Field>
          <Field label="Wind (mph)">
            <TextInput inputMode="numeric" value={f.windSpeed} onChange={set('windSpeed')} />
          </Field>
        </Row>
        <Row>
          <Field label="Wind dir">
            <TextInput value={f.windDir} onChange={set('windDir')} placeholder="NW / 3 o'clock" />
          </Field>
          <Field label="Humidity (%)">
            <TextInput inputMode="numeric" value={f.humidity} onChange={set('humidity')} />
          </Field>
        </Row>
        <Row>
          <Field label="Pressure (inHg)">
            <TextInput inputMode="numeric" value={f.pressure} onChange={set('pressure')} />
          </Field>
          <Field label="Light">
            <TextInput value={f.light} onChange={set('light')} placeholder="Overcast" />
          </Field>
        </Row>

        <SectionLabel>Notes</SectionLabel>
        <Field label="Notes">
          <TextArea value={f.notes} onChange={set('notes')} />
        </Field>

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
