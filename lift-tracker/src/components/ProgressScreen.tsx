import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { ProgramPhase, Settings } from '../types'
import { DAY_TITLES } from '../data/program'
import { phaseForWeek, programPosition } from '../lib/schedule'
import { exerciseHistory, mainLiftsTrend } from '../lib/progression'
import { combinedProgress } from '../lib/combined'
import { E1RMChart, WeightHistoryChart, CombinedProgressCharts, SERIES_COLOR } from './charts'

interface Props {
  settings: Settings
  phases: ProgramPhase[]
  onOpenSettings: () => void
}

const emptyTrend = { mains: [], rows: [] }

export function ProgressScreen({ settings, phases, onOpenSettings }: Props) {
  const pos = programPosition(settings.programStartDate)
  const currentPhase = phaseForWeek(pos.week, phases)

  const exercises = useLiveQuery(() => db.exercises.orderBy('order').toArray(), [], [])
  const trend = useLiveQuery(() => mainLiftsTrend(), [], emptyTrend)
  const combined = useLiveQuery(
    () => combinedProgress(settings.programStartDate),
    [settings.programStartDate],
    [],
  )

  const [exId, setExId] = useState('d1-bench')
  const history = useLiveQuery(() => exerciseHistory(exId), [exId], [])
  const selected = (exercises ?? []).find((e) => e.id === exId)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Progress</h1>
        <button className="icon-btn" aria-label="Settings" onClick={onOpenSettings}>
          ⚙
        </button>
      </header>

      {/* Phase timeline */}
      <PhaseTimeline phases={phases} week={pos.week} notStarted={pos.notStarted} />
      <p className="progress-caption">
        {pos.notStarted
          ? `Program starts in ${pos.daysUntilStart} days`
          : `Week ${pos.week} of 20 · ${currentPhase?.name ?? ''} · ${pos.weeksRemaining} weeks to year-end`}
      </p>

      {/* The payoff: weight · strength · protein together */}
      <section className="chart-card">
        <h2 className="chart-title">Weight · Strength · Protein</h2>
        <p className="chart-subtitle">
          Eating enough and lifting consistently should pull strength up together — here they are on
          one timeline.
        </p>
        <CombinedProgressCharts points={combined ?? []} unit={settings.weightUnit} />
      </section>

      {/* Estimated 1RM trend */}
      <section className="chart-card">
        <h2 className="chart-title">Estimated 1RM — main lifts</h2>
        <E1RMChart mains={trend?.mains ?? []} rows={trend?.rows ?? []} unit={settings.weightUnit} />
      </section>

      {/* Per-exercise history */}
      <section className="chart-card">
        <div className="exercise-picker">
          <h2 className="chart-title">Exercise history</h2>
          <select value={exId} onChange={(e) => setExId(e.target.value)}>
            {[1, 2, 3, 4].map((day) => (
              <optgroup key={day} label={`Day ${day} — ${DAY_TITLES[day]}`}>
                {(exercises ?? [])
                  .filter((e) => e.day === day)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>

        <p className="chart-subtitle">
          {selected?.name} — top-set weight ({settings.weightUnit})
        </p>
        <WeightHistoryChart
          history={history ?? []}
          color={SERIES_COLOR[exId] ?? '#3987e5'}
          unit={settings.weightUnit}
        />

        {(history ?? []).length > 0 && (
          <div className="history-list">
            {[...(history ?? [])].reverse().map((h) => (
              <div className="history-row" key={h.createdAt}>
                <div className="history-row-head">
                  <span className="history-row-date">
                    {new Date(h.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="history-row-e1rm">
                    est. 1RM {Math.round(h.bestE1rm)}
                    {settings.weightUnit}
                  </span>
                </div>
                <div className="history-sets">
                  {h.sets.map((s) => (
                    <span className="history-set" key={s.setNumber}>
                      {s.weight}
                      {settings.weightUnit} × {s.reps}
                      {s.rpe != null ? ` @${s.rpe}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function PhaseTimeline({
  phases,
  week,
  notStarted,
}: {
  phases: ProgramPhase[]
  week: number
  notStarted: boolean
}) {
  const total = phases[phases.length - 1]?.weekEnd ?? 20
  return (
    <div className="phase-timeline">
      {phases.map((p, i) => {
        const span = p.weekEnd - p.weekStart + 1
        const isCurrent = !notStarted && week >= p.weekStart && week <= p.weekEnd
        return (
          <div
            key={p.id}
            className={`phase-seg${isCurrent ? ' current' : ''}`}
            style={{ flexGrow: span / total }}
            title={`${p.name} (wk ${p.weekStart}-${p.weekEnd})`}
          >
            <span className="phase-seg-num">{i + 1}</span>
          </div>
        )
      })}
    </div>
  )
}
