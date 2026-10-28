"use client"

import { useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

import { ChartLoader } from "@/components/shared/chart-loader"
import { cn, formatCount } from "@/lib/utils"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { useForecastVsActual } from "@/features/initiative-7/hooks/use-forecast-vs-actual"
import {
  availableRange,
  filterToPeriod,
  monthsToCoverPeriod,
  type ForecastPeriod,
} from "@/features/initiative-7/utils/forecast-period"

const ACTUAL_COLOR = "var(--chart-3)"
const FORECAST_COLOR = "var(--chart-1)"

/** The two plants the initiative covers. "All" is every plant together. */
const PLANT_TABS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: "All plants" },
  { value: "1300", label: sapPlantLabel("1300") },
  { value: "1500", label: sapPlantLabel("1500") },
]

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "2026-03-01" -> "Mar 2026". */
export function monthLabel(isoDate: string): string {
  const [year, month] = isoDate.split("-")
  const index = Number(month) - 1
  return index >= 0 && index < 12 ? `${MONTH_NAMES[index]} ${year}` : isoDate
}

function Tooltip_({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="mt-1 flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 shrink-0" style={{ backgroundColor: String(entry.color) }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">
            {typeof entry.value === "number" ? formatCount(Math.round(entry.value)) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Forecast vs Actual Demand for the whole portfolio, from the backend's champion
 * backtests: per month, the sum of the champion models' one-step-ahead
 * predictions against what was actually used. Switch between All plants and each
 * plant. Quantities are summed in each material's own unit of measure.
 *
 * Material-plants with no backtest are not in the lines -- cold-start materials
 * (no history) and the declining-demand ones, which use TSB directly and are not
 * backtested by design. The caption says how many are in.
 *
 * With `period` (a Quarterly Report), only the months of that period are drawn -- Q3 shows July,
 * August and September -- instead of the latest twelve months.
 */
export function PortfolioForecastVsActualChart({ months = 12, period }: { months?: number; period?: ForecastPeriod }) {
  const [plant, setPlant] = useState<string | undefined>(undefined)
  const requestMonths = period ? monthsToCoverPeriod(period.start) : months
  const { data, loading, error } = useForecastVsActual(plant, requestMonths)

  const visiblePoints = period ? filterToPeriod(data?.points ?? [], period) : (data?.points ?? [])
  const history = availableRange(data?.points ?? [])

  const points = visiblePoints.map((point) => ({
    period: monthLabel(point.period),
    actual: point.actual,
    forecast: point.predicted,
  }))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Plant">
        {PLANT_TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={plant === tab.value}
            onClick={() => setPlant(tab.value)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              plant === tab.value
                ? "border-primary bg-primary/10 font-medium text-foreground"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <ChartLoader label="Loading the chart" className="h-[220px] w-full" />
      ) : error ? (
        <div className="flex h-[220px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
          <p>Could not load Forecast vs Actual from the backend.</p>
          <p className="max-w-xs">{error.message}</p>
        </div>
      ) : points.length === 0 ? (
        <div className="flex h-[220px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
          <p>
            No forecast history to show{period?.label ? ` for ${period.label}` : ""}
            {plant ? ` for ${sapPlantLabel(plant)}` : ""}.
          </p>
          <p className="max-w-xs">
            {period && history
              ? `Forecast history exists for ${monthLabel(history.first)} to ${monthLabel(history.last)}, none of it inside this period.`
              : "The latest forecast run has no backtested material-plants here. The chart fills in once a run with backtests is available."}
          </p>
        </div>
      ) : (
        <>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="period" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={48}
                  allowDecimals={false}
                  tickFormatter={(value: number) => formatCount(Math.round(value))}
                />
                <Tooltip content={Tooltip_} cursor={{ stroke: "var(--border)" }} />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Actual"
                  stroke={ACTUAL_COLOR}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2, stroke: "var(--card)", fill: ACTUAL_COLOR }}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Forecast"
                  stroke={FORECAST_COLOR}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3 shrink-0" style={{ backgroundColor: ACTUAL_COLOR }} />
              Actual
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 shrink-0 border-t-2 border-dashed" style={{ borderColor: FORECAST_COLOR }} />
              Forecast (one month ahead)
            </div>
          </div>
        </>
      )}

      {data && (
        <p className="text-[11px] text-muted-foreground">
          {`Based on ${formatCount(data.materialsWithHistory)} of ${formatCount(data.materialsInScope)} forecast material-plants. `}
          Material-plants with no backtest are not included: those with too little history, and declining-demand
          ones, which use TSB directly. Quantities are summed in each material&apos;s own unit.
        </p>
      )}
    </div>
  )
}
