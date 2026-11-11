import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { Screen, ScreenHeader, Card, Stat, EmptyState, Badge } from '../ui/kit'
import { TurretDivider } from '../ui/TurretDivider'
import { useRifles, useAllBarrels, useSessions } from '../hooks/useData'
import { hitRate, barrelHealth, type BarrelHealth } from '../domain/metrics'
import { totalRounds } from '../lib/format'

const C = { impact: '#ff7a1a', brass: '#c08a4e', ok: '#6fae7f', danger: '#c85a4a', dim: '#8b968e', line: '#33403a' }
const HEALTH_COLOR: Record<BarrelHealth, string> = { ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', replace: 'var(--impact)' }
const HEALTH_TEXT: Record<BarrelHealth, string> = { ok: 'OK', warn: 'WATCH', danger: 'WORN', replace: 'REPLACE' }

export function AnalyticsScreen() {
  const rifles = useRifles()
  const barrels = useAllBarrels()
  const sessions = useSessions()
  const navigate = useNavigate()

  const data = useMemo(() => {
    const rs = rifles ?? []
    const bs = barrels ?? []
    const ss = sessions ?? []

    let hits = 0
    let misses = 0
    for (const s of ss) {
      hits += s.hits || 0
      misses += s.misses || 0
    }

    const perRifle = rs.map((r) => {
      const rifleSessions = ss.filter((s) => s.rifleId === r.id)
      const rifleBarrels = bs.filter((b) => b.rifleId === r.id)
      let h = 0
      let m = 0
      for (const s of rifleSessions) {
        h += s.hits || 0
        m += s.misses || 0
      }
      const worst = rifleBarrels.reduce<BarrelHealth | null>((w, b) => {
        const hb = barrelHealth(b.rounds ?? 0, b.life)
        const rank: Record<BarrelHealth, number> = { ok: 0, warn: 1, danger: 2, replace: 3 }
        return w == null || rank[hb] > rank[w] ? hb : w
      }, null)
      return {
        id: r.id,
        name: r.name,
        sessions: rifleSessions.length,
        hits: h,
        misses: m,
        rate: hitRate(h, m),
        rounds: totalRounds(rifleBarrels),
        worst,
      }
    })

    return {
      totalSessions: ss.length,
      roundsFired: hits + misses,
      overallRate: hitRate(hits, misses),
      perRifle,
    }
  }, [rifles, barrels, sessions])

  const chartData = data.perRifle
    .filter((r) => r.hits + r.misses > 0)
    .map((r) => ({ name: shortName(r.name), pct: Math.round(r.rate * 100), id: r.id }))

  const loading = rifles == null || barrels == null || sessions == null

  return (
    <Screen>
      <ScreenHeader title="Analytics" />
      <TurretDivider />

      {loading ? null : data.totalSessions === 0 ? (
        <EmptyState title="No data yet" hint="Log courses of fire to see hit rate, rounds, and per-rifle trends." />
      ) : (
        <>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <Stat label="Sessions" value={data.totalSessions} />
              <Stat label="Rounds fired" value={data.roundsFired.toLocaleString()} accent="var(--brass)" />
              <Stat label="Hit rate" value={`${Math.round(data.overallRate * 100)}%`} accent="var(--impact)" />
            </div>
          </Card>

          {chartData.length > 0 && (
            <>
              <div style={sectionLabel}>Hit rate by rifle</div>
              <Card>
                <div style={{ width: '100%', height: Math.max(120, chartData.length * 44) }}>
                  <ResponsiveContainer>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 2, bottom: 2 }}>
                      <XAxis type="number" domain={[0, 100]} hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={92}
                        tick={{ fill: C.dim, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        contentStyle={{ background: '#1e2622', border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: '#f2f4f0' }}
                        formatter={(v: number) => [`${v}%`, 'Hit rate']}
                      />
                      <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={16}>
                        {chartData.map((d) => (
                          <Cell key={d.id} fill={d.pct >= 80 ? C.ok : d.pct >= 50 ? C.brass : C.danger} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </>
          )}

          <div style={sectionLabel}>Per rifle</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.perRifle.map((r) => (
              <Card key={r.id} onClick={() => navigate(`/rifles/${r.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={name}>{r.name}</div>
                    <div style={meta}>
                      {r.sessions} session{r.sessions === 1 ? '' : 's'} · {r.rounds.toLocaleString()} rounds
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    {r.worst && <Badge color={HEALTH_COLOR[r.worst]}>{HEALTH_TEXT[r.worst]}</Badge>}
                    {r.hits + r.misses > 0 && (
                      <Badge color={r.rate >= 0.8 ? 'var(--ok)' : r.rate >= 0.5 ? 'var(--brass)' : 'var(--danger)'}>
                        {Math.round(r.rate * 100)}%
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <div style={{ height: 16 }} />
        </>
      )}
    </Screen>
  )
}

function shortName(n: string): string {
  return n.length > 14 ? n.slice(0, 13) + '…' : n
}

const sectionLabel = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: 'uppercase' as const,
  color: 'var(--brass)',
  margin: '20px 2px 10px',
}
const name = {
  fontFamily: 'Rajdhani, sans-serif',
  fontWeight: 700,
  fontSize: 17,
  color: '#f2f4f0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
}
const meta = { color: 'var(--text-dim)', fontSize: 12, marginTop: 2 }
