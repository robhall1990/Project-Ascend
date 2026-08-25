import Dexie, { type Table } from 'dexie'
import type {
  BodyweightLog,
  CardioActivity,
  CoachingSuggestion,
  DayNutrition,
  Exercise,
  FoodEntry,
  FoodItem,
  Meal,
  ProgramPhase,
  RuckLog,
  Session,
  SetLog,
  Settings,
  TrainingLoad,
  UserStats,
  WellnessRecord,
} from '../types'
import { PROGRAM_VERSION, SEED_EXERCISES, SEED_PHASES } from '../data/program'
import { newId } from '../lib/id'
import { todayISO } from '../lib/schedule'

// Default program start: first Monday of August 2026 (the block's stated start).
const DEFAULT_START = '2026-08-03'

const DEFAULT_SETTINGS: Settings = {
  id: 'singleton',
  programStartDate: DEFAULT_START,
  weightUnit: 'kg',
  goalMode: 'lean-gain',
  anthropicModel: 'claude-sonnet-5',
  programVersion: PROGRAM_VERSION,
}

// Example stats so the Fuel screen has something to compute from on first run.
// `configured: false` drives a "set your own stats" prompt until edited.
const DEFAULT_STATS: UserStats = {
  id: 'singleton',
  heightCm: 178,
  age: 36,
  sex: 'male',
  activity: 'moderate',
  proteinPerKg: 1.8,
  configured: false,
}
const DEFAULT_BODYWEIGHT_KG = 80

export class LiftTrackerDB extends Dexie {
  exercises!: Table<Exercise, string>
  phases!: Table<ProgramPhase, string>
  settings!: Table<Settings, string>
  sessions!: Table<Session, string>
  setLogs!: Table<SetLog, string>
  // Nutrition (Phase 5+)
  userStats!: Table<UserStats, string>
  bodyweightLogs!: Table<BodyweightLog, string>
  dayNutrition!: Table<DayNutrition, string>
  foodEntries!: Table<FoodEntry, string>
  foodItems!: Table<FoodItem, string>
  meals!: Table<Meal, string>
  cardioActivities!: Table<CardioActivity, string>
  ruckLogs!: Table<RuckLog, string>
  // AI Coaching (Phase 1+)
  trainingLoads!: Table<TrainingLoad, string>
  coachingSuggestions!: Table<CoachingSuggestion, string>
  // Wellness / performance data (Phase 2)
  wellnessRecords!: Table<WellnessRecord, string>

  constructor() {
    super('lift-tracker')
    this.version(1).stores({
      exercises: 'id, day, order',
      phases: 'id, weekStart',
      settings: 'id',
      sessions: 'id, date, day',
      setLogs: 'id, sessionId, exerciseId',
    })
    // v2: index session lifecycle fields for ordering / rotation queries.
    this.version(2).stores({
      sessions: 'id, date, day, createdAt, completedAt',
    })
    // v3: nutrition tables.
    this.version(3).stores({
      userStats: 'id',
      bodyweightLogs: 'id, date, createdAt',
      dayNutrition: 'date',
      foodEntries: 'id, date, slot, createdAt',
      foodItems: 'id, name',
      meals: 'id, name',
    })
    // v4: cardio activities synced from intervals.icu.
    this.version(4).stores({
      cardioActivities: 'id, date, syncedAt',
    })
    // v5: weekly ruck log (program v2).
    this.version(5).stores({
      ruckLogs: 'id, date, createdAt',
    })
    // v6: AI coaching (Phase 1).
    this.version(6).stores({
      trainingLoads: 'id, date, createdAt',
      coachingSuggestions: 'id, date',
    })
    // v7: wellness / performance data synced via intervals.icu (Phase 2).
    this.version(7).stores({
      wellnessRecords: 'date, syncedAt',
    })
  }
}

export const db = new LiftTrackerDB()

/**
 * Populate the program, settings and example nutrition stats on first run.
 * Idempotent: seeding only happens when a table is empty, so user data is
 * never overwritten.
 */
export async function seedIfEmpty(): Promise<void> {
  await db.transaction(
    'rw',
    [db.exercises, db.phases, db.settings, db.userStats, db.bodyweightLogs],
    async () => {
      const settings = await db.settings.get('singleton')
      if (!settings) {
        await db.settings.add(DEFAULT_SETTINGS)
      }

      // Seed on first run, and migrate an install still carrying an older
      // program. Logged sessions and set logs are untouched: history for
      // exercises that no longer exist stays in the database, it just stops
      // being offered in the current program.
      const storedVersion = settings?.programVersion ?? (settings ? 1 : 0)
      if ((await db.exercises.count()) === 0 || storedVersion < PROGRAM_VERSION) {
        await db.exercises.clear()
        await db.exercises.bulkAdd(SEED_EXERCISES)
        await db.phases.clear()
        await db.phases.bulkAdd(SEED_PHASES)
        await db.settings.update('singleton', { programVersion: PROGRAM_VERSION })
      }
      if (!(await db.userStats.get('singleton'))) {
        await db.userStats.add(DEFAULT_STATS)
      }
      if ((await db.bodyweightLogs.count()) === 0) {
        await db.bodyweightLogs.add({
          id: newId('bw'),
          date: todayISO(),
          weightKg: DEFAULT_BODYWEIGHT_KG,
          createdAt: Date.now(),
        })
      }
    },
  )
}
