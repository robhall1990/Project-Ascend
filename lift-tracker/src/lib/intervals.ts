import { db } from '../db/db'
import type { CardioActivity, DayType, EnduranceIntensity } from '../types'

// intervals.icu already aggregates activities from Garmin/Strava/Wahoo, so it's
// the single place to pull cardio from. Auth is HTTP Basic with the literal
// username "API_KEY" and the user's key as the password.

const BASE = 'https://intervals.icu/api/v1'

/** Sports that count as endurance work for fuelling purposes. */
const ENDURANCE_SPORTS = new Set(['Run', 'Ride', 'Swim', 'Row', 'Ski', 'Walk', 'Elliptical'])

/** intervals.icu strength sessions shouldn't be treated as cardio. */
const STRENGTH_SPORTS = new Set(['WeightTraining', 'Workout'])

export function normaliseSport(type: string | undefined): string {
  const t = (type || '').toLowerCase()
  if (t.includes('run')) return 'Run'
  if (t.includes('ride') || t.includes('cycl') || t.includes('bike') || t.includes('velo')) return 'Ride'
  if (t.includes('swim')) return 'Swim'
  if (t.includes('row')) return 'Row'
  if (t.includes('walk') || t.includes('hike')) return 'Walk'
  if (t.includes('ski')) return 'Ski'
  if (t.includes('elliptical')) return 'Elliptical'
  if (t.includes('weight') || t.includes('strength')) return 'WeightTraining'
  return type || 'Other'
}

export function isEnduranceSport(sport: string): boolean {
  return ENDURANCE_SPORTS.has(sport) && !STRENGTH_SPORTS.has(sport)
}

interface RawActivity {
  id: string | number
  name?: string
  type?: string
  start_date_local?: string
  moving_time?: number
  elapsed_time?: number
  distance?: number
  calories?: number
  icu_calories?: number
  average_heartrate?: number
  icu_training_load?: number
}

function toActivity(a: RawActivity): CardioActivity | null {
  const date = (a.start_date_local || '').slice(0, 10)
  if (!date) return null
  const seconds = a.moving_time || a.elapsed_time || 0
  return {
    id: `icu:${a.id}`,
    date,
    name: a.name || a.type || 'Activity',
    sport: normaliseSport(a.type),
    movingMinutes: Math.round(seconds / 60),
    distanceKm: a.distance ? Math.round((a.distance / 1000) * 100) / 100 : undefined,
    calories: a.calories ?? a.icu_calories ?? undefined,
    avgHr: a.average_heartrate != null ? Math.round(a.average_heartrate) : undefined,
    load: a.icu_training_load ?? undefined,
    source: 'intervals',
    syncedAt: Date.now(),
  }
}

/**
 * Infer session intensity from training load per hour, falling back to heart
 * rate, then to moderate. Used to size the endurance carbohydrate top-up.
 */
export function inferIntensity(act: {
  load?: number
  movingMinutes: number
  avgHr?: number
}): EnduranceIntensity {
  const hours = act.movingMinutes / 60
  if (act.load && hours > 0.1) {
    const perHour = act.load / hours
    if (perHour >= 70) return 'hard'
    if (perHour >= 45) return 'moderate'
    return 'easy'
  }
  if (act.avgHr) {
    if (act.avgHr >= 160) return 'hard'
    if (act.avgHr >= 135) return 'moderate'
    return 'easy'
  }
  return 'moderate'
}

export interface SyncResult {
  fetched: number
  imported: number
  daysUpdated: number
}

/** Fetch and store activities for an inclusive date range (YYYY-MM-DD). */
export async function syncIntervals(
  apiKey: string,
  athleteId: string,
  oldest: string,
  newest: string,
): Promise<SyncResult> {
  const url = `${BASE}/athlete/${encodeURIComponent(athleteId)}/activities?oldest=${oldest}&newest=${newest}`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: `Basic ${btoa(`API_KEY:${apiKey}`)}` },
    })
  } catch {
    // A browser-blocked cross-origin request lands here with no status.
    throw new Error(
      'Couldn’t reach intervals.icu from the browser. This is usually CORS — the API may not allow direct browser calls.',
    )
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('intervals.icu rejected those credentials — check the API key and Athlete ID.')
  }
  if (!res.ok) throw new Error(`intervals.icu error: HTTP ${res.status}`)

  const raw = (await res.json()) as unknown
  if (!Array.isArray(raw)) throw new Error('Unexpected response from intervals.icu')

  const activities = (raw as RawActivity[])
    .map(toActivity)
    .filter((a): a is CardioActivity => a !== null && a.movingMinutes > 0)

  if (activities.length) await db.cardioActivities.bulkPut(activities)

  const daysUpdated = await applyCardioToDays([...new Set(activities.map((a) => a.date))])

  await db.settings.update('singleton', { intervalsLastSync: Date.now() })

  return { fetched: raw.length, imported: activities.length, daysUpdated }
}

/**
 * Reflect synced cardio into each day's nutrition context: total endurance
 * minutes and an inferred intensity, which the macro engine turns into extra
 * carbohydrate. A day the user set by hand is left alone.
 */
export async function applyCardioToDays(dates: string[]): Promise<number> {
  let updated = 0
  for (const date of dates) {
    const dayActs = (await db.cardioActivities.where('date').equals(date).toArray()).filter((a) =>
      isEnduranceSport(a.sport),
    )
    if (dayActs.length === 0) continue

    const existing = await db.dayNutrition.get(date)
    if (existing?.dayTypeSource === 'manual') continue

    const minutes = dayActs.reduce((n, a) => n + a.movingMinutes, 0)
    const totalLoad = dayActs.reduce((n, a) => n + (a.load ?? 0), 0)
    const avgHr = dayActs.find((a) => a.avgHr)?.avgHr
    const intensity = inferIntensity({ load: totalLoad || undefined, movingMinutes: minutes, avgHr })

    await db.dayNutrition.put({
      ...(existing ?? { date }),
      date,
      dayType: 'endurance' as DayType,
      enduranceMinutes: minutes,
      enduranceIntensity: intensity,
      dayTypeSource: 'intervals',
    })
    updated++
  }
  return updated
}

/** Endurance minutes and load over the last `days` days, for training context. */
export async function recentCardioLoad(days = 7): Promise<{ minutes: number; load: number }> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffISO = cutoff.toISOString().slice(0, 10)
  const acts = (await db.cardioActivities.toArray()).filter(
    (a) => a.date >= cutoffISO && isEnduranceSport(a.sport),
  )
  return {
    minutes: acts.reduce((n, a) => n + a.movingMinutes, 0),
    load: Math.round(acts.reduce((n, a) => n + (a.load ?? 0), 0)),
  }
}
