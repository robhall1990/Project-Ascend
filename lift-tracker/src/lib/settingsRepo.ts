import { db } from '../db/db'
import type { Settings, WeightUnit } from '../types'
import { KG_PER_LB } from './units'

/** Patch settings. Undefined values are stripped so Dexie never sees them. */
export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) {
    clean[k] = v === undefined ? null : v
  }
  const changed = await db.settings.update('singleton', clean as Partial<Settings>)
  if (changed === 0) throw new Error('settings record missing')
}

/**
 * Switch display units, converting every stored lifting weight so history keeps
 * its real-world meaning. Bodyweight is already stored canonically in kg.
 */
export async function setWeightUnit(next: WeightUnit): Promise<void> {
  const current = (await db.settings.get('singleton'))?.weightUnit ?? 'kg'
  if (current === next) return
  const factor = next === 'lb' ? 1 / KG_PER_LB : KG_PER_LB

  await db.transaction('rw', db.setLogs, db.settings, async () => {
    const logs = await db.setLogs.toArray()
    await db.setLogs.bulkPut(
      logs.map((l) => ({ ...l, weight: Math.round(l.weight * factor * 2) / 2 })),
    )
    await db.settings.update('singleton', { weightUnit: next })
  })
}

// ---- Backup & restore --------------------------------------------------------

const BACKUP_VERSION = 1

export interface Backup {
  app: 'lift-tracker'
  version: number
  exportedAt: string
  data: Record<string, unknown[]>
}

const TABLES = [
  'exercises',
  'phases',
  'settings',
  'sessions',
  'setLogs',
  'userStats',
  'bodyweightLogs',
  'dayNutrition',
  'foodEntries',
  'foodItems',
  'meals',
] as const

export async function exportBackup(): Promise<Backup> {
  const data: Record<string, unknown[]> = {}
  for (const name of TABLES) {
    data[name] = await db.table(name).toArray()
  }
  return {
    app: 'lift-tracker',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
}

/** Replace all local data with a backup's contents. */
export async function importBackup(raw: unknown): Promise<void> {
  const backup = raw as Backup
  if (!backup || backup.app !== 'lift-tracker' || !backup.data) {
    throw new Error('That file isn’t a Lift Tracker backup')
  }
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const name of TABLES) {
      const rows = backup.data[name]
      if (!Array.isArray(rows)) continue
      await db.table(name).clear()
      if (rows.length) await db.table(name).bulkPut(rows)
    }
  })
}

/** Wipe logged data but keep the seeded program, settings and stats. */
export async function resetLoggedData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.sessions, db.setLogs, db.foodEntries, db.dayNutrition, db.bodyweightLogs],
    async () => {
      await Promise.all([
        db.sessions.clear(),
        db.setLogs.clear(),
        db.foodEntries.clear(),
        db.dayNutrition.clear(),
        db.bodyweightLogs.clear(),
      ])
    },
  )
}
