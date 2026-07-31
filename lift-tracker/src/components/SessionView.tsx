import type { DayNumber, Exercise, ProgramPhase, WeightUnit } from '../types'
import { effectiveTargetRange, effectiveSetCount, formatPrescription } from '../lib/schedule'
import type { Suggestion } from '../lib/progression'

interface Props {
  day: DayNumber
  title: string
  isToday: boolean
  exercises: Exercise[]
  phase: ProgramPhase | undefined
  deload: boolean
  unit: WeightUnit
  suggestions: Record<string, Suggestion>
}

export function SessionView({
  day,
  title,
  isToday,
  exercises,
  phase,
  deload,
  unit,
  suggestions,
}: Props) {
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
              <ExerciseCard
                key={ex.id}
                ex={ex}
                phase={phase}
                deload={deload}
                unit={unit}
                suggestion={suggestions[ex.id]}
                inSuperset
              />
            ))}
          </div>
        ) : (
          <ExerciseCard
            key={row.items[0].id}
            ex={row.items[0]}
            phase={phase}
            deload={deload}
            unit={unit}
            suggestion={suggestions[row.items[0].id]}
          />
        ),
      )}
    </section>
  )
}

function ExerciseCard({
  ex,
  phase,
  deload,
  unit,
  suggestion,
  inSuperset,
}: {
  ex: Exercise
  phase: ProgramPhase | undefined
  deload: boolean
  unit: WeightUnit
  suggestion?: Suggestion
  inSuperset?: boolean
}) {
  const range = effectiveTargetRange(ex, phase)
  const sets = effectiveSetCount(ex.setCount, deload)
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
        {suggestion && suggestion.action !== 'none' && (
          <div className={`suggestion ${suggestion.action}`}>
            <span className="suggestion-weight">
              {suggestion.action === 'increase' ? '↑ ' : '→ '}
              {suggestion.suggestedWeight}
              {unit}
            </span>
            <span className="suggestion-reason">{suggestion.reason}</span>
          </div>
        )}
      </div>
      <div className="prescription">
        <span className="reps">
          {formatPrescription(sets, range.min, range.max, ex.metric, ex.submax)}
        </span>
        {ex.perSide && <span className="adjusted per-side">per side</span>}
        {range.adjusted && <span className="adjusted">phase-adjusted</span>}
        {deload && <span className="adjusted deload">deload</span>}
      </div>
    </div>
  )
}
