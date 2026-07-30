import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { DayType, EnduranceIntensity, GoalMode, Settings } from '../types'
import { todayISO } from '../lib/schedule'
import {
  GOAL_LABEL,
  maintenanceCalories,
  resolveTarget,
  setDayType,
  setEndurance,
} from '../lib/nutrition'
import { ProteinRing, MacroBar } from './MacroRings'
import { StatsForm } from './StatsForm'

const DAY_TYPES: DayType[] = ['lift', 'endurance', 'rest']
const DAY_TYPE_LABEL: Record<DayType, string> = {
  lift: 'Lift',
  endurance: 'Endurance',
  rest: 'Rest',
}
const GOALS: GoalMode[] = ['lean-gain', 'recomposition', 'maintenance']
const INTENSITIES: EnduranceIntensity[] = ['easy', 'moderate', 'hard']

const COLOR = {
  protein: '#22c55e',
  calories: '#38bdf8',
  carbs: '#f59e0b',
  fat: '#a78bfa',
}

export function FuelScreen({ settings }: { settings: Settings }) {
  const today = todayISO()
  const stats = useLiveQuery(() => db.userStats.get('singleton'))
  const bw = useLiveQuery(() => db.bodyweightLogs.orderBy('createdAt').last())
  const dayNut = useLiveQuery(() => db.dayNutrition.get(today), [today])
  const entries = useLiveQuery(() => db.foodEntries.where('date').equals(today).toArray(), [today], [])

  const [editingStats, setEditingStats] = useState(false)

  if (!stats || !bw) return <div className="app">Loading…</div>

  const bodyweightKg = bw.weightKg
  const dayType = dayNut?.dayType ?? 'lift'
  const target = resolveTarget(dayNut, { stats, bodyweightKg, goal: settings.goalMode })
  const maintenance = Math.round(maintenanceCalories(stats, bodyweightKg))

  const consumed = (entries ?? []).reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>Fuel</h1>
        <button className="link-btn" onClick={() => setEditingStats((v) => !v)}>
          {editingStats ? 'Close' : 'Stats'}
        </button>
      </header>

      {!stats.configured && !editingStats && (
        <button className="setup-banner" onClick={() => setEditingStats(true)}>
          📏 Using example stats ({bodyweightKg} kg, {stats.heightCm} cm, {stats.age}). Tap to set
          your own so targets are accurate.
        </button>
      )}

      {editingStats ? (
        <StatsForm
          stats={stats}
          bodyweightKg={bodyweightKg}
          settings={settings}
          onClose={() => setEditingStats(false)}
        />
      ) : (
        <>
          {/* Day type */}
          <div className="segmented">
            {DAY_TYPES.map((d) => (
              <button
                key={d}
                className={dayType === d ? 'active' : ''}
                onClick={() => setDayType(today, d)}
              >
                {DAY_TYPE_LABEL[d]}
              </button>
            ))}
          </div>

          {dayType === 'endurance' && (
            <EnduranceControls
              minutes={dayNut?.enduranceMinutes ?? 60}
              intensity={dayNut?.enduranceIntensity ?? 'moderate'}
              onChange={(m, i) => setEndurance(today, m, i)}
            />
          )}

          {/* Protein ring — the headline */}
          <section className="fuel-hero">
            <ProteinRing consumed={consumed.protein} target={target.protein} color={COLOR.protein} />
          </section>

          {/* Other macros */}
          <div className="macro-bars">
            <MacroBar label="Calories" consumed={consumed.calories} target={target.calories} unit="kcal" color={COLOR.calories} />
            <MacroBar label="Carbs" consumed={consumed.carbs} target={target.carbs} unit="g" color={COLOR.carbs} />
            <MacroBar label="Fat" consumed={consumed.fat} target={target.fat} unit="g" color={COLOR.fat} />
          </div>

          {/* Goal + rationale */}
          <div className="goal-row">
            <span className="goal-label">Goal</span>
            <div className="segmented small">
              {GOALS.map((g) => (
                <button
                  key={g}
                  className={settings.goalMode === g ? 'active' : ''}
                  onClick={() => db.settings.update('singleton', { goalMode: g })}
                >
                  {GOAL_LABEL[g]}
                </button>
              ))}
            </div>
          </div>

          <p className="fuel-rationale">
            Maintenance ≈ {maintenance} kcal (Mifflin–St Jeor × activity).{' '}
            {settings.goalMode === 'lean-gain' ? '+10% for lean gain. ' : 'Held at maintenance. '}
            Protein {stats.proteinPerKg} g/kg · fat ~25% of calories · carbs flex by day type
            {dayType === 'endurance' ? ' (extra carbs added for today’s session).' : dayType === 'rest' ? ' (carbs trimmed for rest).' : '.'}
          </p>
        </>
      )}
    </div>
  )
}

function EnduranceControls({
  minutes,
  intensity,
  onChange,
}: {
  minutes: number
  intensity: EnduranceIntensity
  onChange: (m: number, i: EnduranceIntensity) => void
}) {
  return (
    <div className="endurance-controls">
      <label>
        Session length: <strong>{minutes} min</strong>
        <input
          type="range"
          min={20}
          max={240}
          step={5}
          value={minutes}
          onChange={(e) => onChange(parseInt(e.target.value), intensity)}
        />
      </label>
      <div className="segmented small">
        {INTENSITIES.map((i) => (
          <button key={i} className={intensity === i ? 'active' : ''} onClick={() => onChange(minutes, i)}>
            {i[0].toUpperCase() + i.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )
}
