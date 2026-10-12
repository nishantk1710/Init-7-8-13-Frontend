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

import type { RepairChain, RepairStatus } from "@demo/features/initiative-8/types/repair"
import { REPAIR_STATUS_ORDER } from "@demo/features/initiative-8/utils/status"
import { formatCount } from "@demo/lib/utils"

const STATUS_COLORS: Record<RepairStatus, string> = {
  "PR Raised": "var(--chart-4)",
  "PO Issued": "var(--chart-1)",
  "At Vendor": "var(--chart-2)",
  Received: "var(--chart-3)",
  Closed: "var(--muted-foreground)",
  // The vendor found it not worth repairing: the one outcome that ends in a
  // write-off, so it reads in the destructive colour, as its badge does.
  Scrapped: "var(--destructive)",
}

function StatusTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  if (!point || typeof point.value !== "number") return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">
        {formatCount(point.value)} repair {point.value === 1 ? "line" : "lines"}
      </div>
      <div className="mt-0.5 text-muted-foreground">{String(point.payload?.status)}</div>
    </div>
  )
}

/**
 * Repair lines by repair status. Every status keeps its bar, empty ones
 * included, so the axis does not shift as the Overview's filters narrow the
 * lines — a missing "Scrapped" bar would read as "not tracked", not "none".
 */
export function RepairStatusChart({ chains }: { chains: RepairChain[] }) {
  const data = REPAIR_STATUS_ORDER.map((status) => ({
    status,
    count: chains.filter((c) => c.repairStatus === status).length,
  }))

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="status"
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
              <Cell key={d.status} fill={STATUS_COLORS[d.status]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
