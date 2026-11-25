"use client"

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts"

import { parseDecimal } from "@/features/initiative-7/services/reverse-conversion-api"
import type { ApiReverseConsumption } from "@/features/initiative-7/types/reverse-conversion"
import { formatFigure, formatYearMonth } from "@/features/initiative-7/utils/reverse-conversion-query"

// Colours are CSS variables, never hard-coded: the latest 12 months (the window the rule counts) in the chart's
// first colour, the 12 months before it muted.
const LATEST_COLOR = "var(--chart-1)"
const PRIOR_COLOR = "var(--muted-foreground)"

export interface ChartPoint {
  month: string
  label: string
  quantity: number
  issues: number
  reversals: number
  latest: boolean
}

/** The chart's data: one point per month, with the months of the latest window marked. Pure, so it is tested. */
export function chartPoints(consumption: ApiReverseConsumption): ChartPoint[] {
  return consumption.months.map((m) => ({
    month: m.month,
    label: formatYearMonth(m.month).replace(/ (\d{2})(\d{2})$/, " '$2"),
    quantity: Math.max(parseDecimal(m.net_issued_quantity) ?? 0, 0),
    issues: m.issue_count,
    reversals: m.reversal_count,
    latest: m.month >= consumption.latest_window_start,
  }))
}

function ConsumptionTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload as ChartPoint
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{formatYearMonth(point.month)}</div>
      <div className="text-muted-foreground">
        {point.quantity > 0 ? `${formatFigure(point.quantity, 3)} issued (net of reversals)` : "No consumption"}
      </div>
      <div className="text-muted-foreground">
        {point.issues} issue{point.issues === 1 ? "" : "s"}
        {point.reversals > 0 ? `, ${point.reversals} reversal${point.reversals === 1 ? "" : "s"}` : ""}
      </div>
    </div>
  )
}

/** Net quantity issued each month for the last 24 months. Months with no bar had no consumption. */
export function ConsumptionChart({ consumption }: { consumption: ApiReverseConsumption }) {
  const points = chartPoints(consumption)
  const boundary = points.find((p) => p.latest)?.label
  return (
    <div className="flex flex-col gap-2">
      <div className="h-52 w-full" role="img" aria-label="Monthly consumption for the last 24 months">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={10} interval={1} />
            <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} width={40} allowDecimals={false} />
            <Tooltip content={ConsumptionTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
            {boundary && <ReferenceLine x={boundary} stroke="var(--border)" strokeDasharray="4 3" />}
            <Bar dataKey="quantity" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {points.map((p) => (
                <Cell key={p.month} fill={p.latest ? LATEST_COLOR : PRIOR_COLOR} fillOpacity={p.latest ? 1 : 0.45} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: LATEST_COLOR }} aria-hidden="true" />
          Latest 12 months (what the rule counts)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm opacity-50" style={{ background: PRIOR_COLOR }} aria-hidden="true" />
          The 12 months before
        </span>
        <span>Units issued per month, net of reversals</span>
      </div>
    </div>
  )
}
