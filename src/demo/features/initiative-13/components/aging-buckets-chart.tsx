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

const BUCKET_COLORS = ["var(--chart-3)", "var(--chart-4)", "var(--chart-2)", "var(--destructive)", "var(--destructive)"]

function AgingTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as { bucket: string; count: number } | undefined
  if (!point) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">{point.count} lines</div>
      <div className="mt-0.5 text-muted-foreground">{point.bucket}</div>
    </div>
  )
}

/** Aging-bucket distribution for unutilized OAR lines. */
export function AgingBucketsChart({ data }: { data: { bucket: string; count: number }[] }) {
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="bucket" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} width={28} allowDecimals={false} />
          <Tooltip content={AgingTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
