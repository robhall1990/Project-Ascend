import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { seedIfEmpty } from './db/db'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './lib/toast'
import './styles.css'

function Root() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  )
}

async function bootstrap() {
  const root = createRoot(document.getElementById('root')!)
  try {
    await seedIfEmpty()
  } catch (err) {
    // Storage can be unavailable (private mode, blocked upgrade). Say so rather
    // than rendering an app whose every write will silently fail.
    root.render(
      <div className="app crash">
        <h1>Storage unavailable</h1>
        <p className="crash-msg">{err instanceof Error ? err.message : String(err)}</p>
        <p className="footnote">
          Lift Tracker stores everything in this browser’s database. If you’re in private
          browsing, or another tab is mid-upgrade, close it and reload.
        </p>
        <button className="btn primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>,
    )
    return
  }
  root.render(
    <StrictMode>
      <Root />
    </StrictMode>,
  )
}

bootstrap()
