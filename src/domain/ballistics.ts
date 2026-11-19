/**
 * EDB ballistic solver — a point-mass trajectory engine with standard G1/G7
 * drag models. Pure (no I/O), so it is easy to unit-test and reuse for the DOPE
 * card, the "solve for now" view, and muzzle-velocity true-up.
 *
 * Model: 3-DOF point mass integrated with RK4. Drag uses the published McCoy
 * G1/G7 standard drag curves (Cd vs Mach) scaled by the user's BC and the air
 * density ratio relative to the ICAO standard atmosphere (15 °C, 29.92 inHg,
 * dry). Includes crosswind deflection and an optional Litz spin-drift estimate.
 * Coriolis is intentionally omitted (needs latitude/azimuth) and left for later.
 *
 * Units are US customary at the boundary (fps, yards, inches, °F, inHg, mph) to
 * match the rest of the app; SI is used only inside the atmosphere math.
 */

import type { AngularUnit, DragModel } from './types'

/* --------------------------------------------------------------- constants */

const G = 32.174 // gravity, ft/s^2
/**
 * Drag scale constant: decel = K · densityRatio · Cd(Mach) · v² / BC.
 * Derived from the point-mass drag equation with BC in lb/in² and the ICAO
 * sea-level air density folded in (see the module docs / derivation).
 */
const K = 0.00020856
const MPH_TO_FPS = 1.4666667
const INHG_TO_PA = 3386.389
const ICAO_RHO = 1.225 // kg/m^3, ICAO sea-level dry air
const MIL_PER_RAD = 1000 // true milliradians
const MOA_PER_RAD = (180 / Math.PI) * 60

/* ------------------------------------------------------------- drag tables */
/** McCoy G7 standard drag: [Mach, Cd]. Boat-tail / long-range match bullets. */
const G7: readonly [number, number][] = [
  [0.0, 0.1198], [0.05, 0.1197], [0.1, 0.1196], [0.15, 0.1194], [0.2, 0.1193],
  [0.25, 0.1194], [0.3, 0.1194], [0.35, 0.1194], [0.4, 0.1193], [0.45, 0.1193],
  [0.5, 0.1194], [0.55, 0.1193], [0.6, 0.1194], [0.65, 0.1197], [0.7, 0.1202],
  [0.725, 0.1207], [0.75, 0.1215], [0.775, 0.1226], [0.8, 0.1242], [0.825, 0.1266],
  [0.85, 0.1306], [0.875, 0.1368], [0.9, 0.1464], [0.925, 0.166], [0.95, 0.2054],
  [0.975, 0.2993], [1.0, 0.3803], [1.025, 0.4015], [1.05, 0.4043], [1.075, 0.4034],
  [1.1, 0.4014], [1.125, 0.3987], [1.15, 0.3955], [1.2, 0.3884], [1.25, 0.381],
  [1.3, 0.3732], [1.35, 0.3657], [1.4, 0.358], [1.5, 0.344], [1.55, 0.3376],
  [1.6, 0.3315], [1.65, 0.326], [1.7, 0.3209], [1.75, 0.316], [1.8, 0.3117],
  [1.85, 0.3078], [1.9, 0.3042], [1.95, 0.301], [2.0, 0.298], [2.05, 0.2951],
  [2.1, 0.2922], [2.15, 0.2892], [2.2, 0.2864], [2.25, 0.2835], [2.3, 0.2807],
  [2.35, 0.2779], [2.4, 0.2752], [2.45, 0.2725], [2.5, 0.2697], [2.55, 0.267],
  [2.6, 0.2643], [2.65, 0.2615], [2.7, 0.2588], [2.75, 0.2561], [2.8, 0.2533],
  [2.85, 0.2506], [2.9, 0.2479], [2.95, 0.2451], [3.0, 0.2424], [3.1, 0.2368],
  [3.2, 0.2313], [3.3, 0.2258], [3.4, 0.2205], [3.5, 0.2154], [3.6, 0.2106],
  [3.7, 0.206], [3.8, 0.2017], [3.9, 0.1975], [4.0, 0.1935], [4.2, 0.1861],
  [4.4, 0.1793], [4.6, 0.173], [4.8, 0.1672], [5.0, 0.1618],
]

