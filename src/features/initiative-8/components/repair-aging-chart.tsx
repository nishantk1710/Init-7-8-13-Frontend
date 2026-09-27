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
import { DEFAULT_AGING_BUCKETS, isOpenRepair } from "@/features/initiative-8/utils/status"
import { formatCount } from "@/lib/utils"

// Cycled by index rather than a 1:1 array, since the band count is backend
// configuration (I8_AGING_BAND_BOUNDARIES) and is not always five.
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

export function RepairAgingChart({
  chains,
  bands = DEFAULT_AGING_BUCKETS,
}: {
  chains: RepairChain[]
  /** The active aging bands, from `LiveRegister.agingBands` in live mode.
   *  Defaults to the fixed bands the fixtures were written against. */
  bands?: string[]
}) {
  // Still out -- the register's own definition of open, so the bars add up to
  // the "open repair lines" figure beside them.
  const open = chains.filter(isOpenRepair)
  const data = bands.map((bucket) => ({
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
              <Cell key={d.bucket} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
