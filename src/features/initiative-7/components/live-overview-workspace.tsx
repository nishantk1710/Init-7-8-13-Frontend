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

import { useState } from "react"
import { ChartCard } from "@/components/shared/chart-card"
import { PageLoader } from "@/components/shared/page-loader"
import {
  ALL_FILTER,
  DashboardFilters,
  EMPTY_DASHBOARD_FILTERS,
  isValueChangeFilter,
  type DashboardFilterState,
  type ValueChangeFilter,
} from "@/features/initiative-7/components/dashboard-filters"
import { OverviewFormulasProvider } from "@/features/initiative-7/components/overview-formulas-context"
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
import { useLiveAdoptionSummary } from "@/features/initiative-7/hooks/use-live-adoption"
import { useLiveRecommendationSummary } from "@/features/initiative-7/hooks/use-live-recommendation-summary"
import { useActiveKpiFormulas } from "@/features/initiative-7/hooks/use-kpi-formulas"
import type { Criticality, DemandPattern } from "@/features/initiative-7/types/inventory"
import { DEMAND_CLASS_FOR_PATTERN } from "@/features/initiative-7/utils/recommendation-list-query"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

// The ZMM065 tier behind each display level, for the summary endpoint (which filters on the raw
// tier). Low has none -- it is NORMAL, OBSOLETE or no tier at all, which one value cannot express --
// so for Low the summary is asked by display level instead (criticality_level=Low).
const CRITICALITY_RAW_TIER: Partial<Record<Criticality, string>> = {
  Critical: "CRITICAL",
  High: "IMPACT",
  Medium: "INSURANCE",
}

// Every figure on this page comes from a backend SQL aggregate over the whole filtered set. Nothing
// here counts a fetched page of recommendations, so no page size limits the Overview.

// The Plant filter's options: real SAP plant codes. The default list is scenario data keyed on
// invented ids (PLANT-GBG), which never equal a live row's plant, so choosing one matched nothing.
const PLANT_OPTIONS = ADOPTION_PLANTS.map((p) => ({ value: p.code, label: sapPlantLabel(p.code) }))

const TYPE_LABEL: Record<"oar" | "stock_item", string> = { oar: "OAR", stock_item: "stock item" }

/** What each Value Change view counts, said once under the cards so every figure on the page reads the same way. */
const VALUE_CHANGE_NOTE: Record<ValueChangeFilter, string> = {
  released: "Only materials that release value (reorder point goes down).",
  tied_up: "Only materials that tie up value (reorder point goes up).",
  released_stock_oar:
    "Stock items, each counted once: one eligible to convert to OAR at the value its conversion would release, every other at its own release.",
  released_overlap:
    "Stock items at their own release, plus those eligible to convert to OAR at the value their conversion would release. A material in both counts twice.",
}

