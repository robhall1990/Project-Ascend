import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { DayNumber, Exercise, ProgramPhase, Settings, Session } from '../types'
import { DAY_TITLES } from '../data/program'
import {
  isDeloadWeek,
  nextDayAfter,
  phaseForWeek,
  programPosition,
} from '../lib/schedule'
import { mainLiftBests, suggestionsForDay, type Suggestion } from '../lib/progression'
import { startSession } from '../lib/sessionRepo'
import { SessionView } from './SessionView'

interface Props {
  settings: Settings
  exercises: Exercise[]
  phases: ProgramPhase[]
  sessions: Session[]
  onOpenLog: (id: string) => void
}

const SHORT_LABEL: Record<string, string> = {
  'd1-bench': 'Bench',
  'd1-ohp': 'OHP',
  'd3-pullup': 'Pull-up',
  'd2-squat': 'Squat/DL',
}

export function TodayScreen({ settings, exercises, phases, sessions, onOpenLog }: Props) {
  const [selectedDay, setSelectedDay] = useState<DayNumber | null>(null)

  const pos = useMemo(
    () => programPosition(settings.programStartDate),
    [settings.programStartDate],
  )
  const currentPhase = useMemo(
    () => phaseForWeek(pos.week, phases),
    [pos.week, phases],
  )
  const deload = isDeloadWeek(pos.week, currentPhase)

  const activeSession = sessions.find((s) => s.completedAt == null)
  const lastCompleted = sessions.find((s) => s.completedAt != null)
  const todayDay: DayNumber = activeSession
    ? activeSession.day
    : nextDayAfter(lastCompleted?.day)
  const activeDay: DayNumber = selectedDay ?? todayDay
  const dayExercises = exercises.filter((e) => e.day === activeDay)

  const suggestions = useLiveQuery(
    () => suggestionsForDay(activeDay, currentPhase, deload, phases, settings.weightUnit),
    [activeDay, currentPhase?.id, deload, settings.weightUnit],
    {} as Record<string, Suggestion>,
  )
  const bests = useLiveQuery(() => mainLiftBests(), [], [])

  async function startToday() {
    const s = await startSession(activeDay, currentPhase?.id ?? phases[0].id)
    onOpenLog(s.id)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Lift Tracker</h1>
        {currentPhase && (
          <span className="phase-pill">
            Phase {phases.findIndex((p) => p.id === currentPhase.id) + 1} · {currentPhase.name}
          </span>
        )}
      </header>

      <div className="status-strip">
        <div className="status-card">
          <div className="label">Week</div>
          <div className="value">{pos.notStarted ? '—' : `${pos.week} / 20`}</div>
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

      {/* Estimated 1RM strip for the four main lifts */}
      <div className="strength-strip">
        {(bests ?? []).map(({ exercise, best }) => (
          <div className="strength-tile" key={exercise.id}>
            <div className="strength-label">{SHORT_LABEL[exercise.id] ?? exercise.name}</div>
            <div className="strength-value">
              {best > 0 ? Math.round(best) : '—'}
              {best > 0 && <span className="strength-unit">{settings.weightUnit}</span>}
            </div>
            <div className="strength-cap">est. 1RM</div>
          </div>
        ))}
      </div>

      {deload && (
        <div className="deload-banner">
          🪫 Deload week — volume cut to 2 sets, hold your weights. Recover for the next block.
        </div>
      )}

      {activeSession ? (
        <button className="cta resume" onClick={() => onOpenLog(activeSession.id)}>
          Resume Day {activeSession.day} session
          <span className="cta-sub">In progress · {activeSession.date}</span>
        </button>
      ) : (
        <button className="cta" onClick={startToday}>
          Start Day {activeDay} session
          {activeDay !== todayDay && <span className="cta-sub">Previewing — not today’s session</span>}
        </button>
      )}

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
        deload={deload}
        unit={settings.weightUnit}
        suggestions={suggestions}
      />
    </div>
  )
}