/** McCoy G1 standard drag: [Mach, Cd]. Flat-base / typical sporting bullets. */
const G1: readonly [number, number][] = [
  [0.0, 0.2629], [0.05, 0.2558], [0.1, 0.2487], [0.15, 0.2413], [0.2, 0.2344],
  [0.25, 0.2278], [0.3, 0.2214], [0.35, 0.2155], [0.4, 0.2104], [0.45, 0.2061],
  [0.5, 0.2032], [0.55, 0.202], [0.6, 0.2034], [0.7, 0.2165], [0.725, 0.223],
  [0.75, 0.2313], [0.775, 0.2417], [0.8, 0.2546], [0.825, 0.2706], [0.85, 0.2901],
  [0.875, 0.3136], [0.9, 0.3415], [0.925, 0.3734], [0.95, 0.4084], [0.975, 0.4448],
  [1.0, 0.4805], [1.025, 0.5136], [1.05, 0.5427], [1.075, 0.5677], [1.1, 0.5883],
  [1.125, 0.6053], [1.15, 0.6191], [1.2, 0.6393], [1.25, 0.6518], [1.3, 0.6589],
  [1.35, 0.6621], [1.4, 0.6625], [1.45, 0.6607], [1.5, 0.6573], [1.55, 0.6528],
  [1.6, 0.6474], [1.65, 0.6413], [1.7, 0.6347], [1.75, 0.628], [1.8, 0.621],
  [1.85, 0.6141], [1.9, 0.6072], [1.95, 0.6003], [2.0, 0.5934], [2.05, 0.5867],
  [2.1, 0.5804], [2.15, 0.5743], [2.2, 0.5685], [2.25, 0.563], [2.3, 0.5577],
  [2.35, 0.5527], [2.4, 0.5481], [2.45, 0.5438], [2.5, 0.5397], [2.6, 0.5325],
  [2.7, 0.5264], [2.8, 0.5211], [2.9, 0.5168], [3.0, 0.5133], [3.1, 0.5105],
  [3.2, 0.5084], [3.3, 0.5067], [3.4, 0.5054], [3.5, 0.504], [3.6, 0.503],
  [3.7, 0.5022], [3.8, 0.5016], [3.9, 0.501], [4.0, 0.5006], [4.2, 0.4998],
  [4.4, 0.4995], [4.6, 0.4992], [4.8, 0.499], [5.0, 0.4988],
]

/** Linear-interpolated standard-drag Cd for a Mach number (clamped at ends). */
export function dragCd(model: DragModel, mach: number): number {
  const t = model === 'G1' ? G1 : G7
  if (mach <= t[0][0]) return t[0][1]
  const last = t[t.length - 1]
  if (mach >= last[0]) return last[1]
  // Linear scan is fine (~85 rows); keeps the table human-auditable.
  for (let i = 1; i < t.length; i++) {
    if (mach <= t[i][0]) {
      const [m0, c0] = t[i - 1]
      const [m1, c1] = t[i]
      return c0 + ((c1 - c0) * (mach - m0)) / (m1 - m0)
    }
  }
  return last[1]
}

/* -------------------------------------------------------------- atmosphere */

export interface Atmosphere {
  tempF?: number
  pressureInHg?: number
  humidityPct?: number
  /** 'station' = actual local pressure (use directly); 'absolute' = sea-level. */
  pressureType?: 'station' | 'absolute'
}

const ICAO_TEMP_F = 59
const ICAO_PRESSURE_INHG = 29.92

/** Speed of sound (ft/s) at a given air temperature. */
export function speedOfSoundFps(tempF: number): number {
  const tempK = ((tempF - 32) * 5) / 9 + 273.15
  const aMs = Math.sqrt(1.4 * 287.058 * tempK)
  return aMs * 3.28084
}

/** Saturation vapor pressure (Pa) via the Tetens formula, temp in °C. */
function saturationVaporPa(tempC: number): number {
  return 610.78 * Math.exp((17.27 * tempC) / (tempC + 237.3))
}

/**
 * Air density ratio relative to the ICAO standard atmosphere. 1.0 = standard;
 * hot / humid / high (lower pressure) air is thinner (< 1) and drops less.
 */
export function densityRatio(atm: Atmosphere): number {
  const tempF = atm.tempF ?? ICAO_TEMP_F
  const pInHg = atm.pressureInHg ?? ICAO_PRESSURE_INHG
  const rh = Math.max(0, Math.min(100, atm.humidityPct ?? 0))
  const tempC = ((tempF - 32) * 5) / 9
  const tempK = tempC + 273.15
  const p = pInHg * INHG_TO_PA
  const pv = (rh / 100) * saturationVaporPa(tempC)
  const pd = Math.max(0, p - pv)
  // Density of moist air = dry partial / (Rd T) + vapor partial / (Rv T).
  const rho = pd / (287.058 * tempK) + pv / (461.495 * tempK)
  return rho / ICAO_RHO
}

