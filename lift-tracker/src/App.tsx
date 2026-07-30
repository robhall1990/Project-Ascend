import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import type { DayNumber } from './types'
import { DAY_TITLES } from './data/program'
import { nextDayAfter, phaseForWeek, programPosition } from './lib/schedule'
import { startSession } from './lib/sessionRepo'
import { SessionView } from './components/SessionView'
import { SessionLogView } from './components/SessionLogView'
import { HistoryView } from './components/HistoryView'

type Tab = 'today' | 'history'

export function App() {
  const settings = useLiveQuery(() => db.settings.get('singleton'))
  const exercises = useLiveQuery(() => db.exercises.orderBy('order').toArray())
  const phases = useLiveQuery(() => db.phases.orderBy('weekStart').toArray())
  const sessions = useLiveQuery(
    async () => (await db.sessions.orderBy('createdAt').toArray()).reverse(),
    [],
  )

  const [tab, setTab] = useState<Tab>('today')
  const [logSessionId, setLogSessionId] = useState<string | null>(null)
  const [logReturnTo, setLogReturnTo] = useState<Tab>('today')
  const [selectedDay, setSelectedDay] = useState<DayNumber | null>(null)

  const pos = useMemo(
    () => (settings ? programPosition(settings.programStartDate) : null),
    [settings],
  )
  const currentPhase = useMemo(
    () => (pos && phases ? phaseForWeek(pos.week, phases) : undefined),
    [pos, phases],
  )

  if (!settings || !exercises || !phases || !pos || sessions === undefined) {
    return <div className="app">Loading…</div>
  }

  // ---- Full-screen logging / editing view ----
  if (logSessionId) {
    return (
      <SessionLogView
        sessionId={logSessionId}
        onExit={() => {
          setLogSessionId(null)
          setTab(logReturnTo)
        }}
      />
    )
  }

  const activeSession = sessions.find((s) => s.completedAt == null)
  const lastCompleted = sessions.find((s) => s.completedAt != null)
  const todayDay: DayNumber = activeSession
    ? activeSession.day
    : nextDayAfter(lastCompleted?.day)
  const activeDay: DayNumber = selectedDay ?? todayDay
  const dayExercises = exercises.filter((e) => e.day === activeDay)

  function openLog(id: string, from: Tab) {
    setLogReturnTo(from)
    setLogSessionId(id)
  }

  async function startToday() {
    const s = await startSession(activeDay, currentPhase?.id ?? phases![0].id)
    openLog(s.id, 'today')
  }

  return (
    <>
      {tab === 'today' && (
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

          {activeSession ? (
            <button className="cta resume" onClick={() => openLog(activeSession.id, 'today')}>
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
          />
        </div>
      )}

      {tab === 'history' && (
        <HistoryView onOpen={(id) => openLog(id, 'history')} />
      )}

      <nav className="bottom-nav">
        <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}>
          Today
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          History
        </button>
      </nav>
    </>
  )
}
