import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { isEnduranceSport, recentCardioLoad } from '../lib/intervals'

const SPORT_ICON: Record<string, string> = {
  Run: '🏃',
  Ride: '🚴',
  Swim: '🏊',
  Row: '🚣',
  Walk: '🚶',
  Ski: '⛷',
}

/**
 * Today's synced cardio plus the rolling weekly load — context for how much
 * endurance fatigue is already in the legs before a lifting session.
 */
export function CardioCard({ date }: { date: string }) {
  const today = useLiveQuery(() => db.cardioActivities.where('date').equals(date).toArray(), [date], [])
  const week = useLiveQuery(() => recentCardioLoad(7), [], { minutes: 0, load: 0 })

  const endurance = (today ?? []).filter((a) => isEnduranceSport(a.sport))
  if (endurance.length === 0 && (week?.minutes ?? 0) === 0) return null

  return (
    <div className="cardio-card">
      <div className="cardio-head">
        <span className="cardio-title">Cardio</span>
        <span className="cardio-week">
          {Math.round((week?.minutes ?? 0) / 6) / 10} h this week
          {week?.load ? ` · ${week.load} load` : ''}
        </span>
      </div>
      {endurance.length === 0 ? (
        <p className="cardio-empty">Nothing logged today.</p>
      ) : (
        endurance.map((a) => (
          <div className="cardio-row" key={a.id}>
            <span className="cardio-sport">{SPORT_ICON[a.sport] ?? '🏅'}</span>
            <span className="cardio-name">{a.name}</span>
            <span className="cardio-stats">
              {a.movingMinutes} min
              {a.distanceKm ? ` · ${a.distanceKm} km` : ''}
              {a.avgHr ? ` · ${a.avgHr} bpm` : ''}
            </span>
          </div>
        ))
      )}
    </div>
  )
}
