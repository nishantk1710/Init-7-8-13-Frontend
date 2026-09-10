"use client"

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

import { formatCount, formatZARCompact } from "@/lib/utils"
import type { MonthlyCount } from "@/features/initiative-7/data/monitoring-series"

export type TrendValueFormat = "count" | "zar"

const FORMATTERS: Record<TrendValueFormat, (v: number) => string> = {
  count: (v) => formatCount(v),
  zar: (v) => formatZARCompact(v),
}

/** Generic single-series monthly trend line, used for both the stockout-risk
 * count trend and the excess-inventory ZAR-opportunity trend. `format` picks
 * the value formatter internally (a function prop can't cross the
 * Server->Client boundary from the pages that render this). */
export function TrendLineChart({
  data,
  color = "var(--chart-1)",
  format = "count",
  height = 220,
}: {
  data: MonthlyCount[]
  color?: string
  format?: TrendValueFormat
  height?: number
}) {
  const valueFormatter = FORMATTERS[format]

  function TrendTooltip({ active, payload, label }: TooltipContentProps) {
    if (!active || !payload?.length) return null
    const point = payload[0]
    if (!point || typeof point.value !== "number") return null
    return (
      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
        <div className="font-medium text-foreground">{label}</div>
        <div className="mt-0.5 text-muted-foreground">{valueFormatter(point.value)}</div>
      </div>
    )
  }

  return (
    <div className="h-full w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={40}
            tickFormatter={valueFormatter}
          />
          <Tooltip content={TrendTooltip} cursor={{ stroke: "var(--border)" }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2, stroke: "var(--card)", fill: color }}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
