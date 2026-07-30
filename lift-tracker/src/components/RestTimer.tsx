import { useEffect, useState } from 'react'

interface Props {
  /** Epoch ms when rest ends. */
  endsAt: number
  /** Total rest length in seconds (for the progress bar). */
  totalSeconds: number
  onAdjust: (deltaSeconds: number) => void
  onSkip: () => void
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.ceil(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function RestTimer({ endsAt, totalSeconds, onAdjust, onSkip }: Props) {
  const [now, setNow] = useState(Date.now())
  const [buzzed, setBuzzed] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  const remaining = (endsAt - now) / 1000
  const done = remaining <= 0

  useEffect(() => {
    if (done && !buzzed) {
      setBuzzed(true)
      navigator.vibrate?.([120, 60, 120])
    }
    if (!done && buzzed) setBuzzed(false)
  }, [done, buzzed])

  const pct = Math.max(0, Math.min(100, (remaining / totalSeconds) * 100))

  return (
    <div className={`rest-timer${done ? ' rest-done' : ''}`}>
      <div className="rest-bar" style={{ width: `${done ? 100 : pct}%` }} />
      <div className="rest-content">
        <button className="rest-adjust" onClick={() => onAdjust(-15)}>
          −15
        </button>
        <div className="rest-readout">
          <span className="rest-label">{done ? 'Rest complete' : 'Rest'}</span>
          <span className="rest-time">{done ? '0:00' : fmt(remaining)}</span>
        </div>
        <button className="rest-adjust" onClick={() => onAdjust(15)}>
          +15
        </button>
        <button className="rest-skip" onClick={onSkip}>
          {done ? 'Dismiss' : 'Skip'}
        </button>
      </div>
    </div>
  )
}
