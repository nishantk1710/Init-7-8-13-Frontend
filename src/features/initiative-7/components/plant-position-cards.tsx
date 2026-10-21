"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

import { ChartLoader } from "@/components/shared/chart-loader"
import { formatCount, formatIsoDateDMY } from "@/lib/utils"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import type { PlantPositionsState } from "@/features/initiative-7/hooks/use-plant-positions"
import {
  formatShare,
  positionBars,
  stockoutAsOf,
  type PositionBar,
  type PositionMetric,
  type PositionScope,
} from "@/features/initiative-7/utils/plant-position"

// The Overview's Stockout risk and Excess inventory cards: today's position for All plants and each
// plant, as counts of material-plants. A history of past runs is built separately; until it exists
// these show the current position rather than an empty card.

const SCOPE_NAME: Record<PositionScope, string> = {
  ALL: "All plants",
  "1300": sapPlantLabel("1300"),
  "1500": sapPlantLabel("1500"),
}

const SCOPE_COLOR: Record<PositionScope, string> = {
  ALL: "var(--chart-5)",
  "1300": "var(--chart-3)",
  "1500": "var(--chart-1)",
}

interface BarDatum extends PositionBar {
  name: string
}

/** "Black Mountain (1300)" -> "Black Mountain": three full names do not fit under the bars of a
 * narrow card, and the tooltip still carries the full name and plant code. */
export function shortAxisName(name: string): string {
  return name.replace(/\s*\(\d+\)$/, "")
}

function toData(bars: PositionBar[]): BarDatum[] {
  return bars.map((bar) => ({ ...bar, name: bar.scope === "ALL" ? "All plants" : SCOPE_NAME[bar.scope] }))
}

const METRIC_COPY: Record<
  PositionMetric,
  { noun: string; population: string; loadError: string; empty: string; note: (asOf: string | null) => string }
> = {
  stockoutRisk: {
    noun: "at stockout risk",
    population: "judged material-plants",
    loadError: "Could not load the stockout risk position from the backend.",
    empty: "No material-plants could be judged yet.",
    note: (asOf) =>
      `Fast and slow moving material-plants whose stock on hand is below their average daily consumption times their supplier lead time${
        asOf ? `, as of ${formatIsoDateDMY(asOf)}` : ""
      }. Material-plants with no lead time or stock figure are left out as insufficient data.`,
  },
  excess: {
    noun: "above the recommended maximum",
    population: "material-plants",
    loadError: "Could not load the excess inventory position from the backend.",
    empty: "No recommendations to count yet.",
    note: () =>
      "Material-plants whose current maximum stock is above the recommended maximum, as of the latest recommendation analysis. A count, not a money value.",
  },
}

function PositionTooltip({
  active,
  payload,
  noun,
  population,
}: TooltipContentProps & { noun: string; population: string }) {
  const bar = payload?.[0]?.payload as BarDatum | undefined
  if (!active || !bar) return null
  const share = formatShare(bar.value, bar.total)
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{bar.name}</div>
      <div className="mt-1 text-muted-foreground">
        <span className="font-medium text-foreground">{formatCount(bar.value)}</span> of {formatCount(bar.total)}{" "}
        {population} {noun}
        {share ? ` (${share})` : ""}
      </div>
    </div>
  )
}

/** The body of one card, from a loaded state. Separate from the card so each state (loading, error,
 * nothing to count, bars) can be rendered and tested on its own. */
export function PlantPositionView({ state, metric }: { state: PlantPositionsState; metric: PositionMetric }) {
  const copy = METRIC_COPY[metric]
  if (state.loading) return <ChartLoader label="Loading the chart" className="h-[220px] w-full" />
  if (state.error) {
    return (
      <div className="flex h-[220px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <p>{copy.loadError}</p>
        <p className="max-w-xs">{state.error.message}</p>
      </div>
    )
  }
  // The stockout counts are 0 -- not "none at risk" -- until the usage they are built from exists.
  if (metric === "stockoutRisk" && state.positions.length > 0 && stockoutAsOf(state.positions) === null) {
    return (
      <div className="flex h-[220px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <p>Not available</p>
        <p className="max-w-xs">The stockout usage has not been built yet, so nothing can be judged.</p>
      </div>
    )
  }
  const bars = positionBars(state.positions, metric)
  if (bars.length === 0 || bars.every((bar) => bar.total === 0)) {
    return (
      <div className="flex h-[220px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <p>{copy.empty}</p>
      </div>
    )
  }
  const data = toData(bars)
  return (
    <div className="flex flex-col gap-2">
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="name"
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              interval={0}
              tickFormatter={shortAxisName}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={44}
              allowDecimals={false}
              tickFormatter={(value: number) => formatCount(value)}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              content={(props: TooltipContentProps) => (
                <PositionTooltip {...props} noun={copy.noun} population={copy.population} />
              )}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((bar) => (
                <Cell key={bar.scope} fill={SCOPE_COLOR[bar.scope]} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                fontSize={11}
                fill="var(--foreground)"
                formatter={(value: unknown) => (typeof value === "number" ? formatCount(value) : "")}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-muted-foreground">{copy.note(stockoutAsOf(state.positions))}</p>
    </div>
  )
}

export function StockoutPositionCard({ state }: { state: PlantPositionsState }) {
  return <PlantPositionView state={state} metric="stockoutRisk" />
}

export function ExcessPositionCard({ state }: { state: PlantPositionsState }) {
  return <PlantPositionView state={state} metric="excess" />
}
