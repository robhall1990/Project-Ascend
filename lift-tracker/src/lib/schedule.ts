import type { DayNumber, Exercise, Metric, ProgramPhase } from '../types'
import { PROGRAM_WEEKS } from '../data/program'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Parse a YYYY-MM-DD string as local midnight (avoids UTC offset drift). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Local midnight of a Date, as a fresh Date. */
function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Whole days from `start` to `today` (negative if the program hasn't begun). */
export function daysSinceStart(startISO: string, today = new Date()): number {
  const start = atMidnight(parseISODate(startISO)).getTime()
  const now = atMidnight(today).getTime()
  return Math.floor((now - start) / MS_PER_DAY)
}

export interface ProgramPosition {
  /** 1-based program week, clamped to [1, PROGRAM_WEEKS]. */
  week: number
  /** True when today is before the program's start date. */
  notStarted: boolean
  /** Days until the program starts (0 once started). */
  daysUntilStart: number
  weeksRemaining: number
}

export function programPosition(startISO: string, today = new Date()): ProgramPosition {
  const diff = daysSinceStart(startISO, today)
  const notStarted = diff < 0
  const rawWeek = Math.floor(diff / 7) + 1
  const week = Math.min(Math.max(rawWeek, 1), PROGRAM_WEEKS)
  return {
    week,
    notStarted,
    daysUntilStart: notStarted ? -diff : 0,
    weeksRemaining: Math.max(PROGRAM_WEEKS - week, 0),
  }
}

export function phaseForWeek(week: number, phases: ProgramPhase[]): ProgramPhase | undefined {
  return phases.find((p) => week >= p.weekStart && week <= p.weekEnd)
}

/**
 * Which day (1-4) comes next in the rotation, given the day of the most recent
 * completed session. No history yet → Day 1; otherwise the following day, wrapping.
 */
export function nextDayAfter(lastDay: DayNumber | undefined): DayNumber {
  if (!lastDay) return 1
  return ((lastDay % 4) + 1) as DayNumber
}

/** Today as a local YYYY-MM-DD string. */
export function todayISO(today = new Date()): string {
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Target range for an exercise after any current-phase adjustment. */
export function effectiveTargetRange(
  ex: Exercise,
  phase: ProgramPhase | undefined,
): { min: number; max: number; adjusted: boolean } {
  if (ex.isMainLift && phase?.mainLiftReps) {
    return { ...phase.mainLiftReps, adjusted: true }
  }
  return { min: ex.targetMin, max: ex.targetMax, adjusted: false }
}

/** Short unit suffix for an exercise's metric. */
export function metricUnit(metric: Metric): string {
  return metric === 'distance' ? 'm' : metric === 'time' ? 's' : ''
}

/** Input label for logging a set of this exercise. */
export function metricLabel(metric: Metric): string {
  return metric === 'distance' ? 'Metres' : metric === 'time' ? 'Seconds' : 'Reps'
}

/** "4×4-6", "4×40m", "3× max" style prescription string. */
export function formatPrescription(
  setCount: number,
  min: number,
  max: number,
  metric: Metric = 'reps',
  submax = false,
): string {
  if (submax) return `${setCount}× max`
  const unit = metricUnit(metric)
  const amount = min === max ? `${min}` : `${min}-${max}`
  return `${setCount}×${amount}${unit}`
}

/**
 * Weeks on which a deload is due. Every ~6 weeks (6, 12, 18) plus the taper
 * block, matching "deload every 5-6 weeks" from the program.
 */
export const DELOAD_WEEKS = [6, 12, 18]

export function isDeloadWeek(week: number, phase: ProgramPhase | undefined): boolean {
  return DELOAD_WEEKS.includes(week) || !!phase?.isTaper
}

/** Suggested working sets, cut to 2 on a deload week (from the usual 3-4). */
export function effectiveSetCount(setCount: number, deload: boolean): number {
  return deload ? Math.min(2, setCount) : setCount
}
