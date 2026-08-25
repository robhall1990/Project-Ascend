import { useEffect, useState } from 'react'
import type { Settings } from '../types'
import { computeDailyLoad, resolveWeeklyTolerance } from './loadModeling'
import type { LoadContext } from './nutrition'

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

/**
 * Today's and yesterday's training load plus the resolved weekly tolerance,
 * for flexing nutrition targets around actual training stress (Phase 3).
 *
 * Deliberately a useEffect + local state hook rather than useLiveQuery:
 * computeDailyLoad() caches its result back to db.trainingLoads, and a
 * useLiveQuery watching that same table would re-fire on its own write,
 * looping. This only recomputes when the date or tolerance settings change.
 */
export function useLoadContext(settings: Settings, date: string): LoadContext | undefined {
  const [context, setContext] = useState<LoadContext | undefined>()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const weeklyTolerance = resolveWeeklyTolerance(settings)
      const [todayLoad, yesterdayLoad] = await Promise.all([
        computeDailyLoad(date),
        computeDailyLoad(isoDaysAgo(1)),
      ])
      if (!cancelled) {
        setContext({
          weeklyTolerance,
          todayLoad: todayLoad?.totalLoad,
          yesterdayLoad: yesterdayLoad?.totalLoad,
        })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [date, settings.recoveryTolerance, settings.trainingAge])

  return context
}
