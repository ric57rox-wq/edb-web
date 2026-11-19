import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Crosshair, Share, Target, FlaskConical, ClipboardList } from 'lucide-react'
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
  const showInstallHint = isIosSafariUninstalled()

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
        <>
          <Card style={{ marginBottom: 12 }}>
            <div style={introTitle}>How EDB is organized</div>
            <div style={introStep}>
              <Crosshair size={15} style={introIcon} />
              <span>
                <strong style={introLead}>Rifle</strong> — your firearm and its defaults (scope, zero).
              </span>
            </div>
            <div style={introStep}>
              <Target size={15} style={introIcon} />
              <span>
                <strong style={introLead}>Barrel</strong> — tracks round count &amp; life per barrel.
              </span>
            </div>
            <div style={introStep}>
              <FlaskConical size={15} style={introIcon} />
              <span>
                <strong style={introLead}>Load</strong> — ammo with BC &amp; muzzle velocity for the ballistic solver.
              </span>
            </div>
            <div style={introStep}>
              <ClipboardList size={15} style={introIcon} />
              <span>
                <strong style={introLead}>Course of fire</strong> — each range session: holds, hits, conditions.
              </span>
            </div>
            {showInstallHint && (
              <div style={installHint}>
                <Share size={14} style={{ verticalAlign: '-2px', marginRight: 5, color: 'var(--brass)' }} />
                Install EDB: tap Share, then <strong>Add to Home Screen</strong>.
              </div>
            )}
          </Card>
          <EmptyState
            title="No rifles yet"
            hint="Add your first rifle to start logging barrels, loads, and courses of fire."
            action={
              <Button onClick={() => setAdding(true)}>
                <Plus size={15} /> Add a rifle
              </Button>
            }
          />
        </>
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

/** True on an iOS browser that isn't the installed standalone PWA. */
function isIosSafariUninstalled(): boolean {
  try {
    const ua = navigator.userAgent
    const isIos = /iphone|ipad|ipod/i.test(ua)
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    return isIos && !standalone
  } catch {
    return false
  }
}

const introTitle: CSSProperties = {
  fontFamily: 'Rajdhani, sans-serif',
  fontWeight: 700,
  fontSize: 16,
  color: '#f2f4f0',
  marginBottom: 10,
}
const introStep: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 9,
  fontSize: 12.5,
  color: 'var(--text-dim)',
  lineHeight: 1.5,
  marginBottom: 8,
}
const introIcon: CSSProperties = { color: 'var(--brass)', flex: 'none', marginTop: 1 }
const introLead: CSSProperties = { color: 'var(--text)' }
const installHint: CSSProperties = {
  marginTop: 10,
  paddingTop: 10,
  borderTop: '1px solid var(--line-soft)',
  fontSize: 12,
  color: 'var(--text-dim)',
}
