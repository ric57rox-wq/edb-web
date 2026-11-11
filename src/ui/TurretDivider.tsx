import type { CSSProperties } from 'react'

// The app's signature motif: a row of turret-click ticks with one lit in
// impact-orange. Ported from the original EDB prototype.
export function TurretDivider({ tickCount = 15 }: { tickCount?: number }) {
  const hit = Math.floor(tickCount / 2)
  return (
    <div style={row} aria-hidden="true">
      {Array.from({ length: tickCount }).map((_, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            width: 2,
            height: i === hit ? 12 : 8,
            background: i === hit ? 'var(--impact)' : 'var(--line)',
          }}
        />
      ))}
    </div>
  )
}

const row: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  height: 12,
  padding: '8px 4px',
}
