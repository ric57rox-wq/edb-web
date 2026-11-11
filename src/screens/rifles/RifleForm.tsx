import { useState } from 'react'
import { Sheet } from '../../ui/Sheet'
import { Button, Field, TextInput, TextArea, Row } from '../../ui/kit'
import { createRifle, updateRifle } from '../../db/repositories/rifles'
import type { Rifle } from '../../domain/types'

/**
 * Add / edit a rifle. `scope` and `suppressor` are stored as the rifle's
 * defaults and pre-fill the matching fields on every new course of fire.
 */
export function RifleForm({
  open,
  onClose,
  existing,
}: {
  open: boolean
  onClose: () => void
  existing?: Rifle
}) {
  return (
    <Sheet open={open} title={existing ? 'Edit Rifle' : 'New Rifle'} onClose={onClose}>
      {open && <RifleFormBody key={existing?.id ?? 'new'} onClose={onClose} existing={existing} />}
    </Sheet>
  )
}

function RifleFormBody({ onClose, existing }: { onClose: () => void; existing?: Rifle }) {
  const [name, setName] = useState(existing?.name ?? '')
  const [caliber, setCaliber] = useState(existing?.caliber ?? '')
  const [manufacturer, setManufacturer] = useState(existing?.manufacturer ?? '')
  const [model, setModel] = useState(existing?.model ?? '')
  const [acquired, setAcquired] = useState(existing?.acquired ?? '')
  const [scope, setScope] = useState(existing?.scope ?? '')
  const [suppressor, setSuppressor] = useState(existing?.suppressor ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!name.trim() || busy) return
    setBusy(true)
    const data = {
      name: name.trim(),
      caliber: caliber.trim() || undefined,
      manufacturer: manufacturer.trim() || undefined,
      model: model.trim() || undefined,
      acquired: acquired || undefined,
      scope: scope.trim() || undefined,
      suppressor: suppressor.trim() || undefined,
      notes: notes.trim() || undefined,
    }
    if (existing) await updateRifle(existing.id, data)
    else await createRifle(data)
    onClose()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Match Rifle" autoFocus required />
      </Field>
      <Row>
        <Field label="Caliber">
          <TextInput value={caliber} onChange={(e) => setCaliber(e.target.value)} placeholder="6.5 CM" />
        </Field>
        <Field label="Acquired">
          <TextInput type="date" value={acquired} onChange={(e) => setAcquired(e.target.value)} />
        </Field>
      </Row>
      <Row>
        <Field label="Manufacturer">
          <TextInput value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Tikka" />
        </Field>
        <Field label="Model">
          <TextInput value={model} onChange={(e) => setModel(e.target.value)} placeholder="T3x" />
        </Field>
      </Row>
      <Row>
        <Field label="Scope (default)">
          <TextInput value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Vortex Razor" />
        </Field>
        <Field label="Suppressor (default)">
          <TextInput value={suppressor} onChange={(e) => setSuppressor(e.target.value)} placeholder="None" />
        </Field>
      </Row>
      <Field label="Notes">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Button type="submit" full disabled={!name.trim() || busy}>
        {existing ? 'Save Changes' : 'Add Rifle'}
      </Button>
    </form>
  )
}
