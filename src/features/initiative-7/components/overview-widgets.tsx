"use client"

// The Inventory Planning Overview's own widgets, shared with the Q2 2026 report so the two draw the same
// chart from the same figures: the Stockout Risk Distribution and the SAP adoption card.

import { BarChart, Bar, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, type TooltipContentProps } from "recharts"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChartLoader } from "@/components/shared/chart-loader"
import { ALL_FILTER } from "@/features/initiative-7/components/dashboard-filters"
import { InventoryHealthCard } from "@/features/initiative-7/components/inventory-health-card"
import type { AdoptionSummaryResult } from "@/features/initiative-7/services/i7-api"
import { formatCount, formatIsoDateDMY } from "@/lib/utils"

function AdoptionStatusTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  // The real count, never `displayCount` -- the bar's rendered width is
  // padded for zero-count visibility (see statusData), but the tooltip must
  // report what actually happened, not the padded sliver.
  const count = point?.payload?.count
  if (typeof count !== "number") return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">{count}</div>
      <div className="mt-0.5 text-muted-foreground">{point.payload?.status}</div>
    </div>
  )
}

// The only two plants MARC/OAR data actually covers (see CLAUDE.md's
// "Plant coverage gap" -- raw_marc holds 1300/1200 only, and every
// MRP-type/OAR-adjacent figure elsewhere in I07 is scoped to Black Mountain and
// Gamsberg specifically, never the other SAP plant codes that show up
// elsewhere in the extract as unrelated noise for this initiative). Real SAP
// plant codes, human names hardcoded here since no plant-code -> name
// mapping exists anywhere in this codebase yet (PLANTS in
// lib/shared-data/plants.ts is scenario-only master data keyed on invented
// ids like PLANT-GBG, not real SAP WERKS codes).
export const ADOPTION_PLANTS: { code: string; name: string }[] = [
  { code: "1300", name: "Black Mountain" },
  { code: "1500", name: "Gamsberg" },
]

/** FR-9's adoption rate, from the persisted recommendation ledger
 * (i7_sap_adoption) -- real counts, never a fabricated rate. `null`
 * adoptionRatePercentage (every evaluated row still UNKNOWN, the current
 * state of this data extract) renders as an explicit "Not yet measured"
 * state, never a 0%. totalEvaluated only grows as recommendations are
 * viewed through the adoption endpoints -- this is not a portfolio-wide
 * figure on day one.
 *
 * `plant`/`onPlantChange` are this card's own filter, separate from the
 * page's sidebar Plant filter -- the ledger has no plant column of its own
 * (see fetchAdoptionSummary's docstring), so this is a dedicated backend
 * param, not something the sidebar selection could drive for free. */
