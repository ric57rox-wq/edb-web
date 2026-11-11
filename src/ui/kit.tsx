/**
 * Tactical UI kit — the shared primitives every EDB screen is built from, so the
 * dark green-black / brass / impact-orange look stays consistent. Inline-style
 * objects read the CSS variables defined in app/theme.css.
 */

import type { CSSProperties, ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import type { BarrelHealth } from '../domain/metrics'
import { barrelHealth, hitRateBand } from '../domain/metrics'

/* ------------------------------------------------------------------ layout */

export function Screen({ children }: { children: ReactNode }) {
  return <div style={{ padding: '18px 18px 8px' }}>{children}</div>
}

export function ScreenHeader({
  eyebrow = 'Electronic Data Book',
  title,
  back,
  right,
}: {
  eyebrow?: string
  title: string
  back?: boolean | (() => void)
  right?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div style={{ marginBottom: 6 }}>
      {back && (
        <button
          style={backBtn}
          onClick={() => (typeof back === 'function' ? back() : navigate(-1))}
        >
          <ChevronLeft size={15} /> Back
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{eyebrow}</div>
          <h1 style={h1}>{title}</h1>
        </div>
        {right && <div style={{ flexShrink: 0, paddingBottom: 2 }}>{right}</div>}
      </div>
    </div>
  )
}

export function Card({
  children,
  onClick,
  style,
}: {
  children: ReactNode
  onClick?: () => void
  style?: CSSProperties
}) {
  return (
    <div
      onClick={onClick}
      style={{ ...card, cursor: onClick ? 'pointer' : 'default', ...style }}
    >
      {children}
    </div>
  )
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={sectionRow}>
      <span style={sectionLabel}>{children}</span>
      {right}
    </div>
  )
}

export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ ...statValue, color: accent ?? '#f2f4f0' }}>{value}</div>
      <div style={statLabel}>{label}</div>
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div style={empty}>
      <div style={{ color: 'var(--text-dim)', fontSize: 13.5, fontWeight: 600 }}>{title}</div>
      {hint && <div style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ buttons */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
  full,
  small,
  style,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: BtnVariant
  type?: 'button' | 'submit'
  disabled?: boolean
  full?: boolean
  small?: boolean
  style?: CSSProperties
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btnBase,
        ...btnVariant[variant],
        ...(small ? { padding: '7px 12px', fontSize: 12.5 } : null),
        ...(full ? { width: '100%' } : null),
        ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : null),
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ fields */

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={fieldLabel}>{label}</label>
      {children}
      {hint && <div style={{ color: 'var(--text-faint)', fontSize: 11, marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...props.style }} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputStyle, minHeight: 72, resize: 'vertical', ...props.style }} />
}

export function Select({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select {...props} style={{ ...inputStyle, appearance: 'none', ...props.style }}>
      {children}
    </select>
  )
}

/** Two fields side by side. */
export function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>
}

/* ------------------------------------------------------------------ badges */

const healthColor: Record<BarrelHealth, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  replace: 'var(--impact)',
}
const healthText: Record<BarrelHealth, string> = {
  ok: 'OK',
  warn: 'WATCH',
  danger: 'WORN',
  replace: 'REPLACE',
}

export function Badge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        border: `1px solid ${color}`,
        color,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 9.5,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

export function HealthBadge({ rounds, life }: { rounds: number; life?: number | null }) {
  const h = barrelHealth(rounds, life)
  return <Badge color={healthColor[h]}>{healthText[h]}</Badge>
}

export function HitRateBadge({ hits, misses }: { hits: number; misses: number }) {
  const band = hitRateBand(hits, misses)
  if (!band) return null
  const color = band === 'high' ? 'var(--ok)' : band === 'mid' ? 'var(--brass)' : 'var(--danger)'
  const total = hits + misses
  const pct = total > 0 ? Math.round((hits / total) * 100) : 0
  return <Badge color={color}>{pct}%</Badge>
}

/** Thin progress bar for barrel life. */
export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--line-soft)' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color ?? 'var(--brass)' }} />
    </div>
  )
}

/* ------------------------------------------------------------------ styles */

const h1: CSSProperties = {
  fontFamily: 'Rajdhani, sans-serif',
  fontWeight: 700,
  fontSize: 28,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  margin: '2px 0 0',
  color: '#f2f4f0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
const backBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  background: 'none',
  border: 'none',
  color: 'var(--text-dim)',
  fontSize: 12.5,
  cursor: 'pointer',
  padding: '2px 0 8px',
  fontFamily: 'JetBrains Mono, monospace',
  letterSpacing: 0.5,
}
const card: CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: 14,
}
const sectionRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  margin: '20px 2px 10px',
}
const sectionLabel: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  color: 'var(--brass)',
}
const statValue: CSSProperties = {
  fontFamily: 'Rajdhani, sans-serif',
  fontWeight: 700,
  fontSize: 26,
  lineHeight: 1.05,
}
const statLabel: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
  marginTop: 3,
}
const empty: CSSProperties = {
  textAlign: 'center',
  padding: '34px 22px',
  background: 'var(--panel)',
  border: '1px dashed var(--line)',
  borderRadius: 10,
}
const btnBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  borderRadius: 6,
  padding: '10px 16px',
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid transparent',
  fontFamily: 'Inter, system-ui, sans-serif',
}
const btnVariant: Record<BtnVariant, CSSProperties> = {
  primary: { background: 'var(--impact)', color: '#201200', borderColor: 'var(--impact)' },
  secondary: { background: 'var(--panel-2)', color: 'var(--text)', borderColor: 'var(--line)' },
  ghost: { background: 'transparent', color: 'var(--text-dim)', borderColor: 'transparent' },
  danger: { background: 'transparent', color: 'var(--danger)', borderColor: 'var(--danger)' },
}
const fieldLabel: CSSProperties = {
  display: 'block',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
  marginBottom: 6,
}
const inputStyle: CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  color: 'var(--text)',
  borderRadius: 6,
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'Inter, system-ui, sans-serif',
}
