import { useEffect, useState, type ReactNode, type CSSProperties } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Pencil, Trash2, Check } from 'lucide-react'
import { Screen, ScreenHeader, Card, Button, Stat, HitRateBadge, SectionLabel } from '../../ui/kit'
import { TurretDivider } from '../../ui/TurretDivider'
import { ConfirmDialog } from '../../ui/Sheet'
import { PhotosSection } from './PhotosSection'
import { useSession, useRifle, useBarrels, useAmmunition } from '../../hooks/useData'
import { deleteSession } from '../../db/repositories/sessions'
import { hitRate, roundsFired } from '../../domain/metrics'
import { groupStats, zeroCorrection } from '../../domain/group'
import { formatDate } from '../../lib/format'
import type { Impact } from '../../domain/types'

export function SessionDetailScreen() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const session = useSession(sessionId)
  const rifle = useRifle(session?.rifleId)
  const barrels = useBarrels(session?.rifleId)
  const loads = useAmmunition(session?.rifleId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [savedToast, setSavedToast] = useState(
    (location.state as { justSaved?: boolean } | null)?.justSaved ?? false,
  )
  useEffect(() => {
    if (!savedToast) return
    // Consume the flag so a refresh/back doesn't re-show it, then auto-dismiss.
    window.history.replaceState({}, '')
    const t = setTimeout(() => setSavedToast(false), 2200)
    return () => clearTimeout(t)
  }, [savedToast])

  if (session === undefined) return null
  if (session === null) {
    return (
      <Screen>
        <ScreenHeader title="Course of Fire" back />
        <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Session not found.</div>
      </Screen>
    )
  }

  const barrel = barrels?.find((b) => b.id === session.barrelId)
  const load = loads?.find((a) => a.id === session.ammunitionId)
  const total = roundsFired(session.hits, session.misses)
  const pct = Math.round(hitRate(session.hits, session.misses) * 100)
  const title = session.target || formatDate(session.date)

  const weather = [
    session.weatherTemp != null && `${session.weatherTemp}°F`,
    session.windSpeed != null && `${session.windSpeed} mph${session.windDir ? ` ${session.windDir}` : ''}`,
    session.humidity != null && `${session.humidity}% RH`,
    session.pressure != null && `${session.pressure} inHg`,
    session.light,
  ].filter(Boolean) as string[]

  return (
    <Screen>
      {savedToast && (
        <div style={toastStyle} role="status">
          <Check size={15} /> Course of fire logged
        </div>
      )}
      <ScreenHeader
        eyebrow={rifle?.name ?? 'Course of Fire'}
        title={title}
        back
        right={
          <div style={{ display: 'flex', gap: 6 }}>
            <Button small variant="secondary" onClick={() => navigate(`/sessions/${session.id}/edit`)}>
              <Pencil size={14} />
            </Button>
            <Button small variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} />
            </Button>
          </div>
        }
      />
      <TurretDivider />

      {/* Hit-rate hero */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
          <Stat label="Hits" value={session.hits} accent="var(--ok)" />
          <Stat label="Misses" value={session.misses} accent={session.misses > 0 ? 'var(--danger)' : undefined} />
          <Stat label="Rounds" value={total} accent="var(--brass)" />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 26, color: '#f2f4f0' }}>
              {total > 0 ? `${pct}%` : '—'}
            </div>
            <div style={{ marginTop: 4 }}>
              <HitRateBadge hits={session.hits} misses={session.misses} />
            </div>
          </div>
        </div>
      </Card>

      <SectionLabel>Course</SectionLabel>
      <Card>
        <Grid>
          <Cell label="Date" value={formatDate(session.date)} />
          {session.time && <Cell label="Time" value={session.time} />}
          {session.distance != null && <Cell label="Distance" value={`${session.distance} yd`} />}
          {session.targetType && <Cell label="Target type" value={session.targetType} />}
          {barrel && <Cell label="Barrel" value={barrel.label || 'Barrel'} />}
          {load && <Cell label="Load" value={load.label} />}
          {session.position && <Cell label="Position" value={session.position} />}
          {session.barricade && <Cell label="Barricade" value={session.barricade} />}
          {session.timeLimit && <Cell label="Time limit" value={session.timeLimit} />}
          {session.velocity != null && <Cell label="Velocity" value={`${session.velocity} fps`} />}
          {session.scope && <Cell label="Scope" value={session.scope} />}
          {session.suppressor && <Cell label="Suppressor" value={session.suppressor} />}
        </Grid>
      </Card>

      {(session.dopeElevation || session.dopeWindage) && (
        <>
          <SectionLabel>DOPE</SectionLabel>
          <Card>
            <Grid>
              {session.dopeElevation && <Cell label="Elevation" value={session.dopeElevation} accent />}
              {session.dopeWindage && <Cell label="Windage" value={session.dopeWindage} accent />}
            </Grid>
          </Card>
        </>
      )}

      {session.impacts && session.impacts.length > 0 && (
        <GroupSection
          impacts={session.impacts}
          spanMoa={session.targetSpanMoa ?? 10}
          distance={session.distance}
        />
      )}

      {session.shotSequence && (
        <>
          <SectionLabel>Shot sequence</SectionLabel>
          <Card>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--text)', letterSpacing: 1 }}>
              {session.shotSequence}
            </div>
          </Card>
        </>
      )}

      {weather.length > 0 && (
        <>
          <SectionLabel right={session.weatherSource === 'auto' ? <span style={autoTag}>AUTO</span> : undefined}>
            Weather
          </SectionLabel>
          <Card>
            <div style={{ color: 'var(--text)', fontSize: 13.5, lineHeight: 1.6 }}>{weather.join('  ·  ')}</div>
          </Card>
        </>
      )}

      <PhotosSection sessionId={session.id} />

      {session.notes && (
        <>
          <SectionLabel>Notes</SectionLabel>
          <Card>
            <div style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
              {session.notes}
            </div>
          </Card>
        </>
      )}

      <div style={{ height: 24 }} />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this course of fire?"
        message="Its rounds are subtracted back off the barrel. This cannot be undone."
        onConfirm={async () => {
          await deleteSession(session.id)
          setConfirmDelete(false)
          navigate(-1)
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  )
}

