"use client"

import { useMemo } from "react"
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

import type { ApiVendorTurnaround } from "@/lib/api/i8"
import {
  THIN_TURNAROUND_SAMPLE,
  TURNAROUND_LIMIT,
  turnaroundBars,
  type TurnaroundBar,
} from "@/features/initiative-8/utils/overview-view"
import { clipVendor, VENDOR_LABEL_WIDTH } from "@/features/initiative-8/components/repairs-by-vendor-chart"
import { formatCount } from "@/lib/utils"

/**
 * Vendor turnaround — dispatch (the 541) to goods receipt, in days.
 *
 * FR-10 asks for this and FR-3 defines the window. This replaced a six-column
 * table on 13-Oct-2026: the table answered the question but took a whole card
 * to say what one bar per vendor says at a glance, and the Snapshot screen had
 * been showing it as bars all along.
 *
 * ## Only measurable vendors are drawn, and the caller must say so
 *
 * An average needs BOTH ends of the clock — a 541 and a goods receipt on the
 * same line. Most vendors on the live register have neither, and a vendor
 * missing from a turnaround chart reads as "this vendor has no repairs", which
 * is a different and wrong claim. So this draws what can be measured and
 * returns the counts the caller needs to say what it left out; the card's
 * footnote carries that sentence.
 *
 * ## Why the sample size travels with every average
 *
 * Plenty of vendors have one or two measurable repairs, and a mean of one is
 * not a record of anything. The tooltip always states how many repairs the
 * average came from, and a thin sample is called out rather than printed as if
 * it were a rate.
 */

function TurnaroundTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  if (!point || typeof point.value !== "number") return null
  const row = point.payload as TurnaroundBar
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">
        {formatCount(point.value)} days on average
      </div>
      <div className="mt-0.5 text-muted-foreground">{row.vendor}</div>
      <div className="mt-0.5 text-muted-foreground">
        from {formatCount(row.sample)} completed repair
        {row.sample === 1 ? "" : "s"}
        {row.minDays !== null && row.maxDays !== null && row.sample > 1
          ? ` · ${row.minDays}–${row.maxDays} days`
          : ""}
      </div>
      {/* A mean of one or two is an anecdote. Marked, never hidden. */}
      {row.sample < THIN_TURNAROUND_SAMPLE && (
        <div className="mt-1 text-warning">
          Too few repairs to read as a rate.
        </div>
      )}
      {row.openCount > 0 && (
        <div className="mt-1 text-muted-foreground">
          {formatCount(row.openCount)} still open
          {row.overdueCount > 0 && ` · ${formatCount(row.overdueCount)} overdue`}
        </div>
      )}
    </div>
  )
}

export function VendorTurnaroundChart({
  vendors,
  limit = TURNAROUND_LIMIT,
}: {
  vendors: ApiVendorTurnaround[]
  limit?: number
}) {
  const { bars } = useMemo(() => turnaroundBars(vendors, limit), [vendors, limit])

  if (bars.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border px-6 text-center text-xs text-muted-foreground">
        No vendor turnaround could be measured. Turnaround needs a dispatch
        (541) and a goods receipt on the same line, and no closed repair line in
        this data has both.
      </div>
    )
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={bars}
          layout="vertical"
          // Room on the right for the day count written at the bar's end.
          margin={{ top: 4, right: 40, left: 0, bottom: 4 }}
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
            unit="d"
          />
          <YAxis
            type="category"
            dataKey="vendor"
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={VENDOR_LABEL_WIDTH}
            tickMargin={8}
            tickFormatter={clipVendor}
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
