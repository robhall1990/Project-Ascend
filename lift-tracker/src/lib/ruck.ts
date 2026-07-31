import { db } from '../db/db'
import type { RuckLog } from '../types'
import { newId } from './id'

// "Start at 10 kg for 5 km. Add either 2.5 kg or 1 km every fortnight, not
// both. Cap around 20 kg." Alternating the two increments is the simplest
// reading of "either/or, not both" — load first, then distance.

export const RUCK_START_KG = 10
export const RUCK_START_KM = 5
export const RUCK_MAX_KG = 20
const LOAD_STEP_KG = 2.5
const DIST_STEP_KM = 1

export interface RuckPrescription {
  loadKg: number
  distanceKm: number
  /** Which increment is due this fortnight, for the explanation line. */
  nextStep: 'load' | 'distance'
  fortnight: number
  capped: boolean
}

export function ruckPrescription(week: number): RuckPrescription {
  const fortnights = Math.max(0, Math.floor((Math.max(week, 1) - 1) / 2))
  let loadKg = RUCK_START_KG
  let distanceKm = RUCK_START_KM
  let capped = false

  for (let i = 0; i < fortnights; i++) {
    // Odd steps add load, even steps add distance; load stops at the cap and
    // the increase rolls into distance instead.
    const wantsLoad = i % 2 === 0
    if (wantsLoad && loadKg + LOAD_STEP_KG <= RUCK_MAX_KG) {
      loadKg += LOAD_STEP_KG
    } else {
      if (wantsLoad) capped = true
      distanceKm += DIST_STEP_KM
    }
  }

  return {
    loadKg,
    distanceKm,
    nextStep: fortnights % 2 === 0 ? 'load' : 'distance',
    fortnight: fortnights + 1,
    capped: capped || loadKg >= RUCK_MAX_KG,
  }
}

/** Most recent ruck, used to show what was actually done last time. */
export async function lastRuck(): Promise<RuckLog | undefined> {
  return db.ruckLogs.orderBy('createdAt').last()
}

/** Rucks logged in the current week (Mon-anchored ISO week is overkill here). */
export async function ruckThisWeek(sinceISO: string): Promise<RuckLog[]> {
  return (await db.ruckLogs.toArray()).filter((r) => r.date >= sinceISO)
}

export async function logRuck(input: {
  date: string
  loadKg: number
  distanceKm: number
  minutes?: number
}): Promise<void> {
  await db.ruckLogs.add({
    id: newId('ruck'),
    date: input.date,
    loadKg: input.loadKg,
    distanceKm: input.distanceKm,
    minutes: input.minutes,
    createdAt: Date.now(),
  })
}

export async function deleteRuck(id: string): Promise<void> {
  await db.ruckLogs.delete(id)
}
