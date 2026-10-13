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
import { repairStatusBuckets } from "@/features/initiative-8/utils/overview-view"
import { formatCount } from "@/lib/utils"

function StatusTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  if (!point || typeof point.value !== "number") return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">
        {formatCount(point.value)} repair {point.value === 1 ? "line" : "lines"}
      </div>
      <div className="mt-0.5 text-muted-foreground">{String(point.payload?.label)}</div>
    </div>
  )
}

/**
 * Repair lines by lifecycle stage.
 *
 * The bucketing — including why Received and Closed share a bar, and why there
 * is no requisition stage — lives in `repairStatusBuckets` in
 * `utils/overview-view.ts`, where it is unit-tested. This only draws what it
 * is handed, the same split `RepairsByVendorChart` uses.
 */
export function RepairStatusChart({ chains }: { chains: RepairChain[] }) {
  const data = repairStatusBuckets(chains)

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            interval={0}
            angle={-15}
            textAnchor="end"
            height={44}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={28}
            allowDecimals={false}
          />
          <Tooltip content={StatusTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
