import { db } from '../db/db'
import { newId } from './id'
import { todayISO } from './schedule'
import type {
  ActivityLevel,
  DayNutrition,
  DayType,
  EnduranceIntensity,
  GoalMode,
  UserStats,
} from '../types'

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  'very-active': 1.9,
}

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Light',
  moderate: 'Moderate',
  active: 'Active',
  'very-active': 'Very active',
}

export const GOAL_LABEL: Record<GoalMode, string> = {
  'lean-gain': 'Lean gain',
  recomposition: 'Recomposition',
  maintenance: 'Maintenance',
}

/** Extra carbohydrate per kg bodyweight per hour of endurance work. */
export const ENDURANCE_CARB_G_PER_KG_HR: Record<EnduranceIntensity, number> = {
  easy: 0.5,
  moderate: 0.75,
  hard: 1.0,
}

/** Mifflin–St Jeor resting metabolic rate (kcal/day). */
export function mifflinBMR(sex: UserStats['sex'], kg: number, cm: number, age: number): number {
  const base = 10 * kg + 6.25 * cm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export function maintenanceCalories(stats: UserStats, bodyweightKg: number): number {
  return mifflinBMR(stats.sex, bodyweightKg, stats.heightCm, stats.age) * ACTIVITY_FACTORS[stats.activity]
}

/** Goal adjustment: lean gain +10%; recomposition & maintenance = maintenance. */
export function goalCalories(maintenance: number, goal: GoalMode): number {
  return goal === 'lean-gain' ? maintenance * 1.1 : maintenance
}

export interface MacroTarget {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface TargetInputs {
  stats: UserStats
  bodyweightKg: number
  goal: GoalMode
  dayType: DayType
  enduranceMinutes?: number
  enduranceIntensity?: EnduranceIntensity
}

/**
 * Compute a day's macro target from stats, goal and day type. Protein is
 * bodyweight-driven and held constant across day types; fat is 25% of calories
 * with a 0.8 g/kg floor; carbs take the remainder and are the lever that flexes
 * by day type (endurance adds, rest trims). Calories are re-derived from the
 * final macros so the numbers stay internally consistent.
 */
export function computeTarget(input: TargetInputs): MacroTarget {
  const { stats, bodyweightKg: kg, goal, dayType } = input
  const maintenance = maintenanceCalories(stats, kg)
  const baseCalories = goalCalories(maintenance, goal)

  const protein = stats.proteinPerKg * kg
  const fat = Math.max((0.25 * baseCalories) / 9, 0.8 * kg)
  let carbs = Math.max((baseCalories - protein * 4 - fat * 9) / 4, 0)

  if (dayType === 'rest') {
    carbs = carbs * 0.85
  } else if (dayType === 'endurance') {
    const minutes = input.enduranceMinutes ?? 0
    const intensity = input.enduranceIntensity ?? 'moderate'
    carbs += kg * (minutes / 60) * ENDURANCE_CARB_G_PER_KG_HR[intensity]
  }

  const calories = protein * 4 + carbs * 4 + fat * 9
  return {
    calories: Math.round(calories / 5) * 5,
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  }
}

/** Resolve a day's target, honouring a manual override if present. */
export function resolveTarget(
  day: DayNutrition | undefined,
  input: Omit<TargetInputs, 'dayType' | 'enduranceMinutes' | 'enduranceIntensity'>,
): MacroTarget {
  const dayType = day?.dayType ?? 'lift'
  if (day?.override) return day.override
  return computeTarget({
    ...input,
    dayType,
    enduranceMinutes: day?.enduranceMinutes,
    enduranceIntensity: day?.enduranceIntensity,
  })
}

/** Latest logged bodyweight in kg, or undefined if none. */
export async function currentBodyweightKg(): Promise<number | undefined> {
  const latest = (await db.bodyweightLogs.orderBy('createdAt').last())?.weightKg
  return latest
}

/** Record today's bodyweight (kg), replacing an existing entry for today. */
export async function logBodyweight(kg: number): Promise<void> {
  const date = todayISO()
  const existing = await db.bodyweightLogs.where('date').equals(date).first()
  if (existing) {
    await db.bodyweightLogs.update(existing.id, { weightKg: kg, createdAt: Date.now() })
  } else {
    await db.bodyweightLogs.add({ id: newId('bw'), date, weightKg: kg, createdAt: Date.now() })
  }
}

/** Read (or default) the per-day nutrition record. */
export async function getDayNutrition(date: string): Promise<DayNutrition | undefined> {
  return db.dayNutrition.get(date)
}

export async function setDayType(date: string, dayType: DayType): Promise<void> {
  const existing = await db.dayNutrition.get(date)
  await db.dayNutrition.put({ ...(existing ?? { date }), date, dayType })
}

export async function setEndurance(
  date: string,
  minutes: number,
  intensity: EnduranceIntensity,
): Promise<void> {
  const existing = await db.dayNutrition.get(date)
  await db.dayNutrition.put({
    ...(existing ?? { date, dayType: 'endurance' as DayType }),
    date,
    dayType: 'endurance',
    enduranceMinutes: minutes,
    enduranceIntensity: intensity,
  })
}
