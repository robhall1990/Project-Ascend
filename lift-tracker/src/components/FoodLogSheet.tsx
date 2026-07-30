import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { FoodItem, MealSlot } from '../types'
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
  onClose: () => void
}

const numOr0 = (s: string) => {
  const v = parseFloat(s)
  return Number.isFinite(v) ? v : 0
}

export function FoodLogSheet({ date, initialSlot, onClose }: Props) {
  const [slot, setSlot] = useState<MealSlot>(initialSlot)
  const [tab, setTab] = useState<'saved' | 'manual'>('saved')
  const [search, setSearch] = useState('')

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
                <button className="add-btn" onClick={() => logMeal(date, slot, m)}>
                  Add
                </button>
                <button className="del-x" aria-label="Delete meal" onClick={() => deleteMeal(m.id)}>
                  ✕
                </button>
              </div>
            ))}

            {items.map((item) => (
              <SavedFoodRow key={item.id} item={item} onAdd={(g) => logFoodItem(date, slot, item, g)} onDelete={() => deleteFoodItem(item.id)} />
            ))}
          </div>
        ) : (
          <ManualForm date={date} slot={slot} onLogged={() => setTab('saved')} />
        )}
      </div>
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

function ManualForm({
  date,
  slot,
  onLogged,
}: {
  date: string
  slot: MealSlot
  onLogged: () => void
}) {
  const [name, setName] = useState('')
  const [cal, setCal] = useState('')
  const [p, setP] = useState('')
  const [c, setC] = useState('')
  const [f, setF] = useState('')
  const [portion, setPortion] = useState('')
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
    await addManualEntry({ date, slot, name: name.trim(), macros, portion: portion.trim() || undefined })
    if (reuse) await saveFoodItem({ name: name.trim(), servingGrams: numOr0(servingG) || 100, macros })
    onLogged()
  }

  return (
    <div className="sheet-body">
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
