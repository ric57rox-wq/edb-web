import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Screen, ScreenHeader, Card, EmptyState, HitRateBadge, TextInput } from '../../ui/kit'
import { TurretDivider } from '../../ui/TurretDivider'
import { useSessions, useRifles } from '../../hooks/useData'
import { roundsFired } from '../../domain/metrics'
import { formatDate } from '../../lib/format'

export function LogScreen() {
  const sessions = useSessions()
  const rifles = useRifles()
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  const rifleName = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rifles ?? []) m.set(r.id, r.name)
    return m
  }, [rifles])

  const filtered = useMemo(() => {
    const list = sessions ?? []
    const needle = q.trim().toLowerCase()
    if (!needle) return list
    return list.filter((s) => {
      const hay = [
        s.target,
        rifleName.get(s.rifleId),
        s.distance != null ? `${s.distance}` : '',
        s.date,
        s.targetType,
        s.position,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [sessions, q, rifleName])

  return (
    <Screen>
      <ScreenHeader title="Log" />
      <TurretDivider />

      <div style={searchWrap}>
        <Search size={15} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search target, rifle, distance, date…"
          style={{ border: 'none', background: 'transparent', padding: '8px 4px' }}
        />
      </div>

      {sessions == null ? null : sessions.length === 0 ? (
        <EmptyState title="No courses of fire yet" hint="Log one from a rifle's page to see it here." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" hint={`Nothing matches “${q}”.`} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((s) => {
            const total = roundsFired(s.hits, s.misses)
            return (
              <Card key={s.id} onClick={() => navigate(`/sessions/${s.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={title}>{s.target || formatDate(s.date)}</div>
                    <div style={meta}>
                      {[rifleName.get(s.rifleId), s.distance != null ? `${s.distance} yd` : null, formatDate(s.date)]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <HitRateBadge hits={s.hits} misses={s.misses} />
                    <div style={rounds}>
                      {s.hits}/{total}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <div style={{ height: 16 }} />
    </Screen>
  )
}

const searchWrap = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: '2px 12px',
  margin: '6px 0 14px',
}
const title = {
  fontFamily: 'Rajdhani, sans-serif',
  fontWeight: 700,
  fontSize: 17,
  color: '#f2f4f0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
}
const meta = { color: 'var(--text-dim)', fontSize: 12, marginTop: 2 }
const rounds = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  color: 'var(--text-faint)',
  marginTop: 4,
}
