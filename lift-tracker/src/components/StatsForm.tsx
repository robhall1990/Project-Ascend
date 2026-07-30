import { useState } from 'react'
import { db } from '../db/db'
import type { ActivityLevel, Sex, Settings, UserStats } from '../types'
import { ACTIVITY_LABEL } from '../lib/nutrition'
import { logBodyweight } from '../lib/nutrition'
import { round1, toDisplayWeight, toKg } from '../lib/units'

interface Props {
  stats: UserStats
  bodyweightKg: number
  settings: Settings
  onClose: () => void
}

export function StatsForm({ stats, bodyweightKg, settings, onClose }: Props) {
  const unit = settings.weightUnit
  const [weight, setWeight] = useState(String(round1(toDisplayWeight(bodyweightKg, unit))))
  const [height, setHeight] = useState(String(stats.heightCm))
  const [age, setAge] = useState(String(stats.age))
  const [sex, setSex] = useState<Sex>(stats.sex)
  const [activity, setActivity] = useState<ActivityLevel>(stats.activity)
  const [protein, setProtein] = useState(String(stats.proteinPerKg))

  async function save() {
    const w = parseFloat(weight)
    await db.userStats.update('singleton', {
      heightCm: parseFloat(height) || stats.heightCm,
      age: parseInt(age) || stats.age,
      sex,
      activity,
      proteinPerKg: Math.min(Math.max(parseFloat(protein) || 1.8, 1.2), 3),
      configured: true,
    })
    if (Number.isFinite(w) && w > 0) await logBodyweight(toKg(w, unit))
    onClose()
  }

  return (
    <div className="stats-form">
      <div className="stats-grid">
        <label>
          Bodyweight ({unit})
          <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label>
          Height (cm)
          <input type="number" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} />
        </label>
        <label>
          Age
          <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
        </label>
        <label>
          Sex
          <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label className="span-2">
          Activity baseline
          <select value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)}>
            {(Object.keys(ACTIVITY_LABEL) as ActivityLevel[]).map((a) => (
              <option key={a} value={a}>
                {ACTIVITY_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="span-2">
          Protein target (g/kg) — {protein} g/kg
          <input
            type="range"
            min={1.6}
            max={2.2}
            step={0.1}
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
          />
        </label>
      </div>
      <div className="stats-actions">
        <button className="btn primary" onClick={save}>
          Save stats
        </button>
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
