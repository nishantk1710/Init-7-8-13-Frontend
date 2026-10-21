// Part 22 — I07 complete frontend live data integration.
//
// Live counterpart to overview-workspace.tsx's InventoryOptimizationOverviewWorkspace.
// The KPI/chart components (InventoryPortfolioKpis, InventoryHealthCard) are the same ones; only the
// data source differs. There is no Forecast vs Actual chart and no Recommendation status chart here:
// the Overview is about stockout and excess position and SAP adoption, not forecast accuracy (the
// quarterly report has that) or where a recommendation sits in the approval flow (the Action Center
// and Approvals own that).
//
// The filter rail's Plant, Criticality, Demand Pattern and Recommendation (OAR / Stock item)
// narrow the KPI row, the distribution, both plant cards and the SAP adoption counts, each through
// the backend call that produces its figure -- never by filtering one fetched page in the browser.

"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

import { ChartCard } from "@/components/shared/chart-card"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ALL_FILTER,
  DashboardFilters,
  EMPTY_DASHBOARD_FILTERS,
  type DashboardFilterState,
} from "@/features/initiative-7/components/dashboard-filters"
import { InventoryHealthCard } from "@/features/initiative-7/components/inventory-health-card"
import { InventoryPortfolioKpis } from "@/features/initiative-7/components/inventory-portfolio-kpis"
import {
  ExcessPositionCard,
  StockoutPositionCard,
} from "@/features/initiative-7/components/plant-position-cards"
import { usePlantPositions } from "@/features/initiative-7/hooks/use-plant-positions"
import { useLiveAdoption, useLiveAdoptionSummary } from "@/features/initiative-7/hooks/use-live-adoption"
import { useLiveRecommendationSummary } from "@/features/initiative-7/hooks/use-live-recommendation-summary"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import type { AdoptionSummaryResult, RecommendationSummaryStats } from "@/features/initiative-7/services/i7-api"
import type { Criticality, DemandPattern } from "@/features/initiative-7/types/inventory"
import { DEMAND_CLASS_FOR_PATTERN } from "@/features/initiative-7/utils/recommendation-list-query"
import { formatCount, formatIsoDateDMY } from "@/lib/utils"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

// The ZMM065 tier behind each display level, for the summary endpoint (which filters on the raw
// tier). Low has none: it is NORMAL, OBSOLETE or no tier at all, which one value cannot express.
const CRITICALITY_RAW_TIER: Partial<Record<Criticality, string>> = {
  Critical: "CRITICAL",
  High: "IMPACT",
  Medium: "INSURANCE",
}

// The backend list endpoint's own MAX_PAGE_SIZE ceiling (see
// app/api/i7/recommendations.py). Fetched once and filtered client-side,
// same as the recommendations workspace/table -- see that component's own
// note on why the whole set (not one page) is needed for these KPIs/charts.
const LIVE_OVERVIEW_PAGE_SIZE = 200

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
const ADOPTION_PLANTS: { code: string; name: string }[] = [
  { code: "1300", name: "Black Mountain" },
  { code: "1500", name: "Gamsberg" },
]

