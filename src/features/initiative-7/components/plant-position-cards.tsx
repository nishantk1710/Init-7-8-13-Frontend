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

import { Skeleton } from "@/components/ui/skeleton"
import { formatCount } from "@/lib/utils"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import type { PlantPositionsState } from "@/features/initiative-7/hooks/use-plant-positions"
import {
  formatShare,
  positionBars,
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
  { noun: string; loadError: string; note: string }
> = {
  stockoutRisk: {
    noun: "below their reorder point",
    loadError: "Could not load the stockout risk position from the backend.",
    note: "Material-plants whose stock on hand is below the recommended reorder point, as of the latest recommendation run. An internal definition, not yet confirmed by the business.",
  },
  excess: {
    noun: "above the recommended maximum",
    loadError: "Could not load the excess inventory position from the backend.",
    note: "Material-plants whose current maximum stock is above the recommended maximum, as of the latest recommendation run. A count, not a money value. An internal definition, not yet confirmed by the business.",
  },
}

function PositionTooltip({ active, payload, noun }: TooltipContentProps & { noun: string }) {
  const bar = payload?.[0]?.payload as BarDatum | undefined
  if (!active || !bar) return null
  const share = formatShare(bar.value, bar.total)
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{bar.name}</div>
      <div className="mt-1 text-muted-foreground">
        <span className="font-medium text-foreground">{formatCount(bar.value)}</span> of {formatCount(bar.total)}{" "}
        material-plants {noun}
        {share ? ` (${share})` : ""}
      </div>
    </div>
  )
}

/** The body of one card, from a loaded state. Separate from the card so each state (loading, error,
 * nothing to count, bars) can be rendered and tested on its own. */
export function PlantPositionView({ state, metric }: { state: PlantPositionsState; metric: PositionMetric }) {
  const copy = METRIC_COPY[metric]
  if (state.loading) return <Skeleton className="h-[220px] w-full" />
  if (state.error) {
    return (
      <div className="flex h-[220px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <p>{copy.loadError}</p>
        <p className="max-w-xs">{state.error.message}</p>
      </div>
    )
  }
  const bars = positionBars(state.positions, metric)
  if (bars.length === 0 || bars.every((bar) => bar.total === 0)) {
    return (
      <div className="flex h-[220px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <p>No recommendations to count yet.</p>
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
              content={(props: TooltipContentProps) => <PositionTooltip {...props} noun={copy.noun} />}
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
      <p className="text-[11px] text-muted-foreground">{copy.note}</p>
      <p className="text-[11px] text-muted-foreground">
        The history of how this changes run by run builds up from the next recommendation runs.
      </p>
    </div>
  )
}

export function StockoutPositionCard({ state }: { state: PlantPositionsState }) {
  return <PlantPositionView state={state} metric="stockoutRisk" />
}

export function ExcessPositionCard({ state }: { state: PlantPositionsState }) {
  return <PlantPositionView state={state} metric="excess" />
}
