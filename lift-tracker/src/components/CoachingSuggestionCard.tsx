import { useEffect, useState } from 'react'
import type { CoachingSuggestion, Settings } from '../types'
import { getOrGenerateSuggestion } from '../lib/aiCoach'
import { useToast } from '../lib/toast'

interface Props {
  date: string
  settings: Settings
  onRefresh?: () => void
}

export function CoachingSuggestionCard({ date, settings, onRefresh }: Props) {
  const [suggestion, setSuggestion] = useState<CoachingSuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { run } = useToast()

  useEffect(() => {
    loadSuggestion()
  }, [date])

  async function loadSuggestion() {
    if (!settings.anthropicApiKey) {
      setError('API key not configured. Set it in Settings.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const sug = await getOrGenerateSuggestion(
        date,
        settings.anthropicApiKey,
        settings.anthropicModel || 'claude-sonnet-5',
      )
      setSuggestion(sug)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suggestion')
      console.error('Suggestion error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    if (!settings.anthropicApiKey) {
      run(async () => {
        throw new Error('API key not configured')
      })
      return
    }

    await run(async () => {
      setLoading(true)
      try {
        // Force regenerate by fetching from Claude, not cache
        const sug = await generateSessionSuggestion(
          date,
          settings.anthropicApiKey!,
          settings.anthropicModel || 'claude-sonnet-5',
        )
        setSuggestion(sug)
      } finally {
        setLoading(false)
      }
      onRefresh?.()
    })
  }

  if (!settings.anthropicApiKey) {
    return (
      <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid #999' }}>
        <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
          💡 AI Coach disabled
        </p>
        <p style={{ fontSize: '0.85rem', margin: 0, color: '#999' }}>
          Set your Anthropic API key in Settings to enable daily workout suggestions.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid #e74c3c' }}>
        <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#e74c3c' }}>
          ⚠ Coach error
        </p>
        <p style={{ fontSize: '0.85rem', margin: 0, color: '#666' }}>{error}</p>
      </div>
    )
  }

  if (!suggestion) {
    return (
      <div className="card" style={{ marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.9rem', color: '#999' }}>Loading suggestion...</p>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid #3498db' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>
            {getSessionTypeEmoji(suggestion.sessionType)} {suggestion.title}
          </h3>
          <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#666' }}>
            {suggestion.reasoning}
          </p>
          {suggestion.intensityModifier && (
            <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', fontWeight: 'bold' }}>
              Intensity: {suggestion.intensityModifier}
            </p>
          )}
          {suggestion.cardioGuidance && (
            <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#555' }}>
              🏃 {suggestion.cardioGuidance}
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          style={{
            padding: '0.4rem 0.8rem',
            marginLeft: '0.5rem',
            fontSize: '0.8rem',
            background: 'none',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            color: loading ? '#999' : '#333',
          }}
        >
          {loading ? '...' : '↻'}
        </button>
      </div>
    </div>
  )
}

function getSessionTypeEmoji(type: string): string {
  switch (type) {
    case 'strength':
      return '💪'
    case 'cardio':
      return '🏃'
    case 'skill':
      return '🎯'
    case 'rest':
      return '😴'
    default:
      return '📋'
  }
}

// Import the function here to avoid circular dependency
async function generateSessionSuggestion(
  date: string,
  apiKey: string,
  model: string,
): Promise<CoachingSuggestion> {
  const { generateSessionSuggestion: gen } = await import('../lib/aiCoach')
  return gen(date, apiKey, model)
}
