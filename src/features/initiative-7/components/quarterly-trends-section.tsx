"use client"

// Monthly trends and the quarter-end position of a generated quarterly report, from its saved KPI snapshots.
//
// A month is what was measured at the time: one with no snapshot is a gap in the line, with a line under the chart naming
// it, never a zero and never rebuilt from today's data. A stockout reading that was too old for its month is not a point.
// The quarter-end position is the last month's snapshot, shown only when it is valid; if it is not, the card says why and
// which snapshot is the latest available -- it never shows an earlier month as the quarter-end.
//
// Working capital here is an *estimate* of what the recommendations would change, not a realised saving, and each card
// says so behind its (i), with the report's own notes on how the months were measured.

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts"

import { ChartCard } from "@/components/shared/chart-card"
import { InfoPopup, type InfoTone } from "@/components/shared/info-popup"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCount, formatIsoDateDMY } from "@/lib/utils"
import type { ApiQuarterTrends } from "@/features/initiative-7/types/api"
import {
  compactMoney,
  hasPoints,
  num,
  seriesGaps,
  trendPoints,
  type TrendPoint,
} from "@/features/initiative-7/utils/quarterly-management"

type SeriesKey = "stockout" | "excessOpportunity" | "workingCapital"

const SERIES: {
  key: SeriesKey
  title: string
  subtitle: string
  /** What the figure is, said once, behind the card's (i). */
  about: string
  color: string
  tone: InfoTone
  money: boolean
}[] = [
  {
    key: "stockout",
    title: "At stockout risk",
    subtitle: "Materials at risk each month",
    about: "Materials whose stock was below what their lead time needs, as measured at the end of each month.",
    color: "var(--destructive)",
    tone: "danger",
    money: false,
  },
  {
    key: "excessOpportunity",
    title: "Excess inventory opportunity",
    subtitle: "Stock above the recommended maximum",
    about: "Estimated value of stock above the recommended maximum at the end of each month. An estimate, not a saving.",
    color: "var(--chart-1)",
    tone: "info",
    money: true,
  },
  {
    key: "workingCapital",
    title: "Working capital impact",
    subtitle: "Cash freed (+) or tied up (−)",
    about:
      "Estimated cash freed (+) or tied up (−) if every recommended reorder point were adopted, at the end of each month. An estimate, not a realised saving.",
    color: "var(--chart-3)",
    tone: "success",
    money: true,
  },
]

function TrendTooltip({ active, payload, label, money, currency }: TooltipContentProps & { money: boolean; currency: string | null }) {
  const value = payload?.[0]?.value
  if (!active || typeof value !== "number") return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-1 text-muted-foreground">
        {money ? compactMoney(value, currency, true) : formatCount(Math.round(value))}
      </div>
    </div>
  )
}

/** One measure over the quarter's months, as a card of the Overview's own kind: a title, one line, the chart with each
 * month's value on its point (so there is no table to read), and an (i) for the detail. A month with no figure is a gap in
 * the line -- never a zero -- and the card says which, in one line under the chart. */
function TrendCard({
  trends,
  points,
  series,
  currency,
}: {
  trends: ApiQuarterTrends
  points: TrendPoint[]
  series: (typeof SERIES)[number]
  currency: string | null
}) {
  const drawable = hasPoints(points, series.key)
  const gaps = seriesGaps(points, series.key)
  const show = (value: number) =>
    series.money ? compactMoney(value, currency, series.key === "workingCapital") : formatCount(Math.round(value))
  // Why a month has no figure, and what the report says about how it was measured: for the (i), not the card.
  const notes = [...trends.months.filter((m) => m.note).map((m) => `${m.label}: ${m.note}`), ...trends.notes]
  return (
    <ChartCard
      title={series.title}
      subtitle={series.subtitle}
      span={4}
      info={
        <InfoPopup title={series.title} description={series.about} tone={series.tone}>
          {notes.length > 0 ? (
            <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm text-muted-foreground">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Every month of the quarter has a saved snapshot.</p>
          )}
        </InfoPopup>
      }
      footnote={drawable && gaps.length > 0 ? `No figure for ${gaps.join(", ")}.` : undefined}
    >
      {drawable ? (
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 22, right: 24, left: 24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
              {/* The values are on the points, so the axis only sets the scale. */}
              <YAxis hide domain={series.money ? ["auto", "auto"] : [0, "auto"]} />
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
                label={{
                  position: "top",
                  fontSize: 11,
                  fill: "var(--foreground)",
                  formatter: (value: unknown) => (typeof value === "number" ? show(value) : ""),
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[180px] items-center justify-center text-center text-xs text-muted-foreground">
          No month has a measured value yet.
        </div>
      )}
    </ChartCard>
  )
}

/** The three monthly measures, each its own card in the report's grid -- the way the Overview lays out its charts. */
export function MonthlyTrends({ trends }: { trends: ApiQuarterTrends }) {
  const points = trendPoints(trends)
  const currency = trends.months.find((m) => m.currency)?.currency ?? null
  return (
    <>
      {SERIES.map((series) => (
        <TrendCard key={series.key} trends={trends} points={points} series={series} currency={currency} />
      ))}
    </>
  )
}

/** The closing position of the period: the last month's saved snapshot. For a monthly report that month is the whole
 * period, so ``period`` is ``"month"`` and the card says "Month-end"; a quarterly report says "Quarter-end". */
export function QuarterEndCard({ trends, period = "quarter" }: { trends: ApiQuarterTrends; period?: "quarter" | "month" }) {
  const end = trends.quarter_end
  const available = end.status === "AVAILABLE"
  return (
    <ChartCard
      title={period === "month" ? "Month-end position" : "Quarter-end position"}
      subtitle={
        available && end.measured_on
          ? `The saved ${end.label} month-end snapshot, measured ${formatIsoDateDMY(end.measured_on)}.`
          : `The last month's saved snapshot, shown only when it is valid for the end of the ${period}.`
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
              It is not shown as the {period}-end.
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
