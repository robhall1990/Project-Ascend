// ---- Domain types -----------------------------------------------------------
// Phase 1 uses Exercise, ProgramPhase and Settings. SetLog / Session and the
// nutrition types are declared here up front so the shape of the data model is
// visible, but they are not persisted or used until later phases.

export type DayNumber = 1 | 2 | 3 | 4
export type WeightUnit = 'kg' | 'lb'
export type GoalMode = 'lean-gain' | 'recomposition' | 'maintenance'

/**
 * What a set of this exercise is measured in. Carries are prescribed by
 * distance and holds by time, so "reps" is not universal in program v2.
 */
export type Metric = 'reps' | 'distance' | 'time'

/** A single programmed exercise slot on a training day. */
export interface Exercise {
  id: string
  day: DayNumber
  order: number
  name: string
  /** Programmed number of working sets. */
  setCount: number
  /** What each set is measured in. */
  metric: Metric
  /** Target range (inclusive) in the exercise's metric: reps, metres or seconds. */
  targetMin: number
  targetMax: number
  /** Prescribed per side rather than per set (suitcase carry, single-arm row). */
  perSide?: boolean
  /** No fixed target — work to technical failure / max hold. */
  submax?: boolean
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
  /** Optional Anthropic API key (on-device only) for photo food estimation. */
  anthropicApiKey?: string
  /** Model used for photo estimation. */
  anthropicModel?: string
  /** intervals.icu credentials (on-device only) for cardio sync. */
  intervalsApiKey?: string
  intervalsAthleteId?: string
  /** Epoch ms of the last successful intervals.icu sync. */
  intervalsLastSync?: number
  /** Seeded program version, so a program change migrates existing installs. */
  programVersion?: number
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
  /**
   * The measured amount for the set, in the exercise's metric: repetitions,
   * metres carried, or seconds held.
   */
  reps: number
  rpe?: number
}

/** A weekly ruck — weighted walking, logged separately from the 4 gym days. */
export interface RuckLog {
  id: string
  date: string
  loadKg: number
  distanceKm: number
  minutes?: number
  createdAt: number
}

// ---- Nutrition ---------------------------------------------------------------

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active'
export type DayType = 'lift' | 'endurance' | 'rest'
export type EnduranceIntensity = 'easy' | 'moderate' | 'hard'
export type MealSlot =
  | 'pre-training'
  | 'post-training'
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'

/** Standing physiological stats used to compute macro targets. */
export interface UserStats {
  id: 'singleton'
  heightCm: number
  age: number
  sex: Sex
  activity: ActivityLevel
  /** Protein target in grams per kg bodyweight (1.6–2.2; default 1.8). */
  proteinPerKg: number
  /** Whether the user has replaced the seeded example figures with their own. */
  configured: boolean
}

/** Bodyweight logged over time (stored in kg regardless of display unit). */
export interface BodyweightLog {
  id: string
  date: string
  weightKg: number
  createdAt: number
}

/**
 * Per-day nutrition context: the day type (which flexes carbs) plus any manual
 * override of the computed target. Keyed by date.
 */
export interface DayNutrition {
  date: string
  dayType: DayType
  enduranceMinutes?: number
  enduranceIntensity?: EnduranceIntensity
  /** Manual override of the computed target for this date. */
  override?: { calories: number; protein: number; carbs: number; fat: number }
  /** Ids of training-nutrition guidance cards the user dismissed today. */
  dismissedGuidance?: string[]
  /**
   * Where the day type came from. A manual choice is never overwritten by an
   * intervals.icu sync.
   */
  dayTypeSource?: 'manual' | 'intervals'
}

/** A cardio session pulled from intervals.icu (or entered by hand). */
export interface CardioActivity {
  /** "icu:<id>" for synced activities — the dedupe key. */
  id: string
  date: string
  name: string
  /** Normalised sport: Run / Ride / Swim / Other. */
  sport: string
  movingMinutes: number
  distanceKm?: number
  calories?: number
  avgHr?: number
  /** intervals.icu training load (TSS-like), when available. */
  load?: number
  source: 'intervals'
  syncedAt: number
}

// Declared for later nutrition phases (food logging, meals).
export interface FoodEntry {
  id: string
  date: string
  slot: MealSlot
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  portion?: string
  createdAt: number
}

export interface FoodItem {
  id: string
  name: string
  /** Per-100g macros. */
  per100: { calories: number; protein: number; carbs: number; fat: number }
  /** Typical serving in grams, used for one-tap logging. */
  defaultGrams: number
}

/**
 * A saved combination logged in one tap. Stored as aggregate macros (summed
 * from whatever entries created it) so repeat meals log instantly and Phase 8
 * can rank them by protein density.
 */
export interface Meal {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

// ---- AI Coaching (Phase 1+) --------------------------------------------------

export type RecoveryStatus = 'adequate' | 'deficit' | 'surplus'
export type SessionType = 'strength' | 'cardio' | 'skill' | 'rest'
export type IntensityModifier = 'deload' | 'standard' | 'heavy'

/** Daily training load tracking: strength RPE, cardio load, combined total. */
export interface TrainingLoad {
  id: string
  date: string
  strengthRpe?: number // 1–10 during session, optional if rest day
  strengthDurationMin?: number
  strengthLoad: number // RPE × duration, 0 if no session
  cardioLoad: number // TSS or load score from cardio activities
  totalLoad: number // strengthLoad + cardioLoad
  recoveryStatus: RecoveryStatus
  createdAt: number
}

/** AI coaching suggestion for a day: session type, reasoning, intensity modifier. */
export interface CoachingSuggestion {
  id: string
  date: string
  dayNumber?: DayNumber | 'flexible'
  sessionType: SessionType
  title: string // "Upper Body Strength (Heavy)"
  reasoning: string
  intensityModifier?: IntensityModifier
  cardioGuidance?: string // "Easy run, 30–40 min only"
  createdAt: number
  regeneratedAt?: number
}
