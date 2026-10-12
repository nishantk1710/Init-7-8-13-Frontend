"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

import type { RepairChain } from "@demo/features/initiative-8/types/repair"
import { formatCount } from "@demo/lib/utils"

export interface VendorTurnaround {
  vendor: string
  /** Whole days, averaged over the vendor's lines that came back. */
  averageDays: number
  lines: number
  fastestDays: number
  slowestDays: number
}

/**
 * Average dispatch-to-receipt days per vendor (FR-3, FR-10, AC 9), slowest
 * first. Only lines with a `turnaroundDays` count: a line still out has no
 * turnaround yet, and averaging its days so far in would flatter the slow
 * vendors, whose lines are the ones still out.
 */
export function vendorTurnaround(lines: RepairChain[]): VendorTurnaround[] {
  const byVendor = new Map<string, number[]>()
  for (const line of lines) {
    if (line.turnaroundDays === undefined) continue
    byVendor.set(line.vendor, [...(byVendor.get(line.vendor) ?? []), line.turnaroundDays])
  }
  return [...byVendor]
    .map(([vendor, days]) => ({
      vendor,
      averageDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
      lines: days.length,
      fastestDays: Math.min(...days),
      slowestDays: Math.max(...days),
    }))
    .sort((a, b) => b.averageDays - a.averageDays || a.vendor.localeCompare(b.vendor))
}

function TurnaroundTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  if (!point || typeof point.value !== "number") return null
  const row = point.payload as VendorTurnaround
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">
        {formatCount(point.value)} days on average
      </div>
      <div className="mt-0.5 text-muted-foreground">{row.vendor}</div>
      <div className="mt-0.5 text-muted-foreground">
        {formatCount(row.lines)} {row.lines === 1 ? "line" : "lines"} fully back
        {row.lines > 1 && ` · ${row.fastestDays}–${row.slowestDays} days`}
      </div>
    </div>
  )
}

/** Vendor turnaround as horizontal bars, the average written at the bar's end. */
export function VendorTurnaroundChart({ data }: { data: VendorTurnaround[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
        No repair line in this view has come back from its vendor yet.
      </div>
    )
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 36, left: 0, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            allowDecimals={false}
            unit="d"
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
          <Tooltip content={TurnaroundTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <Bar
            dataKey="averageDays"
            fill="var(--chart-2)"
            radius={[0, 4, 4, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="averageDays"
              position="right"
              fontSize={11}
              fill="var(--muted-foreground)"
              formatter={(value) => `${value}d`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
