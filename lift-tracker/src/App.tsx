import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import type { DayNumber } from './types'
import { DAY_TITLES } from './data/program'
import {
  nextDayInRotation,
  phaseForWeek,
  programPosition,
} from './lib/schedule'
import { SessionView } from './components/SessionView'

export function App() {
  const settings = useLiveQuery(() => db.settings.get('singleton'))
  const exercises = useLiveQuery(() => db.exercises.orderBy('order').toArray())
  const phases = useLiveQuery(() => db.phases.orderBy('weekStart').toArray())
  const sessionCount = useLiveQuery(() => db.sessions.count(), [], 0)

  const [selectedDay, setSelectedDay] = useState<DayNumber | null>(null)

  const pos = useMemo(
    () => (settings ? programPosition(settings.programStartDate) : null),
    [settings],
  )
  const currentPhase = useMemo(
    () => (pos && phases ? phaseForWeek(pos.week, phases) : undefined),
    [pos, phases],
  )

  if (!settings || !exercises || !phases || !pos) {
    return <div className="app">Loading…</div>
  }

  const todayDay = nextDayInRotation(sessionCount ?? 0)
  const activeDay: DayNumber = selectedDay ?? todayDay
  const dayExercises = exercises.filter((e) => e.day === activeDay)

  async function updateStartDate(value: string) {
    if (value) await db.settings.update('singleton', { programStartDate: value })
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Lift Tracker</h1>
        {currentPhase && (
          <span className="phase-pill">
            Phase {phaseIndex(phases, currentPhase.id)} · {currentPhase.name}
          </span>
        )}
      </header>

      <div className="status-strip">
        <div className="status-card">
          <div className="label">Week</div>
          <div className="value">
            {pos.notStarted ? '—' : `${pos.week} / 20`}
          </div>
          <div className="sub">
            {pos.notStarted
              ? `Starts in ${pos.daysUntilStart} day${pos.daysUntilStart === 1 ? '' : 's'}`
              : `${pos.weeksRemaining} weeks left`}
          </div>
        </div>
        <div className="status-card">
          <div className="label">Focus</div>
          <div className="value" style={{ fontSize: 15 }}>
            {currentPhase?.name ?? '—'}
          </div>
          <div className="sub">{currentPhase?.focus ?? ''}</div>
        </div>
      </div>

      <div className="settings-row">
        <label>
          Start
          <input
            type="date"
            value={settings.programStartDate}
            onChange={(e) => updateStartDate(e.target.value)}
          />
        </label>
        <span>·</span>
        <span>Units: {settings.weightUnit}</span>
        <span>·</span>
        <span>Goal: {settings.goalMode.replace('-', ' ')}</span>
      </div>

      <nav className="day-tabs">
        {([1, 2, 3, 4] as DayNumber[]).map((d) => (
          <button
            key={d}
            className={`day-tab${d === activeDay ? ' active' : ''}`}
            onClick={() => setSelectedDay(d)}
          >
            Day {d}
            {d === todayDay && <span className="today-dot" />}
          </button>
        ))}
      </nav>

      <SessionView
        day={activeDay}
        title={DAY_TITLES[activeDay]}
        isToday={activeDay === todayDay}
        exercises={dayExercises}
        phase={currentPhase}
      />

      <p className="footnote">
        Read-only preview. The dotted tab is today’s session (next in the 4-day
        rotation). Logging, progression and nutrition come in later phases.
      </p>
    </div>
  )
}

function phaseIndex(
  phases: { id: string }[],
  id: string,
): number | string {
  const i = phases.findIndex((p) => p.id === id)
  return i >= 0 ? i + 1 : '—'
}
