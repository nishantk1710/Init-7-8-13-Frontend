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

/** Aggregate consumption for whichever recommendations are in view, against a
 * one-step-ahead exponential-smoothing forecast of that same series. */
export function ForecastVsActualChart({
  recommendations = RECOMMENDATIONS,
}: {
  recommendations?: Recommendation[]
}) {
  const [windowSize, setWindowSize] = useState<WindowValue>("6")

  const data = useMemo(() => {
    const series = aggregateConsumption(recommendations).slice(-Number(windowSize))
    const forecast = oneStepAheadForecast(series.map((p) => p.qty))
    return series.map((p, i) => ({
      period: p.period,
      actual: p.qty,
      forecast: Math.round(forecast[i] * 10) / 10,
    }))
  }, [recommendations, windowSize])

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
