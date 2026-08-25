import { db } from '../db/db'
import type { RecoveryStatus, TrainingLoad } from '../types'

/**
 * Compute training load for a day from strength and cardio components.
 * Returns undefined if no data available that day.
 */
export async function computeDailyLoad(date: string): Promise<TrainingLoad | undefined> {
  // Fetch strength log: most recent session on that date
  const session = await db.sessions
    .where('date')
    .equals(date)
    .and((s) => s.completedAt != null)
    .toArray()
    .then((sessions) => sessions.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0])

  let strengthRpe: number | undefined
  let strengthDurationMin: number | undefined
  let strengthLoad = 0

  if (session) {
    // Get all sets for this session to extract RPE
    const setLogs = await db.setLogs
      .where('sessionId')
      .equals(session.id)
      .toArray()
    if (setLogs.length > 0) {
      // Use average RPE across all sets logged that session
      const rpeValues = setLogs.map((s) => s.rpe ?? 0).filter((r) => r > 0)
      if (rpeValues.length > 0) {
        strengthRpe = Math.round((rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length) * 10) / 10
      }
    }
    // Duration: assume 60 minutes for a full session (user can adjust later)
    strengthDurationMin = 60
    if (strengthRpe && strengthDurationMin) {
      strengthLoad = strengthRpe * strengthDurationMin
    }
  }

  // Fetch cardio load: sum of all cardio activities that day
  const cardioActivities = await db.cardioActivities
    .where('date')
    .equals(date)
    .toArray()
  const cardioLoad = cardioActivities.reduce((sum, activity) => sum + (activity.load ?? 0), 0)

  const totalLoad = strengthLoad + cardioLoad
  const recoveryStatus = computeRecoveryStatus(totalLoad)

  // Only return a load record if there's actual data
  if (strengthLoad === 0 && cardioLoad === 0) {
    return undefined
  }

  return {
    id: `load:${date}`,
    date,
    strengthRpe,
    strengthDurationMin,
    strengthLoad,
    cardioLoad,
    totalLoad,
    recoveryStatus,
    createdAt: Date.now(),
  }
}

/**
 * Determine recovery status based on daily load.
 * Conservative thresholds: under 50 is adequate, 50–150 is okay, over 150 is deficit.
 */
function computeRecoveryStatus(totalLoad: number): RecoveryStatus {
  if (totalLoad < 50) return 'adequate'
  if (totalLoad < 150) return 'adequate'
  return 'deficit'
}

/**
 * Get the rolling sum of cardio load over the last N days.
 */
export async function recentCardioLoad(days: number = 7): Promise<number> {
  const now = Date.now()
  const windowMs = days * 24 * 60 * 60 * 1000
  const oldestTime = now - windowMs

  const activities = await db.cardioActivities
    .where('syncedAt')
    .aboveOrEqual(oldestTime)
    .toArray()

  return activities.reduce((sum, activity) => sum + (activity.load ?? 0), 0)
}

/**
 * Get daily loads for a date range, filling in missing days with zeros.
 */
export async function loadSeries(startDate: string, endDate: string): Promise<TrainingLoad[]> {
  const loads: TrainingLoad[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  const current = new Date(start)

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]
    const load = await computeDailyLoad(dateStr)
    if (load) {
      loads.push(load)
    } else {
      // Add a zero-load day for charting continuity
      loads.push({
        id: `load:${dateStr}`,
        date: dateStr,
        strengthLoad: 0,
        cardioLoad: 0,
        totalLoad: 0,
        recoveryStatus: 'adequate',
        createdAt: Date.now(),
      })
    }
    current.setDate(current.getDate() + 1)
  }

  return loads
}

/**
 * Sum of loads over the last N days.
 */
export async function weeklyLoadTotal(days: number = 7): Promise<number> {
  const now = new Date()
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]
  const endDate = now.toISOString().split('T')[0]

  const loads = await loadSeries(startDate, endDate)
  return loads.reduce((sum, load) => sum + load.totalLoad, 0)
}
