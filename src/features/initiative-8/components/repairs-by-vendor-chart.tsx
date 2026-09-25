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

function VendorTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  if (!point || typeof point.value !== "number") return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">
        {formatCount(point.value)} open repair lines
      </div>
      <div className="mt-0.5 text-muted-foreground">{label}</div>
    </div>
  )
}

/**
 * Open repair lines per vendor — a count, never a turnaround. The counting
 * (and the "Unknown vendor" grouping) lives in `openLinesByVendor` in
 * `data/live-overview.ts`; this only draws what it is handed.
 */
export function RepairsByVendorChart({ data }: { data: { vendor: string; count: number }[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="vendor"
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={150}
          />
          <Tooltip content={VendorTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <Bar
            dataKey="count"
            fill="var(--chart-1)"
            radius={[0, 4, 4, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
