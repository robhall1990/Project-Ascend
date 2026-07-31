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
import type { CombinedPoint } from '../lib/combined'
import { parseISODate } from '../lib/schedule'
import { round1, toDisplayWeight } from '../lib/units'

// Validated categorical palette (dark surface #1e293b): blue / orange / aqua /
// yellow in adjacency-safe order — see dataviz validation.
export const SERIES_COLOR: Record<string, string> = {
  'd1-ohp': '#3987e5',
  'd2-squat': '#d95926',
  'd2-trapbar': '#199e70',
  'd3-pullup': '#c98500',
}
const SERIES_LABEL: Record<string, string> = {
  'd1-ohp': 'OHP',
  'd2-squat': 'Squat',
  'd2-trapbar': 'Trap bar',
  'd3-pullup': 'Pull-up',
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

/**
 * The payoff view: bodyweight, strength (sum of main-lift e1RM) and weekly
 * average protein as three stacked mini-charts sharing one weekly x-axis.
 * Three separate single-scale panels avoid a forbidden dual-axis chart while
 * keeping real units and vertical alignment for eyeballing the relationship.
 */
export function CombinedProgressCharts({
  points,
  unit,
}: {
  points: CombinedPoint[]
  unit: WeightUnit
}) {
  if (points.length === 0) {
    return (
      <p className="chart-empty">
        Log training, bodyweight and food over a few weeks to see how they move together.
      </p>
    )
  }
  const maxWeek = points[points.length - 1].week
  const data = points.map((p) => ({
    week: p.week,
    bodyweight: p.bodyweightKg != null ? round1(toDisplayWeight(p.bodyweightKg, unit)) : undefined,
    strength: p.strengthKg != null ? Math.round(toDisplayWeight(p.strengthKg, unit)) : undefined,
    protein: p.proteinG,
  }))

  const panels: Array<{ key: 'bodyweight' | 'strength' | 'protein'; label: string; color: string; unit: string }> = [
    { key: 'bodyweight', label: 'Bodyweight', color: '#3987e5', unit },
    { key: 'strength', label: 'Strength (Σ main-lift e1RM)', color: '#c98500', unit },
    { key: 'protein', label: 'Protein (weekly avg/day)', color: '#22c55e', unit: 'g' },
  ]

  return (
    <div className="combined">
      {panels.map((panel, i) => (
        <div className="combined-panel" key={panel.key}>
          <div className="combined-label" style={{ color: panel.color }}>
            {panel.label}
          </div>
          <ResponsiveContainer width="100%" height={i === panels.length - 1 ? 128 : 110}>
            <LineChart data={data} margin={{ top: 6, right: 14, bottom: i === panels.length - 1 ? 4 : 0, left: 6 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="week"
                type="number"
                domain={[1, maxWeek]}
                allowDecimals={false}
                tickCount={Math.min(maxWeek, 10)}
                stroke={AXIS}
                tick={i === panels.length - 1 ? { fill: AXIS, fontSize: 11 } : false}
                height={i === panels.length - 1 ? 20 : 0}
                tickFormatter={(w) => `wk ${w}`}
              />
              <YAxis
                stroke={AXIS}
                tick={{ fill: AXIS, fontSize: 11 }}
                width={44}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(w) => `Week ${w}`}
                formatter={(value: number) => [`${value} ${panel.unit}`, panel.label]}
              />
              <Line
                type="monotone"
                dataKey={panel.key}
                stroke={panel.color}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: panel.color }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
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
