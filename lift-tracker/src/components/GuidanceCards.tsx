import type { MealSlot } from '../types'
import type { GuidanceCard } from '../lib/nutrition'

interface Props {
  cards: GuidanceCard[]
  onAction: (slot: MealSlot) => void
  onDismiss: (id: string) => void
}

export function GuidanceCards({ cards, onAction, onDismiss }: Props) {
  if (cards.length === 0) return null
  return (
    <div className="guidance">
      {cards.map((c) => (
        <div className={`guidance-card${c.flag ? ' flag' : ''}`} key={c.id}>
          <button className="guidance-dismiss" aria-label="Dismiss" onClick={() => onDismiss(c.id)}>
            ✕
          </button>
          <div className="guidance-head">
            <span className="guidance-icon">{c.icon}</span>
            <span className="guidance-title">{c.title}</span>
          </div>
          <p className="guidance-body">{c.body}</p>
          <button className="guidance-action" onClick={() => onAction(c.actionSlot)}>
            {c.actionLabel} →
          </button>
        </div>
      ))}
    </div>
  )
}
