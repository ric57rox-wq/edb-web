import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Crosshair } from 'lucide-react'
import { Screen, ScreenHeader, Card, Button, EmptyState, HealthBadge } from '../../ui/kit'
import { TurretDivider } from '../../ui/TurretDivider'
import { RifleForm } from './RifleForm'
import { useRifles, useAllBarrels } from '../../hooks/useData'
import { totalRounds } from '../../lib/format'
import type { Barrel } from '../../domain/types'

export function RiflesScreen() {
  const rifles = useRifles()
  const allBarrels = useAllBarrels()
  const [adding, setAdding] = useState(false)
  const navigate = useNavigate()

  const barrelsByRifle = new Map<string, Barrel[]>()
  for (const b of allBarrels ?? []) {
    const list = barrelsByRifle.get(b.rifleId) ?? []
    list.push(b)
    barrelsByRifle.set(b.rifleId, list)
  }

  return (
    <Screen>
      <ScreenHeader
        title="Rifles"
        right={
          <Button small onClick={() => setAdding(true)}>
            <Plus size={15} /> New
          </Button>
        }
      />
      <TurretDivider />

      {rifles == null ? null : rifles.length === 0 ? (
        <EmptyState
          title="No rifles yet"
          hint="Add your first rifle to start logging barrels, loads, and courses of fire."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus size={15} /> Add a rifle
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          {rifles.map((r) => {
            const barrels = barrelsByRifle.get(r.id) ?? []
            const rounds = totalRounds(barrels)
            const worst = barrels.reduce<Barrel | null>((w, b) => {
              if (!b.life) return w
              const bp = (b.rounds ?? 0) / b.life
              const wp = w?.life ? (w.rounds ?? 0) / w.life : -1
              return bp > wp ? b : w
            }, null)
            return (
              <Card key={r.id} onClick={() => navigate(`/rifles/${r.id}`)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={rifleName}>{r.name}</div>
                    <div style={rifleMeta}>
                      {[r.caliber, r.manufacturer, r.model].filter(Boolean).join(' · ') || 'No details'}
                    </div>
                  </div>
                  {worst && <HealthBadge rounds={worst.rounds ?? 0} life={worst.life} />}
                </div>
                <div style={footerRow}>
                  <span style={footMeta}>
                    <Crosshair size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                    {barrels.length} barrel{barrels.length === 1 ? '' : 's'}
                  </span>
                  <span style={footMeta}>
                    <strong style={{ color: 'var(--brass)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {rounds.toLocaleString()}
                    </strong>{' '}
                    rounds
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <RifleForm open={adding} onClose={() => setAdding(false)} />
    </Screen>
  )
}

const rifleName = {
  fontFamily: 'Rajdhani, sans-serif',
  fontWeight: 700,
  fontSize: 19,
  color: '#f2f4f0',
  letterSpacing: 0.3,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
}
const rifleMeta = { color: 'var(--text-dim)', fontSize: 12.5, marginTop: 2 }
const footerRow = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: 12,
  paddingTop: 10,
  borderTop: '1px solid var(--line-soft)',
}
const footMeta = { color: 'var(--text-dim)', fontSize: 12 }
