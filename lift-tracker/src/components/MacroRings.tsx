interface RingProps {
  consumed: number
  target: number
  color: string
}

/** Large protein ring — the most prominent number on the Fuel screen. */
export function ProteinRing({ consumed, target, color }: RingProps) {
  const size = 168
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0
  const remaining = Math.max(target - consumed, 0)

  return (
    <div className="protein-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="protein-ring-center">
        <div className="protein-remaining">{Math.round(remaining)}</div>
        <div className="protein-remaining-unit">g protein left</div>
        <div className="protein-target">
          {Math.round(consumed)} / {Math.round(target)} g
        </div>
      </div>
    </div>
  )
}

interface BarProps {
  label: string
  consumed: number
  target: number
  unit: string
  color: string
}

export function MacroBar({ label, consumed, target, unit, color }: BarProps) {
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0
  const remaining = Math.max(target - consumed, 0)
  return (
    <div className="macro-bar">
      <div className="macro-bar-head">
        <span className="macro-bar-label">{label}</span>
        <span className="macro-bar-remaining">
          {Math.round(remaining)}
          <span className="macro-bar-unit"> {unit} left</span>
        </span>
      </div>
      <div className="macro-bar-track">
        <div className="macro-bar-fill" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
      <div className="macro-bar-sub">
        {Math.round(consumed)} / {Math.round(target)} {unit}
      </div>
    </div>
  )
}
