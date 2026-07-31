import { db } from './../db/db'
import { programPosition } from './schedule'
import { epley1RM } from './progression'
import { PROGRAM_WEEKS } from '../data/program'

export interface CombinedPoint {
  week: number
  /** Latest bodyweight logged that week (kg). */
  bodyweightKg?: number
  /** Sum of the four main lifts' best estimated 1RM, carried forward (kg). */
  strengthKg?: number
  /** Average daily protein across logged days that week (g). */
  proteinG?: number
}

const MAIN_LIFT_IDS = ['d1-ohp', 'd2-squat', 'd2-trapbar', 'd3-pullup']

/**
 * Weekly-bucketed series for the combined "payoff" view: bodyweight, a strength
 * index (sum of main-lift e1RMs, carried forward), and average daily protein —
 * all keyed by program week so they line up on one x-axis.
 */
export async function combinedProgress(startISO: string): Promise<CombinedPoint[]> {
  const weekOf = (date: string) => programPosition(startISO, parseLocal(date)).week

  // ---- Bodyweight: latest entry per week ----
  const bwByWeek = new Map<number, { weightKg: number; createdAt: number }>()
  for (const b of await db.bodyweightLogs.toArray()) {
    const w = weekOf(b.date)
    const prev = bwByWeek.get(w)
    if (!prev || b.createdAt > prev.createdAt) bwByWeek.set(w, { weightKg: b.weightKg, createdAt: b.createdAt })
  }

  // ---- Strength: best e1RM per main lift per week (from completed sessions) ----
  const completed = (await db.sessions.toArray()).filter((s) => s.completedAt != null)
  const sessionWeek = new Map(completed.map((s) => [s.id, weekOf(s.date)]))
  // week -> liftId -> best e1RM that week
  const liftWeekBest = new Map<number, Map<string, number>>()
  for (const log of await db.setLogs.toArray()) {
    if (!MAIN_LIFT_IDS.includes(log.exerciseId)) continue
    const w = sessionWeek.get(log.sessionId)
    if (w == null) continue
    const e = epley1RM(log.weight, log.reps)
    if (e <= 0) continue
    const wk = liftWeekBest.get(w) ?? new Map<string, number>()
    wk.set(log.exerciseId, Math.max(wk.get(log.exerciseId) ?? 0, e))
    liftWeekBest.set(w, wk)
  }

  // ---- Protein: average daily protein per week ----
  const proteinByWeek = new Map<number, Map<string, number>>() // week -> date -> daily protein
  for (const e of await db.foodEntries.toArray()) {
    const w = weekOf(e.date)
    const days = proteinByWeek.get(w) ?? new Map<string, number>()
    days.set(e.date, (days.get(e.date) ?? 0) + e.protein)
    proteinByWeek.set(w, days)
  }

  const weeksWithData = new Set<number>([
    ...bwByWeek.keys(),
    ...liftWeekBest.keys(),
    ...proteinByWeek.keys(),
  ])
  if (weeksWithData.size === 0) return []
  const maxWeek = Math.min(Math.max(...weeksWithData), PROGRAM_WEEKS)

  // Carry-forward strength: keep last known best per lift as weeks advance.
  const running = new Map<string, number>()
  const points: CombinedPoint[] = []
  for (let week = 1; week <= maxWeek; week++) {
    const thisWeekLifts = liftWeekBest.get(week)
    if (thisWeekLifts) for (const [id, v] of thisWeekLifts) running.set(id, Math.max(running.get(id) ?? 0, v))
    const strengthKg = running.size > 0 ? sum([...running.values()]) : undefined

    const days = proteinByWeek.get(week)
    const proteinG = days && days.size > 0 ? sum([...days.values()]) / days.size : undefined

    points.push({
      week,
      bodyweightKg: bwByWeek.get(week)?.weightKg,
      strengthKg,
      proteinG: proteinG != null ? Math.round(proteinG) : undefined,
    })
  }
  return points
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0)
}

function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
