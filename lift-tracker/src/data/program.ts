import type { Exercise, ProgramPhase } from '../types'

// v3: Physique + functional-dad strength. Same 4-day + weekly-ruck structure
// as v2, but accessory work shifts hard into hypertrophy territory (10-15+
// reps, more isolation, more direct sets on the muscles that actually show —
// shoulders, chest, arms, back width, abs) while the four main lifts stay
// heavy. Carries/odd-object work survive at reduced volume: still real
// grip/carrying capacity for an actual dad, just no longer the dominant
// stimulus on every day.
//
// Bump this whenever the seeded program changes so existing installs are
// migrated onto the new program instead of keeping the old one forever.
export const PROGRAM_VERSION = 3

/**
 * Carries progress distance first, then load. The prescribed distance is the
 * bottom of the range; this is how much further you extend before adding
 * weight and dropping back.
 */
const CARRY_HEADROOM_M = 20

const carry = (base: number) => ({ targetMin: base, targetMax: base + CARRY_HEADROOM_M })

/**
 * The four lifts whose estimated 1RM is tracked. Unchanged from v2 — overhead
 * press, back squat, trap-bar deadlift and weighted pull-up are already as
 * good for visible mass as they are for raw strength, so there was no reason
 * to touch them. Keeping the same ids also means existing e1RM history keeps
 * plotting as one continuous line across the version bump.
 */
export const SEED_EXERCISES: Exercise[] = [
  // ---- Day 1 — Push: Chest, Shoulders & Arms ----
  { id: 'd1-ohp', day: 1, order: 1, name: 'Standing Overhead Press', setCount: 4, metric: 'reps', targetMin: 5, targetMax: 5, isMainLift: true, notes: 'Main press — overhead strength transfers to lifting and placing loads' },
  { id: 'd1-incline', day: 1, order: 2, name: 'Incline DB or Barbell Press', setCount: 4, metric: 'reps', targetMin: 8, targetMax: 12, isMainLift: false, notes: 'Upper chest — the fullness that shows in a t-shirt' },
  { id: 'd1-chestpress', day: 1, order: 3, name: 'Flat DB Press or Machine Chest Press', setCount: 3, metric: 'reps', targetMin: 10, targetMax: 12, isMainLift: false },
  { id: 'd1-lat-raise', day: 1, order: 4, name: 'Cable or DB Lateral Raise', setCount: 4, metric: 'reps', targetMin: 15, targetMax: 20, isMainLift: false, notes: 'Shoulder width — does more for the silhouette than almost anything else here' },
  { id: 'd1-tricep', day: 1, order: 5, name: 'Cable Tricep Pushdown', setCount: 3, metric: 'reps', targetMin: 10, targetMax: 15, isMainLift: false },
  { id: 'd1-farmer', day: 1, order: 6, name: "Farmer's Carry", setCount: 3, metric: 'distance', ...carry(40), isMainLift: false, notes: 'Heavy — grip and trap work that actually carries over to hauling kids and shopping' },

  // ---- Day 2 — Legs & Core ----
  { id: 'd2-squat', day: 2, order: 1, name: 'Back Squat or Front Squat', setCount: 4, metric: 'reps', targetMin: 5, targetMax: 5, isMainLift: true },
  { id: 'd2-trapbar', day: 2, order: 2, name: 'Trap Bar Deadlift', setCount: 3, metric: 'reps', targetMin: 5, targetMax: 5, isMainLift: true },
  { id: 'd2-splitsquat', day: 2, order: 3, name: 'Bulgarian Split Squat or Walking Lunge', setCount: 3, metric: 'reps', targetMin: 10, targetMax: 12, perSide: true, isMainLift: false, notes: 'Quad/glute size plus single-leg stability' },
  { id: 'd2-legcurl', day: 2, order: 4, name: 'Lying or Seated Leg Curl', setCount: 3, metric: 'reps', targetMin: 10, targetMax: 12, isMainLift: false, notes: 'Hamstrings — balances the squat/lunge quad volume and protects the lower back' },
  { id: 'd2-frontcarry', day: 2, order: 5, name: 'Front-Rack or Zercher Carry', setCount: 2, metric: 'distance', ...carry(30), isMainLift: false },
  { id: 'd2-legraise', day: 2, order: 6, name: 'Hanging Leg Raise', setCount: 3, metric: 'reps', targetMin: 12, targetMax: 15, isMainLift: false, notes: 'Abs show at low body fat more than high rep counts, but this keeps them trained' },

  // ---- Day 3 — Pull: Back & Arms ----
  { id: 'd3-pullup', day: 3, order: 1, name: 'Weighted Pull-up', setCount: 4, metric: 'reps', targetMin: 4, targetMax: 6, isMainLift: true, notes: 'Strength-to-weight — the metric that matters for climbing and hauling' },
  { id: 'd3-latpulldown', day: 3, order: 2, name: 'Wide-Grip Lat Pulldown', setCount: 3, metric: 'reps', targetMin: 10, targetMax: 12, isMainLift: false, notes: 'Back width — the V-taper, second angle on top of the heavy pull-up' },
  { id: 'd3-row', day: 3, order: 3, name: 'Barbell Row or Chest-Supported Row', setCount: 3, metric: 'reps', targetMin: 8, targetMax: 12, isMainLift: false, notes: 'Back thickness' },
  { id: 'd3-db-row', day: 3, order: 4, name: 'Single-Arm DB Row', setCount: 3, metric: 'reps', targetMin: 10, targetMax: 12, perSide: true, isMainLift: false },
  { id: 'd3-facepull', day: 3, order: 5, name: 'Face Pull', setCount: 3, metric: 'reps', targetMin: 15, targetMax: 20, isMainLift: false, notes: 'Rear delts and posture — the unglamorous exercise that keeps the glamorous ones healthy' },
  { id: 'd3-curl', day: 3, order: 6, name: 'Barbell Curl', setCount: 3, metric: 'reps', targetMin: 8, targetMax: 12, isMainLift: false },
  { id: 'd3-hammercurl', day: 3, order: 7, name: 'Hammer Curl', setCount: 3, metric: 'reps', targetMin: 10, targetMax: 12, isMainLift: false, notes: 'Second angle — brachialis and forearm, arm thickness from the side' },
  { id: 'd3-suitcase', day: 3, order: 8, name: 'Suitcase Carry', setCount: 2, metric: 'distance', ...carry(40), perSide: true, isMainLift: false, notes: 'Brutal for the obliques — mimics one-handed carrying' },

  // ---- Day 4 — Conditioning & Arms Finisher ----
  { id: 'd4-sandbag-clean', day: 4, order: 1, name: 'Sandbag Clean to Shoulder', setCount: 5, metric: 'reps', targetMin: 5, targetMax: 5, isMainLift: false },
  { id: 'd4-sled', day: 4, order: 2, name: 'Sled Push or Drag', setCount: 4, metric: 'distance', ...carry(30), isMainLift: false },
  { id: 'd4-kb-swing', day: 4, order: 3, name: 'Kettlebell Swing', setCount: 4, metric: 'reps', targetMin: 15, targetMax: 15, isMainLift: false },
  { id: 'd4-pushup', day: 4, order: 4, name: 'Push-ups', setCount: 4, metric: 'reps', targetMin: 0, targetMax: 0, submax: true, isMainLift: false, notes: 'Submax — stop short of failure' },
  { id: 'd4-sandbag-carry', day: 4, order: 5, name: 'Sandbag Carry', setCount: 3, metric: 'distance', ...carry(40), isMainLift: false },
  { id: 'd4-ezcurl', day: 4, order: 6, name: 'EZ-Bar Curl', setCount: 3, metric: 'reps', targetMin: 12, targetMax: 15, isMainLift: false, supersetGroup: 'd4-arms', notes: 'Finisher, superset with Tricep Extension' },
  { id: 'd4-tricep-ext', day: 4, order: 7, name: 'Tricep Extension', setCount: 3, metric: 'reps', targetMin: 12, targetMax: 15, isMainLift: false, supersetGroup: 'd4-arms', notes: 'Finisher, superset with EZ-Bar Curl' },
]

