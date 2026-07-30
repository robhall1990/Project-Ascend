import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { SessionLogView } from './components/SessionLogView'
import { HistoryView } from './components/HistoryView'
import { TodayScreen } from './components/TodayScreen'

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

  if (!settings || !exercises || !phases || sessions === undefined) {
    return <div className="app">Loading…</div>
  }

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

  function openLog(id: string, from: Tab) {
    setLogReturnTo(from)
    setLogSessionId(id)
  }

  return (
    <>
      {tab === 'today' && (
        <TodayScreen
          settings={settings}
          exercises={exercises}
          phases={phases}
          sessions={sessions}
          onOpenLog={(id) => openLog(id, 'today')}
        />
      )}

      {tab === 'history' && <HistoryView onOpen={(id) => openLog(id, 'history')} />}

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
