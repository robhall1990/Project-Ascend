import { db } from '../db/db'
import { syncIntervals } from './intervals'
import { syncWellness } from './wellness'

// Manual "Sync now" buttons stay in Settings for an on-demand refresh, but a
// coaching app that only updates when you remember to tap a button isn't
// really coaching you. This runs the same two syncs automatically — on app
// launch and whenever the tab/app comes back to the foreground — throttled so
// it doesn't hit intervals.icu on every glance at the phone.

/** Re-sync (or retry) at most this often per feed. */
const AUTO_SYNC_STALE_MS = 60 * 60 * 1000 // 1 hour

function isStale(lastMs: number | undefined): boolean {
  return lastMs == null || Date.now() - lastMs > AUTO_SYNC_STALE_MS
}

// Throttle on *attempts*, not just successes, and in memory rather than
// Settings: a persistently failing sync (offline, bad credentials, intervals.icu
// down) never reaches the point of recording intervalsLastSync, so throttling
// only on that would retry on every single foreground event forever. This
// still gives every fresh app load one attempt, but caps retries within a
// session to once an hour per feed regardless of outcome.
let lastCardioAttempt: number | undefined
let lastWellnessAttempt: number | undefined

/**
 * Date window for a background sync: a full 30-day backfill the first time,
 * then a narrow few-day window on every re-sync after that — recent activity
 * is what's likely to have changed, and a small window keeps a
 * once-an-hour background job cheap.
 */
function syncWindow(everSynced: boolean): { oldest: string; newest: string } {
  const newest = new Date()
  const oldest = new Date()
  oldest.setDate(oldest.getDate() - (everSynced ? 3 : 30))
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { oldest: iso(oldest), newest: iso(newest) }
}

/**
 * Best-effort background sync of both intervals.icu feeds (cardio activities
 * and wellness/performance data). Never throws and never surfaces a toast —
 * this can fire while the user is looking at something unrelated, so a
 * failure here is logged and silently retried next time the app comes to the
 * foreground, rather than interrupting them. The manual Settings buttons are
 * still the place to see and act on sync errors directly.
 */
export async function autoSyncIntervals(): Promise<void> {
  const settings = await db.settings.get('singleton')
  if (!settings?.intervalsApiKey || !settings.intervalsAthleteId) return
  const { intervalsApiKey: apiKey, intervalsAthleteId: athleteId } = settings

  const jobs: Promise<void>[] = []

  if (isStale(lastCardioAttempt) && isStale(settings.intervalsLastSync)) {
    lastCardioAttempt = Date.now()
    const { oldest, newest } = syncWindow(settings.intervalsLastSync != null)
    jobs.push(
      syncIntervals(apiKey, athleteId, oldest, newest)
        .then(() => undefined)
        .catch((err) => console.warn('Auto-sync (cardio) failed:', err)),
    )
  }

  if (isStale(lastWellnessAttempt) && isStale(settings.intervalsLastWellnessSync)) {
    lastWellnessAttempt = Date.now()
    const { oldest, newest } = syncWindow(settings.intervalsLastWellnessSync != null)
    jobs.push(
      syncWellness(apiKey, athleteId, oldest, newest)
        .then(() => db.settings.update('singleton', { intervalsLastWellnessSync: Date.now() }))
        .then(() => undefined)
        .catch((err) => console.warn('Auto-sync (wellness) failed:', err)),
    )
  }

  await Promise.all(jobs)
}
