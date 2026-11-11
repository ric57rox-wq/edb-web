import { useMemo, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { Share2, Copy, Check } from 'lucide-react'
import { Screen, ScreenHeader, Card, Button, Field, Select, EmptyState } from '../../ui/kit'
import { TurretDivider } from '../../ui/TurretDivider'
import { useRifle, useAmmunition, useSessionsForRifle } from '../../hooks/useData'
import { buildDopeCard } from '../../domain/dope'
import { formatDate } from '../../lib/format'

const ALL = 'all'
const UNSPEC = 'none'

export function DopeCardScreen() {
  const { rifleId } = useParams()
  const rifle = useRifle(rifleId)
  const loads = useAmmunition(rifleId) ?? []
  const sessions = useSessionsForRifle(rifleId) ?? []
  const [loadId, setLoadId] = useState<string>(ALL)
  const [copied, setCopied] = useState(false)

  const filtered = useMemo(() => {
    if (loadId === ALL) return sessions
    if (loadId === UNSPEC) return sessions.filter((s) => !s.ammunitionId)
    return sessions.filter((s) => s.ammunitionId === loadId)
  }, [sessions, loadId])

  const entries = useMemo(() => buildDopeCard(filtered), [filtered])
  const loadLabel =
    loadId === ALL ? 'All loads' : loadId === UNSPEC ? 'Unspecified' : loads.find((l) => l.id === loadId)?.label

  if (rifle === undefined) return null
  if (!rifle) {
    return (
      <Screen>
        <ScreenHeader title="DOPE Card" back />
        <EmptyState title="Rifle not found" />
      </Screen>
    )
  }

  const shareText = buildShareText(rifle.name, loadLabel, entries)

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `DOPE — ${rifle!.name}`, text: shareText })
        return
      } catch {
        /* cancelled or unsupported — fall back to copy */
      }
    }
    await copy()
  }

  return (
    <Screen>
      <ScreenHeader eyebrow={rifle.name} title="DOPE Card" back />
      <TurretDivider />

      <Field label="Load">
        <Select value={loadId} onChange={(e) => setLoadId(e.target.value)}>
          <option value={ALL}>All loads</option>
          {loads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
          <option value={UNSPEC}>Unspecified</option>
        </Select>
      </Field>

      {entries.length === 0 ? (
        <EmptyState
          title="No DOPE yet"
          hint="Log courses of fire with a distance and elevation/windage holds to build this card."
        />
      ) : (
        <>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ ...rowStyle, ...headRow }}>
              <span style={{ ...cell, ...distCell }}>DIST</span>
              <span style={cell}>ELEV</span>
              <span style={cell}>WIND</span>
              <span style={{ ...cell, ...nCell }}>N</span>
            </div>
            {entries.map((e, i) => (
              <div key={e.distance} style={{ ...rowStyle, borderTop: i === 0 ? 'none' : '1px solid var(--line-soft)' }}>
                <span style={{ ...cell, ...distCell, color: 'var(--brass)' }}>{e.distance}</span>
                <span style={{ ...cell, color: '#f2f4f0' }}>{e.elevation || '—'}</span>
                <span style={{ ...cell, color: '#f2f4f0' }}>{e.windage || '—'}</span>
                <span style={{ ...cell, ...nCell }} title={e.lastDate ? `last ${formatDate(e.lastDate)}` : ''}>
                  {e.samples}
                </span>
              </div>
            ))}
          </Card>
          <div style={{ color: 'var(--text-faint)', fontSize: 11, margin: '8px 2px 0' }}>
            Distances in yards. Holds are the most recently logged at each distance; N = confirming sessions.
          </div>

          <div style={{ display: 'flex', gap: 10, margin: '16px 0 24px' }}>
            <Button variant="secondary" full onClick={() => void copy()}>
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button full onClick={() => void share()}>
              <Share2 size={15} /> Share
            </Button>
          </div>
        </>
      )}
    </Screen>
  )
}

function buildShareText(
  rifleName: string,
  loadLabel: string | undefined,
  entries: ReturnType<typeof buildDopeCard>,
): string {
  const head = `EDB DOPE — ${rifleName}${loadLabel && loadLabel !== 'All loads' ? ` · ${loadLabel}` : ''}`
  const lines = entries.map(
    (e) =>
      `${String(e.distance).padStart(4)} yd   E ${(e.elevation || '—').padEnd(8)} W ${(e.windage || '—').padEnd(8)} (n=${e.samples})`,
  )
  return [head, '─'.repeat(head.length), ...lines].join('\n')
}

const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', padding: '11px 14px' }
const headRow: CSSProperties = { background: 'var(--panel-2)' }
const cell: CSSProperties = {
  flex: 1,
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 13,
  color: 'var(--text-dim)',
  letterSpacing: 0.5,
}
const distCell: CSSProperties = { flex: 0.7, fontWeight: 700 }
const nCell: CSSProperties = { flex: 0.4, textAlign: 'right', color: 'var(--text-faint)' }
