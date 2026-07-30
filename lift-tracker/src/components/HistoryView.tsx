import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { DAY_TITLES } from '../data/program'

interface Props {
  onOpen: (sessionId: string) => void
}

export function HistoryView({ onOpen }: Props) {
  const sessions = useLiveQuery(
    async () => {
      const all = (await db.sessions.orderBy('createdAt').toArray()).reverse()
      return Promise.all(
        all.map(async (s) => ({
          session: s,
          sets: await db.setLogs.where('sessionId').equals(s.id).count(),
        })),
      )
    },
    [],
    [],
  )

  if (!sessions) return <div className="app">Loading…</div>

  return (
    <div className="app">
      <header className="app-header">
        <h1>History</h1>
      </header>

      {sessions.length === 0 ? (
        <p className="footnote">No sessions logged yet. Start one from the Today tab.</p>
      ) : (
        sessions.map(({ session, sets }) => (
          <button
            key={session.id}
            className="history-card"
            onClick={() => onOpen(session.id)}
          >
            <div>
              <div className="history-title">
                Day {session.day} — {DAY_TITLES[session.day]}
              </div>
              <div className="history-sub">
                {session.date} · {sets} set{sets === 1 ? '' : 's'} logged
              </div>
            </div>
            <span className={`history-badge${session.completedAt ? '' : ' open'}`}>
              {session.completedAt ? 'Done' : 'In progress'}
            </span>
          </button>
        ))
      )}
    </div>
  )
}
