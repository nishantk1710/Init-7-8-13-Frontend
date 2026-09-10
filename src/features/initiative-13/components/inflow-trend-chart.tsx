"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

function InflowTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">{value} lines</div>
      <div className="mt-0.5 text-muted-foreground">{label}</div>
    </div>
  )
}

/** Monthly inflow of new Non-Moving / Slow-Moving materials into OAR tracking. */
export function InflowTrendChart({ data }: { data: { month: string; inflow: number }[] }) {
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} width={28} allowDecimals={false} />
          <Tooltip content={InflowTooltip} cursor={{ stroke: "var(--border)" }} />
          <Line
            type="monotone"
            dataKey="inflow"
            name="NM/SM inflow"
            stroke="var(--chart-5)"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2, stroke: "var(--card)", fill: "var(--chart-5)" }}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
