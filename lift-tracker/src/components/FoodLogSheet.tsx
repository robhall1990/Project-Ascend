import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { FoodItem, MealSlot, Settings } from '../types'
import {
  addManualEntry,
  deleteFoodItem,
  deleteMeal,
  logFoodItem,
  logMeal,
  macrosForGrams,
  saveFoodItem,
  type Macros,
} from '../lib/foodRepo'
import { analyzeMealPhoto, fileToBase64Jpeg, type PhotoEstimate } from '../lib/aiPhoto'
import { useToast } from '../lib/toast'

export const SLOT_LABEL: Record<MealSlot, string> = {
  'pre-training': 'Pre-training',
  'post-training': 'Post-training',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}
const SLOTS = Object.keys(SLOT_LABEL) as MealSlot[]

interface Props {
  date: string
  initialSlot: MealSlot
  settings: Settings
  onClose: () => void
}

const numOr0 = (s: string) => {
  const v = parseFloat(s)
  return Number.isFinite(v) ? v : 0
}

export interface ManualInitial {
  name: string
  cal: string
  p: string
  c: string
  f: string
  portion: string
}

export function FoodLogSheet({ date, initialSlot, settings, onClose }: Props) {
  const { run, toast } = useToast()
  const [slot, setSlot] = useState<MealSlot>(initialSlot)
  const [tab, setTab] = useState<'saved' | 'manual' | 'photo'>('saved')
  const [search, setSearch] = useState('')
  const [prefill, setPrefill] = useState<ManualInitial | null>(null)
  const [prefillKey, setPrefillKey] = useState(0)

  function usePhotoEstimate(est: PhotoEstimate) {
    setPrefill({
      name: est.name,
      cal: String(est.calories),
      p: String(est.protein),
      c: String(est.carbs),
      f: String(est.fat),
      portion: 'photo estimate',
    })
    setPrefillKey((k) => k + 1)
    setTab('manual')
  }

  const foodItems = useLiveQuery(() => db.foodItems.orderBy('name').toArray(), [], [])
  const meals = useLiveQuery(() => db.meals.orderBy('name').toArray(), [], [])

  const q = search.trim().toLowerCase()
  const items = (foodItems ?? []).filter((i) => i.name.toLowerCase().includes(q))
  const savedMeals = (meals ?? []).filter((m) => m.name.toLowerCase().includes(q))

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <strong>Log food</strong>
          <button className="link-btn" onClick={onClose}>
            Done
          </button>
        </div>

        {/* Slot picker */}
        <div className="slot-chips">
          {SLOTS.map((s) => (
            <button key={s} className={`chip${slot === s ? ' active' : ''}`} onClick={() => setSlot(s)}>
              {SLOT_LABEL[s]}
            </button>
          ))}
        </div>

        <div className="segmented small sheet-tabs">
          <button className={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}>
            Saved
          </button>
          <button className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}>
            Manual
          </button>
          <button className={tab === 'photo' ? 'active' : ''} onClick={() => setTab('photo')}>
            📷 Photo
          </button>
        </div>

        {tab === 'saved' ? (
          <div className="sheet-body">
            <input
              className="food-search"
              placeholder="Search saved foods & meals…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {savedMeals.length === 0 && items.length === 0 && (
              <p className="chart-empty">
                No saved foods yet. Log something in <b>Manual</b> and tick “save as reusable”, or
                save a slot as a meal.
              </p>
            )}

            {savedMeals.map((m) => (
              <div className="saved-row" key={m.id}>
                <div className="saved-info">
                  <div className="saved-name">🍽 {m.name}</div>
                  <div className="saved-macros">
                    {m.calories} kcal · P{m.protein} C{m.carbs} F{m.fat}
                  </div>
                </div>
                <button className="add-btn" onClick={() => run(() => logMeal(date, slot, m), 'Couldn’t log that meal')}>
                  Add
                </button>
                <button className="del-x" aria-label="Delete meal" onClick={() => run(() => deleteMeal(m.id), 'Couldn’t delete that meal')}>
                  ✕
                </button>
              </div>
            ))}

            {items.map((item) => (
              <SavedFoodRow key={item.id} item={item} onAdd={(g) => run(() => logFoodItem(date, slot, item, g), 'Couldn’t log that food')} onDelete={() => run(() => deleteFoodItem(item.id), 'Couldn’t delete that food')} />
            ))}
          </div>
        ) : tab === 'photo' ? (
          <PhotoTab settings={settings} onEstimate={usePhotoEstimate} />
        ) : (
          <ManualForm
            key={prefillKey}
            slot={slot}
            initial={prefill}
            onAdd={async ({ name, macros, portion, reuse, servingG }) => {
              const ok = await run(async () => {
                await addManualEntry({ date, slot, name, macros, portion })
                if (reuse) await saveFoodItem({ name, servingGrams: servingG, macros })
                return true
              }, 'Couldn’t log that food')
              if (ok) toast(`Added to ${SLOT_LABEL[slot]}`, 'success')
              return !!ok
            }}
            onLogged={() => {
              setPrefill(null)
              setTab('saved')
            }}
          />
        )}
      </div>
    </div>
  )
}