export function AdoptionRateCard({
  summary,
  loading = false,
  failed = false,
  plant,
  onPlantChange,
  showPlantPicker = true,
  emptyMessage,
}: {
  summary: AdoptionSummaryResult | null
  loading?: boolean
  failed?: boolean
  plant: string
  onPlantChange: (plant: string) => void
  /** False when the page's own Plant filter is set: that one decides, and a second picker would
   * only disagree with it. */
  showPlantPicker?: boolean
  /** Said under the chart when there is no summary at all (e.g. a report that did not capture adoption),
   * in place of the "could not load" line, which would blame the backend for something that is not one. */
  emptyMessage?: string
}) {
  const plantPicker = showPlantPicker && (
    <div className="mb-3 flex justify-end">
      <Select value={plant} onValueChange={(v) => onPlantChange(v ?? ALL_FILTER)}>
        <SelectTrigger className="h-8 w-48">
          <SelectValue placeholder="All">
            {(v: string) =>
              v === ALL_FILTER ? "All" : `${ADOPTION_PLANTS.find((p) => p.code === v)?.name} (${v})`
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_FILTER}>All</SelectItem>
          {ADOPTION_PLANTS.map((p) => (
            <SelectItem key={p.code} value={p.code}>
              {p.name} ({p.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  // While the counts are being fetched a spinning circle stands in for the chart: neither the previous filter's bars nor a
  // chart of zeros, either of which reads as a real answer. As tall as the chart, so the card does not change size.
  if (loading) {
    return (
      <div className="flex w-full flex-col items-stretch gap-2">
        {plantPicker}
        <ChartLoader label="Loading SAP adoption" className="h-[290px] w-full" />
      </div>
    )
  }

  // The chart is always drawn, with zero bars when there is nothing to count, so the
  // card keeps its shape; a line under it says why the counts are empty.
  const shown: AdoptionSummaryResult = summary ?? {
    totalEvaluated: 0,
    adoptedCount: 0,
    partiallyAdoptedCount: 0,
    notAdoptedCount: 0,
    unknownCount: 0,
    adoptionRatePercentage: null,
  }
  const emptyReason = emptyMessage && !summary
    ? emptyMessage
    : loading
    ? "Loading adoption counts..."
    : failed
      ? "Could not load the adoption counts from the backend."
      : shown.totalEvaluated === 0
        ? "No recommendations with a change to adopt yet."
        : null

  const rateKnown = shown.adoptionRatePercentage !== null

  const statusCounts = [
    { status: "Adopted", count: shown.adoptedCount, color: "var(--chart-3)" },
    { status: "Partially adopted", count: shown.partiallyAdoptedCount, color: "var(--chart-4)" },
    { status: "Not adopted", count: shown.notAdoptedCount, color: "var(--destructive)" },
    { status: "Pending", count: shown.unknownCount, color: "var(--muted-foreground)" },
  ]
  // A real but zero count renders as a zero-width bar -- invisible, and
  // indistinguishable from the color simply being wrong. displayCount gives
  // every status a sliver just wide enough to show its color and be
  // findable/hoverable; the tooltip and axis still read the real `count`.
  const maxCount = Math.max(1, ...statusCounts.map((d) => d.count))
  const statusData = statusCounts.map((d) => ({
    ...d,
    displayCount: d.count === 0 ? maxCount * 0.015 : d.count,
  }))

  return (
    <div className="flex w-full flex-col items-stretch gap-2">
      {plantPicker}
      <div className="text-center">
        <div className="text-lg font-semibold text-foreground">
          {rateKnown ? `${shown.adoptionRatePercentage}% adoption rate` : "Not yet measured"}
        </div>
        <div className="text-xs text-muted-foreground">
          {rateKnown
            ? "adopted or partially adopted, of recommendations with SAP evidence"
            : "no SAP change-document evidence observed for any tracked recommendation"}
        </div>
      </div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={statusData}
            layout="vertical"
            margin={{ top: 4, right: 32, left: 16, bottom: 4 }}
          >
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis
              type="category"
              dataKey="status"
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={110}
            />
            <RechartsTooltip content={AdoptionStatusTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
            <Bar dataKey="displayCount" radius={[0, 4, 4, 0]} isAnimationActive={false} barSize={20}>
              {statusData.map((d) => (
                <Cell key={d.status} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {statusData.map((d) => (
          <div key={d.status} className="flex items-center gap-1.5 text-xs">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-foreground">{d.status}</span>
            <span className="tabular-nums text-muted-foreground">{d.count}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        {emptyReason ?? `${shown.totalEvaluated} recommendation(s) tracked. Pending means SAP has recorded no change yet.`}
      </p>
    </div>
  )
}

/** What the Stockout Risk Distribution is drawn from: the High Stockout Risk card's own figures. */
export interface StockoutFigures {
  atRisk: number
  /** The material-plants that could be judged -- the denominator of the share. */
  evaluated: number
  /** Fast / Slow material-plants that could not be judged. Never counted as safe. */
  insufficient: number
  /** ISO date the usage was read as of; null = the usage has not been built. */
  asOf: string | null
}

/** The Stockout Risk Distribution, on the same definition as the High Stockout Risk card and the
 * stockout-by-plant chart: Fast / Slow moving material-plants whose stock on hand is below average
 * daily consumption x lead time. High is the at-risk count (the card's figure), Low the judged
 * material-plants that are not at risk, and the shares are of those judged -- the card's own
 * denominator. Material-plants that could not be judged are never counted as safe: they are named
 * under the legend instead. */
export function StockoutRiskDistribution({
  figures,
  unavailable,
  loading = false,
}: {
  figures: StockoutFigures | null
  unavailable?: string
  /** The figures are being fetched: a spinning circle, not "Not available", for the moments they take to arrive. */
  loading?: boolean
}) {
  if (loading) {
    return <ChartLoader label="Loading stockout risk distribution" className="h-[150px] w-full" />
  }
  if (!figures || figures.asOf === null) {
    return (
      <div className="flex h-[150px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <p>Not available</p>
        <p className="max-w-xs">{figures ? "needs the stockout usage build" : (unavailable ?? "not available from the backend")}</p>
      </div>
    )
  }
  const { atRisk, evaluated, insufficient, asOf } = figures
  return (
    <InventoryHealthCard
      recommendations={[]}
      visibleTiers={["high", "low"]}
      riskOverride={{
        counts: [
          { level: "high", count: atRisk },
          { level: "low", count: Math.max(evaluated - atRisk, 0) },
        ],
        total: evaluated,
      }}
      footnote={`High: stock on hand below average daily consumption times lead time. As of ${formatIsoDateDMY(asOf)}${
        insufficient > 0 ? ` · ${formatCount(insufficient)} need data, not counted above` : ""
      }.`}
    />
  )
}
