"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

import type { RepairChain } from "@/features/initiative-8/types/repair"
import { AGING_BUCKETS } from "@/features/initiative-8/utils/status"
import { formatCount } from "@/lib/utils"

const BUCKET_COLORS = [
  "var(--chart-3)",
  "var(--chart-1)",
  "var(--chart-4)",
  "var(--chart-2)",
  "var(--destructive)",
]

function AgingTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  if (!point || typeof point.value !== "number") return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">{formatCount(point.value)} chains</div>
      <div className="mt-0.5 text-muted-foreground">{String(point.payload?.bucket)} days open</div>
    </div>
  )
}

export function RepairAgingChart({ chains }: { chains: RepairChain[] }) {
  const open = chains.filter((c) => c.repairStatus !== "Closed")
  const data = AGING_BUCKETS.map((bucket) => ({
    bucket,
    count: open.filter((c) => c.agingBucket === bucket).length,
  }))

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="bucket"
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
          <Tooltip content={AgingTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={d.bucket} fill={BUCKET_COLORS[i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
