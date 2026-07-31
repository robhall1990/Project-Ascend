import type { Exercise, ProgramPhase } from '../types'

// Seed data transcribed from training-program-v2-preparedness.md.
// General Physical Preparedness: 4-day split plus a weekly ruck, double
// progression, deloads every 5-6 weeks.
//
// Bump this whenever the seeded program changes so existing installs are
// migrated onto the new program instead of keeping the old one forever.
export const PROGRAM_VERSION = 2

/**
 * Carries progress distance first, then load. The prescribed distance is the
 * bottom of the range; this is how much further you extend before adding
 * weight and dropping back. (Interpretation of "progress distance first,
 * then load" — the source gives fixed distances, not ranges.)
 */
const CARRY_HEADROOM_M = 20

const carry = (base: number) => ({ targetMin: base, targetMax: base + CARRY_HEADROOM_M })

/**
 * The four lifts whose estimated 1RM is tracked. Overhead press is promoted to
 * the main press, bench is demoted, and squat and trap-bar deadlift are now
 * separate lifts rather than one alternating slot.
 */
export const SEED_EXERCISES: Exercise[] = [
  // ---- Day 1 — Upper Push + Carry ----
  { id: 'd1-ohp', day: 1, order: 1, name: 'Standing Overhead Press', setCount: 4, metric: 'reps', targetMin: 5, targetMax: 5, isMainLift: true, notes: 'Main press — overhead strength transfers to lifting and placing loads' },
  { id: 'd1-bench', day: 1, order: 2, name: 'Barbell Bench Press or Weighted Dips', setCount: 3, metric: 'reps', targetMin: 6, targetMax: 8, isMainLift: false },
  { id: 'd1-incline', day: 1, order: 3, name: 'Incline DB Press', setCount: 3, metric: 'reps', targetMin: 8, targetMax: 10, isMainLift: false },
  { id: 'd1-farmer', day: 1, order: 4, name: "Farmer's Carry", setCount: 4, metric: 'distance', ...carry(40), isMainLift: false, notes: 'Heavy' },
  { id: 'd1-lat-raise', day: 1, order: 5, name: 'Lateral Raise', setCount: 3, metric: 'reps', targetMin: 12, targetMax: 15, isMainLift: false },

  // ---- Day 2 — Lower / Load-Bearing ----
  { id: 'd2-squat', day: 2, order: 1, name: 'Back Squat or Front Squat', setCount: 4, metric: 'reps', targetMin: 5, targetMax: 5, isMainLift: true },
  { id: 'd2-trapbar', day: 2, order: 2, name: 'Trap Bar Deadlift', setCount: 3, metric: 'reps', targetMin: 5, targetMax: 5, isMainLift: true },
  { id: 'd2-lunge', day: 2, order: 3, name: 'Loaded Walking Lunge', setCount: 3, metric: 'distance', ...carry(20), isMainLift: false },
  { id: 'd2-frontcarry', day: 2, order: 4, name: 'Front-Rack or Zercher Carry', setCount: 3, metric: 'distance', ...carry(30), isMainLift: false },
  { id: 'd2-legraise', day: 2, order: 5, name: 'Hanging Leg Raise', setCount: 3, metric: 'reps', targetMin: 12, targetMax: 15, isMainLift: false },

  // ---- Day 3 — Upper Pull + Grip ----
  { id: 'd3-pullup', day: 3, order: 1, name: 'Weighted Pull-up', setCount: 4, metric: 'reps', targetMin: 4, targetMax: 6, isMainLift: true, notes: 'Strength-to-weight — the metric that matters for climbing and hauling' },
  { id: 'd3-row', day: 3, order: 2, name: 'Barbell Row or Chest-Supported Row', setCount: 3, metric: 'reps', targetMin: 8, targetMax: 10, isMainLift: false },
  { id: 'd3-db-row', day: 3, order: 3, name: 'Single-Arm DB Row', setCount: 3, metric: 'reps', targetMin: 10, targetMax: 10, perSide: true, isMainLift: false },
  { id: 'd3-suitcase', day: 3, order: 4, name: 'Suitcase Carry', setCount: 3, metric: 'distance', ...carry(40), perSide: true, isMainLift: false, notes: 'Brutal for the obliques — mimics one-handed carrying' },
  { id: 'd3-deadhang', day: 3, order: 5, name: 'Dead Hang', setCount: 3, metric: 'time', targetMin: 0, targetMax: 0, submax: true, isMainLift: false, notes: 'Max time' },
  { id: 'd3-facepull', day: 3, order: 6, name: 'Face Pull', setCount: 3, metric: 'reps', targetMin: 15, targetMax: 15, isMainLift: false },
  { id: 'd3-curl', day: 3, order: 7, name: 'Barbell Curl', setCount: 3, metric: 'reps', targetMin: 8, targetMax: 10, isMainLift: false },

  // ---- Day 4 — Work Capacity / Odd Object ----
  { id: 'd4-sandbag-clean', day: 4, order: 1, name: 'Sandbag Clean to Shoulder', setCount: 5, metric: 'reps', targetMin: 5, targetMax: 5, isMainLift: false },
  { id: 'd4-sled', day: 4, order: 2, name: 'Sled Push or Drag', setCount: 4, metric: 'distance', ...carry(30), isMainLift: false },
  { id: 'd4-kb-swing', day: 4, order: 3, name: 'Kettlebell Swing', setCount: 4, metric: 'reps', targetMin: 15, targetMax: 15, isMainLift: false },
  { id: 'd4-pushup', day: 4, order: 4, name: 'Push-ups', setCount: 4, metric: 'reps', targetMin: 0, targetMax: 0, submax: true, isMainLift: false, notes: 'Submax — stop short of failure' },
  { id: 'd4-sandbag-carry', day: 4, order: 5, name: 'Sandbag Carry', setCount: 4, metric: 'distance', ...carry(40), isMainLift: false },
  { id: 'd4-ezcurl', day: 4, order: 6, name: 'EZ-Bar Curl', setCount: 3, metric: 'reps', targetMin: 12, targetMax: 12, isMainLift: false, supersetGroup: 'd4-arms', notes: 'Finisher, superset with Tricep Extension' },
  { id: 'd4-tricep-ext', day: 4, order: 7, name: 'Tricep Extension', setCount: 3, metric: 'reps', targetMin: 12, targetMax: 12, isMainLift: false, supersetGroup: 'd4-arms', notes: 'Finisher, superset with EZ-Bar Curl' },
]

