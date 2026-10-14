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

import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatCount, formatMoney } from "@/lib/utils"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { useRecommendationTrends, type RecommendationTrendsState } from "@/features/initiative-7/hooks/use-recommendation-trends"
import type { TrendPlant } from "@/features/initiative-7/services/i7-api"
import {
  excessSeries,
  formatTrendDate,
  formatTrendDateTime,
  opportunityCurrency,
  stockoutSeries,
  type ChartPoint,
  type ExcessChartPoint,
} from "@/features/initiative-7/utils/trend-series"

// The Overview's two trend cards. Both draw what the backend saved when each recommendation run
// finished (GET /recommendations/trends): one point per saved run, placed at its real time. They
// never fill a gap and never show zero for a day nothing was recorded.

const STOCKOUT_COLOR = "var(--chart-5)"
const COUNT_COLOR = "var(--chart-3)"
const MONEY_COLOR = "var(--chart-1)"

const PLANT_TABS: { value: TrendPlant; label: string }[] = [
  { value: "ALL", label: "All plants" },
  { value: "1300", label: sapPlantLabel("1300") },
  { value: "1500", label: sapPlantLabel("1500") },
]

function PlantTabs({ plant, onChange }: { plant: TrendPlant; onChange: (plant: TrendPlant) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Plant">
      {PLANT_TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={plant === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "rounded-md border px-2 py-0.5 text-[11px] transition-colors",
            plant === tab.value
              ? "border-primary bg-primary/10 font-medium text-foreground"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function Message({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-[220px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
      <p>{title}</p>
      {children && <p className="max-w-xs">{children}</p>}
    </div>
  )
}

/** The x-axis for a few points or many: a real time scale, padded by a day when there is only
 * one snapshot so it still draws a dot instead of a degenerate axis. */
function timeDomain(points: { t: number }[]): [number, number] {
  const times = points.map((point) => point.t)
  const first = Math.min(...times)
  const last = Math.max(...times)
  const DAY = 24 * 60 * 60 * 1000
  return first === last ? [first - DAY, last + DAY] : [first, last]
}

function sourceLabel(source: ChartPoint["source"]): string {
  return source === "captured" ? "Recorded when the run finished" : "Rebuilt later from stored recommendations"
}

function TooltipBox({ children, t }: { children: React.ReactNode; t: number }) {
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{formatTrendDateTime(t)}</div>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Stockout risk trend
// ---------------------------------------------------------------------------------------------

function StockoutTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as ChartPoint | undefined
  if (!active || !point) return null
  return (
    <TooltipBox t={point.t}>
      <div className="mt-1 text-muted-foreground">
        Below reorder point: <span className="font-medium text-foreground">{formatCount(point.value ?? 0)}</span>
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sourceLabel(point.source)}</div>
    </TooltipBox>
  )
}

/** The body of the Stockout risk trend card, from a loaded state. Separate from the card so each
 * state (loading, error, no history, chart) can be rendered and tested on its own. */
export function StockoutTrendView({ state }: { state: RecommendationTrendsState }) {
  const { data, loading, error } = state
  if (loading) return <Skeleton className="h-[220px] w-full" />
  if (error) {
    return (
      <Message title="Could not load the stockout risk history from the backend.">{error.message}</Message>
    )
  }
  const series = data ? stockoutSeries(data) : []
  if (!data || series.length === 0) {
    return (
      <Message title="No stockout history yet.">
        It starts with the first recommendation run recorded after this was switched on. Earlier days cannot be
        shown: the stock on hand of those days was not saved, and today&apos;s stock is not applied to them.
      </Message>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={timeDomain(series)}
              tickFormatter={formatTrendDate}
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={40}
              allowDecimals={false}
              domain={[0, "auto"]}
              tickFormatter={(value: number) => formatCount(value)}
            />
            <Tooltip content={StockoutTooltip} cursor={{ stroke: "var(--border)" }} />
            <Line
              type="monotone"
              dataKey="value"
              name="Below reorder point"
              stroke={STOCKOUT_COLOR}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 2, stroke: "var(--card)", fill: STOCKOUT_COLOR }}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Material-plants whose stock on hand was below the recommended reorder point when each run finished. An
        internal definition, not yet confirmed by the business.
      </p>
    </div>
  )
}

export function StockoutRiskTrendCard() {
  const [plant, setPlant] = useState<TrendPlant>("ALL")
  const state = useRecommendationTrends(plant)
  return (
    <div className="flex flex-col gap-3">
      <PlantTabs plant={plant} onChange={setPlant} />
      <StockoutTrendView state={state} />
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Excess inventory trend
// ---------------------------------------------------------------------------------------------

function ExcessTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as (ExcessChartPoint & { currencyLabel: string | null }) | undefined
  if (!active || !point) return null
  return (
    <TooltipBox t={point.t}>
      <div className="mt-1 text-muted-foreground">
        Excess material-plants: <span className="font-medium text-foreground">{formatCount(point.count)}</span>
      </div>
      <div className="mt-0.5 text-muted-foreground">
        Estimated opportunity:{" "}
        <span className="font-medium text-foreground">
          {point.opportunity === null
            ? "not available (no priced excess)"
            : point.currency
              ? formatMoney(point.opportunity, point.currency)
              : `${formatMoney(point.opportunity, null)} (currency not stated)`}
        </span>
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sourceLabel(point.source)}</div>
    </TooltipBox>
  )
}

/** The body of the Excess inventory card, from a loaded state. */
export function ExcessTrendView({ state }: { state: RecommendationTrendsState }) {
  const { data, loading, error } = state
  if (loading) return <Skeleton className="h-[220px] w-full" />
  if (error) {
    return <Message title="Could not load the excess inventory history from the backend.">{error.message}</Message>
  }
  const series = data ? excessSeries(data) : []
  if (!data || series.length === 0) {
    return (
      <Message title="No excess inventory history yet.">
        It fills in as recommendation runs are recorded, one point per run.
      </Message>
    )
  }
  const currency = opportunityCurrency(series)
  return (
    <div className="flex flex-col gap-2">
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={timeDomain(series)}
              tickFormatter={formatTrendDate}
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <YAxis
              yAxisId="count"
              orientation="left"
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={40}
              allowDecimals={false}
              domain={[0, "auto"]}
              tickFormatter={(value: number) => formatCount(value)}
            />
            <YAxis
              yAxisId="money"
              orientation="right"
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={56}
              domain={[0, "auto"]}
              tickFormatter={(value: number) => formatMoney(value, currency).replace(/\.\d+/, "")}
            />
            <Tooltip content={ExcessTooltip} cursor={{ stroke: "var(--border)" }} />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="count"
              name="Excess material-plants"
              stroke={COUNT_COLOR}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 2, stroke: "var(--card)", fill: COUNT_COLOR }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="money"
              type="monotone"
              dataKey="opportunity"
              name="Estimated opportunity"
              stroke={MONEY_COLOR}
              strokeWidth={2}
              strokeDasharray="4 3"
              connectNulls={false}
              dot={{ r: 3, strokeWidth: 2, stroke: "var(--card)", fill: MONEY_COLOR }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 shrink-0" style={{ backgroundColor: COUNT_COLOR }} />
          Excess material-plants (left)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 shrink-0 border-t-2 border-dashed" style={{ borderColor: MONEY_COLOR }} />
          Estimated opportunity{currency ? ` (${currency})` : ""} (right)
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        An estimate, not confirmed savings: unit price × how far the current max stock is above the recommended
        one. {currency === null && "The currency is not stated for these points. "}
        {data.reconstructedCount > 0 &&
          `${data.reconstructedCount} earlier point${data.reconstructedCount === 1 ? " was" : "s were"} rebuilt from stored recommendations, not recorded at the time. `}
        An internal definition, not yet confirmed by the business.
      </p>
    </div>
  )
}

export function ExcessInventoryTrendCard() {
  const [plant, setPlant] = useState<TrendPlant>("ALL")
  const state = useRecommendationTrends(plant)
  return (
    <div className="flex flex-col gap-3">
      <PlantTabs plant={plant} onChange={setPlant} />
      <ExcessTrendView state={state} />
    </div>
  )
}
