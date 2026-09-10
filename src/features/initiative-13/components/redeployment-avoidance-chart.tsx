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

import { formatZARCompact } from "@/lib/utils"

function AvoidanceTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value
  if (typeof value !== "number") return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">{formatZARCompact(value)}</div>
      <div className="mt-0.5 text-muted-foreground">{label} · avoided repurchase</div>
    </div>
  )
}

/** Estimated purchase-avoidance value from redeployment candidates. */
export function RedeploymentAvoidanceChart({
  data,
}: {
  data: { label: string; avoidedValue: number }[]
}) {
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={40}
            tickFormatter={(v: number) => formatZARCompact(v)}
          />
          <Tooltip content={AvoidanceTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <Bar dataKey="avoidedValue" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
