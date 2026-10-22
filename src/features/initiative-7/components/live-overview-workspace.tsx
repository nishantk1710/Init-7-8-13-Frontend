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
import { ChartCard } from "@/components/shared/chart-card"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { PageLoader } from "@/components/shared/page-loader"
import {
  ALL_FILTER,
  DashboardFilters,
  EMPTY_DASHBOARD_FILTERS,
  type DashboardFilterState,
} from "@/features/initiative-7/components/dashboard-filters"
import { OverviewInfo } from "@/features/initiative-7/components/overview-info-popup"
import { InventoryPortfolioKpis } from "@/features/initiative-7/components/inventory-portfolio-kpis"
import {
  ADOPTION_PLANTS,
  AdoptionRateCard,
  StockoutRiskDistribution,
} from "@/features/initiative-7/components/overview-widgets"
import {
  ExcessPositionCard,
  StockoutPositionCard,
} from "@/features/initiative-7/components/plant-position-cards"
import { usePlantPositions } from "@/features/initiative-7/hooks/use-plant-positions"
import { useLiveAdoption, useLiveAdoptionSummary } from "@/features/initiative-7/hooks/use-live-adoption"
import { useLiveRecommendationSummary } from "@/features/initiative-7/hooks/use-live-recommendation-summary"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import type { Criticality, DemandPattern } from "@/features/initiative-7/types/inventory"
import { DEMAND_CLASS_FOR_PATTERN } from "@/features/initiative-7/utils/recommendation-list-query"
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

// The Plant filter's options: real SAP plant codes. The default list is scenario data keyed on
// invented ids (PLANT-GBG), which never equal a live row's plant, so choosing one matched nothing.
const PLANT_OPTIONS = ADOPTION_PLANTS.map((p) => ({ value: p.code, label: sapPlantLabel(p.code) }))

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
  // New figures are on their way (first load, or a filter just changed): the cards and charts that read them show a
  // loader meanwhile. Not when the summary cannot be narrowed to the filter at all -- that is a reason, not a wait.
  const summaryRefreshing = summaryLoading && !criticalityCannotNarrow
  // High Stockout Risk is a portfolio figure; counting the fetched rows in its place would pass a
  // page of 200 off as the portfolio, so without a summary the card says why it has no number.
  const stockoutUnavailable = summary
    ? undefined
    : criticalityCannotNarrow
      ? "cannot be narrowed to this criticality"
      : summaryError
        ? "could not be loaded from the backend"
        : summaryLoading
          ? undefined // being fetched: the cards and the chart show a loader, not a reason
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
      <PageLoader label="Loading the Inventory Planning overview" className="h-[480px] w-full" />
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
        showInfo
        recommendations={filtered}
        adoptedOverride={
          adoptionSummary ? { count: adoptionSummary.adoptedCount, total: adoptionSummary.totalEvaluated } : null
        }
        loading={{
          stockout: summaryRefreshing,
          excess: summaryRefreshing,
          workingCapital: summaryRefreshing,
          adopted: adoptionLoading,
        }}
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
              info={<OverviewInfo id="stockoutDistribution" />}
              subtitle={`Fast and slow moving material-plants, by stock on hand against lead-time need.${typeNote}`}
              span={6}
            >
              <StockoutRiskDistribution
                figures={
                  summary && !summaryRefreshing
                    ? {
                        atRisk: summary.criticalStockoutRiskCount,
                        evaluated: summary.stockoutRiskEvaluatedCount,
                        insufficient: summary.stockoutRiskInsufficientDataCount,
                        asOf: summary.stockoutRiskAsOf,
                      }
                    : null
                }
                unavailable={stockoutUnavailable}
                loading={summaryRefreshing}
              />
            </ChartCard>
            <ChartCard
              title="Stockout risk by plant"
              info={<OverviewInfo id="stockoutByPlant" />}
              subtitle={`Fast and slow moving material-plants short of their lead-time need.${typeNote}`}
              span={6}
            >
              <StockoutPositionCard state={plantPositions} />
            </ChartCard>
            <ChartCard
              title="Excess inventory by plant"
              info={<OverviewInfo id="excessByPlant" />}
              subtitle={`Material-plants above their recommended maximum stock, now.${typeNote}`}
              span={6}
            >
              <ExcessPositionCard state={plantPositions} />
            </ChartCard>

            <ChartCard
              title="SAP adoption"
              info={<OverviewInfo id="sapAdoption" />}
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
