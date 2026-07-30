import type { DayNumber, Exercise, ProgramPhase } from '../types'
import { effectiveRepRange, formatPrescription } from '../lib/schedule'

interface Props {
  day: DayNumber
  title: string
  isToday: boolean
  exercises: Exercise[]
  phase: ProgramPhase | undefined
}

export function SessionView({ day, title, isToday, exercises, phase }: Props) {
  // Group consecutive exercises that share a supersetGroup so they render
  // together inside a bracket; standalone exercises render on their own.
  const rows: Array<{ group?: string; items: Exercise[] }> = []
  for (const ex of exercises) {
    const last = rows[rows.length - 1]
    if (ex.supersetGroup && last?.group === ex.supersetGroup) {
      last.items.push(ex)
    } else {
      rows.push({ group: ex.supersetGroup, items: [ex] })
    }
  }

  return (
    <section>
      <h2 className="session-title">
        Day {day} — {title}
      </h2>
      <p className="session-sub">
        {isToday ? 'Today’s session · ' : ''}
        {exercises.length} exercises
      </p>

      {rows.map((row, i) =>
        row.group ? (
          <div className="superset-bracket" key={i}>
            <p className="superset-label">Superset</p>
            {row.items.map((ex) => (
              <ExerciseCard key={ex.id} ex={ex} phase={phase} inSuperset />
            ))}
            {row.items[0].notes && (
              <p className="exercise-note" style={{ marginLeft: 2 }}>
                {row.items.length} exercises, alternating sets with minimal rest
              </p>
            )}
          </div>
        ) : (
          <ExerciseCard key={row.items[0].id} ex={row.items[0]} phase={phase} />
        ),
      )}
    </section>
  )
}

function ExerciseCard({
  ex,
  phase,
  inSuperset,
}: {
  ex: Exercise
  phase: ProgramPhase | undefined
  inSuperset?: boolean
}) {
  const range = effectiveRepRange(ex, phase)
  return (
    <div className={`exercise-card${ex.isMainLift ? ' main-lift' : ''}`}>
      <div className="exercise-main">
        <div className="exercise-name">{ex.name}</div>
        {ex.isMainLift && (
          <div className="exercise-meta">
            <span className="tag main">Main lift</span>
          </div>
        )}
        {ex.notes && !inSuperset && <div className="exercise-note">{ex.notes}</div>}
      </div>
      <div className="prescription">
        <span className="reps">
          {formatPrescription(ex.setCount, range.min, range.max)}
        </span>
        {range.adjusted && <span className="adjusted">phase-adjusted</span>}
      </div>
    </div>
  )
}
