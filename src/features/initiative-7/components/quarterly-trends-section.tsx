"use client"

// Monthly trends and the quarter-end position of a generated quarterly report, from its saved KPI snapshots.
//
// A month is what was measured at the time: one with no snapshot is a gap in the line and a "No snapshot" row, never a
// zero and never rebuilt from today's data. A stockout reading that was too old for its month is not a point. The
// quarter-end position is the last month's snapshot, shown only when it is valid; if it is not, the card says why and
// which snapshot is the latest available -- it never shows an earlier month as the quarter-end.
//
// Working capital here is an *estimate* of what the recommendations would change, and the change between months is the
// movement in that estimate. Neither is a realised saving, and the section says so.

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts"

import { ChartCard } from "@/components/shared/chart-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatCount, formatIsoDateDMY } from "@/lib/utils"
import type { ApiQuarterTrends } from "@/features/initiative-7/types/api"
import {
  hasPoints,
  millions,
  monthBasisLabel,
  num,
  trendPoints,
  type TrendPoint,
} from "@/features/initiative-7/utils/quarterly-management"

type SeriesKey = "stockout" | "excessOpportunity" | "workingCapital"

const SERIES: { key: SeriesKey; title: string; subtitle: string; color: string; money: boolean }[] = [
  { key: "stockout", title: "At stockout risk", subtitle: "Material-plants, as of each month", color: "var(--destructive)", money: false },
  { key: "excessOpportunity", title: "Excess inventory opportunity", subtitle: "Estimated value above the recommended maximum", color: "var(--chart-1)", money: true },
  { key: "workingCapital", title: "Working capital impact", subtitle: "Estimate if recommended reorder points were adopted", color: "var(--chart-3)", money: true },
]

function TrendTooltip({ active, payload, label, money, currency }: TooltipContentProps & { money: boolean; currency: string | null }) {
  const value = payload?.[0]?.value
  if (!active || typeof value !== "number") return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-1 text-muted-foreground">
        {money ? millions(value, currency, true) : formatCount(Math.round(value))}
      </div>
    </div>
  )
}

function MiniTrend({
  points,
  series,
  currency,
}: {
  points: TrendPoint[]
  series: (typeof SERIES)[number]
  currency: string | null
}) {
  const drawable = hasPoints(points, series.key)
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border p-3">
      <div className="text-sm font-medium text-foreground">{series.title}</div>
      <div className="text-[11px] text-muted-foreground">{series.subtitle}</div>
      {drawable ? (
        <div className="mt-2 h-[140px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis
                stroke="var(--muted-foreground)"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                width={48}
                tickFormatter={(v: number) => (series.money ? `${(v / 1_000_000).toFixed(0)}M` : formatCount(Math.round(v)))}
              />
              <Tooltip
                cursor={{ stroke: "var(--border)" }}
                content={(props: TooltipContentProps) => <TrendTooltip {...props} money={series.money} currency={currency} />}
              />
              {/* connectNulls off: a month with no measurement breaks the line instead of being joined across. */}
              <Line
                type="monotone"
                dataKey={series.key}
                stroke={series.color}
                strokeWidth={2}
                connectNulls={false}
                dot={{ r: 3, strokeWidth: 2, stroke: "var(--card)", fill: series.color }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-2 flex h-[140px] items-center justify-center text-center text-xs text-muted-foreground">
          No month has a measured value yet.
        </div>
      )}
    </div>
  )
}

const STATE_TONE = { FINAL: "success", OPEN: "warning", MISSING: "default" } as const

