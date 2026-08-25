import type { CoachingSuggestion } from '../types'
import { db } from '../db/db'
import { programPosition, phaseForWeek } from './schedule'
import { weeklyToleranceStatus, type ToleranceStatus } from './loadModeling'
import { recentCardioLoad } from './intervals'
import { latestWellness, wellnessSummary } from './wellness'

interface CoachContext {
  phase: string
  weekNumber: number
  goalMode: string
  tolerance: ToleranceStatus
  cardioLoad7d: number
  cardioMinutes7d: number
  strengthSessions: number
  mainLiftsProgress?: { exerciseName: string; e1rm: number }[]
  wellness?: string
}

/**
 * Generate a daily coaching suggestion by querying Claude.
 */
export async function generateSessionSuggestion(
  date: string,
  apiKey: string,
  model: string,
): Promise<CoachingSuggestion> {
  // Gather context for Claude
  const context = await buildCoachingContext(date)

  // Build the prompt
  const prompt = formatCoachingPrompt(context)

  // Call Claude
  const response = await callClaudeAPI(prompt, apiKey, model)

  // Parse response
  const suggestion = parseCoachResponse(response, date)

  return suggestion
}

/**
 * Gather training context for the coaching prompt.
 */
async function buildCoachingContext(date: string): Promise<CoachContext> {
  const settings = await db.settings.get('singleton')
  if (!settings) throw new Error('Settings not found')

  const programStart = settings.programStartDate
  const pos = programPosition(programStart, new Date(date))
  const phases = await db.phases.toArray()
  const currentPhase = phaseForWeek(pos.week, phases)

  // Weekly load against the athlete's tolerance (Phase 3)
  const tolerance = await weeklyToleranceStatus(settings)
  const cardio7d = await recentCardioLoad(7)

  // Recent sessions
  const week7ago = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]
  const recentSessions = await db.sessions
    .where('date')
    .aboveOrEqual(week7ago)
    .and((s) => s.completedAt != null)
    .toArray()

  // Gather main lift progress (simple: just count recent sessions for now)
  const mainLifts = await db.exercises.filter((e) => e.isMainLift).toArray()

  // Garmin-sourced wellness (VO2 max, resting HR, HRV, fitness/fatigue), via intervals.icu
  const wellness = await latestWellness()

  return {
    phase: currentPhase?.name ?? 'Unknown',
    weekNumber: pos.week,
    goalMode: settings.goalMode,
    tolerance,
    cardioLoad7d: cardio7d.load,
    cardioMinutes7d: cardio7d.minutes,
    strengthSessions: recentSessions.length,
    mainLiftsProgress: mainLifts.map((e) => ({ exerciseName: e.name, e1rm: 0 })), // TODO: fetch actual e1rms
    wellness: wellness ? wellnessSummary(wellness) : undefined,
  }
}

/**
 * Format the coaching prompt for Claude.
 */
function formatCoachingPrompt(context: CoachContext): string {
  const t = context.tolerance
  const toleranceLine =
    t.status === 'over'
      ? `${t.weeklyLoad} vs a tolerance of ${t.tolerance} (${Math.round(t.ratio * 100)}% — OVER tolerance, favour a lighter or deload day)`
      : t.status === 'under'
        ? `${t.weeklyLoad} vs a tolerance of ${t.tolerance} (${Math.round(t.ratio * 100)}% — well under tolerance, room to push)`
        : `${t.weeklyLoad} vs a tolerance of ${t.tolerance} (${Math.round(t.ratio * 100)}% — within tolerance)`

  return `You are a strength coaching assistant balancing lifting against cardio (running/cycling). Suggest today's workout based on the athlete's training state.

Context:
- Phase: ${context.phase}, Week ${context.weekNumber}
- Goal: ${context.goalMode}
- 7-day combined load (strength RPE-load + cardio): ${toleranceLine}
- 7-day cardio: ${context.cardioLoad7d} load over ${context.cardioMinutes7d} minutes
- Sessions this week: ${context.strengthSessions}
${context.wellness ? `- Recovery data: ${context.wellness}` : '- No recovery/wellness data synced.'}

If weekly load is over tolerance, the intensityModifier should usually be "deload" and the reasoning should say so plainly. If cardio load is high relative to strength sessions, be cautious about heavy lower-body work — that's the interference effect: too much running/cycling volume blunts strength adaptation, so call it out and suggest trimming cardio or keeping it easy rather than cutting the lift. If recovery data shows elevated fatigue (ATL well above CTL, low HRV, high resting HR), lean toward standard or deload intensity rather than heavy, even if the weekly load number alone looks fine.

Respond ONLY with valid JSON (no extra text):
{
  "sessionType": "strength" | "cardio" | "skill" | "rest",
  "title": "Brief session name, e.g., Upper Body Strength",
  "reasoning": "One sentence explaining why this is recommended",
  "intensityModifier": "standard" | "deload" | null,
  "cardioGuidance": "Optional guidance for cardio today, e.g., Easy run, 30-40 min"
}`
}

/**
 * Call the Claude API directly from browser.
 */
async function callClaudeAPI(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as { content: Array<{ type: string; text: string }> }
  const text = data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')

  return text
}

/**
 * Parse Claude's JSON response into a CoachingSuggestion.
 */
function parseCoachResponse(response: string, date: string): CoachingSuggestion {
  // Extract JSON from response (Claude might add extra text)
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response')
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    sessionType: string
    title: string
    reasoning: string
    intensityModifier?: string
    cardioGuidance?: string
  }

  return {
    id: `suggestion:${date}`,
    date,
    sessionType: (parsed.sessionType ?? 'strength') as 'strength' | 'cardio' | 'skill' | 'rest',
    title: parsed.title ?? 'Workout',
    reasoning: parsed.reasoning ?? 'Stay active',
    intensityModifier: parsed.intensityModifier as 'standard' | 'deload' | 'heavy' | undefined,
    cardioGuidance: parsed.cardioGuidance,
    createdAt: Date.now(),
    regeneratedAt: Date.now(),
  }
}

/**
 * Get or generate today's suggestion, with fallback.
 */
export async function getOrGenerateSuggestion(
  date: string,
  apiKey: string,
  model: string,
): Promise<CoachingSuggestion> {
  // Check cache first
  const cached = await db.coachingSuggestions.where('date').equals(date).first()
  if (cached && isFresh(cached)) {
    return cached
  }

  try {
    const suggestion = await generateSessionSuggestion(date, apiKey, model)
    await db.coachingSuggestions.put(suggestion)
    return suggestion
  } catch (err) {
    // Fallback to cached if available
    if (cached) {
      return cached
    }
    // Last resort: default suggestion
    return createDefaultSuggestion(date)
  }
}

/**
 * Check if a suggestion is fresh (generated in last 24 hours).
 */
function isFresh(suggestion: CoachingSuggestion): boolean {
  const oneDayMs = 24 * 60 * 60 * 1000
  return Date.now() - suggestion.createdAt < oneDayMs
}

/**
 * Create a default fallback suggestion.
 */
function createDefaultSuggestion(date: string): CoachingSuggestion {
  return {
    id: `suggestion:${date}`,
    date,
    sessionType: 'strength',
    title: 'Follow Today\'s Scheduled Session',
    reasoning: 'Coach unavailable; roll with the program.',
    createdAt: Date.now(),
  }
}
