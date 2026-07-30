import { db } from '../db/db'
import type { DayNumber, Session, SetLog } from '../types'
import { newId, setLogId } from './id'
import { todayISO } from './schedule'

/** Create and persist a new in-progress session for the given day/phase. */
export async function startSession(day: DayNumber, phaseId: string): Promise<Session> {
  const session: Session = {
    id: newId('sess'),
    date: todayISO(),
    day,
    phaseId,
    createdAt: Date.now(),
  }
  await db.sessions.add(session)
  return session
}

export async function finishSession(id: string): Promise<void> {
  await db.sessions.update(id, { completedAt: Date.now() })
}

export async function reopenSession(id: string): Promise<void> {
  await db.sessions.update(id, { completedAt: undefined })
}

/** Delete a session and all its set logs. */
export async function discardSession(id: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    await db.setLogs.where('sessionId').equals(id).delete()
    await db.sessions.delete(id)
  })
}

/** Upsert one set. Blank weight and reps removes it. */
export async function saveSet(input: {
  sessionId: string
  exerciseId: string
  setNumber: number
  weight: number | null
  reps: number | null
  rpe?: number | null
}): Promise<void> {
  const id = setLogId(input.sessionId, input.exerciseId, input.setNumber)
  if (input.weight == null && input.reps == null) {
    await db.setLogs.delete(id)
    return
  }
  const log: SetLog = {
    id,
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    setNumber: input.setNumber,
    weight: input.weight ?? 0,
    reps: input.reps ?? 0,
    ...(input.rpe != null ? { rpe: input.rpe } : {}),
  }
  await db.setLogs.put(log)
}

/**
 * Most recent previously-logged weight per exercise, taken from the latest
 * completed session before `beforeCreatedAt`. Used to pre-fill inputs.
 */
export async function lastWeightsByExercise(
  beforeCreatedAt: number,
): Promise<Record<string, number>> {
  // Ascending by createdAt, then walk newest→oldest.
  const prior = (
    await db.sessions.where('createdAt').below(beforeCreatedAt).sortBy('createdAt')
  ).reverse()
  const result: Record<string, number> = {}
  // Walk newest→oldest, filling each exercise once.
  for (const s of prior) {
    const logs = await db.setLogs.where('sessionId').equals(s.id).toArray()
    for (const l of logs) {
      if (result[l.exerciseId] == null && l.weight > 0) {
        result[l.exerciseId] = l.weight
      }
    }
  }
  return result
}
