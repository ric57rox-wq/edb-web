import { useState } from 'react'
import { Sheet } from '../../ui/Sheet'
import { Button, Field, TextInput, TextArea } from '../../ui/kit'
import { createAmmunition, updateAmmunition } from '../../db/repositories/ammunition'
import type { Ammunition } from '../../domain/types'

export function AmmoForm({
  open,
  onClose,
  rifleId,
  existing,
}: {
  open: boolean
  onClose: () => void
  rifleId: string
  existing?: Ammunition
}) {
  return (
    <Sheet open={open} title={existing ? 'Edit Load' : 'New Load'} onClose={onClose}>
      {open && (
        <AmmoFormBody key={existing?.id ?? 'new'} onClose={onClose} rifleId={rifleId} existing={existing} />
      )}
    </Sheet>
  )
}

function AmmoFormBody({
  onClose,
  rifleId,
  existing,
}: {
  onClose: () => void
  rifleId: string
  existing?: Ammunition
}) {
  const [label, setLabel] = useState(existing?.label ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!label.trim() || busy) return
    setBusy(true)
    const data = { rifleId, label: label.trim(), notes: notes.trim() || undefined }
    if (existing) await updateAmmunition(existing.id, data)
    else await createAmmunition(data)
    onClose()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Field label="Load" hint="e.g. 140 ELD-M · 41.5 H4350 · 2.800 COAL">
        <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="140 ELD-M / H4350" autoFocus required />
      </Field>
      <Field label="Notes">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Button type="submit" full disabled={!label.trim() || busy}>
        {existing ? 'Save Changes' : 'Add Load'}
      </Button>
    </form>
  )
}