/** Read-only group plot + zero stats from a session's logged impacts. */
function GroupSection({ impacts, spanMoa, distance }: { impacts: Impact[]; spanMoa: number; distance?: number }) {
  const stats = groupStats(impacts, spanMoa, distance)
  if (!stats) return null
  const z = zeroCorrection(stats)
  const cx = impacts.reduce((s, i) => s + i.x, 0) / impacts.length
  const cy = impacts.reduce((s, i) => s + i.y, 0) / impacts.length
  const vert = z ? (z.up >= 0 ? `${z.up.toFixed(1)} up` : `${(-z.up).toFixed(1)} down`) : null
  const horz = z ? (z.left >= 0 ? `${z.left.toFixed(1)} left` : `${(-z.left).toFixed(1)} right`) : null

  return (
    <>
      <SectionLabel>Group &amp; zero</SectionLabel>
      <Card>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <svg viewBox="-1 -1 2 2" style={{ width: 150, height: 150, flex: 'none' }}>
            <rect x={-1} y={-1} width={2} height={2} rx={0.06} fill="var(--panel-2)" stroke="var(--line)" strokeWidth={0.01} />
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
          <div style={{ flex: 1, minWidth: 150, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <GroupStat
              label="Group (ES)"
              value={`${stats.extremeSpreadMoa.toFixed(1)} MOA`}
              sub={stats.extremeSpreadIn != null ? `${stats.extremeSpreadIn.toFixed(1)}" @ ${distance} yd` : undefined}
            />
            <GroupStat label="Mean radius" value={`${stats.meanRadiusMoa.toFixed(2)} MOA`} />
            <GroupStat
              label="Center off aim"
              value={`${stats.centerOffsetMoa.toFixed(1)} MOA`}
              sub={stats.centerOffsetIn != null ? `${stats.centerOffsetIn.toFixed(1)}"` : undefined}
              accent={stats.centerOffsetMoa >= 0.25}
            />
            <GroupStat label="Shots" value={`${stats.hits}/${stats.shots}`} />
          </div>
        </div>
        {z && (
          <div style={zeroLine}>
            To zero: dial <strong style={{ color: '#f2f4f0' }}>{vert}</strong> and{' '}
            <strong style={{ color: '#f2f4f0' }}>{horz}</strong> (MOA) to center the group on aim.
          </div>
        )}
      </Card>
    </>
  )
}

function GroupStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div>
      <div style={cellLabel}>{label}</div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, marginTop: 2, color: accent ? 'var(--brass)' : '#f2f4f0' }}>
        {value}
      </div>
      {sub && <div style={{ color: 'var(--text-faint)', fontSize: 10.5, marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

function Grid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{children}</div>
}
function Cell({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div>
      <div style={cellLabel}>{label}</div>
      <div style={{ ...cellValue, color: accent ? 'var(--brass)' : 'var(--text)' }}>{value}</div>
    </div>
  )
}

const cellLabel: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
}
const cellValue: CSSProperties = { fontSize: 14, marginTop: 3, fontWeight: 600 }
const zeroLine: CSSProperties = {
  marginTop: 14,
  paddingTop: 12,
  borderTop: '1px solid var(--line-soft)',
  color: 'var(--text-dim)',
  fontSize: 12.5,
  lineHeight: 1.5,
}
const autoTag: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9,
  letterSpacing: 1,
  color: 'var(--ok)',
  border: '1px solid var(--ok)',
  borderRadius: 3,
  padding: '1px 5px',
}

const toastStyle: CSSProperties = {
  position: 'fixed',
  top: 'calc(10px + env(safe-area-inset-top))',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 30,
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  background: 'var(--ok)',
  color: '#06240f',
  fontSize: 13,
  fontWeight: 600,
  padding: '9px 16px',
  borderRadius: 999,
  boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
}
