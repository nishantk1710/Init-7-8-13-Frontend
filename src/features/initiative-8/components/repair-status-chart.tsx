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

import type { RepairChain, RepairStatus } from "@/features/initiative-8/types/repair"
import { formatCount } from "@/lib/utils"

const STATUS_ORDER: RepairStatus[] = [
  "PR Raised",
  "PO Issued",
  "At Vendor",
  "In Transit Return",
  "Received",
  "Closed",
]

const STATUS_COLORS: Record<RepairStatus, string> = {
  "PR Raised": "var(--chart-4)",
  "PO Issued": "var(--chart-1)",
  "At Vendor": "var(--chart-2)",
  "In Transit Return": "var(--chart-5)",
  Received: "var(--chart-3)",
  Closed: "var(--muted-foreground)",
}

function StatusTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  if (!point || typeof point.value !== "number") return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">
        {formatCount(point.value)} chains
      </div>
      <div className="mt-0.5 text-muted-foreground">{String(point.payload?.status)}</div>
    </div>
  )
}

export function RepairStatusChart({ chains }: { chains: RepairChain[] }) {
  const data = STATUS_ORDER.map((status) => ({
    status,
    count: chains.filter((c) => c.repairStatus === status).length,
  })).filter((d) => d.count > 0)

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
