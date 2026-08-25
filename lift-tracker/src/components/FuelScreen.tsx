import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { DayType, EnduranceIntensity, FoodEntry, MealSlot, Settings } from '../types'
import { todayISO } from '../lib/schedule'
import {
  GOAL_LABEL,
  maintenanceCalories,
  resolveTarget,
  setDayType,
  setEndurance,
} from '../lib/nutrition'
import { deleteEntry, logMeal, saveMealFromEntries, suggestMeals } from '../lib/foodRepo'
import type { Meal } from '../types'
import { useToast } from '../lib/toast'
import { useLoadContext } from '../lib/useLoadContext'
import { ProteinRing, MacroBar } from './MacroRings'
import { PromptDialog } from './Modal'
import { FoodLogSheet, SLOT_LABEL } from './FoodLogSheet'

const DAY_TYPES: DayType[] = ['lift', 'endurance', 'rest']
const DAY_TYPE_LABEL: Record<DayType, string> = {
  lift: 'Lift',
  endurance: 'Endurance',
  rest: 'Rest',
}
const INTENSITIES: EnduranceIntensity[] = ['easy', 'moderate', 'hard']
const SLOT_ORDER: MealSlot[] = ['pre-training', 'breakfast', 'lunch', 'post-training', 'dinner', 'snack']

