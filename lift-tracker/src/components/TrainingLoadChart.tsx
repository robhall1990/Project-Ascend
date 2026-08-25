import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { TrainingLoad } from '../types'

interface Props {
  loads: TrainingLoad[]
}

export function TrainingLoadChart({ loads }: Props) {
  const data = useMemo(() => {
    return loads.map((load) => ({
      date: load.date.slice(-5), // 'MM-DD' format for compact display
      total: Math.round(load.totalLoad * 10) / 10,
      strength: Math.round(load.strengthLoad * 10) / 10,
      cardio: Math.round(load.cardioLoad * 10) / 10,
    }))
  }, [loads])

  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
        <p>No training data yet. Log sessions with RPE to see your load trends.</p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: 300, marginTop: '1.5rem' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis dataKey="date" stroke="#999" fontSize={12} />
          <YAxis stroke="#999" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '8px',
            }}
            formatter={(value) => Math.round(value as number)}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="#3498db"
            name="Total Load"
            dot={{ r: 3 }}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="strength"
            stroke="#2ecc71"
            name="Strength"
            dot={false}
            strokeWidth={1}
            opacity={0.6}
          />
          <Line
            type="monotone"
            dataKey="cardio"
            stroke="#e74c3c"
            name="Cardio"
            dot={false}
            strokeWidth={1}
            opacity={0.6}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