export function LiveInventoryOptimizationOverviewWorkspace() {
  const [filters, setFilters] = useState<DashboardFilterState>(EMPTY_DASHBOARD_FILTERS)
  // The formulas in force, for the (i) popups. Not awaited: until they arrive (or if they cannot be read) the
  // popups show the built-in text, so the Overview never waits on them.
  const activeFormulas = useActiveKpiFormulas()
  // Plant, Criticality, Demand Pattern and the Recommendation type are asked of the backend, which counts
  // every matching material-plant -- never a fetched page. The KPIs, the distribution, both plant cards and
  // the SAP adoption counts take the same four, so they all follow the filters with the same totals.
  const plantParam = filters.plant !== ALL_FILTER ? filters.plant : undefined
  const demandClassParam = DEMAND_CLASS_FOR_PATTERN[filters.demandPattern as DemandPattern]
  const criticalityLevel = filters.criticality !== ALL_FILTER ? filters.criticality : undefined
  const typeParam = filters.type === "oar" || filters.type === "stock_item" ? filters.type : undefined
  const isOarParam = typeParam === undefined ? undefined : typeParam === "oar"
  const criticalityTier = criticalityLevel ? CRITICALITY_RAW_TIER[criticalityLevel as Criticality] : undefined
  // Low is asked by its level, the others by their raw tier -- as before; only Low had no way to be asked.
  const criticalityLevelParam = criticalityLevel && !criticalityTier ? criticalityLevel : undefined
  // The Value Change filter exists only for stock items: Releases value (the reorder point goes down) or Ties up more
  // value (it goes up). It narrows the same backend figures as the other filters -- working capital, excess, stockout,
  // the plant cards and the SAP adoption counts -- so every card on the page speaks about the same materials.
  const valueChangeParam =
    typeParam === "stock_item" && isValueChangeFilter(filters.valueChange) ? filters.valueChange : undefined
  const {
    summary,
    loading: summaryLoading,
    error: summaryError,
  } = useLiveRecommendationSummary({
    plant: plantParam,
    demandClass: demandClassParam,
    criticality: criticalityTier,
    criticalityLevel: criticalityLevelParam,
    isOar: isOarParam,
    valueChange: valueChangeParam,
  })
  // New figures are on their way (first load, or a filter just changed): the cards and charts that read them show a
  // loader meanwhile.
  const summaryRefreshing = summaryLoading
  // Every portfolio figure is the backend's; with no summary the cards say why they have no number rather than
  // counting whatever rows the browser happens to hold.
  const summaryUnavailable = summary
    ? undefined
    : summaryError
      ? "could not be loaded from the backend"
      : summaryLoading
        ? undefined // being fetched: the cards and the chart show a loader, not a reason
        : "not available from the backend"
  // Stockout and excess by plant follow the rail too: with a plant chosen only that plant's bar is
  // drawn, and the other three filters narrow every bar.
  const plantPositions = usePlantPositions({
    plant: plantParam,
    isOar: isOarParam,
    demandClass: demandClassParam,
    criticality: criticalityTier,
    criticalityLevel: criticalityLevelParam,
    valueChange: valueChangeParam,
  })
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
    valueChange: valueChangeParam,
  })
  // Only the first load replaces the page: a filter change refetches with the filters still on
  // screen, and the previous figures stay until the new ones arrive.
  if (summaryLoading && !summary && !summaryError) {
    return (
      <PageLoader label="Loading the Inventory Planning overview" className="h-[480px] w-full" />
    )
  }

  // Said once under the cards whose population is "recommended material-plants" when the type is
  // narrowed: the All figures also count Fast / Slow movers that have no recommendation at all.
  const typeNote =
    (typeParam ? ` Counted over ${TYPE_LABEL[typeParam]} recommendations only.` : "") +
    (valueChangeParam ? ` ${VALUE_CHANGE_NOTE[valueChangeParam]}` : "")

  return (
    <OverviewFormulasProvider value={activeFormulas}>
    <div className="flex flex-col gap-4">
      <DashboardFilters
        layout="bar"
        value={filters}
        // Leaving Stock item clears Value Change: it has no meaning (and no dropdown) for OAR or All.
        onChange={(next) => setFilters(next.type === "stock_item" ? next : { ...next, valueChange: ALL_FILTER })}
        plantOptions={PLANT_OPTIONS}
        showSapAdoptionFilter
        showValueChangeFilter
        showCircuitFilter={false}
        showStatusFilter={false}
        showRiskFilter={false}
        showTypeFilter
        typeFilterAllowAll
        typeFilterLabel="Recommendation"
        mergeCriticalIntoHigh
      />

      <InventoryPortfolioKpis
        showInfo
        recommendations={[]}
        adoptedOverride={
          adoptionSummary
            ? {
                // The card counts what the Calculation page says counts as adopted (adopted, by default).
                count: adoptionSummary.countedAsAdopted ?? adoptionSummary.adoptedCount,
                total: adoptionSummary.totalEvaluated,
              }
            : null
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
        stockoutRiskUnavailable={summaryUnavailable}
        excessInventoryUnavailable={summaryUnavailable}
        workingCapitalUnavailable={summaryUnavailable}
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
                // ZAR from MBEW's price (ZAR, and NAD at 1:1); the portfolio currency only for an older backend.
                currency: summary.workingCapitalCurrency ?? summary.currency,
                includedCount: summary.workingCapitalIncludedCount,
                excludedCount: summary.workingCapitalExcludedCount,
                overlapCount: summary.workingCapitalOverlapCount,
              }
            : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4">
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
                unavailable={summaryUnavailable}
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
    </OverviewFormulasProvider>
  )
}
