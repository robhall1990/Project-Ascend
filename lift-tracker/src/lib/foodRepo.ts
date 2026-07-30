import { db } from '../db/db'
import type { FoodEntry, FoodItem, Meal, MealSlot } from '../types'
import { newId } from './id'

export interface Macros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export const ZERO_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 }

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (a, m) => ({
      calories: a.calories + m.calories,
      protein: a.protein + m.protein,
      carbs: a.carbs + m.carbs,
      fat: a.fat + m.fat,
    }),
    { ...ZERO_MACROS },
  )
}

/** Scale a FoodItem's per-100g macros to a gram amount. */
export function macrosForGrams(item: FoodItem, grams: number): Macros {
  const f = grams / 100
  return {
    calories: Math.round(item.per100.calories * f),
    protein: Math.round(item.per100.protein * f),
    carbs: Math.round(item.per100.carbs * f),
    fat: Math.round(item.per100.fat * f),
  }
}

export async function addManualEntry(input: {
  date: string
  slot: MealSlot
  name: string
  macros: Macros
  portion?: string
}): Promise<void> {
  const entry: FoodEntry = {
    id: newId('fe'),
    date: input.date,
    slot: input.slot,
    name: input.name,
    ...input.macros,
    portion: input.portion,
    createdAt: Date.now(),
  }
  await db.foodEntries.add(entry)
}

export async function logFoodItem(
  date: string,
  slot: MealSlot,
  item: FoodItem,
  grams: number,
): Promise<void> {
  await addManualEntry({
    date,
    slot,
    name: item.name,
    macros: macrosForGrams(item, grams),
    portion: `${Math.round(grams)} g`,
  })
}

export async function logMeal(date: string, slot: MealSlot, meal: Meal): Promise<void> {
  await addManualEntry({
    date,
    slot,
    name: meal.name,
    macros: { calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat },
    portion: 'meal',
  })
}

export async function deleteEntry(id: string): Promise<void> {
  await db.foodEntries.delete(id)
}

/** Save a reusable single-food item from per-serving macros. */
export async function saveFoodItem(input: {
  name: string
  servingGrams: number
  macros: Macros
}): Promise<FoodItem> {
  const g = input.servingGrams > 0 ? input.servingGrams : 100
  const factor = 100 / g
  const item: FoodItem = {
    id: newId('fi'),
    name: input.name,
    per100: {
      calories: Math.round(input.macros.calories * factor),
      protein: Math.round(input.macros.protein * factor),
      carbs: Math.round(input.macros.carbs * factor),
      fat: Math.round(input.macros.fat * factor),
    },
    defaultGrams: g,
  }
  await db.foodItems.add(item)
  return item
}

/** Save a set of logged entries as a one-tap reusable Meal. */
export async function saveMealFromEntries(name: string, entries: FoodEntry[]): Promise<void> {
  const totals = sumMacros(entries)
  const meal: Meal = { id: newId('meal'), name, ...totals }
  await db.meals.add(meal)
}

export async function deleteFoodItem(id: string): Promise<void> {
  await db.foodItems.delete(id)
}

export async function deleteMeal(id: string): Promise<void> {
  await db.meals.delete(id)
}