// The Plant filter's options: real SAP plant codes. The default list is scenario data keyed on
// invented ids (PLANT-GBG), which never equal a live row's plant, so choosing one matched nothing.
const PLANT_OPTIONS = ADOPTION_PLANTS.map((p) => ({ value: p.code, label: sapPlantLabel(p.code) }))

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
function AdoptionRateCard({
  summary,
  loading = false,
  failed = false,
  plant,
  onPlantChange,
  showPlantPicker = true,
}: {
  summary: AdoptionSummaryResult | null
  loading?: boolean
  failed?: boolean
  plant: string
  onPlantChange: (plant: string) => void
  /** False when the page's own Plant filter is set: that one decides, and a second picker would
   * only disagree with it. */
  showPlantPicker?: boolean
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
  const emptyReason = loading
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

/** The Stockout Risk Distribution, on the same definition as the High Stockout Risk card and the
 * stockout-by-plant chart: Fast / Slow moving material-plants whose stock on hand is below average
 * daily consumption x lead time. High is the at-risk count (the card's figure), Low the judged
 * material-plants that are not at risk, and the shares are of those judged -- the card's own
 * denominator. Material-plants that could not be judged are never counted as safe: they are named
 * under the legend instead. */
function StockoutRiskDistribution({
  summary,
  unavailable,
}: {
  summary: RecommendationSummaryStats | null
  unavailable: string | undefined
}) {
  if (!summary || summary.stockoutRiskAsOf === null) {
    return (
      <div className="flex h-[150px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <p>Not available</p>
        <p className="max-w-xs">{summary ? "needs the stockout usage build" : (unavailable ?? "not available from the backend")}</p>
      </div>
    )
  }
  const atRisk = summary.criticalStockoutRiskCount
  const evaluated = summary.stockoutRiskEvaluatedCount
  const insufficient = summary.stockoutRiskInsufficientDataCount
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
      footnote={`High: stock on hand below average daily consumption times lead time. As of ${formatIsoDateDMY(summary.stockoutRiskAsOf)}${
        insufficient > 0 ? ` · ${formatCount(insufficient)} need data, not counted above` : ""
      }.`}
    />
  )
}

const TYPE_LABEL: Record<"oar" | "stock_item", string> = { oar: "OAR", stock_item: "stock item" }

export function LiveInventoryOptimizationOverviewWorkspace() {
  const [filters, setFilters] = useState<DashboardFilterState>(EMPTY_DASHBOARD_FILTERS)
  // Plant, Criticality, Demand Pattern and the Recommendation type are asked of the backend, not
  // applied to whichever 200 rows happen to be newest: a plant or tier with no rows among them would
  // otherwise read as "nothing matches". The KPIs, the distribution, both plant cards and the SAP
  // adoption counts take the same four, so they all follow the filters.
  const plantParam = filters.plant !== ALL_FILTER ? filters.plant : undefined
  const demandClassParam = DEMAND_CLASS_FOR_PATTERN[filters.demandPattern as DemandPattern]
  const criticalityLevel = filters.criticality !== ALL_FILTER ? filters.criticality : undefined
  const typeParam = filters.type === "oar" || filters.type === "stock_item" ? filters.type : undefined
  const isOarParam = typeParam === undefined ? undefined : typeParam === "oar"
  const { data, loading, error, refetch } = useLiveRecommendations({
    pageSize: LIVE_OVERVIEW_PAGE_SIZE,
    plant: plantParam,
    demandClass: demandClassParam,
    criticalityLevel,
    type: typeParam,
  })
  const criticalityTier = criticalityLevel ? CRITICALITY_RAW_TIER[criticalityLevel as Criticality] : undefined
  const {
    summary: scopedSummary,
    loading: summaryLoading,
    error: summaryError,
  } = useLiveRecommendationSummary({
    plant: plantParam,
    demandClass: demandClassParam,
    criticality: criticalityTier,
    isOar: isOarParam,
  })
  // The summary cannot be narrowed to Low, so for Low it would read as the whole portfolio under a
  // filter that says otherwise. Without it the KPIs and charts count the rows fetched above.
  const criticalityCannotNarrow = Boolean(criticalityLevel && !criticalityTier)
  const summary = criticalityCannotNarrow ? null : scopedSummary
  // High Stockout Risk is a portfolio figure; counting the fetched rows in its place would pass a
  // page of 200 off as the portfolio, so without a summary the card says why it has no number.
  const stockoutUnavailable = summary
    ? undefined
    : criticalityCannotNarrow
      ? "cannot be narrowed to this criticality"
      : summaryError
        ? "could not be loaded from the backend"
        : summaryLoading
          ? "loading…"
          : "not available from the backend"
  // Stockout and excess by plant follow the rail too: with a plant chosen only that plant's bar is
  // drawn, and the other three filters narrow every bar.
  const livePositions = usePlantPositions({
    plant: plantParam,
    isOar: isOarParam,
    demandClass: demandClassParam,
    criticality: criticalityTier,
    enabled: !criticalityCannotNarrow,
  })
  const plantPositions = criticalityCannotNarrow
    ? { positions: [], loading: false, error: new Error("These counts cannot be narrowed to this criticality.") }
    : livePositions
  // Own plant filter, independent of the sidebar's Plant filter -- lets
  // someone compare adoption by plant without changing what the rest of the
  // page shows (see get_adoption_summary's own docstring for why this needs
  // a dedicated backend param rather than reading it off the sidebar
  // selection: the ledger has no plant column of its own). Once the sidebar has a plant, that one
  // decides and this picker goes away.
  const [adoptionPlant, setAdoptionPlant] = useState<string>(ALL_FILTER)
  const { summary: adoptionSummary, loading: adoptionLoading, error: adoptionError } = useLiveAdoptionSummary({
    plant: plantParam ?? (adoptionPlant === ALL_FILTER ? undefined : adoptionPlant),
    type: typeParam,
    demandClass: demandClassParam,
    criticalityLevel,
  })
  // Adoption is a separate reconciliation, keyed by recommendation id, not a
  // field on Recommendation itself (see use-live-adoption.ts) -- fetched at
  // the same page size and joined in below so the "SAP Adoption" filter has
  // something to read. Only covers material-plants with something to adopt
  // (the backend's own /recommendations/adoption scope), so a row absent from this map has no
  // adoption status to filter on at all -- treated as "Unknown" below, the same value a genuinely
  // evaluated-but-no-evidence row gets, since neither has anything to show.
  // Only needed to filter the page by SAP adoption: fetching 200 adoption rows on every
  // visit would look each one up in SAP's change history for nothing.
  const { items: adoptionItems } = useLiveAdoption(
    { pageSize: LIVE_OVERVIEW_PAGE_SIZE },
    { enabled: filters.sapAdoption !== ALL_FILTER },
  )
  const adoptionByRecommendationId = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of adoptionItems ?? []) map.set(row.recommendationId, row.status)
    return map
  }, [adoptionItems])

  const filtered = useMemo(() => {
    if (!data) return []
    const query = filters.material.trim().toLowerCase()
    return data.filter((r) => {
      if (filters.plant !== ALL_FILTER && r.plantId !== filters.plant) return false
      if (filters.criticality !== ALL_FILTER && r.criticality !== filters.criticality) return false
      if (filters.demandPattern !== ALL_FILTER && r.demandPattern !== filters.demandPattern) return false
      if (typeParam === "oar" && r.demandType !== "OAR") return false
      if (typeParam === "stock_item" && r.demandType === "OAR") return false
      if (filters.sapAdoption !== ALL_FILTER) {
        const adoptionStatus = adoptionByRecommendationId.get(r.id) ?? "Unknown"
        if (adoptionStatus !== filters.sapAdoption) return false
      }
      if (query) {
        const haystack = `${r.material.materialId} ${r.material.description}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [data, filters, typeParam, adoptionByRecommendationId])

  // Only the first load replaces the page: a filter change refetches with the filters still on
  // screen, and the previous rows stay until the new ones arrive.
  if (loading && !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-4" />}
        title="Could not load the overview from the backend"
        description={error.message}
        actions={
          <Button size="sm" variant="outline" onClick={refetch}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        }
      />
    )
  }

  // Said once under the cards whose population is "recommended material-plants" when the type is
  // narrowed: the All figures also count Fast / Slow movers that have no recommendation at all.
  const typeNote = typeParam
    ? ` Counted over ${TYPE_LABEL[typeParam]} recommendations only.`
    : ""

  return (
    <div className="flex flex-col gap-4">
      <InventoryPortfolioKpis
        recommendations={filtered}
        adoptedOverride={
          adoptionSummary ? { count: adoptionSummary.adoptedCount, total: adoptionSummary.totalEvaluated } : null
        }
        adoptedUnavailable={adoptionLoading ? "loading…" : undefined}
        stockoutRiskOverride={
          summary
            ? {
                count: summary.criticalStockoutRiskCount,
                // Judged material-plants only: Insufficient Data is neither at risk nor safe, so it
                // stays out of the share.
                total: summary.stockoutRiskEvaluatedCount,
                insufficient: summary.stockoutRiskInsufficientDataCount,
                asOf: summary.stockoutRiskAsOf,
              }
            : undefined
        }
        stockoutRiskUnavailable={stockoutUnavailable}
        excessInventoryOverride={
          summary
            ? {
                count: summary.excessInventoryCandidatesCount,
                total: summary.total,
                opportunity: summary.excessInventoryOpportunity,
              }
            : undefined
        }
        workingCapitalOverride={
          summary
            ? {
                amount: summary.netRopValueImpact,
                currency: summary.currency,
              }
            : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <DashboardFilters
          value={filters}
          onChange={setFilters}
          plantOptions={PLANT_OPTIONS}
          showSapAdoptionFilter
          showCircuitFilter={false}
          showStatusFilter={false}
          showRiskFilter={false}
          showTypeFilter
          typeFilterAllowAll
          typeFilterLabel="Recommendation"
          mergeCriticalIntoHigh
        />

        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <ChartCard
              title="Stockout Risk Distribution"
              subtitle={`Fast and slow moving material-plants, by stock on hand against lead-time need.${typeNote}`}
              span={6}
            >
              <StockoutRiskDistribution
                summary={summary && !summaryLoading ? summary : null}
                unavailable={stockoutUnavailable}
              />
            </ChartCard>
            <ChartCard
              title="Stockout risk by plant"
              subtitle={`Fast and slow moving material-plants short of their lead-time need.${typeNote}`}
              span={6}
            >
              <StockoutPositionCard state={plantPositions} />
            </ChartCard>
            <ChartCard
              title="Excess inventory by plant"
              subtitle={`Material-plants above their recommended maximum stock, now.${typeNote}`}
              span={6}
            >
              <ExcessPositionCard state={plantPositions} />
            </ChartCard>

            <ChartCard
              title="SAP adoption"
              subtitle="Recommendations with a change to adopt, checked against SAP change history."
              span={6}
            >
              <AdoptionRateCard
                summary={adoptionSummary}
                loading={adoptionLoading}
                failed={adoptionError !== null}
                plant={adoptionPlant}
                onPlantChange={setAdoptionPlant}
                showPlantPicker={plantParam === undefined}
              />
            </ChartCard>
          </div>
        </div>
      </div>
    </div>
  )
}
