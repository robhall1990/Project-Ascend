import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { ActivityLevel, GoalMode, Sex, Settings, WeightUnit } from '../types'
import { ACTIVITY_LABEL, GOAL_LABEL, logBodyweight, maintenanceCalories } from '../lib/nutrition'
import { exportBackup, importBackup, resetLoggedData, setWeightUnit, updateSettings } from '../lib/settingsRepo'
import { round1, toDisplayWeight, toKg } from '../lib/units'
import { programPosition } from '../lib/schedule'
import { DEFAULT_MODEL } from '../lib/aiPhoto'
import { useToast } from '../lib/toast'
import { ConfirmDialog } from './Modal'

const GOALS: GoalMode[] = ['lean-gain', 'recomposition', 'maintenance']
const MODELS = [
  { id: 'claude-sonnet-5', label: 'Sonnet 5 — fast, good value' },
  { id: 'claude-opus-5', label: 'Opus 5 — most accurate' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 — cheapest' },
]

export function SettingsScreen({ settings, onBack }: { settings: Settings; onBack: () => void }) {
  const { toast, run } = useToast()
  const stats = useLiveQuery(() => db.userStats.get('singleton'))
  const bw = useLiveQuery(() => db.bodyweightLogs.orderBy('createdAt').last())
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirming, setConfirming] = useState<'reset' | 'import' | null>(null)
  const [pendingImport, setPendingImport] = useState<unknown>(null)
  const [testing, setTesting] = useState(false)

  if (!stats || !bw) return <div className="app">Loading…</div>

  const unit = settings.weightUnit
  const pos = programPosition(settings.programStartDate)

  const patch = (p: Parameters<typeof updateSettings>[0], msg?: string) =>
    run(async () => {
      await updateSettings(p)
      if (msg) toast(msg, 'success')
    }, 'Couldn’t save that setting')

  async function onUnitChange(next: WeightUnit) {
    await run(async () => {
      await setWeightUnit(next)
      toast(`Switched to ${next} — existing weights converted`, 'success')
    }, 'Couldn’t change units')
  }

  async function saveStats(p: Partial<typeof stats>) {
    await run(async () => {
      await db.userStats.update('singleton', { ...p, configured: true })
    }, 'Couldn’t save your stats')
  }

  async function onExport() {
    await run(async () => {
      const backup = await exportBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lift-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast('Backup downloaded', 'success')
    }, 'Export failed')
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setPendingImport(JSON.parse(await file.text()))
      setConfirming('import')
    } catch {
      toast('That file isn’t valid JSON', 'error')
    }
  }

  async function testKey() {
    if (!settings.anthropicApiKey) return
    setTesting(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': settings.anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: settings.anthropicModel || DEFAULT_MODEL,
          max_tokens: 8,
          messages: [{ role: 'user', content: 'Reply with OK' }],
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
      toast('API key works', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Key test failed', 'error')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="app">
      <header className="log-header">
        <button className="link-btn" onClick={onBack}>
          ‹ Back
        </button>
        <div className="log-title">
          <div className="log-day">Settings</div>
        </div>
        <span />
      </header>

      {/* ---- Program ---- */}
      <Section title="Program">
        <Row label="Start date" hint={pos.notStarted ? `Starts in ${pos.daysUntilStart} days` : `Week ${pos.week} of 20`}>
          <input
            type="date"
            value={settings.programStartDate}
            onChange={(e) => e.target.value && patch({ programStartDate: e.target.value }, 'Start date updated')}
          />
        </Row>
        <Row label="Weight units" hint="Existing logged weights are converted">
          <Segmented
            options={[
              { v: 'kg', label: 'kg' },
              { v: 'lb', label: 'lb' },
            ]}
            value={unit}
            onChange={(v) => onUnitChange(v as WeightUnit)}
          />
        </Row>
      </Section>

      {/* ---- Nutrition goal ---- */}
      <Section title="Nutrition goal">
        <div className="setting-stack">
          {GOALS.map((g) => (
            <button
              key={g}
              className={`radio-row${settings.goalMode === g ? ' active' : ''}`}
              onClick={() => patch({ goalMode: g })}
            >
              <span className="radio-dot" />
              <span className="radio-text">
                <strong>{GOAL_LABEL[g]}</strong>
                <span>
                  {g === 'lean-gain'
                    ? 'Maintenance +10% — build while gaining slowly'
                    : g === 'recomposition'
                      ? 'Hold maintenance — recomp at stable weight'
                      : 'Hold maintenance — no deliberate change'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Section>

      {/* ---- Your stats ---- */}
      <Section title="Your stats" hint={`Maintenance ≈ ${Math.round(maintenanceCalories(stats, bw.weightKg))} kcal/day`}>
        <Row label={`Bodyweight (${unit})`}>
          <input
            type="number"
            inputMode="decimal"
            defaultValue={round1(toDisplayWeight(bw.weightKg, unit))}
            onBlur={(e) => {
              const v = parseFloat(e.target.value)
              if (Number.isFinite(v) && v > 0) run(() => logBodyweight(toKg(v, unit)), 'Couldn’t log bodyweight')
            }}
          />
        </Row>
        <Row label="Height (cm)">
          <input type="number" inputMode="numeric" defaultValue={stats.heightCm}
            onBlur={(e) => saveStats({ heightCm: parseFloat(e.target.value) || stats.heightCm })} />
        </Row>
        <Row label="Age">
          <input type="number" inputMode="numeric" defaultValue={stats.age}
            onBlur={(e) => saveStats({ age: parseInt(e.target.value) || stats.age })} />
        </Row>
        <Row label="Sex" hint="Needed by the Mifflin–St Jeor formula">
          <Segmented
            options={[
              { v: 'male', label: 'Male' },
              { v: 'female', label: 'Female' },
            ]}
            value={stats.sex}
            onChange={(v) => saveStats({ sex: v as Sex })}
          />
        </Row>
        <Row label="Activity baseline">
          <select value={stats.activity} onChange={(e) => saveStats({ activity: e.target.value as ActivityLevel })}>
            {(Object.keys(ACTIVITY_LABEL) as ActivityLevel[]).map((a) => (
              <option key={a} value={a}>
                {ACTIVITY_LABEL[a]}
              </option>
            ))}
          </select>
        </Row>
        <Row label={`Protein ${stats.proteinPerKg} g/kg`} hint="1.6–2.2 g/kg is the evidenced range">
          <input
            type="range"
            min={1.6}
            max={2.2}
            step={0.1}
            value={stats.proteinPerKg}
            onChange={(e) => saveStats({ proteinPerKg: parseFloat(e.target.value) })}
          />
        </Row>
      </Section>

      {/* ---- AI ---- */}
      <Section title="Photo estimation" hint="Optional. Key is stored only on this device and sent directly to Anthropic.">
        <Row label="Anthropic API key">
          <input
            type="password"
            autoComplete="off"
            placeholder="sk-ant-…"
            defaultValue={settings.anthropicApiKey ?? ''}
            onBlur={(e) => patch({ anthropicApiKey: e.target.value.trim() || undefined }, 'API key saved')}
          />
        </Row>
        <Row label="Model">
          <select
            value={settings.anthropicModel || DEFAULT_MODEL}
            onChange={(e) => patch({ anthropicModel: e.target.value })}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Row>
        <button className="btn ghost full" disabled={!settings.anthropicApiKey || testing} onClick={testKey}>
          {testing ? 'Testing…' : 'Test API key'}
        </button>
      </Section>

      {/* ---- Data ---- */}
      <Section title="Data" hint="Everything lives on this device only. Back up before clearing browser data.">
        <button className="btn ghost full" onClick={onExport}>
          Export backup (JSON)
        </button>
        <button className="btn ghost full" onClick={() => fileRef.current?.click()}>
          Import backup
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onPickFile} />
        <button className="btn ghost full danger" onClick={() => setConfirming('reset')}>
          Clear logged data
        </button>
      </Section>

      {confirming === 'reset' && (
        <ConfirmDialog
          title="Clear logged data?"
          body="Deletes every session, set, food entry and bodyweight log on this device. Your program, settings and saved foods stay."
          confirmLabel="Clear"
          danger
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            setConfirming(null)
            await run(async () => {
              await resetLoggedData()
              toast('Logged data cleared', 'success')
            }, 'Couldn’t clear data')
          }}
        />
      )}

      {confirming === 'import' && (
        <ConfirmDialog
          title="Replace all data?"
          body="Importing overwrites everything currently on this device with the backup's contents."
          confirmLabel="Import"
          danger
          onCancel={() => {
            setConfirming(null)
            setPendingImport(null)
          }}
          onConfirm={async () => {
            setConfirming(null)
            await run(async () => {
              await importBackup(pendingImport)
              toast('Backup restored', 'success')
            }, 'Import failed')
            setPendingImport(null)
          }}
        />
      )}
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="settings-section">
      <h2 className="settings-heading">{title}</h2>
      {hint && <p className="settings-hint">{hint}</p>}
      <div className="settings-card">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <div className="setting-label">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  )
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: Array<{ v: string; label: string }>
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="segmented small inline">
      {options.map((o) => (
        <button key={o.v} className={value === o.v ? 'active' : ''} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
