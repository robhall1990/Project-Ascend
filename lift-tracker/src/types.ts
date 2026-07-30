// ---- Domain types -----------------------------------------------------------
// Phase 1 uses Exercise, ProgramPhase and Settings. SetLog / Session and the
// nutrition types are declared here up front so the shape of the data model is
// visible, but they are not persisted or used until later phases.

export type DayNumber = 1 | 2 | 3 | 4
export type WeightUnit = 'kg' | 'lb'
export type GoalMode = 'lean-gain' | 'recomposition' | 'maintenance'

/** A single programmed exercise slot on a training day. */
export interface Exercise {
  id: string
  day: DayNumber
  order: number
  name: string
  /** Programmed number of working sets. */
  setCount: number
  /** Target rep range (inclusive). */
  repMin: number
  repMax: number
  /** One of the four lifts whose estimated 1RM is tracked over the block. */
  isMainLift: boolean
  notes?: string
  /**
   * When set, this exercise is performed as a superset with the exercise of the
   * same `supersetGroup` on the same day (e.g. Day 4 curls + tricep ext).
   */
  supersetGroup?: string
}

/** A block of weeks with its own emphasis and (optionally) rep/volume tweaks. */
export interface ProgramPhase {
  id: string
  name: string
  /** 1-based inclusive week range within the program. */
  weekStart: number
  weekEnd: number
  focus: string
  /** Override applied to the four main lifts' rep range while in this phase. */
  mainLiftReps?: { min: number; max: number }
  /** True for the taper/deload block. */
  isTaper?: boolean
}

export interface Settings {
  id: 'singleton'
  /** ISO date (YYYY-MM-DD) the program's Week 1 begins. */
  programStartDate: string
  weightUnit: WeightUnit
  goalMode: GoalMode
}

// ---- Declared now, used in later phases -------------------------------------

export interface Session {
  id: string
  /** ISO date (YYYY-MM-DD) the session was performed. */
  date: string
  day: DayNumber
  /** Phase in effect when the session was started (captured for history). */
  phaseId: string
  /** Epoch ms; used for ordering and rotation. */
  createdAt: number
  /** Epoch ms once finished; undefined while a session is in progress. */
  completedAt?: number
}

export interface SetLog {
  id: string
  sessionId: string
  exerciseId: string
  setNumber: number
  weight: number
  reps: number
  rpe?: number
}