function PhotoTab({
  settings,
  onEstimate,
}: {
  settings: Settings
  onEstimate: (est: PhotoEstimate) => void
}) {
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'error'>('idle')
  const [message, setMessage] = useState('')

  if (!settings.anthropicApiKey) {
    return (
      <div className="sheet-body">
        <p className="chart-empty">
          📷 Add your Anthropic API key in <b>Settings</b> (⚙, top-right) to estimate a meal from a photo.
          It’s stored only on this device and sent directly to Anthropic. Estimates are a starting
          point — you always confirm before logging.
        </p>
      </div>
    )
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStatus('analyzing')
    setMessage('')
    try {
      const b64 = await fileToBase64Jpeg(file)
      const est = await analyzeMealPhoto(b64, settings.anthropicApiKey!, settings.anthropicModel)
      setStatus('idle')
      onEstimate(est)
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Could not analyze that photo')
    }
  }

  return (
    <div className="sheet-body">
      <label className={`photo-drop${status === 'analyzing' ? ' busy' : ''}`}>
        <input type="file" accept="image/*" capture="environment" onChange={onFile} hidden disabled={status === 'analyzing'} />
        {status === 'analyzing' ? (
          <span className="photo-analyzing">Analyzing your photo…</span>
        ) : (
          <span className="photo-cta">📷 Take or choose a meal photo</span>
        )}
      </label>
      <p className="photo-note">
        The estimate pre-fills the Manual tab so you can confirm or correct it before logging — it’s
        never logged automatically.
      </p>
      {status === 'error' && <p className="photo-error">{message}</p>}
    </div>
  )
}

function SavedFoodRow({
  item,
  onAdd,
  onDelete,
}: {
  item: FoodItem
  onAdd: (grams: number) => void
  onDelete: () => void
}) {
  const [grams, setGrams] = useState(String(item.defaultGrams))
  const g = numOr0(grams)
  const preview = macrosForGrams(item, g)
  return (
    <div className="saved-row">
      <div className="saved-info">
        <div className="saved-name">{item.name}</div>
        <div className="saved-macros">
          {preview.calories} kcal · P{preview.protein} C{preview.carbs} F{preview.fat}
        </div>
      </div>
      <input
        className="grams-input"
        type="number"
        inputMode="numeric"
        value={grams}
        onChange={(e) => setGrams(e.target.value)}
        aria-label="grams"
      />
      <button className="add-btn" onClick={() => onAdd(g)}>
        Add
      </button>
      <button className="del-x" aria-label="Delete food" onClick={onDelete}>
        ✕
      </button>
    </div>
  )
}

interface ManualSubmit {
  name: string
  macros: Macros
  portion?: string
  reuse: boolean
  servingG: number
}

function ManualForm({
  slot,
  initial,
  onAdd,
  onLogged,
}: {
  slot: MealSlot
  initial?: ManualInitial | null
  onAdd: (input: ManualSubmit) => Promise<boolean>
  onLogged: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [cal, setCal] = useState(initial?.cal ?? '')
  const [p, setP] = useState(initial?.p ?? '')
  const [c, setC] = useState(initial?.c ?? '')
  const [f, setF] = useState(initial?.f ?? '')
  const [portion, setPortion] = useState(initial?.portion ?? '')
  const [reuse, setReuse] = useState(false)
  const [servingG, setServingG] = useState('100')

  const canAdd = name.trim().length > 0 && (numOr0(cal) > 0 || numOr0(p) > 0)

  async function add() {
    const macros: Macros = {
      calories: Math.round(numOr0(cal)),
      protein: Math.round(numOr0(p)),
      carbs: Math.round(numOr0(c)),
      fat: Math.round(numOr0(f)),
    }
    const ok = await onAdd({ name: name.trim(), macros, portion: portion.trim() || undefined, reuse, servingG: numOr0(servingG) || 100 })
    if (ok) onLogged()
  }

  return (
    <div className="sheet-body">
      {initial && (
        <p className="photo-confirm">✨ Photo estimate — check the numbers and correct anything before logging.</p>
      )}
      <input className="food-search" placeholder="Food name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="manual-grid">
        <label>
          Calories
          <input type="number" inputMode="numeric" value={cal} onChange={(e) => setCal(e.target.value)} />
        </label>
        <label>
          Protein (g)
          <input type="number" inputMode="numeric" value={p} onChange={(e) => setP(e.target.value)} />
        </label>
        <label>
          Carbs (g)
          <input type="number" inputMode="numeric" value={c} onChange={(e) => setC(e.target.value)} />
        </label>
        <label>
          Fat (g)
          <input type="number" inputMode="numeric" value={f} onChange={(e) => setF(e.target.value)} />
        </label>
        <label className="span-2">
          Portion note (optional)
          <input value={portion} onChange={(e) => setPortion(e.target.value)} placeholder="e.g. 1 bowl, 200 g" />
        </label>
      </div>

      <label className="reuse-toggle">
        <input type="checkbox" checked={reuse} onChange={(e) => setReuse(e.target.checked)} />
        Save as reusable food
        {reuse && (
          <span className="reuse-serving">
            serving
            <input type="number" inputMode="numeric" value={servingG} onChange={(e) => setServingG(e.target.value)} /> g
          </span>
        )}
      </label>

      <button className="btn primary" disabled={!canAdd} onClick={add}>
        Add to {SLOT_LABEL[slot]}
      </button>
    </div>
  )
}
