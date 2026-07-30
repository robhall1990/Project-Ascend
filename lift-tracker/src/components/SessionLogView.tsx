import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Exercise, ProgramPhase } from '../types'
import { DAY_TITLES } from '../data/program'
import { effectiveRepRange, formatPrescription } from '../lib/schedule'
import { setLogId } from '../lib/id'
import {
  discardSession,
  finishSession,
  lastWeightsByExercise,
  saveSet,
} from '../lib/sessionRepo'
import { RestTimer } from './RestTimer'

const DEFAULT_REST = 120

interface Props {
  sessionId: string
  onExit: () => void
}

interface Entry {
  weight: string
  reps: string
  rpe: string
}

const blank: Entry = { weight: '', reps: '', rpe: '' }
const num = (s: string): number | null => {
  const v = parseFloat(s)
  return Number.isFinite(v) ? v : null
}

export function SessionLogView({ sessionId, onExit }: Props) {
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId])
  const settings = useLiveQuery(() => db.settings.get('singleton'))
  const exercises = useLiveQuery(
    () =>
      session
        ? db.exercises.where('day').equals(session.day).sortBy('order')
        : Promise.resolve<Exercise[]>([]),
    [session?.day],
  )
  const phase = useLiveQuery<ProgramPhase | undefined>(
    () =>
      session?.phaseId
        ? db.phases.get(session.phaseId)
        : Promise.resolve<ProgramPhase | undefined>(undefined),
    [session?.phaseId],
  )

  const [entries, setEntries] = useState<Record<string, Entry>>({})
  const [done, setDone] = useState<Set<string>>(new Set())
  const [prefill, setPrefill] = useState<Record<string, number>>({})
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null)
  const [restTotal, setRestTotal] = useState(DEFAULT_REST)
  const initRef = useRef<string | null>(null)

  // Load last-used weights for pre-fill hints (once per session).
  useEffect(() => {
    if (session) lastWeightsByExercise(session.createdAt).then(setPrefill)
  }, [session?.createdAt])

  // Initialise local input state from any already-persisted set logs.
  useEffect(() => {
    if (!session || initRef.current === sessionId) return
    initRef.current = sessionId
    db.setLogs
      .where('sessionId')
      .equals(sessionId)
      .toArray()
      .then((logs) => {
        const e: Record<string, Entry> = {}
        const d = new Set<string>()
        for (const l of logs) {
          const key = setLogId(sessionId, l.exerciseId, l.setNumber)
          e[key] = {
            weight: String(l.weight),
            reps: String(l.reps),
            rpe: l.rpe != null ? String(l.rpe) : '',
          }
          d.add(key)
        }
        setEntries(e)
        setDone(d)
      })
  }, [session, sessionId])

  const totalSets = useMemo(
    () => (exercises ?? []).reduce((n, ex) => n + ex.setCount, 0),
    [exercises],
  )

  if (!session || !exercises || !settings) {
    return <div className="app">Loading…</div>
  }

  const isEditing = session.completedAt != null
  const unit = settings.weightUnit

  function entryFor(key: string): Entry {
    return entries[key] ?? blank
  }

  /** Placeholder weight for a set: previous set's weight, else last session's. */
  function placeholderWeight(ex: Exercise, setNumber: number): string {
    for (let n = setNumber - 1; n >= 1; n--) {
      const w = entries[setLogId(sessionId, ex.id, n)]?.weight
      if (w) return w
    }
    return prefill[ex.id] != null ? String(prefill[ex.id]) : ''
  }

  function update(ex: Exercise, setNumber: number, field: keyof Entry, value: string) {
    const key = setLogId(sessionId, ex.id, setNumber)
    const next = { ...entryFor(key), [field]: value }
    setEntries((prev) => ({ ...prev, [key]: next }))
    saveSet({
      sessionId,
      exerciseId: ex.id,
      setNumber,
      weight: num(next.weight),
      reps: num(next.reps),
      rpe: num(next.rpe),
    })
  }

  function logSet(ex: Exercise, setNumber: number) {
    const key = setLogId(sessionId, ex.id, setNumber)
    const e = entryFor(key)
    const weight = e.weight || placeholderWeight(ex, setNumber)
    const next = { ...e, weight }
    setEntries((prev) => ({ ...prev, [key]: next }))
    setDone((prev) => new Set(prev).add(key))
    saveSet({
      sessionId,
      exerciseId: ex.id,
      setNumber,
      weight: num(weight),
      reps: num(e.reps),
      rpe: num(e.rpe),
    })
    // Start rest timer (skip when editing a finished session).
    if (!isEditing) {
      setRestEndsAt(Date.now() + restTotal * 1000)
    }
  }

  function unlog(key: string) {
    setDone((prev) => {
      const n = new Set(prev)
      n.delete(key)
      return n
    })
  }

  const doneCount = done.size

  async function onFinish() {
    await finishSession(sessionId)
    onExit()
  }
  async function onDiscard() {
    if (confirm('Discard this session and all its logged sets?')) {
      await discardSession(sessionId)
      onExit()
    }
  }

  return (
    <div className="app log-view">
      <header className="log-header">
        <button className="link-btn" onClick={onExit}>
          ‹ {isEditing ? 'History' : 'Home'}
        </button>
        <div className="log-title">
          <div className="log-day">Day {session.day} — {DAY_TITLES[session.day]}</div>
          <div className="log-date">{session.date}</div>
        </div>
        <span className="log-progress">{doneCount}/{totalSets}</span>
      </header>

      {exercises.map((ex) => {
        const range = effectiveRepRange(ex, phase ?? undefined)
        return (
          <div key={ex.id} className={`log-exercise${ex.isMainLift ? ' main-lift' : ''}`}>
            <div className="log-exercise-head">
              <div className="log-exercise-name">{ex.name}</div>
              <div className="log-exercise-target">
                target {formatPrescription(ex.setCount, range.min, range.max)}
                {range.adjusted && <span className="adjusted"> · phase-adjusted</span>}
              </div>
            </div>

            <div className="set-grid-head">
              <span>Set</span>
              <span>Weight ({unit})</span>
              <span>Reps</span>
              <span>RPE</span>
              <span></span>
            </div>

            {Array.from({ length: ex.setCount }, (_, i) => i + 1).map((setNumber) => {
              const key = setLogId(sessionId, ex.id, setNumber)
              const e = entryFor(key)
              const isDone = done.has(key)
              const canLog = num(e.reps) != null
              return (
                <div key={setNumber} className={`set-row${isDone ? ' done' : ''}`}>
                  <span className="set-num">{setNumber}</span>
                  <input
                    className="set-input"
                    type="number"
                    inputMode="decimal"
                    placeholder={placeholderWeight(ex, setNumber) || '—'}
                    value={e.weight}
                    onChange={(ev) => update(ex, setNumber, 'weight', ev.target.value)}
                  />
                  <input
                    className="set-input"
                    type="number"
                    inputMode="numeric"
                    placeholder={String(range.max)}
                    value={e.reps}
                    onChange={(ev) => update(ex, setNumber, 'reps', ev.target.value)}
                  />
                  <input
                    className="set-input rpe"
                    type="number"
                    inputMode="decimal"
                    placeholder="–"
                    value={e.rpe}
                    onChange={(ev) => update(ex, setNumber, 'rpe', ev.target.value)}
                  />
                  <button
                    className={`set-check${isDone ? ' checked' : ''}`}
                    disabled={!isDone && !canLog}
                    onClick={() => (isDone ? unlog(key) : logSet(ex, setNumber))}
                    aria-label={isDone ? 'Mark set not done' : 'Log set'}
                  >
                    ✓
                  </button>
                </div>
              )
            })}
          </div>
        )
      })}

      <div className="log-actions">
        {isEditing ? (
          <button className="btn primary" onClick={onExit}>Done</button>
        ) : (
          <>
            <button className="btn primary" onClick={onFinish}>Finish session</button>
            <button className="btn ghost danger" onClick={onDiscard}>Discard</button>
          </>
        )}
      </div>

      {restEndsAt != null && (
        <RestTimer
          endsAt={restEndsAt}
          totalSeconds={restTotal}
          onAdjust={(delta) => {
            setRestEndsAt((prev) => (prev ?? Date.now()) + delta * 1000)
            setRestTotal((t) => Math.max(15, t + delta))
          }}
          onSkip={() => setRestEndsAt(null)}
        />
      )}
    </div>
  )
}
