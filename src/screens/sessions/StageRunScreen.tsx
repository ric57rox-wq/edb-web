import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, X, ChevronLeft, ChevronRight, Flag, Target } from 'lucide-react'
import { Screen, ScreenHeader, Button, Field, TextInput, Select, Row, SectionLabel, Card } from '../../ui/kit'
import { TurretDivider } from '../../ui/TurretDivider'
import { useRifle, useBarrels, useAmmunition } from '../../hooks/useData'
import { useWakeLock } from '../../hooks/useWakeLock'
import { createSession } from '../../db/repositories/sessions'
import { canSolve, solverInputsFor } from '../../domain/dopePredict'
import { solve } from '../../domain/ballistics'
import { numOrUndef, today } from '../../lib/format'
import type { AngularUnit, StageTarget } from '../../domain/types'

/** Build and run a multi-target stage: holds pre-solved, tapped through on the clock. */
export function StageRunScreen() {
  const { rifleId } = useParams()
  const rifle = useRifle(rifleId)
  const barrels = useBarrels(rifleId) ?? []
  const loads = useAmmunition(rifleId) ?? []
  const navigate = useNavigate()
  useWakeLock(true)

  const [phase, setPhase] = useState<'setup' | 'run'>('setup')
  const [loadId, setLoadId] = useState('')
  const [barrelId, setBarrelId] = useState('')
  const [targets, setTargets] = useState<StageTarget[]>([])
  const [newDist, setNewDist] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [idx, setIdx] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (loadId === '' && loads.length > 0) setLoadId(loads[0].id)
  }, [loads, loadId])

  const unit: AngularUnit = rifle?.zeroUnit ?? 'MIL'
  const load = loads.find((l) => l.id === loadId)
  const twistDir = barrels.find((b) => b.twistDir)?.twistDir
  const solvable = canSolve(load)

  /** Solve the elevation + 10 mph reference wind hold for a distance (standard atmosphere). */
  const holdFor = useMemo(() => {
    return (distance: number): { elev?: number; wind?: number; sub?: boolean } => {
      if (!rifle || !load || !solvable || !distance) return {}
      const input = solverInputsFor(rifle, load, unit, undefined, 10, twistDir)
      const p = solve(input, [distance])[0]
      if (!p) return {}
      return { elev: p.elevation, wind: Math.abs(p.windage), sub: !p.supersonic }
    }
  }, [rifle, load, solvable, unit, twistDir])

  function addTarget() {
    const d = numOrUndef(newDist)
    if (d == null || d <= 0) return
    setTargets((t) => [...t, { distance: d, label: newLabel.trim() || undefined, hits: 0, misses: 0 }])
    setNewDist('')
    setNewLabel('')
  }
  function removeTarget(i: number) {
    setTargets((t) => t.filter((_, k) => k !== i))
  }

  function start() {
    if (targets.length === 0) return
    setIdx(0)
    setStartedAt(Date.now())
    setPhase('run')
  }

  function tap(hit: boolean) {
    buzz(hit ? 18 : [8, 40, 8])
    setTargets((t) =>
      t.map((tg, k) => (k === idx ? { ...tg, hits: tg.hits + (hit ? 1 : 0), misses: tg.misses + (hit ? 0 : 1) } : tg)),
    )
  }
  function undo() {
    setTargets((t) =>
      t.map((tg, k) => {
        if (k !== idx) return tg
        if (tg.misses > 0) return { ...tg, misses: tg.misses - 1 }
        if (tg.hits > 0) return { ...tg, hits: tg.hits - 1 }
        return tg
      }),
    )
  }

  async function finish() {
    if (busy || !rifleId) return
    setBusy(true)
    const totalHits = targets.reduce((s, t) => s + t.hits, 0)
    const totalMisses = targets.reduce((s, t) => s + t.misses, 0)
    const id = await createSession({
      rifleId,
      barrelId: barrelId || undefined,
      ammunitionId: loadId || undefined,
      target: `Stage · ${targets.length} target${targets.length === 1 ? '' : 's'}`,
      date: today(),
      distance: targets[0]?.distance,
      hits: totalHits,
      misses: totalMisses,
      stageTargets: targets,
    })
    buzz([12, 30, 12])
    navigate(`/sessions/${id}`, { replace: true, state: { justSaved: true } })
  }

  if (rifle === undefined) return null
  if (!rifleId || rifle === null) {
    return (
      <Screen>
        <ScreenHeader title="Stage" back />
        <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Rifle not found.</div>
      </Screen>
    )
  }

  // ---------- SETUP ----------
  if (phase === 'setup') {
    return (
      <Screen>
        <ScreenHeader eyebrow={rifle.name} title="New Stage" back />
        <TurretDivider />

        <SectionLabel>Setup</SectionLabel>
        <Row>
          <Field label="Load">
            <Select value={loadId} onChange={(e) => setLoadId(e.target.value)}>
              <option value="">— none —</option>
              {loads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Barrel">
            <Select value={barrelId} onChange={(e) => setBarrelId(e.target.value)}>
              <option value="">— none —</option>
              {barrels.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label || 'Barrel'}
                </option>
              ))}
            </Select>
          </Field>
        </Row>
        {!solvable && (
          <div style={{ color: 'var(--text-faint)', fontSize: 11, margin: '0 2px 10px' }}>
            Add this load's BC &amp; muzzle velocity to pre-solve each target's hold.
          </div>
        )}

        <SectionLabel>Targets</SectionLabel>
        {targets.length > 0 && (
          <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 10 }}>
            {targets.map((t, i) => {
              const h = holdFor(t.distance)
              return (
                <div key={i} style={{ ...targetRow, borderTop: i === 0 ? 'none' : '1px solid var(--line-soft)' }}>
                  <span style={{ color: 'var(--brass)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, width: 70 }}>
                    {t.distance} yd
                  </span>
                  <span style={{ flex: 1, color: 'var(--text-dim)', fontSize: 12.5, minWidth: 0 }}>{t.label || `Target ${i + 1}`}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: '#f2f4f0' }}>
                    {h.elev != null ? `${fmtHold(h.elev, unit)} ${unit}` : '—'}
                  </span>
                  <button type="button" onClick={() => removeTarget(i)} style={iconBtn} aria-label="Remove target">
                    <X size={15} />
                  </button>
                </div>
              )
            })}
          </Card>
        )}
        <Row>
          <Field label="Distance (yd)">
            <TextInput inputMode="numeric" value={newDist} onChange={(e) => setNewDist(e.target.value)} placeholder="600" />
          </Field>
          <Field label="Label (optional)">
            <TextInput value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="UKD steel" />
          </Field>
        </Row>
        <Button variant="secondary" full onClick={addTarget} disabled={numOrUndef(newDist) == null}>
          <Plus size={15} /> Add target
        </Button>

        <div style={{ margin: '18px 0 24px' }}>
          <Button full onClick={start} disabled={targets.length === 0}>
            <Flag size={15} /> Start stage ({targets.length})
          </Button>
        </div>
      </Screen>
    )
  }

  // ---------- RUN ----------
  const cur = targets[idx]
  const h = holdFor(cur.distance)
  return (
    <Screen>
      <ScreenHeader
        eyebrow={rifle.name}
        title={`Target ${idx + 1} / ${targets.length}`}
        back
        right={<StageClock startedAt={startedAt} />}
      />
      <TurretDivider />

      <Card>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 30, color: 'var(--brass)' }}>
              {cur.distance} <span style={{ fontSize: 16 }}>yd</span>
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>{cur.label || `Target ${idx + 1}`}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={holdLbl}>ELEV</div>
            <div style={holdVal}>{h.elev != null ? `${fmtHold(h.elev, unit)}` : '—'}</div>
            <div style={holdLbl}>
              {unit}
              {h.wind != null ? ` · W10 ${fmtHold(h.wind, unit)}` : ''}
              {h.sub ? ' · sub' : ''}
            </div>
          </div>
        </div>
      </Card>

      <div style={tallyRow}>
        <div style={tallyBox}>
          <div style={{ ...tallyNum, color: 'var(--ok)' }}>{cur.hits}</div>
          <div style={tallyLbl}>HITS</div>
        </div>
        <div style={tallyBox}>
          <div style={{ ...tallyNum, color: 'var(--text-dim)' }}>{cur.misses}</div>
          <div style={tallyLbl}>MISS</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <button type="button" onClick={() => tap(true)} style={{ ...bigTap, ...hitTap }}>
          HIT
        </button>
        <button type="button" onClick={() => tap(false)} style={{ ...bigTap, ...missTap }}>
          MISS
        </button>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button type="button" onClick={undo} style={minorTap}>
          Undo
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <Button variant="secondary" full onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
          <ChevronLeft size={16} /> Prev
        </Button>
        {idx < targets.length - 1 ? (
          <Button full onClick={() => setIdx((i) => Math.min(targets.length - 1, i + 1))}>
            Next <ChevronRight size={16} />
          </Button>
        ) : (
          <Button full onClick={() => void finish()} disabled={busy}>
            <Target size={15} /> Finish &amp; save
          </Button>
        )}
      </div>

      {/* Jump chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
        {targets.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            style={{ ...jumpChip, ...(i === idx ? jumpChipOn : null) }}
          >
            {t.distance}
          </button>
        ))}
      </div>
      <div style={{ height: 24 }} />
    </Screen>
  )
}

function StageClock({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (startedAt == null) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startedAt])
  if (startedAt == null) return null
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000))
  const mm = String(Math.floor(sec / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return (
    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, color: 'var(--brass)' }}>
      {mm}:{ss}
    </span>
  )
}

function fmtHold(v: number, unit: AngularUnit): string {
  return unit === 'MOA' ? v.toFixed(2) : v.toFixed(1)
}

function buzz(pattern: number | number[]) {
  try {
    ;(navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.(pattern)
  } catch {
    /* unsupported / blocked */
  }
}

const targetRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }
const iconBtn: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-faint)',
  cursor: 'pointer',
  padding: 4,
  flex: 'none',
}
const tallyRow: CSSProperties = { display: 'flex', gap: 8, marginTop: 12 }
const tallyBox: CSSProperties = {
  flex: 1,
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: '12px 4px',
  textAlign: 'center',
}
const tallyNum: CSSProperties = { fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 30, lineHeight: 1 }
const tallyLbl: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9,
  letterSpacing: 0.6,
  color: 'var(--text-faint)',
  marginTop: 4,
}
const bigTap: CSSProperties = {
  flex: 1,
  minHeight: 72,
  borderRadius: 12,
  border: 'none',
  fontFamily: 'Rajdhani, sans-serif',
  fontWeight: 700,
  fontSize: 24,
  letterSpacing: 1,
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
}
const hitTap: CSSProperties = { background: 'var(--impact)', color: '#201200' }
const missTap: CSSProperties = { background: 'var(--panel-2)', color: 'var(--text-dim)', border: '1px solid var(--line)' }
const minorTap: CSSProperties = {
  flex: 1,
  minHeight: 40,
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'transparent',
  color: 'var(--text-dim)',
  fontSize: 12.5,
  cursor: 'pointer',
}
const holdLbl: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9,
  letterSpacing: 1,
  color: 'var(--text-faint)',
}
const holdVal: CSSProperties = { fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 30, color: '#f2f4f0', lineHeight: 1 }
const jumpChip: CSSProperties = {
  minWidth: 44,
  padding: '7px 8px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--panel)',
  color: 'var(--text-dim)',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 12,
  cursor: 'pointer',
}
const jumpChipOn: CSSProperties = { background: 'var(--brass)', color: '#201200', borderColor: 'var(--brass)' }
