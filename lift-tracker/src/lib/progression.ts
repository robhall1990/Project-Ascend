import { db } from '../db/db'
import type {
  DayNumber,
  Exercise,
  ProgramPhase,
  Session,
  SetLog,
  WeightUnit,
} from '../types'
import { effectiveRepRange } from './schedule'

/** Epley estimated one-rep max. Reps of 1 returns the weight itself. */
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  return weight * (1 + reps / 30)
}

/** Weight jump for a successful double-progression step. */
export function weightIncrement(ex: Exercise, unit: WeightUnit): number {
  // Barbell lower-body / heavy pulls move in bigger jumps than upper accessories.
  const bigJump = new Set(['d2-squat', 'd2-rdl', 'd3-rack-pull'])
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
    const current = effectiveRepRange(ex, currentPhase)
    const increment = weightIncrement(ex, unit)

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

    const rangeThen = effectiveRepRange(ex, phaseById.get(prev.session.phaseId))
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

    if (hitTop) {
      result[ex.id] = {
        action: 'increase',
        lastWeight: last,
        suggestedWeight: last + increment,
        hitTop,
        increment,
        targetMin: current.min,
        targetMax: current.max,
        reason: `Hit ${rangeThen.max} on every set — add ${increment}${unit}, back to ${current.min} reps.`,
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
        reason: `Hold ${last}${unit} until all sets reach ${current.max} reps.`,
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

/** Best estimated 1RM per completed session for one exercise, oldest → newest. */
export async function e1rmSeries(exerciseId: string): Promise<E1RMPoint[]> {
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
