import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Keeps a render error from leaving a blank screen with no way out — the user
 * gets the message and a reload, rather than a dead app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lift Tracker crashed:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="app crash">
        <h1>Something broke</h1>
        <p className="crash-msg">{this.state.error.message}</p>
        <p className="footnote">
          Your logged data is safe on this device. Reloading usually clears it.
        </p>
        <button className="btn primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}
