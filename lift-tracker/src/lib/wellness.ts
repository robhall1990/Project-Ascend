import { db } from '../db/db'
import type { WellnessRecord } from '../types'

// intervals.icu exposes a per-day "wellness" record alongside activities. When
// the athlete has Garmin Connect linked there, this is where VO2 max, resting
// HR, HRV, sleep and the CTL/ATL fitness-fatigue model show up — so this reuses
// the same intervals.icu credentials rather than a separate Garmin OAuth flow.

const BASE = 'https://intervals.icu/api/v1'

interface RawWellness {
  id?: string // date, e.g. "2026-08-20"
  ctl?: number
  atl?: number
  rampRate?: number
  restingHR?: number
  hrv?: number
  vo2max?: number
  sleepSecs?: number
  sleepScore?: number
  bodyFat?: number
  weight?: number
}

function toWellnessRecord(w: RawWellness): WellnessRecord | null {
  if (!w.id) return null
  const ctl = w.ctl
  const atl = w.atl
  return {
    date: w.id,
    vo2max: w.vo2max ?? undefined,
    restingHr: w.restingHR ?? undefined,
    hrv: w.hrv ?? undefined,
    ctl: ctl ?? undefined,
    atl: atl ?? undefined,
    form: ctl != null && atl != null ? Math.round((ctl - atl) * 10) / 10 : undefined,
    rampRate: w.rampRate ?? undefined,
    sleepSecs: w.sleepSecs ?? undefined,
    sleepScore: w.sleepScore ?? undefined,
    bodyFatPct: w.bodyFat ?? undefined,
    weightKg: w.weight ?? undefined,
    source: 'intervals',
    syncedAt: Date.now(),
  }
}

export interface WellnessSyncResult {
  fetched: number
  imported: number
}

/** Fetch and store wellness records for an inclusive date range (YYYY-MM-DD). */
export async function syncWellness(
  apiKey: string,
  athleteId: string,
  oldest: string,
  newest: string,
): Promise<WellnessSyncResult> {
  const url = `${BASE}/athlete/${encodeURIComponent(athleteId)}/wellness.json?oldest=${oldest}&newest=${newest}`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: `Basic ${btoa(`API_KEY:${apiKey}`)}` },
    })
  } catch {
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

  const records = (raw as RawWellness[])
    .map(toWellnessRecord)
    .filter((r): r is WellnessRecord => r !== null)

  if (records.length) await db.wellnessRecords.bulkPut(records)

  return { fetched: raw.length, imported: records.length }
}

/** Most recent wellness record on file, if any. */
export async function latestWellness(): Promise<WellnessRecord | undefined> {
  return db.wellnessRecords.orderBy('date').last()
}

/** VO2 max trend, oldest → newest, for charting. */
export async function vo2maxSeries(): Promise<Array<{ date: string; vo2max: number }>> {
  const records = await db.wellnessRecords.orderBy('date').toArray()
  return records
    .filter((r): r is WellnessRecord & { vo2max: number } => r.vo2max != null)
    .map((r) => ({ date: r.date, vo2max: r.vo2max }))
}

/** One-line human summary of a wellness record, for the coaching prompt. */
export function wellnessSummary(w: WellnessRecord): string {
  const parts: string[] = []
  if (w.vo2max != null) parts.push(`VO2max ${w.vo2max}`)
  if (w.restingHr != null) parts.push(`resting HR ${w.restingHr}`)
  if (w.hrv != null) parts.push(`HRV ${w.hrv}ms`)
  if (w.ctl != null && w.atl != null) {
    parts.push(`fitness(CTL) ${Math.round(w.ctl)} / fatigue(ATL) ${Math.round(w.atl)}`)
  }
  if (w.form != null) parts.push(`form ${w.form > 0 ? '+' : ''}${w.form}`)
  if (w.sleepScore != null) parts.push(`sleep score ${w.sleepScore}`)
  return parts.length ? parts.join(', ') : 'no metrics recorded'
}
