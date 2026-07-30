/** Short, sortable-enough unique id. */
export function newId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Deterministic id for a set log, so re-entering a set upserts in place. */
export function setLogId(sessionId: string, exerciseId: string, setNumber: number): string {
  return `${sessionId}:${exerciseId}:${setNumber}`
}
