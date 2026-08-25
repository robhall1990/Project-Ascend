import type { WellnessRecord } from '../types'

interface Props {
  wellness: WellnessRecord | undefined
}

/** Compact performance snapshot: VO2 max, resting HR, HRV, fitness/fatigue. */
export function WellnessCard({ wellness }: Props) {
  if (!wellness) return null

  const stats: Array<{ label: string; value: string }> = []
  if (wellness.vo2max != null) stats.push({ label: 'VO2 max', value: String(wellness.vo2max) })
  if (wellness.restingHr != null) stats.push({ label: 'Resting HR', value: `${wellness.restingHr} bpm` })
  if (wellness.hrv != null) stats.push({ label: 'HRV', value: `${wellness.hrv} ms` })
  if (wellness.ctl != null) stats.push({ label: 'Fitness (CTL)', value: String(Math.round(wellness.ctl)) })
  if (wellness.atl != null) stats.push({ label: 'Fatigue (ATL)', value: String(Math.round(wellness.atl)) })
  if (wellness.form != null) {
    stats.push({ label: 'Form', value: `${wellness.form > 0 ? '+' : ''}${wellness.form}` })
  }

  if (stats.length === 0) return null

  return (
    <section className="chart-card">
      <h2 className="chart-title">Performance</h2>
      <p className="chart-subtitle">
        As of {new Date(wellness.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        , via intervals.icu
      </p>
      <div className="strength-strip">
        {stats.map((s) => (
          <div className="strength-tile" key={s.label}>
            <div className="strength-label">{s.label}</div>
            <div className="strength-value" style={{ fontSize: 20 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