export const DAY_TITLES: Record<number, string> = {
  1: 'Upper Push + Carry',
  2: 'Lower / Load-Bearing',
  3: 'Upper Pull + Grip',
  4: 'Work Capacity / Odd Object',
}

export const DAY_NOTES: Record<number, string> = {
  1: '',
  2: 'Carrying anything heavy is legs and back.',
  3: '',
  4: 'Circuit format — 4-5 rounds, moderate rest.',
}

/**
 * No rep-range override on any phase: v2 explicitly keeps the main lifts at
 * 4-6 rather than dropping to 1-3, so "Strength" means heavier load at the same
 * reps, which double progression already handles.
 */
export const SEED_PHASES: ProgramPhase[] = [
  { id: 'p1', name: 'Foundation', weekStart: 1, weekEnd: 4, focus: 'Technique, baseline loads, start rucking light' },
  { id: 'p2', name: 'Accumulation', weekStart: 5, weekEnd: 9, focus: 'Build volume on carries and hypertrophy work' },
  { id: 'p3', name: 'Strength', weekStart: 10, weekEnd: 14, focus: 'Heavier main lifts, ruck load increases' },
  { id: 'p4', name: 'Capacity Peak', weekStart: 15, weekEnd: 18, focus: 'Highest work-capacity emphasis on Day 4' },
  { id: 'taper', name: 'Taper', weekStart: 19, weekEnd: 20, focus: 'Deload, reassess' },
]

/** Total program length in weeks (derived from the last phase). */
export const PROGRAM_WEEKS = SEED_PHASES[SEED_PHASES.length - 1].weekEnd