export const DAY_TITLES: Record<number, string> = {
  1: 'Push: Chest, Shoulders & Arms',
  2: 'Legs & Core',
  3: 'Pull: Back & Arms',
  4: 'Conditioning & Arms Finisher',
}

export const DAY_NOTES: Record<number, string> = {
  1: '',
  2: 'Carrying anything heavy is legs and back.',
  3: '',
  4: 'Circuit format — 4-5 rounds, moderate rest.',
}

/**
 * No rep-range override on any phase: as in v2, the main lifts stay at their
 * working reps throughout, so "Strength" means heavier load at the same
 * reps, which double progression already handles.
 */
export const SEED_PHASES: ProgramPhase[] = [
  { id: 'p1', name: 'Foundation', weekStart: 1, weekEnd: 4, focus: 'Technique, baseline loads, start rucking light' },
  { id: 'p2', name: 'Accumulation', weekStart: 5, weekEnd: 9, focus: 'Build volume on hypertrophy accessories and carries' },
  { id: 'p3', name: 'Strength', weekStart: 10, weekEnd: 14, focus: 'Heavier main lifts, ruck load increases' },
  { id: 'p4', name: 'Capacity Peak', weekStart: 15, weekEnd: 18, focus: 'Highest work-capacity emphasis on Day 4' },
  { id: 'taper', name: 'Taper', weekStart: 19, weekEnd: 20, focus: 'Deload, reassess' },
]

/** Total program length in weeks (derived from the last phase). */
export const PROGRAM_WEEKS = SEED_PHASES[SEED_PHASES.length - 1].weekEnd
