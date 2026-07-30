import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import type { Exercise, WeightUnit } from '../types'
import type { HistorySession, TrendRow } from '../lib/progression'
import { parseISODate } from '../lib/schedule'

// Validated categorical palette (dark surface #1e293b): blue / orange / aqua /
// yellow in adjacency-safe order — see dataviz validation.
export const SERIES_COLOR: Record<string, string> = {
  'd1-bench': '#3987e5',
  'd1-ohp': '#d95926',
  'd3-pullup': '#199e70',
  'd2-squat': '#c98500',
}
const SERIES_LABEL: Record<string, string> = {
  'd1-bench': 'Bench',
  'd1-ohp': 'OHP',
  'd3-pullup': 'Pull-up',
  'd2-squat': 'Squat/DL',
}

const AXIS = '#898781'
const GRID = '#2c2c2a'
const TOOLTIP_STYLE = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 10,
  fontSize: 12,
  color: '#e2e8f0',
}

function shortDate(iso: string): string {
  const d = parseISODate(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Estimated-1RM trend, one line per main lift. */
export function E1RMChart({
  mains,
  rows,
  unit,
}: {
  mains: Exercise[]
  rows: TrendRow[]
  unit: WeightUnit
}) {
  if (rows.length === 0) {
    return <p className="chart-empty">Log a main lift to see your strength trend here.</p>
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={rows} margin={{ top: 8, right: 14, bottom: 4, left: 6 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          stroke={AXIS}
          tick={{ fill: AXIS, fontSize: 11 }}
          tickMargin={6}
        />
        <YAxis
          stroke={AXIS}
          tick={{ fill: AXIS, fontSize: 11 }}
          width={52}
          tickFormatter={(v: number) => `${v}${unit}`}
          domain={['auto', 'auto']}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(v) => shortDate(String(v))}
          formatter={(value: number, name: string) => [`${value} ${unit}`, SERIES_LABEL[name] ?? name]}
        />
        <Legend
          formatter={(v) => <span style={{ color: '#c3c2b7', fontSize: 12 }}>{SERIES_LABEL[v] ?? v}</span>}
        />
        {mains.map((ex) => (
          <Line
            key={ex.id}
            type="monotone"
            dataKey={ex.id}
            name={ex.id}
            stroke={SERIES_COLOR[ex.id] ?? '#3987e5'}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: SERIES_COLOR[ex.id] ?? '#3987e5' }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Single-series top-set weight over time for one exercise. */
export function WeightHistoryChart({
  history,
  color,
  unit,
}: {
  history: HistorySession[]
  color: string
  unit: WeightUnit
}) {
  if (history.length === 0) {
    return <p className="chart-empty">No sessions logged for this exercise yet.</p>
  }
  const data = history.map((h) => ({ date: h.date, weight: h.topWeight }))
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 14, bottom: 4, left: 6 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          stroke={AXIS}
          tick={{ fill: AXIS, fontSize: 11 }}
          tickMargin={6}
        />
        <YAxis
          stroke={AXIS}
          tick={{ fill: AXIS, fontSize: 11 }}
          width={52}
          tickFormatter={(v: number) => `${v}${unit}`}
          domain={['auto', 'auto']}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(v) => shortDate(String(v))}
          formatter={(value: number) => [`${value} ${unit}`, 'Top set']}
        />
        <Line
          type="monotone"
          dataKey="weight"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0, fill: color }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
