import { useState } from 'react'
import { Sheet } from '../../ui/Sheet'
import { Button, Field, TextInput, TextArea, Row, Select, SectionLabel } from '../../ui/kit'
import { createAmmunition, updateAmmunition } from '../../db/repositories/ammunition'
import { useRifle } from '../../hooks/useData'
import { factoryLoads, prefillFromFactory, FACTORY_LOADS } from '../../domain/loadLibrary'
import { numOrUndef } from '../../lib/format'
import type { Ammunition, DragModel } from '../../domain/types'

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
  const [bulletWeight, setBulletWeight] = useState(existing?.bulletWeight != null ? String(existing.bulletWeight) : '')
  const [bc, setBc] = useState(existing?.bc != null ? String(existing.bc) : '')
  const [bcModel, setBcModel] = useState<DragModel>(existing?.bcModel ?? 'G7')
  const [muzzleVelocity, setMuzzleVelocity] = useState(existing?.muzzleVelocity != null ? String(existing.muzzleVelocity) : '')
  const [mvTempSensitivity, setMvTempSensitivity] = useState(existing?.mvTempSensitivity != null ? String(existing.mvTempSensitivity) : '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [pickedFactory, setPickedFactory] = useState(false)

  // Factory-load picker — pre-fills the ballistic fields so the DOPE card works
  // on first use. Filter to the rifle's caliber when it matches our catalog,
  // else offer the whole (Hornady .308 Win) list.
  const rifle = useRifle(rifleId)
  const matches = factoryLoads(rifle?.caliber)
  const catalog = matches.length > 0 ? matches : FACTORY_LOADS

  function applyFactory(id: string) {
    const load = catalog.find((l) => l.id === id)
    if (!load) return
    const p = prefillFromFactory(load)
    if (!label.trim()) setLabel(p.label)
    setBulletWeight(String(p.bulletWeight))
    setBc(String(p.bc))
    setBcModel(p.bcModel)
    setMuzzleVelocity(String(p.muzzleVelocity))
    setPickedFactory(true)
  }

  async function save() {
    if (!label.trim() || busy) return
    setBusy(true)
    const data = {
      rifleId,
      label: label.trim(),
      bulletWeight: numOrUndef(bulletWeight),
      bc: numOrUndef(bc),
      bcModel,
      muzzleVelocity: numOrUndef(muzzleVelocity),
      mvTempSensitivity: numOrUndef(mvTempSensitivity),
      notes: notes.trim() || undefined,
    }
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

      <Field
        label="Start from a factory load"
        hint="Fills the ballistics below. Advertised figures — confirm against the box and true the MV."
      >
        <Select
          value=""
          onChange={(e) => {
            if (e.target.value) applyFactory(e.target.value)
          }}
        >
          <option value="">— pick to pre-fill —</option>
          {catalog.map((l) => (
            <option key={l.id} value={l.id}>
              Hornady {l.caliber} · {l.name}
            </option>
          ))}
        </Select>
      </Field>

      <SectionLabel>Ballistics</SectionLabel>
      {pickedFactory && (
        <div style={{ color: 'var(--text-faint)', fontSize: 11, margin: '-4px 2px 10px' }}>
          Pre-filled from a factory load. Muzzle velocity is barrel-dependent — confirm over a
          chronograph or true it from your logged holds on the DOPE card.
        </div>
      )}
      <Row>
        <Field label="Bullet (gr)">
          <TextInput inputMode="numeric" value={bulletWeight} onChange={(e) => setBulletWeight(e.target.value)} placeholder="140" />
        </Field>
        <Field label="Muzzle vel (fps)">
          <TextInput inputMode="numeric" value={muzzleVelocity} onChange={(e) => setMuzzleVelocity(e.target.value)} placeholder="2710" />
        </Field>
      </Row>
      <Row>
        <Field label="BC">
          <TextInput inputMode="decimal" value={bc} onChange={(e) => setBc(e.target.value)} placeholder="0.310" />
        </Field>
        <Field label="BC model">
          <Select value={bcModel} onChange={(e) => setBcModel(e.target.value as DragModel)}>
            <option value="G7">G7</option>
            <option value="G1">G1</option>
          </Select>
        </Field>
      </Row>
      <Field label="MV temp sensitivity (fps/°F)" hint="Optional — powder temp effect. Leave blank if unknown.">
        <TextInput inputMode="decimal" value={mvTempSensitivity} onChange={(e) => setMvTempSensitivity(e.target.value)} placeholder="1.0" />
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
