import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Target } from 'lucide-react'
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Badge,
  EmptyState,
  HealthBadge,
  ProgressBar,
  SectionLabel,
} from '../../ui/kit'
import { TurretDivider } from '../../ui/TurretDivider'
import { Sheet, ConfirmDialog } from '../../ui/Sheet'
import { Field, TextInput } from '../../ui/kit'
import { RifleForm } from './RifleForm'
import { BarrelForm } from './BarrelForm'
import { AmmoForm } from './AmmoForm'
import { useRifle, useBarrels, useAmmunition } from '../../hooks/useData'
import { deleteRifle } from '../../db/repositories/rifles'
import { deleteBarrel, adjustBarrelRounds } from '../../db/repositories/barrels'
import { deleteAmmunition } from '../../db/repositories/ammunition'
import { barrelHealth, barrelLifePct } from '../../domain/metrics'
import { totalRounds, formatDate } from '../../lib/format'
import type { Barrel, Ammunition } from '../../domain/types'

const HEALTH_BAR: Record<string, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  replace: 'var(--impact)',
}

export function RifleDetailScreen() {
  const { rifleId } = useParams()
  const navigate = useNavigate()
  const rifle = useRifle(rifleId)
  const barrels = useBarrels(rifleId)
  const loads = useAmmunition(rifleId)

  const [editingRifle, setEditingRifle] = useState(false)
  const [confirmDeleteRifle, setConfirmDeleteRifle] = useState(false)
  const [barrelForm, setBarrelForm] = useState<{ open: boolean; existing?: Barrel }>({ open: false })
  const [ammoForm, setAmmoForm] = useState<{ open: boolean; existing?: Ammunition }>({ open: false })
  const [deleteBarrelId, setDeleteBarrelId] = useState<string | null>(null)
  const [deleteLoadId, setDeleteLoadId] = useState<string | null>(null)
  const [logRoundsBarrel, setLogRoundsBarrel] = useState<Barrel | null>(null)

  if (rifle === undefined) return null // loading
  if (rifle === null) {
    return (
      <Screen>
        <ScreenHeader title="Rifle" back />
        <EmptyState title="Rifle not found" hint="It may have been deleted." />
      </Screen>
    )
  }

  const details = [rifle.caliber, rifle.manufacturer, rifle.model].filter(Boolean).join(' · ')
  const rounds = totalRounds(barrels ?? [])

  return (
    <Screen>
      <ScreenHeader
        title={rifle.name}
        back
        right={
          <div style={{ display: 'flex', gap: 6 }}>
            <Button small variant="secondary" onClick={() => setEditingRifle(true)}>
              <Pencil size={14} />
            </Button>
            <Button small variant="danger" onClick={() => setConfirmDeleteRifle(true)}>
              <Trash2 size={14} />
            </Button>
          </div>
        }
      />
      {details && <div style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: -2 }}>{details}</div>}
      <TurretDivider />

      {/* Primary actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <Button full onClick={() => navigate(`/rifles/${rifle.id}/sessions/new`)}>
          <Target size={15} /> Log Course of Fire
        </Button>
        <Button full variant="secondary" onClick={() => navigate(`/rifles/${rifle.id}/dope`)}>
          DOPE Card
        </Button>
      </div>

      {/* Info */}
      {(rifle.acquired || rifle.scope || rifle.suppressor || rifle.notes) && (
        <Card style={{ marginTop: 14 }}>
          <div style={infoGrid}>
            {rifle.acquired && <InfoCell label="Acquired" value={formatDate(rifle.acquired)} />}
            {rifle.scope && <InfoCell label="Scope" value={rifle.scope} />}
            {rifle.suppressor && <InfoCell label="Suppressor" value={rifle.suppressor} />}
            <InfoCell label="Total Rounds" value={rounds.toLocaleString()} accent />
          </div>
          {rifle.notes && <div style={notes}>{rifle.notes}</div>}
        </Card>
      )}

      {/* Barrels */}
      <SectionLabel
        right={
          <Button small variant="ghost" onClick={() => setBarrelForm({ open: true })}>
            <Plus size={14} /> Add
          </Button>
        }
      >
        Barrels
      </SectionLabel>
      {barrels == null ? null : barrels.length === 0 ? (
        <EmptyState title="No barrels" hint="Add a barrel to track round count and life." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {barrels.map((b) => {
            const health = barrelHealth(b.rounds ?? 0, b.life)
            return (
              <Card key={b.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={rowTitle}>{b.label || 'Barrel'}</div>
                    <div style={rowMeta}>
                      {[b.length, b.twist && `twist ${b.twist}`, b.installed && formatDate(b.installed)]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </div>
                  </div>
                  <HealthBadge rounds={b.rounds ?? 0} life={b.life} />
                </div>
                <div style={{ margin: '10px 0 8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={roundsText}>
                      <strong style={{ color: 'var(--brass)' }}>{(b.rounds ?? 0).toLocaleString()}</strong>
                      {b.life ? ` / ${b.life.toLocaleString()}` : ''} rounds
                    </span>
                    {b.life ? (
                      <span style={{ ...rowMeta, fontFamily: 'JetBrains Mono, monospace' }}>
                        {Math.round(barrelLifePct(b.rounds ?? 0, b.life) * 100)}%
                      </span>
                    ) : null}
                  </div>
                  {b.life ? <ProgressBar value={barrelLifePct(b.rounds ?? 0, b.life)} color={HEALTH_BAR[health]} /> : null}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Button small variant="secondary" onClick={() => setLogRoundsBarrel(b)}>
                    + Log rounds
                  </Button>
                  <Button small variant="ghost" onClick={() => setBarrelForm({ open: true, existing: b })}>
                    <Pencil size={13} /> Edit
                  </Button>
                  <Button small variant="ghost" onClick={() => setDeleteBarrelId(b.id)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Ammunition / loads */}
      <SectionLabel
        right={
          <Button small variant="ghost" onClick={() => setAmmoForm({ open: true })}>
            <Plus size={14} /> Add
          </Button>
        }
      >
        Loads
      </SectionLabel>
      {loads == null ? null : loads.length === 0 ? (
        <EmptyState title="No loads" hint="Add the ammunition / handloads you shoot through this rifle." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loads.map((a) => (
            <Card key={a.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={rowTitle}>{a.label}</div>
                  {a.notes && <div style={rowMeta}>{a.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <Button small variant="ghost" onClick={() => setAmmoForm({ open: true, existing: a })}>
                    <Pencil size={13} />
                  </Button>
                  <Button small variant="ghost" onClick={() => setDeleteLoadId(a.id)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div style={{ height: 20 }} />

      {/* Modals */}
      <RifleForm open={editingRifle} onClose={() => setEditingRifle(false)} existing={rifle} />
      <BarrelForm
        open={barrelForm.open}
        onClose={() => setBarrelForm({ open: false })}
        rifleId={rifle.id}
        existing={barrelForm.existing}
      />
      <AmmoForm
        open={ammoForm.open}
        onClose={() => setAmmoForm({ open: false })}
        rifleId={rifle.id}
        existing={ammoForm.existing}
      />
      <LogRoundsSheet barrel={logRoundsBarrel} onClose={() => setLogRoundsBarrel(null)} />

      <ConfirmDialog
        open={confirmDeleteRifle}
        title="Delete this rifle?"
        message="This also removes its barrels, loads, courses of fire, and photos. This cannot be undone."
        onConfirm={async () => {
          await deleteRifle(rifle.id)
          setConfirmDeleteRifle(false)
          navigate('/rifles')
        }}
        onCancel={() => setConfirmDeleteRifle(false)}
      />
      <ConfirmDialog
        open={deleteBarrelId != null}
        title="Delete this barrel?"
        message="Its round count is removed. Courses of fire that referenced it are kept."
        onConfirm={async () => {
          if (deleteBarrelId) await deleteBarrel(deleteBarrelId)
          setDeleteBarrelId(null)
        }}
        onCancel={() => setDeleteBarrelId(null)}
      />
      <ConfirmDialog
        open={deleteLoadId != null}
        title="Delete this load?"
        onConfirm={async () => {
          if (deleteLoadId) await deleteAmmunition(deleteLoadId)
          setDeleteLoadId(null)
        }}
        onCancel={() => setDeleteLoadId(null)}
      />
    </Screen>
  )
}

function InfoCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={infoLabel}>{label}</div>
      <div style={{ ...infoValue, color: accent ? 'var(--brass)' : 'var(--text)' }}>{value}</div>
    </div>
  )
}

/** Quick "fired N rounds" entry that bumps a barrel's count without a full session. */
function LogRoundsSheet({ barrel, onClose }: { barrel: Barrel | null; onClose: () => void }) {
  const [n, setN] = useState('')
  const open = barrel != null

  async function save() {
    const count = Number(n)
    if (barrel && Number.isFinite(count) && count !== 0) {
      await adjustBarrelRounds(barrel.id, count)
    }
    setN('')
    onClose()
  }

  return (
    <Sheet open={open} title="Log Rounds" onClose={() => { setN(''); onClose() }}>
      {barrel && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <Badge color="var(--brass)">{barrel.label || 'Barrel'}</Badge>
            <span style={{ ...rowMeta, marginLeft: 8 }}>now {(barrel.rounds ?? 0).toLocaleString()} rounds</span>
          </div>
          <Field label="Rounds to add" hint="Use a negative number to correct an over-count.">
            <TextInput
              inputMode="numeric"
              value={n}
              onChange={(e) => setN(e.target.value)}
              placeholder="e.g. 20"
              autoFocus
            />
          </Field>
          <Button type="submit" full disabled={!n.trim()}>
            Add to count
          </Button>
        </form>
      )}
    </Sheet>
  )
}

const infoGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } as const
const infoLabel = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9,
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
  color: 'var(--text-faint)',
}
const infoValue = { fontSize: 14, marginTop: 2, fontWeight: 600 }
const notes = {
  marginTop: 12,
  paddingTop: 12,
  borderTop: '1px solid var(--line-soft)',
  color: 'var(--text-dim)',
  fontSize: 13,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap' as const,
}
const rowTitle = {
  fontFamily: 'Rajdhani, sans-serif',
  fontWeight: 700,
  fontSize: 16,
  color: '#f2f4f0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
}
const rowMeta = { color: 'var(--text-dim)', fontSize: 12, marginTop: 1 }
const roundsText = { fontSize: 12.5, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }
