import { db } from '../db/db'
import type {
  DayNumber,
  Exercise,
  ProgramPhase,
  Session,
  SetLog,
  WeightUnit,
} from '../types'
import { effectiveTargetRange } from './schedule'

/** Epley estimated one-rep max. Reps of 1 returns the weight itself. */
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  return weight * (1 + reps / 30)
}

/** Weight jump for a successful double-progression step. */
export function weightIncrement(ex: Exercise, unit: WeightUnit): number {
  // Barbell lower-body, carries and sleds move in bigger jumps than upper
  // accessories — they're limited by load tolerance, not fine motor control.
  const bigJump = new Set([
    'd2-squat',
    'd2-trapbar',
    'd1-farmer',
    'd2-frontcarry',
    'd3-suitcase',
    'd4-sled',
    'd4-sandbag-carry',
  ])
  if (unit === 'lb') return bigJump.has(ex.id) ? 10 : 5
  return bigJump.has(ex.id) ? 5 : 2.5
}

export type ProgressionAction = 'increase' | 'hold' | 'none'

export interface Suggestion {
  action: ProgressionAction
  /** Working weight used in the most recent session containing the exercise. */
  lastWeight?: number
  /** Weight to aim for next time. */
  suggestedWeight?: number
  /** Whether every set hit the top of the range last time. */
  hitTop: boolean
  increment: number
  /** Rep range to aim for next time (current phase). */
  targetMin: number
  targetMax: number
  /** Reason shown to the user. */
  reason: string
}

function workingWeight(sets: SetLog[]): number {
  return sets.reduce((m, s) => Math.max(m, s.weight), 0)
}

/**
 * Compute a double-progression suggestion for every exercise on a day, from the
 * most recent completed session in which each exercise was logged.
 */
export async function suggestionsForDay(
  day: DayNumber,
  currentPhase: ProgramPhase | undefined,
  deload: boolean,
  phases: ProgramPhase[],
  unit: WeightUnit,
  excludeSessionId?: string,
): Promise<Record<string, Suggestion>> {
  const exercises = await db.exercises.where('day').equals(day).sortBy('order')
  const phaseById = new Map(phases.map((p) => [p.id, p]))

  // Completed sessions, newest first (optionally excluding one, e.g. the
  // session currently being edited, so it doesn't reference itself).
  const completed = (
    await db.sessions.where('createdAt').above(0).sortBy('createdAt')
  )
    .reverse()
    .filter((s) => s.completedAt != null && s.id !== excludeSessionId)

  const result: Record<string, Suggestion> = {}

  for (const ex of exercises) {
    const current = effectiveTargetRange(ex, currentPhase)
    const increment = weightIncrement(ex, unit)

    // Submax work (push-ups, dead hangs) has no target to progress against —
    // the instruction is just to beat what you did, so no suggestion is made.
    if (ex.submax) {
      result[ex.id] = {
        action: 'none',
        hitTop: false,
        increment,
        targetMin: current.min,
        targetMax: current.max,
        reason: 'Work submaximally — beat last time where it feels right.',
      }
      continue
    }

    const prev = await findLastPerformance(ex.id, completed)
    if (!prev) {
      result[ex.id] = {
        action: 'none',
        hitTop: false,
        increment,
        targetMin: current.min,
        targetMax: current.max,
        reason: 'No history yet — log your first working weight.',
      }
      continue
    }

    const rangeThen = effectiveTargetRange(ex, phaseById.get(prev.session.phaseId))
    const last = workingWeight(prev.sets)
    const hitTop = prev.sets.length > 0 && prev.sets.every((s) => s.reps >= rangeThen.max)

    if (deload) {
      result[ex.id] = {
        action: 'hold',
        lastWeight: last,
        suggestedWeight: last,
        hitTop,
        increment,
        targetMin: current.min,
        targetMax: current.max,
        reason: 'Deload week — hold weight, cut volume.',
      }
      continue
    }

    const noun = ex.metric === 'distance' ? 'm' : ex.metric === 'time' ? 's' : 'reps'

    if (hitTop) {
      // Carries progress distance first: only once the distance headroom is
      // used up does load go up and distance drop back to base.
      result[ex.id] = {
        action: 'increase',
        lastWeight: last,
        suggestedWeight: last + increment,
        hitTop,
        increment,
        targetMin: current.min,
        targetMax: current.max,
        reason:
          ex.metric === 'distance'
            ? `Carried the full ${rangeThen.max}m on every set — add ${increment}${unit} and drop back to ${current.min}m.`
            : `Hit ${rangeThen.max} on every set — add ${increment}${unit}, back to ${current.min} ${noun}.`,
      }
    } else {
      result[ex.id] = {
        action: 'hold',
        lastWeight: last,
        suggestedWeight: last,
        hitTop,
        increment,
        targetMin: current.min,
        targetMax: current.max,
        reason:
          ex.metric === 'distance'
            ? `Hold ${last}${unit} and extend toward ${current.max}m before adding load.`
            : `Hold ${last}${unit} until all sets reach ${current.max} ${noun}.`,
      }
    }
  }

  return result
}

async function findLastPerformance(
  exerciseId: string,
  completedNewestFirst: Session[],
): Promise<{ session: Session; sets: SetLog[] } | null> {
  for (const s of completedNewestFirst) {
    const sets = await db.setLogs
      .where('sessionId')
      .equals(s.id)
      .and((l) => l.exerciseId === exerciseId && l.weight > 0)
      .toArray()
    if (sets.length > 0) return { session: s, sets }
  }
  return null
}

export interface E1RMPoint {
  date: string
  createdAt: number
  e1rm: number
}

/**
 * Best estimated 1RM per completed session for one exercise, oldest → newest.
 * Only meaningful for rep-based lifts — Epley has nothing to say about a carry
 * measured in metres or a hang measured in seconds.
 */
export async function e1rmSeries(exerciseId: string): Promise<E1RMPoint[]> {
  const ex = await db.exercises.get(exerciseId)
  if (ex && ex.metric !== 'reps') return []
  const completed = (await db.sessions.where('createdAt').above(0).sortBy('createdAt')).filter(
    (s) => s.completedAt != null,
  )
  const points: E1RMPoint[] = []
  for (const s of completed) {
    const sets = await db.setLogs
      .where('sessionId')
      .equals(s.id)
      .and((l) => l.exerciseId === exerciseId)
      .toArray()
    const best = sets.reduce((m, l) => Math.max(m, epley1RM(l.weight, l.reps)), 0)
    if (best > 0) points.push({ date: s.date, createdAt: s.createdAt, e1rm: best })
  }
  return points
}

/** One completed session's logged sets for an exercise, newest last. */
export interface HistorySession {
  date: string
  createdAt: number
  sets: Array<{ setNumber: number; weight: number; reps: number; rpe?: number }>
  topWeight: number
  bestE1rm: number
}

export async function exerciseHistory(exerciseId: string): Promise<HistorySession[]> {
  const completed = (await db.sessions.where('createdAt').above(0).sortBy('createdAt')).filter(
    (s) => s.completedAt != null,
  )
  const out: HistorySession[] = []
  for (const s of completed) {
    const sets = (
      await db.setLogs
        .where('sessionId')
        .equals(s.id)
        .and((l) => l.exerciseId === exerciseId && (l.weight > 0 || l.reps > 0))
        .toArray()
    ).sort((a, b) => a.setNumber - b.setNumber)
    if (sets.length === 0) continue
    out.push({
      date: s.date,
      createdAt: s.createdAt,
      sets: sets.map((x) => ({ setNumber: x.setNumber, weight: x.weight, reps: x.reps, rpe: x.rpe })),
      topWeight: Math.max(...sets.map((x) => x.weight)),
      bestE1rm: Math.max(...sets.map((x) => epley1RM(x.weight, x.reps))),
    })
  }
  return out
}

export interface TrendRow {
  date: string
  t: number
  [exerciseId: string]: number | string
}

/**
 * Estimated-1RM trend for the four main lifts, merged into one row set keyed by
 * session time so each lift becomes a line (gaps where it wasn't trained).
 */
export async function mainLiftsTrend(): Promise<{ mains: Exercise[]; rows: TrendRow[] }> {
  const order = ['d1-ohp', 'd2-squat', 'd2-trapbar', 'd3-pullup']
  const mains = (await db.exercises.toArray())
    .filter((e) => e.isMainLift)
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))

  const rowMap = new Map<number, TrendRow>()
  for (const ex of mains) {
    for (const p of await e1rmSeries(ex.id)) {
      let row = rowMap.get(p.createdAt)
      if (!row) {
        row = { date: p.date, t: p.createdAt }
        rowMap.set(p.createdAt, row)
      }
      row[ex.id] = Math.round(p.e1rm * 10) / 10
    }
  }
  const rows = [...rowMap.values()].sort((a, b) => a.t - b.t)
  return { mains, rows }
}

/** Current best estimated 1RM for each main lift. */
export async function mainLiftBests(): Promise<
  Array<{ exercise: Exercise; best: number; date?: string }>
> {
  const mains = (await db.exercises.toArray())
    .filter((e) => e.isMainLift)
    .sort((a, b) => a.day - b.day || a.order - b.order)
  const out: Array<{ exercise: Exercise; best: number; date?: string }> = []
  for (const ex of mains) {
    const series = await e1rmSeries(ex.id)
    const best = series.reduce(
      (acc, p) => (p.e1rm > acc.e1rm ? p : acc),
      { e1rm: 0, date: undefined as string | undefined },
    )
    out.push({ exercise: ex, best: best.e1rm, date: best.date })
  }
  return out
}
