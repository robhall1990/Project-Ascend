import Dexie, { type Table } from 'dexie'
import type { Exercise, ProgramPhase, Settings, Session, SetLog } from '../types'
import { SEED_EXERCISES, SEED_PHASES } from '../data/program'

// Default program start: first Monday of August 2026 (the block's stated start).
const DEFAULT_START = '2026-08-03'

const DEFAULT_SETTINGS: Settings = {
  id: 'singleton',
  programStartDate: DEFAULT_START,
  weightUnit: 'kg',
  goalMode: 'lean-gain',
}

export class LiftTrackerDB extends Dexie {
  exercises!: Table<Exercise, string>
  phases!: Table<ProgramPhase, string>
  settings!: Table<Settings, string>
  // Declared now; written to from Phase 2 onward.
  sessions!: Table<Session, string>
  setLogs!: Table<SetLog, string>

  constructor() {
    super('lift-tracker')
    this.version(1).stores({
      exercises: 'id, day, order',
      phases: 'id, weekStart',
      settings: 'id',
      sessions: 'id, date, day',
      setLogs: 'id, sessionId, exerciseId',
    })
  }
}

export const db = new LiftTrackerDB()

/**
 * Populate the program and default settings on first run. Idempotent: seeding
 * only happens when the tables are empty, so user data is never overwritten.
 */
export async function seedIfEmpty(): Promise<void> {
  await db.transaction('rw', db.exercises, db.phases, db.settings, async () => {
    if ((await db.exercises.count()) === 0) {
      await db.exercises.bulkAdd(SEED_EXERCISES)
    }
    if ((await db.phases.count()) === 0) {
      await db.phases.bulkAdd(SEED_PHASES)
    }
    if (!(await db.settings.get('singleton'))) {
      await db.settings.add(DEFAULT_SETTINGS)
    }
  })
}
