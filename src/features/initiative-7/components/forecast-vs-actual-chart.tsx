"use client"

import { useEffect, useMemo, useState } from "react"
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
import { fetchForecastHistory, type ForecastHistory } from "@/features/initiative-7/services/i7-api"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import { aggregateConsumption } from "@/features/initiative-7/utils/inventory-calc"

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

/** A cold-start (OAR) material has no forecast: its reorder point, safety stock and max stock
 * are estimated from similar materials, not from its own usage. Drawing a "Forecast" line at
 * zero for it would say the model predicts no demand, which it never did -- so the chart hides
 * the line instead. Only decided for a single material; several in view keep the flat line. */
export function hasNoForecast(recommendations: Recommendation[]): boolean {
  if (recommendations.length !== 1) return false
  const [only] = recommendations
  return only.oarColdStart != null || only.demandPattern === "Cold start"
}

export interface ChartPoint {
  period: string
  actual: number | null
  forecast: number | null
}

/** The flat-line fallback series: the actual monthly usage, with the backend's single forecast
 * rate drawn flat across it -- or no forecast value at all when `noForecast`, so the point is
 * missing rather than zero. */
export function flatSeries(
  actuals: { period: string; qty: number }[],
  forecastRate: number,
  noForecast: boolean,
): ChartPoint[] {
  return actuals.map((p) => ({
    period: p.period,
    actual: p.qty,
    forecast: noForecast ? null : Math.round(forecastRate * 10) / 10,
  }))
}

/** Aggregate consumption for whichever recommendations are in view.
 *
 * This must NOT recompute a forecast client-side: the backend's real model
 * (SBA/Croston, see app/initiatives/i7/forecasting/service.py) already
 * produced the real number, persisted as a single scalar `forecast_rate`
 * (one monthly demand-rate figure, not a per-period series -- confirmed
 * against the schema/DB). A client-side smoothing recompute here would
 * silently diverge from the number that actually drove the recommendation's
 * ROP/Safety Stock. So this plots the real `avgDailyConsumption` (which
 * carries the backend's forecast_rate -- see mapDetailToRecommendation) as a
 * flat reference line instead: the true value, honestly shown as flat
 * because that is genuinely what the backend computed, not a fabricated
 * month-by-month curve. */
export function ForecastVsActualChart({
  recommendations,
}: {
  recommendations: Recommendation[]
}) {
  const [windowSize, setWindowSize] = useState<WindowValue>("6")

  // Real per-period champion-model history only exists per material-plant
  // (GET .../forecast-history), not portfolio-wide -- so it's only fetched
  // (and only replaces the flat-line fallback below) when exactly one
  // recommendation is in view. Multiple materials in view keep the existing
  // flat-line-of-forecast_rate behaviour unchanged.
  const soleRecommendationId = recommendations.length === 1 ? recommendations[0].id : null
  const [liveHistory, setLiveHistory] = useState<ForecastHistory | null>(null)

  useEffect(() => {
    if (!soleRecommendationId) {
      setLiveHistory(null)
      return
    }
    let cancelled = false
    fetchForecastHistory(soleRecommendationId)
      .then((history) => {
        if (!cancelled) setLiveHistory(history)
      })
      .catch(() => {
        if (!cancelled) setLiveHistory(null)
      })
    return () => {
      cancelled = true
    }
  }, [soleRecommendationId])

  const usingRealHistory = Boolean(soleRecommendationId && liveHistory && liveHistory.points.length > 0)

  const noForecast = hasNoForecast(recommendations)

  const data = useMemo(() => {
    const series = aggregateConsumption(recommendations).slice(-Number(windowSize))

    if (soleRecommendationId && liveHistory && liveHistory.points.length > 0) {
      // Real model output: plot exactly what i7_forecast_backtest_path holds,
      // windowed the same way as the other branches, never recomputed.
      return liveHistory.points.slice(-Number(windowSize)).map((p) => ({
        period: p.period,
        actual: p.actual,
        forecast: noForecast ? null : p.predicted,
      }))
    }

    // No persisted backtest history yet for this view (multi-material, or a
    // material-plant with no forecast run since the table shipped) -- fall
    // back to the honest flat reference line: the real forecast_rate that
    // drove the recommendation, never a fabricated month-by-month curve.
    const forecastRate = recommendations.reduce((sum, r) => sum + r.avgDailyConsumption, 0)
    return flatSeries(series, forecastRate, noForecast)
  }, [recommendations, windowSize, soleRecommendationId, liveHistory, noForecast])

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <p>No usage history to show.</p>
        <p className="max-w-xs">
          {recommendations.length === 1
            ? "No usage has been recorded for this material at this plant, so there is nothing to chart. Materials without history are sized from similar materials instead."
            : "These materials carry no monthly history in this view. Use the portfolio Forecast vs Actual chart for the whole portfolio."}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-muted-foreground">
        {noForecast
          ? "Actual monthly usage. There is no forecast for this material: its reorder point, safety stock and max stock are estimated from similar materials, not from its own usage."
          : usingRealHistory
          ? `Real model output (${liveHistory?.modelName ?? "champion model"}): each point is that model's own rolling-origin prediction against what actually happened, never recomputed.`
          : "Actual consumption against the backend's own forecast demand rate — one monthly figure, shown flat, not a fabricated month-by-month curve. (No persisted backtest history yet for this view.)"}
      </p>
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
            {!noForecast && (
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
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 shrink-0" style={{ backgroundColor: ACTUAL_COLOR }} />
          Actual
        </div>
        {!noForecast && (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 shrink-0 border-t-2 border-dashed"
              style={{ borderColor: FORECAST_COLOR }}
            />
            Forecast
          </div>
        )}
      </div>
    </div>
  )
}