/** Guess a meal slot from the time of day, to pre-select the logging sheet. */
function guessSlot(): MealSlot {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

const COLOR = {
  protein: '#22c55e',
  calories: '#38bdf8',
  carbs: '#f59e0b',
  fat: '#a78bfa',
}

export function FuelScreen({
  settings,
  initialSlot = null,
  onInitialSlotConsumed,
  onOpenSettings,
}: {
  settings: Settings
  initialSlot?: MealSlot | null
  onInitialSlotConsumed?: () => void
  onOpenSettings: () => void
}) {
  const today = todayISO()
  const { run } = useToast()
  const stats = useLiveQuery(() => db.userStats.get('singleton'))
  const bw = useLiveQuery(() => db.bodyweightLogs.orderBy('createdAt').last())
  const dayNut = useLiveQuery(() => db.dayNutrition.get(today), [today])
  const entries = useLiveQuery(() => db.foodEntries.where('date').equals(today).toArray(), [today], [])
  const meals = useLiveQuery(() => db.meals.toArray(), [], [])
  const loadContext = useLoadContext(settings, today)

  const [sheetSlot, setSheetSlot] = useState<MealSlot | null>(null)
  const [namingMeal, setNamingMeal] = useState<{ slot: MealSlot; entries: FoodEntry[] } | null>(null)

  // Open the log sheet at the slot requested from a home-screen guidance card.
  useEffect(() => {
    if (initialSlot) {
      setSheetSlot(initialSlot)
      onInitialSlotConsumed?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSlot])

  if (!stats || !bw) return <div className="app">Loading…</div>

  const bodyweightKg = bw.weightKg
  const dayType = dayNut?.dayType ?? 'lift'
  const target = resolveTarget(dayNut, { stats, bodyweightKg, goal: settings.goalMode, loadContext })
  const maintenance = Math.round(maintenanceCalories(stats, bodyweightKg))

  const consumed = (entries ?? []).reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>Fuel</h1>
        <button className="icon-btn" aria-label="Settings" onClick={onOpenSettings}>
          ⚙
        </button>
      </header>

      {!stats.configured && (
        <button className="setup-banner" onClick={onOpenSettings}>
          📏 Using example stats ({bodyweightKg} kg, {stats.heightCm} cm, {stats.age}). Tap to set
          your own so targets are accurate.
        </button>
      )}

      <>
          {/* Day type */}
          <div className="segmented">
            {DAY_TYPES.map((d) => (
              <button
                key={d}
                className={dayType === d ? 'active' : ''}
                onClick={() => run(() => setDayType(today, d), 'Couldn’t change day type')}
              >
                {DAY_TYPE_LABEL[d]}
              </button>
            ))}
          </div>

          {dayNut?.dayTypeSource === 'intervals' && (
            <p className="sync-note">
              ⟳ Set from intervals.icu — {dayNut.enduranceMinutes} min ({dayNut.enduranceIntensity}).
              Tap a day type to override.
            </p>
          )}

          {dayType === 'endurance' && (
            <EnduranceControls
              minutes={dayNut?.enduranceMinutes ?? 60}
              intensity={dayNut?.enduranceIntensity ?? 'moderate'}
              onChange={(m, i) => run(() => setEndurance(today, m, i), 'Couldn’t save session length')}
            />
          )}

          {/* Protein ring — the headline */}
          <section className="fuel-hero">
            <ProteinRing consumed={consumed.protein} target={target.protein} color={COLOR.protein} />
          </section>

          {/* Other macros */}
          <div className="macro-bars">
            <MacroBar label="Calories" consumed={consumed.calories} target={target.calories} unit="kcal" color={COLOR.calories} />
            <MacroBar label="Carbs" consumed={consumed.carbs} target={target.carbs} unit="g" color={COLOR.carbs} />
            <MacroBar label="Fat" consumed={consumed.fat} target={target.fat} unit="g" color={COLOR.fat} />
          </div>

          <button className="cta" onClick={() => setSheetSlot(guessSlot())}>
            ＋ Log food
          </button>

          <FoodLog
            entries={entries ?? []}
            onAddToSlot={(s) => setSheetSlot(s)}
            onDelete={(id) => run(() => deleteEntry(id), 'Couldn’t delete that entry')}
            onSaveMeal={(slot, es) => setNamingMeal({ slot, entries: es })}
          />

          <MealSuggestions
            meals={meals ?? []}
            remaining={{
              calories: Math.max(target.calories - consumed.calories, 0),
              protein: Math.max(target.protein - consumed.protein, 0),
              carbs: Math.max(target.carbs - consumed.carbs, 0),
              fat: Math.max(target.fat - consumed.fat, 0),
            }}
            onLog={(m) => run(() => logMeal(today, guessSlot(), m), 'Couldn’t log that meal')}
          />

          {/* How today's target was derived — goal itself lives in Settings */}
          <button className="rationale-card" onClick={onOpenSettings}>
            <span className="rationale-goal">{GOAL_LABEL[settings.goalMode]}</span>
            <span className="rationale-text">
              Maintenance ≈ {maintenance} kcal (Mifflin–St Jeor × activity).{' '}
              {settings.goalMode === 'lean-gain' ? '+10% for lean gain. ' : 'Held at maintenance. '}
              Protein {stats.proteinPerKg} g/kg · fat ~25% of calories · carbs flex by day type
              {dayType === 'endurance'
                ? ' (extra carbs added for today’s session).'
                : dayType === 'rest'
                  ? ' (carbs trimmed for rest).'
                  : '.'}
            </span>
            <span className="rationale-link">Change goal & stats →</span>
          </button>
        </>

      {sheetSlot && (
        <FoodLogSheet
          date={today}
          initialSlot={sheetSlot}
          settings={settings}
          onClose={() => setSheetSlot(null)}
        />
      )}

      {namingMeal && (
        <PromptDialog
          title={`Save ${SLOT_LABEL[namingMeal.slot].toLowerCase()} as a meal`}
          placeholder="e.g. Post-gym shake & oats"
          confirmLabel="Save meal"
          onCancel={() => setNamingMeal(null)}
          onSubmit={async (name) => {
            const items = namingMeal.entries
            setNamingMeal(null)
            await run(() => saveMealFromEntries(name, items), 'Couldn’t save that meal')
          }}
        />
      )}
    </div>
  )
}

function FoodLog({
  entries,
  onAddToSlot,
  onDelete,
  onSaveMeal,
}: {
  entries: FoodEntry[]
  onAddToSlot: (slot: MealSlot) => void
  onDelete: (id: string) => void
  onSaveMeal: (slot: MealSlot, entries: FoodEntry[]) => void
}) {
  const bySlot = SLOT_ORDER.map((slot) => ({
    slot,
    items: entries.filter((e) => e.slot === slot).sort((a, b) => a.createdAt - b.createdAt),
  })).filter((g) => g.items.length > 0)

  if (bySlot.length === 0) {
    return <p className="fuel-empty">Nothing logged yet today. Tap ＋ Log food to start.</p>
  }

  return (
    <div className="food-log">
      {bySlot.map(({ slot, items }) => (
        <div className="food-slot" key={slot}>
          <div className="food-slot-head">
            <span className="food-slot-title">{SLOT_LABEL[slot]}</span>
            <div className="food-slot-actions">
              {items.length > 1 && (
                <button className="mini-btn" onClick={() => onSaveMeal(slot, items)}>
                  Save as meal
                </button>
              )}
              <button className="mini-btn" onClick={() => onAddToSlot(slot)}>
                ＋
              </button>
            </div>
          </div>
          {items.map((e) => (
            <div className="food-entry" key={e.id}>
              <div className="food-entry-main">
                <span className="food-entry-name">{e.name}</span>
                {e.portion && <span className="food-entry-portion"> · {e.portion}</span>}
                <div className="food-entry-macros">
                  {e.calories} kcal · P{e.protein} C{e.carbs} F{e.fat}
                </div>
              </div>
              <button className="del-x" aria-label="Delete entry" onClick={() => onDelete(e.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function MealSuggestions({
  meals,
  remaining,
  onLog,
}: {
  meals: Meal[]
  remaining: { calories: number; protein: number; carbs: number; fat: number }
  onLog: (m: Meal) => void
}) {
  const suggestions = suggestMeals(meals, remaining, 4)

  return (
    <div className="suggestions-section">
      <h2 className="suggestions-title">Meal suggestions</h2>
      {meals.length === 0 ? (
        <p className="suggestions-empty">
          Save meals from your logged food (tap “Save as meal” on a slot) to get
          protein-first suggestions that fit your remaining macros.
        </p>
      ) : suggestions.length === 0 ? (
        <p className="suggestions-empty">
          Nothing fits your remaining headroom right now — you’re close to today’s targets.
        </p>
      ) : (
        suggestions.map(({ meal, proteinDensity }) => (
          <div className="suggestion-row" key={meal.id}>
            <div className="suggestion-info">
              <div className="suggestion-name">🍽 {meal.name}</div>
              <div className="suggestion-macros">
                {meal.calories} kcal · P{meal.protein} C{meal.carbs} F{meal.fat} ·{' '}
                <span className="suggestion-density">{Math.round(proteinDensity * 1000) / 10} g P/100 kcal</span>
              </div>
            </div>
            <button className="add-btn" onClick={() => onLog(meal)}>
              Log
            </button>
          </div>
        ))
      )}
    </div>
  )
}

function EnduranceControls({
  minutes,
  intensity,
  onChange,
}: {
  minutes: number
  intensity: EnduranceIntensity
  onChange: (m: number, i: EnduranceIntensity) => void
}) {
  return (
    <div className="endurance-controls">
      <label>
        Session length: <strong>{minutes} min</strong>
        <input
          type="range"
          min={20}
          max={240}
          step={5}
          value={minutes}
          onChange={(e) => onChange(parseInt(e.target.value), intensity)}
        />
      </label>
      <div className="segmented small">
        {INTENSITIES.map((i) => (
          <button key={i} className={intensity === i ? 'active' : ''} onClick={() => onChange(minutes, i)}>
            {i[0].toUpperCase() + i.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )
}