export function MonthlyTrends({ trends }: { trends: ApiQuarterTrends }) {
  const points = trendPoints(trends)
  const currency = trends.months.find((m) => m.currency)?.currency ?? null
  return (
    <ChartCard
      title="Monthly trends"
      subtitle="What was measured at the time, from saved monthly snapshots. A month with no snapshot is blank, not zero."
      span={12}
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {SERIES.map((series) => (
          <MiniTrend key={series.key} points={points} series={series} currency={currency} />
        ))}
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Month</TableHead>
              <TableHead>Measured</TableHead>
              <TableHead className="text-right">At stockout risk</TableHead>
              <TableHead className="text-right">Excess opportunity</TableHead>
              <TableHead className="text-right">Working capital estimate</TableHead>
              <TableHead className="text-right">Change from last month</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trends.months.map((m) => (
              <TableRow key={m.month}>
                <TableCell>
                  <div className="font-medium text-foreground">{m.label}</div>
                  <StatusBadge tone={STATE_TONE[m.state]}>{monthBasisLabel(m)}</StatusBadge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {m.measured_on ? formatIsoDateDMY(m.measured_on) : "—"}
                  {m.revision && m.revision > 1 ? ` · revision ${m.revision}` : ""}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.stockout_at_risk === null ? <span className="text-muted-foreground">—</span> : formatCount(m.stockout_at_risk)}
                  {m.stockout_evaluated !== null && (
                    <div className="text-[11px] text-muted-foreground">of {formatCount(m.stockout_evaluated)} judged</div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{millions(num(m.excess_opportunity), m.currency)}</TableCell>
                <TableCell className="text-right tabular-nums">{millions(num(m.net_rop_value_impact), m.currency, true)}</TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    num(m.net_rop_change_from_previous) === null
                      ? "text-muted-foreground"
                      : (num(m.net_rop_change_from_previous) ?? 0) < 0
                        ? "text-warning"
                        : "text-success",
                  )}
                >
                  {millions(num(m.net_rop_change_from_previous), m.currency, true)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="mt-3 flex list-disc flex-col gap-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">
        {trends.months
          .filter((m) => m.note)
          .map((m) => (
            <li key={m.month}>
              <span className="font-medium text-foreground">{m.label}:</span> {m.note}
            </li>
          ))}
        {trends.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
        <li>
          Counts are positions on a date: each month shows its own, and they are never added into a quarter total. A negative
          change means more cash tied up than the month before.
        </li>
      </ul>
    </ChartCard>
  )
}

export function QuarterEndCard({ trends }: { trends: ApiQuarterTrends }) {
  const end = trends.quarter_end
  const available = end.status === "AVAILABLE"
  return (
    <ChartCard
      title="Quarter-end position"
      subtitle={
        available && end.measured_on
          ? `The saved ${end.label} month-end snapshot, measured ${formatIsoDateDMY(end.measured_on)}.`
          : "The last month's saved snapshot, shown only when it is valid for the end of the quarter."
      }
      span={12}
    >
      {available ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Stock level</TableHead>
                <TableHead className="text-right">Current (SAP), mean</TableHead>
                <TableHead className="text-right">Recommended, mean</TableHead>
                <TableHead className="text-right">Records</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {end.stock_levels.map((level) => (
                <TableRow key={level.key}>
                  <TableCell>{level.label}</TableCell>
                  {[level.current, level.recommended].map((value, i) => (
                    <TableCell key={i} className="text-right tabular-nums">
                      {num(value) === null ? <span className="text-muted-foreground">Not available</span> : (num(value) as number).toFixed(1)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatCount(level.records)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 py-2 text-center">
          <p className="text-sm font-medium text-foreground">Not available</p>
          <p className="mx-auto max-w-xl text-xs leading-relaxed text-muted-foreground">{end.reason}</p>
          {end.latest_available_label && end.latest_available_measured_on && (
            <p className="mx-auto max-w-xl text-xs leading-relaxed text-muted-foreground">
              The latest snapshot available is {end.latest_available_label}, measured {formatIsoDateDMY(end.latest_available_measured_on)}.
              It is not shown as the quarter-end.
            </p>
          )}
        </div>
      )}
      {available && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Means over the recommendations in force on the last day of the month, counting only those with both a current and
          a recommended value, so Records says how many each is over.
        </p>
      )}
    </ChartCard>
  )
}