/** Density altitude in feet (handy to display); derived from the density ratio. */
export function densityAltitudeFt(atm: Atmosphere): number {
  const dr = densityRatio(atm)
  // Invert the standard-atmosphere density lapse: DR = (1 - 6.8756e-6 h)^4.2559.
  return (1 - Math.pow(dr, 1 / 4.2559)) / 6.8756e-6
}

/* ---------------------------------------------------------------- solver */

export interface Wind {
  speedMph?: number
  /** Direction the wind blows FROM, degrees: 0 = 12 o'clock (head), 90 = 3 o'clock. */
  angleDeg?: number
}

export interface SolveInput {
  muzzleVelocityFps: number
  bc: number
  bcModel: DragModel
  bulletWeightGr?: number
  sightHeightIn?: number
  zeroRangeYd?: number
  /** Angular unit for the returned elevation/windage holds. */
  outputUnit: AngularUnit
  atmosphere?: Atmosphere
  wind?: Wind
  /** Rifling twist direction — sign of the spin-drift correction. */
  twistDir?: 'R' | 'L'
}

export interface SolvePoint {
  rangeYd: number
  velocityFps: number
  mach: number
  tofS: number
  dropIn: number
  driftIn: number
  /** Elevation come-up (dial UP) in `outputUnit`. */
  elevation: number
  /** Windage hold in `outputUnit`; positive = hold/dial right. */
  windage: number
  energyFtLb?: number
  supersonic: boolean
}

interface State {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
}

const toRad = (deg: number) => (deg * Math.PI) / 180

function makeAccel(dr: number, cdScale: number, soundFps: number, wx: number, wz: number) {
  // cdScale folds K/BC together. decel = cdScale · dr · Cd(Mach) · s².
  return (s: State, model: DragModel) => {
    const rvx = s.vx - wx
    const rvy = s.vy
    const rvz = s.vz - wz
    const speed = Math.sqrt(rvx * rvx + rvy * rvy + rvz * rvz)
    const mach = speed / soundFps
    const decel = cdScale * dr * dragCd(model, mach) * speed // = (…· s²)/s applied per-component below
    return {
      ax: -decel * rvx,
      ay: -decel * rvy - G,
      az: -decel * rvz,
    }
  }
}

/** One RK4 time step of dt seconds. */
function step(
  s: State,
  dt: number,
  accel: (s: State, m: DragModel) => { ax: number; ay: number; az: number },
  model: DragModel,
): State {
  const a1 = accel(s, model)
  const s2: State = {
    x: s.x + s.vx * dt * 0.5, y: s.y + s.vy * dt * 0.5, z: s.z + s.vz * dt * 0.5,
    vx: s.vx + a1.ax * dt * 0.5, vy: s.vy + a1.ay * dt * 0.5, vz: s.vz + a1.az * dt * 0.5,
  }
  const a2 = accel(s2, model)
  const s3: State = {
    x: s.x + s2.vx * dt * 0.5, y: s.y + s2.vy * dt * 0.5, z: s.z + s2.vz * dt * 0.5,
    vx: s.vx + a2.ax * dt * 0.5, vy: s.vy + a2.ay * dt * 0.5, vz: s.vz + a2.az * dt * 0.5,
  }
  const a3 = accel(s3, model)
  const s4: State = {
    x: s.x + s3.vx * dt, y: s.y + s3.vy * dt, z: s.z + s3.vz * dt,
    vx: s.vx + a3.ax * dt, vy: s.vy + a3.ay * dt, vz: s.vz + a3.az * dt,
  }
  const a4 = accel(s4, model)
  return {
    x: s.x + (dt / 6) * (s.vx + 2 * s2.vx + 2 * s3.vx + s4.vx),
    y: s.y + (dt / 6) * (s.vy + 2 * s2.vy + 2 * s3.vy + s4.vy),
    z: s.z + (dt / 6) * (s.vz + 2 * s2.vz + 2 * s3.vz + s4.vz),
    vx: s.vx + (dt / 6) * (a1.ax + 2 * a2.ax + 2 * a3.ax + a4.ax),
    vy: s.vy + (dt / 6) * (a1.ay + 2 * a2.ay + 2 * a3.ay + a4.ay),
    vz: s.vz + (dt / 6) * (a1.az + 2 * a2.az + 2 * a3.az + a4.az),
  }
}

