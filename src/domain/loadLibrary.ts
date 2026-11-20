/**
 * Factory-load library — a small curated catalog of common factory cartridges
 * so a new load can be filled in by picking the box instead of hand-typing a
 * ballistic coefficient. Lighting up the predicted DOPE card on first use is the
 * whole point: without BC + muzzle velocity the card silently falls back to the
 * logged-holds table (see dopePredict.canSolve).
 *
 * Scope: Hornady .308 Winchester (the owner's cartridge). Values are the
 * MANUFACTURER-ADVERTISED figures and are APPROXIMATE — retailers and lots vary,
 * and advertised muzzle velocity is barrel-dependent. They are a starting point:
 * the shooter confirms BC against the box and trues muzzle velocity from real
 * holds ("True my DOPE"). Pure data + helpers, no I/O.
 *
 * Sources (accessed 2026-11): Hornady published ballistics and retailer spec
 * sheets (ammunitiontogo.com, hornady.com, gritrsports.com). G7 is preferred for
 * modern boat-tail match bullets; where only G1 is published, bcG7 is omitted and
 * the picker falls back to the G1 model.
 */

import type { DragModel } from './types'

export interface FactoryLoad {
  id: string
  /** Display name — becomes the load's default label. */
  name: string
  /** Cartridge family, e.g. '.308 Win'. */
  caliber: string
  bulletWeight: number // grains
  bcG1: number
  /** G7 BC where the manufacturer publishes one (preferred for the solver). */
  bcG7?: number
  /** Advertised muzzle velocity, fps (barrel-dependent — true from real holds). */
  muzzleVelocity: number
  bulletType: string
}

/**
 * Hornady .308 Winchester factory loads. Match loads first, then hunting.
 * Figures are advertised/approximate — confirm against the box and true the MV.
 */
export const FACTORY_LOADS: FactoryLoad[] = [
  // --- Match ---
  {
    id: 'hdy-308-168-eldm',
    name: '168 gr ELD Match',
    caliber: '.308 Win',
    bulletWeight: 168,
    bcG1: 0.533,
    bcG7: 0.268,
    muzzleVelocity: 2700,
    bulletType: 'ELD Match',
  },
  {
    id: 'hdy-308-178-eldm',
    name: '178 gr ELD Match',
    caliber: '.308 Win',
    bulletWeight: 178,
    bcG1: 0.547,
    bcG7: 0.275,
    muzzleVelocity: 2600,
    bulletType: 'ELD Match',
  },
  {
    id: 'hdy-308-155-eldm',
    name: '155 gr ELD Match',
    caliber: '.308 Win',
    bulletWeight: 155,
    bcG1: 0.461,
    bcG7: 0.232,
    muzzleVelocity: 2850,
    bulletType: 'ELD Match',
  },
  {
    id: 'hdy-308-168-amax-black',
    name: '168 gr A-MAX (BLACK)',
    caliber: '.308 Win',
    bulletWeight: 168,
    bcG1: 0.475,
    bcG7: 0.238,
    muzzleVelocity: 2700,
    bulletType: 'A-MAX',
  },
  {
    id: 'hdy-308-178-bthp',
    name: '178 gr BTHP Match',
    caliber: '.308 Win',
    bulletWeight: 178,
    bcG1: 0.53,
    bcG7: 0.266,
    muzzleVelocity: 2600,
    bulletType: 'BTHP Match',
  },
  // --- Hunting ---
  {
    id: 'hdy-308-178-eldx',
    name: '178 gr ELD-X (Precision Hunter)',
    caliber: '.308 Win',
    bulletWeight: 178,
    bcG1: 0.535,
    bcG7: 0.271,
    muzzleVelocity: 2600,
    bulletType: 'ELD-X',
  },
  {
    id: 'hdy-308-150-sst-sf',
    name: '150 gr SST (Superformance)',
    caliber: '.308 Win',
    bulletWeight: 150,
    bcG1: 0.415,
    bcG7: 0.209,
    muzzleVelocity: 3000,
    bulletType: 'SST',
  },
  {
    id: 'hdy-308-165-sst-sf',
    name: '165 gr SST (Superformance)',
    caliber: '.308 Win',
    bulletWeight: 165,
    bcG1: 0.447,
    bcG7: 0.224,
    muzzleVelocity: 2840,
    bulletType: 'SST',
  },
  {
    id: 'hdy-308-150-interlock',
    name: '150 gr InterLock (American Whitetail)',
    caliber: '.308 Win',
    bulletWeight: 150,
    bcG1: 0.338,
    muzzleVelocity: 2820,
    bulletType: 'InterLock SP',
  },
  {
    id: 'hdy-308-165-interlock',
    name: '165 gr InterLock (American Whitetail)',
    caliber: '.308 Win',
    bulletWeight: 165,
    bcG1: 0.435,
    muzzleVelocity: 2700,
    bulletType: 'InterLock SP',
  },
]

/** Factory loads, optionally filtered to a caliber (case/spacing-insensitive contains). */
export function factoryLoads(caliber?: string): FactoryLoad[] {
  if (!caliber) return FACTORY_LOADS
  const needle = normalizeCaliber(caliber)
  if (!needle) return FACTORY_LOADS
  return FACTORY_LOADS.filter((l) => normalizeCaliber(l.caliber).includes(needle))
}

/** Look up one factory load by id. */
export function factoryLoadById(id: string): FactoryLoad | undefined {
  return FACTORY_LOADS.find((l) => l.id === id)
}

/** The ballistic fields a picked factory load fills into an Ammunition entity. */
export interface LoadPrefill {
  label: string
  bulletWeight: number
  bc: number
  bcModel: DragModel
  muzzleVelocity: number
}

/** Resolve a factory load into entity field values (prefers G7 when published). */
export function prefillFromFactory(load: FactoryLoad): LoadPrefill {
  const useG7 = load.bcG7 != null
  return {
    label: load.name,
    bulletWeight: load.bulletWeight,
    bc: useG7 ? load.bcG7! : load.bcG1,
    bcModel: useG7 ? 'G7' : 'G1',
    muzzleVelocity: load.muzzleVelocity,
  }
}

/** Normalize a caliber string for loose matching: lowercase, strip spaces/dots. */
function normalizeCaliber(s: string): string {
  return s.toLowerCase().replace(/[\s.]/g, '')
}
