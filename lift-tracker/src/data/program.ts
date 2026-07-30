import type { Exercise, ProgramPhase } from '../types'

// Seed data transcribed verbatim from upper-body-training-program.md.
// 4-day upper-body-biased split, double progression, deload every 5-6 weeks.

/**
 * The four lifts whose estimated 1RM is tracked across the 20 weeks:
 * Bench, OHP, Pull-up/Pulldown, Squat/Deadlift.
 */
export const SEED_EXERCISES: Exercise[] = [
  // ---- Day 1 — Upper Push (Strength) ----
  { id: 'd1-bench', day: 1, order: 1, name: 'Barbell Bench Press', setCount: 4, repMin: 4, repMax: 6, isMainLift: true },
  { id: 'd1-ohp', day: 1, order: 2, name: 'Standing Overhead Press', setCount: 3, repMin: 6, repMax: 8, isMainLift: true },
  { id: 'd1-incline-db', day: 1, order: 3, name: 'Incline Dumbbell Press', setCount: 3, repMin: 8, repMax: 10, isMainLift: false },
  { id: 'd1-dips', day: 1, order: 4, name: 'Weighted Dips or Cable Tricep Pushdown', setCount: 3, repMin: 8, repMax: 12, isMainLift: false },
  { id: 'd1-lat-raise', day: 1, order: 5, name: 'Lateral Raise', setCount: 3, repMin: 12, repMax: 15, isMainLift: false },

  // ---- Day 2 — Lower / Total-Body (Maintenance, ~40-45 min) ----
  { id: 'd2-squat', day: 2, order: 1, name: 'Back Squat or Trap Bar Deadlift', setCount: 3, repMin: 5, repMax: 5, isMainLift: true },
  { id: 'd2-rdl', day: 2, order: 2, name: 'Romanian Deadlift or Leg Curl', setCount: 2, repMin: 8, repMax: 10, isMainLift: false },
  { id: 'd2-lunge', day: 2, order: 3, name: 'Walking Lunge or Split Squat', setCount: 2, repMin: 10, repMax: 10, isMainLift: false },
  { id: 'd2-leg-raise', day: 2, order: 4, name: 'Hanging Leg Raise', setCount: 2, repMin: 12, repMax: 15, isMainLift: false },

  // ---- Day 3 — Upper Pull (Strength) ----
  { id: 'd3-pullup', day: 3, order: 1, name: 'Weighted Pull-up or Lat Pulldown', setCount: 4, repMin: 4, repMax: 6, isMainLift: true },
  { id: 'd3-row', day: 3, order: 2, name: 'Barbell Row or Chest-Supported Row', setCount: 3, repMin: 6, repMax: 8, isMainLift: false },
  { id: 'd3-rack-pull', day: 3, order: 3, name: 'Rack Pull or Seated Cable Row', setCount: 3, repMin: 8, repMax: 10, isMainLift: false },
  { id: 'd3-face-pull', day: 3, order: 4, name: 'Face Pull', setCount: 3, repMin: 12, repMax: 15, isMainLift: false },
  { id: 'd3-curl', day: 3, order: 5, name: 'Barbell or DB Curl', setCount: 3, repMin: 8, repMax: 10, isMainLift: false },

  // ---- Day 4 — Upper Hypertrophy (Physique) ----
  { id: 'd4-incline', day: 4, order: 1, name: 'Incline Barbell or DB Press', setCount: 3, repMin: 8, repMax: 12, isMainLift: false },
  { id: 'd4-fly', day: 4, order: 2, name: 'Cable Fly', setCount: 3, repMin: 12, repMax: 15, isMainLift: false },
  { id: 'd4-shoulder-press', day: 4, order: 3, name: 'Seated DB Shoulder Press', setCount: 3, repMin: 10, repMax: 12, isMainLift: false },
  { id: 'd4-wide-pulldown', day: 4, order: 4, name: 'Wide-Grip Lat Pulldown', setCount: 3, repMin: 10, repMax: 12, isMainLift: false },
  { id: 'd4-ezcurl', day: 4, order: 5, name: 'EZ-Bar Curl', setCount: 3, repMin: 10, repMax: 12, isMainLift: false, supersetGroup: 'd4-arms', notes: 'Superset with Overhead Tricep Extension' },
  { id: 'd4-tricep-ext', day: 4, order: 6, name: 'Overhead Tricep Extension', setCount: 3, repMin: 10, repMax: 12, isMainLift: false, supersetGroup: 'd4-arms', notes: 'Superset with EZ-Bar Curl' },
  { id: 'd4-lat-raise', day: 4, order: 7, name: 'Lateral Raise', setCount: 3, repMin: 15, repMax: 15, isMainLift: false, supersetGroup: 'd4-delts', notes: 'Superset with Rear Delt Fly' },
  { id: 'd4-rear-delt', day: 4, order: 8, name: 'Rear Delt Fly', setCount: 3, repMin: 15, repMax: 15, isMainLift: false, supersetGroup: 'd4-delts', notes: 'Superset with Lateral Raise' },
]

export const DAY_TITLES: Record<number, string> = {
  1: 'Upper Push (Strength)',
  2: 'Lower / Total-Body (Maintenance)',
  3: 'Upper Pull (Strength)',
  4: 'Upper Hypertrophy (Physique)',
}

export const SEED_PHASES: ProgramPhase[] = [
  { id: 'p1', name: 'Foundation', weekStart: 1, weekEnd: 4, focus: 'Groove technique, find working weights' },
  { id: 'p2', name: 'Hypertrophy Accumulation', weekStart: 5, weekEnd: 9, focus: 'Push volume on Day 4, moderate intensity elsewhere' },
  { id: 'p3', name: 'Strength Intensification', weekStart: 10, weekEnd: 14, focus: 'Drop main lifts to 3-5 reps, keep accessory volume', mainLiftReps: { min: 3, max: 5 } },
  { id: 'p4', name: 'Hypertrophy Peak', weekStart: 15, weekEnd: 18, focus: 'Highest volume/pump work — final visible push before year-end' },
  { id: 'taper', name: 'Taper', weekStart: 19, weekEnd: 20, focus: 'Deload, reassess, decide what’s next', isTaper: true },
]

/** Total program length in weeks (derived from the last phase). */
export const PROGRAM_WEEKS = SEED_PHASES[SEED_PHASES.length - 1].weekEnd
