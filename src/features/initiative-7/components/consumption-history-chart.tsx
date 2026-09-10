"use client"

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, type TooltipContentProps } from "recharts"

import type { ConsumptionPoint } from "@/features/initiative-7/types/inventory"

function ConsumptionTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  if (!point || typeof point.value !== "number") return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-0.5 text-muted-foreground">{point.value} units consumed</div>
    </div>
  )
}

/** Compact 6-month consumption sparkline backing the "Consumption history" factor. */
export function ConsumptionHistoryChart({ data }: { data: ConsumptionPoint[] }) {
  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="30%">
          <XAxis dataKey="period" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={10} />
          <Tooltip content={ConsumptionTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <Bar dataKey="qty" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
