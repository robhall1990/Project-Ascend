import type { WeightUnit } from '../types'

export const KG_PER_LB = 0.45359237

/** kg → the user's display unit. */
export function toDisplayWeight(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg / KG_PER_LB : kg
}

/** A value in the user's display unit → kg (canonical storage). */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value * KG_PER_LB : value
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
