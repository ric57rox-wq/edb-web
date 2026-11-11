import { useState, type ReactNode, type CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { Screen, ScreenHeader, Card, Button, Stat, HitRateBadge, SectionLabel } from '../../ui/kit'
import { TurretDivider } from '../../ui/TurretDivider'
import { ConfirmDialog } from '../../ui/Sheet'
import { PhotosSection } from './PhotosSection'
import { useSession, useRifle, useBarrels, useAmmunition } from '../../hooks/useData'
import { deleteSession } from '../../db/repositories/sessions'
import { hitRate, roundsFired } from '../../domain/metrics'
import { formatDate } from '../../lib/format'

export function SessionDetailScreen() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const session = useSession(sessionId)
  const rifle = useRifle(session?.rifleId)
  const barrels = useBarrels(session?.rifleId)
  const loads = useAmmunition(session?.rifleId)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
const autoTag: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9,
  letterSpacing: 1,
  color: 'var(--ok)',
  border: '1px solid var(--ok)',
  borderRadius: 3,
  padding: '1px 5px',
}
