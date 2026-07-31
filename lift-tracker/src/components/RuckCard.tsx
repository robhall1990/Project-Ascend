import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { logRuck, ruckPrescription, RUCK_MAX_KG } from '../lib/ruck'
import { todayISO } from '../lib/schedule'
import { useToast } from '../lib/toast'

/**
 * The weekly ruck sits outside the 4-day rotation, so it gets its own card:
 * this week's prescription, whether it's been done, and a quick log.
 */
export function RuckCard({ week, notStarted }: { week: number; notStarted: boolean }) {
  const { run, toast } = useToast()
  const [open, setOpen] = useState(false)

  const rx = ruckPrescription(week)
  const [load, setLoad] = useState(String(rx.loadKg))
  const [dist, setDist] = useState(String(rx.distanceKm))
  const [mins, setMins] = useState('')

  // "This week" = the last 7 days, which is enough to answer "have I rucked?"
  const since = new Date()
  since.setDate(since.getDate() - 6)
  const sinceISO = since.toISOString().slice(0, 10)
  const recent = useLiveQuery(
    async () => (await db.ruckLogs.toArray()).filter((r) => r.date >= sinceISO),
    [sinceISO],
    [],
  )
  const done = (recent ?? []).length > 0

  async function save() {
    const l = parseFloat(load)
    const d = parseFloat(dist)
    if (!Number.isFinite(l) || !Number.isFinite(d)) return
    const ok = await run(
      () =>
        logRuck({
          date: todayISO(),
          loadKg: l,
          distanceKm: d,
          minutes: parseFloat(mins) || undefined,
        }),
      'Couldn’t log that ruck',
    )
    if (ok !== undefined) {
      toast('Ruck logged', 'success')
      setOpen(false)
      setMins('')
    }
  }

  return (
    <div className={`ruck-card${done ? ' done' : ''}`}>
      <div className="ruck-head">
        <span className="ruck-title">🎒 Weekly ruck</span>
        {done ? (
          <span className="ruck-badge">Done this week</span>
        ) : (
          <button className="mini-btn" onClick={() => setOpen((v) => !v)}>
            {open ? 'Cancel' : 'Log'}
          </button>
        )}
      </div>

      <div className="ruck-rx">
        {notStarted ? (
          <>Starts at <strong>{rx.loadKg} kg</strong> for <strong>{rx.distanceKm} km</strong></>
        ) : (
          <>
            <strong>{rx.loadKg} kg</strong> · <strong>{rx.distanceKm} km</strong>
            <span className="ruck-note">
              {' '}— fortnight {rx.fortnight}
              {rx.capped
                ? `, load capped at ${RUCK_MAX_KG} kg so add distance`
                : `, next step: +${rx.nextStep === 'load' ? '2.5 kg' : '1 km'}`}
            </span>
          </>
        )}
      </div>

      {(recent ?? []).length > 0 && (
        <div className="ruck-last">
          Last: {recent![recent!.length - 1].loadKg} kg · {recent![recent!.length - 1].distanceKm} km
          {recent![recent!.length - 1].minutes ? ` · ${recent![recent!.length - 1].minutes} min` : ''}
        </div>
      )}

      {open && (
        <div className="ruck-form">
          <label>
            Load (kg)
            <input type="number" inputMode="decimal" value={load} onChange={(e) => setLoad(e.target.value)} />
          </label>
          <label>
            Distance (km)
            <input type="number" inputMode="decimal" value={dist} onChange={(e) => setDist(e.target.value)} />
          </label>
          <label>
            Time (min)
            <input type="number" inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value)} placeholder="optional" />
          </label>
          <button className="add-btn" onClick={save}>
            Save
          </button>
        </div>
      )}

      <p className="ruck-hint">Boots, not running shoes. Replaces an easy run.</p>
    </div>
  )
}
