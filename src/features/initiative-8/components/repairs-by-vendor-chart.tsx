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
 * How much room the vendor names get.
 *
 * 150px was enough for the fixtures and is not enough for the real register:
 * live names come from LFA1 and run long, and the lines with no PO header are
 * grouped under "Unknown vendor". At 150 they collided with their own bars.
 */
export const VENDOR_LABEL_WIDTH = 210

/** Longest name drawn in full; beyond this it is clipped and the tooltip has it. */
const MAX_VENDOR_LABEL = 26

/** A name that fits the axis. The full one is still in the tooltip. */
export function clipVendor(value: string): string {
  return value.length > MAX_VENDOR_LABEL ? `${value.slice(0, MAX_VENDOR_LABEL - 1)}…` : value
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
          // Gap between bars, as a share of the band. Without it the bars sit
          // tight against each other and the names read as one block.
          barCategoryGap="28%"
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
            width={VENDOR_LABEL_WIDTH}
            // The gap between the name and the start of its bar.
            tickMargin={8}
            tickFormatter={clipVendor}
          />
          {/* The tooltip carries the FULL name, which is why clipping the axis
              label is safe: nothing is unreachable, only shortened. */}
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
