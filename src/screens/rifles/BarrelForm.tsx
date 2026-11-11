import { useState } from 'react'
import { Sheet } from '../../ui/Sheet'
import { Button, Field, TextInput, TextArea, Row } from '../../ui/kit'
import { createBarrel, updateBarrel } from '../../db/repositories/barrels'
import { numOrUndef } from '../../lib/format'
import type { Barrel } from '../../domain/types'

export function BarrelForm({
  open,
  onClose,
  rifleId,
  existing,
}: {
  open: boolean
  onClose: () => void
  rifleId: string
  existing?: Barrel
}) {
  return (
    <Sheet open={open} title={existing ? 'Edit Barrel' : 'New Barrel'} onClose={onClose}>
      {open && (
        <BarrelFormBody key={existing?.id ?? 'new'} onClose={onClose} rifleId={rifleId} existing={existing} />
      )}
    </Sheet>
  )
}

function BarrelFormBody({
  onClose,
  rifleId,
  existing,
}: {
  onClose: () => void
  rifleId: string
  existing?: Barrel
}) {
  const [label, setLabel] = useState(existing?.label ?? '')
  const [length, setLength] = useState(existing?.length ?? '')
  const [twist, setTwist] = useState(existing?.twist ?? '')
  const [installed, setInstalled] = useState(existing?.installed ?? '')
  const [life, setLife] = useState(existing?.life != null ? String(existing.life) : '')
  const [rounds, setRounds] = useState(existing?.rounds != null ? String(existing.rounds) : '0')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (busy) return
    setBusy(true)
    const data = {
      rifleId,
      label: label.trim() || undefined,
      length: length.trim() || undefined,
      twist: twist.trim() || undefined,
      installed: installed || undefined,
      life: numOrUndef(life),
      rounds: numOrUndef(rounds) ?? 0,
      notes: notes.trim() || undefined,
    }
    if (existing) await updateBarrel(existing.id, data)
    else await createBarrel(data)
    onClose()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Field label="Label">
        <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Proof 22in" autoFocus />
      </Field>
      <Row>
        <Field label="Length">
          <TextInput value={length} onChange={(e) => setLength(e.target.value)} placeholder='22"' />
        </Field>
        <Field label="Twist">
          <TextInput value={twist} onChange={(e) => setTwist(e.target.value)} placeholder="1:8" />
        </Field>
      </Row>
      <Row>
        <Field label="Barrel life (rounds)" hint="Target round count before replacement.">
          <TextInput inputMode="numeric" value={life} onChange={(e) => setLife(e.target.value)} placeholder="2500" />
        </Field>
        <Field label="Current rounds">
          <TextInput inputMode="numeric" value={rounds} onChange={(e) => setRounds(e.target.value)} />
        </Field>
      </Row>
      <Field label="Installed">
        <TextInput type="date" value={installed} onChange={(e) => setInstalled(e.target.value)} />
      </Field>
      <Field label="Notes">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Button type="submit" full disabled={busy}>
        {existing ? 'Save Changes' : 'Add Barrel'}
      </Button>
    </form>
  )
}