const DT = 0.0005 // s — fixed step; ~RK4 error negligible for small-arms ranges

/**
 * Integrate a trajectory for a given launch angle (radians), sampling vertical
 * drop at the requested downrange distances. Returns drop (relative to the line
 * of sight), drift, velocity, Mach and time of flight at each sample.
 */
function integrate(
  launchRad: number,
  mv: number,
  sightHeightFt: number,
  model: DragModel,
  accel: (s: State, m: DragModel) => { ax: number; ay: number; az: number },
  sampleFt: number[],
  soundFps: number,
): { xFt: number; y: number; z: number; v: number; mach: number; t: number }[] {
  let s: State = {
    x: 0, y: -sightHeightFt, z: 0,
    vx: mv * Math.cos(launchRad), vy: mv * Math.sin(launchRad), vz: 0,
  }
  let t = 0
  const maxFt = sampleFt[sampleFt.length - 1]
  const out: { xFt: number; y: number; z: number; v: number; mach: number; t: number }[] = []
  let sampleIdx = 0
  let guard = 0
  while (s.x < maxFt && guard < 2_000_000) {
    guard++
    const prev = s
    const prevT = t
    s = step(s, DT, accel, model)
    t += DT
    // Capture every requested range we just crossed (linear interpolation in x).
    while (sampleIdx < sampleFt.length && s.x >= sampleFt[sampleIdx]) {
      const target = sampleFt[sampleIdx]
      const frac = (target - prev.x) / (s.x - prev.x || 1)
      const y = prev.y + (s.y - prev.y) * frac
      const z = prev.z + (s.z - prev.z) * frac
      const vx = prev.vx + (s.vx - prev.vx) * frac
      const vy = prev.vy + (s.vy - prev.vy) * frac
      const vz = prev.vz + (s.vz - prev.vz) * frac
      const v = Math.sqrt(vx * vx + vy * vy + vz * vz)
      out.push({ xFt: target, y, z, v, mach: v / soundFps, t: prevT + DT * frac })
      sampleIdx++
    }
    if (s.vx <= 0) break // lost all forward motion (shouldn't happen in range)
  }
  return out
}

