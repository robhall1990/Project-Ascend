import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import type { MealSlot } from './types'
import { autoSyncIntervals } from './lib/autoSync'
import { SessionLogView } from './components/SessionLogView'
import { HistoryView } from './components/HistoryView'
import { TodayScreen } from './components/TodayScreen'
import { ProgressScreen } from './components/ProgressScreen'
import { FuelScreen } from './components/FuelScreen'
import { SettingsScreen } from './components/SettingsScreen'

type Tab = 'today' | 'fuel' | 'progress' | 'history'

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
  const [fuelInitialSlot, setFuelInitialSlot] = useState<MealSlot | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  // Auto-sync intervals.icu (cardio + wellness) on launch and whenever the
  // app comes back to the foreground — throttled internally so this doesn't
  // hammer the API on every glance at the phone. Manual "Sync now" in
  // Settings is still there for an on-demand refresh with visible errors.
  useEffect(() => {
    autoSyncIntervals()
    function onVisible() {
      if (document.visibilityState === 'visible') autoSyncIntervals()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

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

  if (showSettings) {
    return <SettingsScreen settings={settings} onBack={() => setShowSettings(false)} />
  }

  function openLog(id: string, from: Tab) {
    setLogReturnTo(from)
    setLogSessionId(id)
  }

  const openSettings = () => setShowSettings(true)

  return (
    <>
      {tab === 'today' && (
        <TodayScreen
          settings={settings}
          exercises={exercises}
          phases={phases}
          sessions={sessions}
          onOpenLog={(id) => openLog(id, 'today')}
          onOpenSettings={openSettings}
          onGoToFuel={(slot) => {
            setFuelInitialSlot(slot)
            setTab('fuel')
          }}
        />
      )}

      {tab === 'fuel' && (
        <FuelScreen
          settings={settings}
          initialSlot={fuelInitialSlot}
          onInitialSlotConsumed={() => setFuelInitialSlot(null)}
          onOpenSettings={openSettings}
        />
      )}

      {tab === 'progress' && (
        <ProgressScreen settings={settings} phases={phases} onOpenSettings={openSettings} />
      )}

      {tab === 'history' && <HistoryView onOpen={(id) => openLog(id, 'history')} />}

      <nav className="bottom-nav">
        <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}>
          Today
        </button>
        <button className={tab === 'fuel' ? 'active' : ''} onClick={() => setTab('fuel')}>
          Fuel
        </button>
        <button className={tab === 'progress' ? 'active' : ''} onClick={() => setTab('progress')}>
          Progress
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          History
        </button>
      </nav>
    </>
  )
}
