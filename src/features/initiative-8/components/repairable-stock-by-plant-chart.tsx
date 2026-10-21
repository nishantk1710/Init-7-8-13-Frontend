"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

import { formatCount } from "@/lib/utils"

function PlantTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  if (!point || typeof point.value !== "number") return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">{formatCount(point.value)} units on hand</div>
      <div className="mt-0.5 text-muted-foreground">{label}</div>
    </div>
  )
}

/**
 * Stock on hand by plant. Aggregated by `stockByPlant` in
 * `data/live-overview.ts` over the repairable universe — one row per material
 * and plant — rather than over register lines, where a material with three
 * repairs would have its stock counted three times.
 */
export function RepairableStockByPlantChart({
  data,
}: {
  data: { plant: string; stock: number }[]
}) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="plant"
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
            width={28}
            allowDecimals={false}
          />
          <Tooltip content={PlantTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <Bar
            dataKey="stock"
            fill="var(--chart-3)"
            radius={[4, 4, 0, 0]}
            maxBarSize={56}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