/** Find the launch angle (radians) that puts the bullet on the line of sight at zero range. */
function solveZeroAngle(
  mv: number,
  sightHeightFt: number,
  zeroFt: number,
  model: DragModel,
  accel: (s: State, m: DragModel) => { ax: number; ay: number; az: number },
  soundFps: number,
): number {
  const dropAtZero = (ang: number) => {
    const r = integrate(ang, mv, sightHeightFt, model, accel, [zeroFt], soundFps)
    return r.length ? r[0].y : -Infinity
  }
  // Bisection on the super-elevation angle (0 .. ~3°).
  let lo = 0
  let hi = toRad(3)
  // Ensure the bracket actually spans a sign change in y(zero).
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const y = dropAtZero(mid)
    if (y > 0) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

/**
 * Spin drift via Litz's time-of-flight approximation, inches.
 * SD ≈ 1.25 · (SG + 1.2) · t^1.83, with a nominal stability factor since we
 * don't track bullet length. Sign follows twist direction (right twist = right).
 */
function spinDriftIn(tofS: number, twistDir?: 'R' | 'L'): number {
  if (!twistDir) return 0
  const sg = 1.5 // nominal gyroscopic stability
  const mag = 1.25 * (sg + 1.2) * Math.pow(tofS, 1.83)
  return twistDir === 'L' ? -mag : mag
}

/**
 * Solve a full come-up table at the requested ranges (yards). Returns elevation
 * and windage holds in the requested angular unit, plus velocity, Mach, time of
 * flight, drop, drift and (if bullet weight is known) retained energy.
 */
export function solve(input: SolveInput, rangesYd: number[]): SolvePoint[] {
  const mv = input.muzzleVelocityFps
  const sightHeightFt = (input.sightHeightIn ?? 1.5) / 12
  const zeroFt = (input.zeroRangeYd ?? 100) * 3
  const atm = input.atmosphere ?? {}
  const dr = densityRatio(atm)
  const soundFps = speedOfSoundFps(atm.tempF ?? ICAO_TEMP_F)
  const cdScale = K / input.bc

  // Wind vector (ft/s). Wind FROM angle: head component in -x, right-side in -z.
  const wMph = input.wind?.speedMph ?? 0
  const wRad = toRad(input.wind?.angleDeg ?? 0)
  const wx = -wMph * MPH_TO_FPS * Math.cos(wRad)
  const wz = -wMph * MPH_TO_FPS * Math.sin(wRad)

  const accel = makeAccel(dr, cdScale, soundFps, wx, wz)
  const launchRad = solveZeroAngle(mv, sightHeightFt, zeroFt, input.bcModel, accel, soundFps)

  const ranges = [...rangesYd].sort((a, b) => a - b)
  const sampleFt = ranges.map((y) => y * 3)
  const traj = integrate(launchRad, mv, sightHeightFt, input.bcModel, accel, sampleFt, soundFps)

  const unit = input.outputUnit
  const angle = (rad: number) => (unit === 'MOA' ? rad * MOA_PER_RAD : rad * MIL_PER_RAD)

  return traj.map((p, i) => {
    const rangeYd = ranges[i]
    const xFt = p.xFt
    const dropIn = p.y * 12 // signed: negative = below line of sight
    const spin = spinDriftIn(p.t, input.twistDir)
    const driftIn = p.z * 12 + spin
    // Elevation come-up: angle from the muzzle to the impact below LoS.
    const elevRad = Math.atan(-p.y / xFt)
    const windRad = Math.atan((p.z + spin / 12) / xFt)
    const energy =
      input.bulletWeightGr != null
        ? 0.5 * (input.bulletWeightGr / 7000 / G) * p.v * p.v
        : undefined
    return {
      rangeYd,
      velocityFps: Math.round(p.v),
      mach: p.mach,
      tofS: p.t,
      dropIn,
      driftIn,
      elevation: angle(elevRad),
      windage: angle(windRad),
      energyFtLb: energy != null ? Math.round(energy) : undefined,
      supersonic: p.mach >= 1.0,
    }
  })
}

/** Round an angular hold for display (MIL to 0.1, MOA to 0.25). */
export function roundHold(value: number, unit: AngularUnit): number {
  return unit === 'MOA' ? Math.round(value * 4) / 4 : Math.round(value * 10) / 10
}

/* ------------------------------------------------------- true-up (A3 prep) */

export interface ConfirmedHold {
  rangeYd: number
  /** Measured elevation hold, in `unit`. */
  elevation: number
  unit: AngularUnit
}

/**
 * Back-solve the muzzle velocity that best fits the shooter's confirmed holds,
 * holding BC fixed. Searches MV over a plausible band and minimizes the summed
 * squared elevation error (converted to a common unit). Returns the best MV and
 * the residual RMS error in the output unit, or null if there isn't enough data.
 */
export function trueMuzzleVelocity(
  input: SolveInput,
  confirmed: ConfirmedHold[],
): { muzzleVelocityFps: number; rmsError: number } | null {
  const pts = confirmed.filter((c) => c.rangeYd > 0 && Number.isFinite(c.elevation))
  if (pts.length < 2) return null
  const toMil = (v: number, u: AngularUnit) => (u === 'MOA' ? v / MOA_PER_RAD : v / MIL_PER_RAD) * MIL_PER_RAD
  const ranges = pts.map((p) => p.rangeYd)
  const targetMil = pts.map((p) => toMil(p.elevation, p.unit))

  const cost = (mv: number) => {
    const sol = solve({ ...input, muzzleVelocityFps: mv, outputUnit: 'MIL' }, ranges)
    let sse = 0
    for (let i = 0; i < sol.length; i++) {
      const d = sol[i].elevation - targetMil[i]
      sse += d * d
    }
    return sse
  }

  // Coarse-to-fine search over a ±400 fps band around the current MV.
  let best = input.muzzleVelocityFps
  let bestCost = cost(best)
  for (let mv = input.muzzleVelocityFps - 400; mv <= input.muzzleVelocityFps + 400; mv += 20) {
    const c = cost(mv)
    if (c < bestCost) { bestCost = c; best = mv }
  }
  for (let mv = best - 20; mv <= best + 20; mv += 2) {
    const c = cost(mv)
    if (c < bestCost) { bestCost = c; best = mv }
  }

  const rmsMil = Math.sqrt(bestCost / pts.length)
  const outUnit = input.outputUnit
  const rmsError = outUnit === 'MOA' ? (rmsMil / MIL_PER_RAD) * MOA_PER_RAD : rmsMil
  return { muzzleVelocityFps: Math.round(best), rmsError }
}
