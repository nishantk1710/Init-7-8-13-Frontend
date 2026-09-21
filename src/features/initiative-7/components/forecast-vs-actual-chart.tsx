"use client"

import { useMemo, useState } from "react"
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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import { aggregateConsumption, oneStepAheadForecast } from "@/features/initiative-7/utils/inventory-calc"
import { USING_LIVE_DATA } from "@/lib/sap/dataset-mode"

const ACTUAL_COLOR = "var(--chart-3)"
const FORECAST_COLOR = "var(--chart-1)"

const WINDOW_OPTIONS = [
  { value: "3", label: "Last 3 Months" },
  { value: "6", label: "Last 6 Months" },
] as const
type WindowValue = (typeof WINDOW_OPTIONS)[number]["value"]

function ForecastTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="mt-1 flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 shrink-0" style={{ backgroundColor: String(entry.color) }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">
            {typeof entry.value === "number" ? entry.value.toFixed(1) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Aggregate consumption for whichever recommendations are in view.
 *
 * In scenario mode, "Forecast" is a one-step-ahead exponential-smoothing
 * recompute of the same actuals series -- illustrative, matching the mock
 * data's own made-up numbers.
 *
 * In live mode this must NOT recompute a forecast client-side: the backend's
 * real model (SBA/Croston, see app/initiatives/i7/forecasting/service.py)
 * already produced the real number, persisted as a single scalar
 * `forecast_rate` (one monthly demand-rate figure, not a per-period series --
 * confirmed against the schema/DB). A client-side smoothing recompute here
 * would silently diverge from the number that actually drove the
 * recommendation's ROP/Safety Stock -- exactly the "the architecture rule
 * forbids recomputing in live mode" violation why-recommended.tsx's own
 * comment already calls out for this same chart. So live mode plots the real
 * `avgDailyConsumption` (which carries the backend's forecast_rate -- see
 * mapDetailToRecommendation) as a flat reference line instead: the true
 * value, honestly shown as flat because that is genuinely what the backend
 * computed, not a fabricated month-by-month curve. */
export function ForecastVsActualChart({
  recommendations = RECOMMENDATIONS,
}: {
  recommendations?: Recommendation[]
}) {
  const [windowSize, setWindowSize] = useState<WindowValue>("6")

  const data = useMemo(() => {
    const series = aggregateConsumption(recommendations).slice(-Number(windowSize))
    if (USING_LIVE_DATA) {
      const forecastRate = recommendations.reduce((sum, r) => sum + r.avgDailyConsumption, 0)
      return series.map((p) => ({
        period: p.period,
        actual: p.qty,
        forecast: Math.round(forecastRate * 10) / 10,
      }))
    }
    const forecast = oneStepAheadForecast(series.map((p) => p.qty))
    return series.map((p, i) => ({
      period: p.period,
      actual: p.qty,
      forecast: Math.round(forecast[i] * 10) / 10,
    }))
  }, [recommendations, windowSize])

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <p>No consumption history available.</p>
        <p className="max-w-xs">
          The backend does not currently return a consumption time series per recommendation — this chart has
          nothing to plot until that data is added to the API.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Show:</span>
        <Select value={windowSize} onValueChange={(v) => setWindowSize((v ?? "6") as WindowValue)}>
          <SelectTrigger className="h-7 w-36 text-xs">
            <SelectValue placeholder="Last 6 Months">
              {(v: string) => WINDOW_OPTIONS.find((o) => o.value === v)?.label ?? v}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {WINDOW_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="period" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={32}
              allowDecimals={false}
            />
            <Tooltip content={ForecastTooltip} cursor={{ stroke: "var(--border)" }} />
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
          <span
            className="inline-block w-3 shrink-0 border-t-2 border-dashed"
            style={{ borderColor: FORECAST_COLOR }}
          />
          Forecast
        </div>
      </div>
    </div>
  )
}
