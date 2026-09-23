// Part 22 — I07 complete frontend live data integration.
//
// Live counterpart to overview-workspace.tsx's InventoryOptimizationOverviewWorkspace.
// Every existing KPI/chart component (InventoryPortfolioKpis, InventoryHealthCard,
// CircuitExposureChart, RecommendationStatusChart, ForecastVsActualChart) is
// reused completely unchanged -- only the data source and the two authored
// trend charts (which have no backend equivalent at all) differ.

"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

import { ChartCard } from "@/components/shared/chart-card"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { RiskLevel } from "@/components/shared/risk-badge"
import { CircuitExposureChart } from "@/features/initiative-7/components/circuit-exposure-chart"
import {
  ALL_FILTER,
  DashboardFilters,
  EMPTY_DASHBOARD_FILTERS,
  type DashboardFilterState,
} from "@/features/initiative-7/components/dashboard-filters"
import { ForecastVsActualChart } from "@/features/initiative-7/components/forecast-vs-actual-chart"
import { InventoryHealthCard } from "@/features/initiative-7/components/inventory-health-card"
import { InventoryPortfolioKpis } from "@/features/initiative-7/components/inventory-portfolio-kpis"
import { RecommendationStatusChart } from "@/features/initiative-7/components/recommendation-status-chart"
import { useLiveAdoptionSummary } from "@/features/initiative-7/hooks/use-live-adoption"
import { useLiveRecommendationSummary } from "@/features/initiative-7/hooks/use-live-recommendation-summary"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import {
  fetchAdoptionDetail,
  mapStatus,
  type AdoptionDetailResult,
  type AdoptionSummaryResult,
} from "@/features/initiative-7/services/i7-api"
import type { Circuit, Recommendation, RecommendationStatus } from "@/features/initiative-7/types/inventory"

// The backend list endpoint's own MAX_PAGE_SIZE ceiling (see
// app/api/i7/recommendations.py). Fetched once and filtered client-side,
// same as the recommendations workspace/table -- see that component's own
// note on why the whole set (not one page) is needed for these KPIs/charts.
const LIVE_OVERVIEW_PAGE_SIZE = 200

function UnavailableTrendCard({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
      <p>{label} is not available from the backend.</p>
      <p className="max-w-xs">
        No API currently exposes a monthly historical time series for this metric.
      </p>
    </div>
  )
}

/** Cap on how many currently-filtered materials get a per-material detail
 * fetch (GET .../{id}/adoption) -- this is a comparison view for "the
 * material(s) I've narrowed down to", not a bulk re-evaluation of the whole
 * filtered set, which the portfolio-wide summary above already covers. */
const MAX_MATERIAL_DETAIL_CARDS = 6

const FIELD_LABEL: Record<string, string> = {
  mrp_type: "MRP type",
  minbe_populated: "MINBE populated",
  mabst_populated: "MABST populated",
  safety_stock: "Safety stock",
  reorder_point: "Reorder point",
  maximum_stock: "Maximum stock",
}

/** One material's expected-vs-observed comparison, field by field -- the
 * detail the portfolio-wide summary/rate above cannot show (it only counts
 * statuses, never which fields matched). Observed is empty whenever no SAP
 * evidence exists (status Unknown) -- shown as an explicit dash, never a
 * blank cell that could read as "value is empty in SAP" rather than "not
 * observed yet". */
function MaterialAdoptionCard({ recommendation, detail }: { recommendation: Recommendation; detail: AdoptionDetailResult | null }) {
  const fieldNames = detail ? Array.from(new Set([...Object.keys(detail.expected), ...Object.keys(detail.observed)])) : []

  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{recommendation.material.materialId}</div>
          <div className="truncate text-[11px] text-muted-foreground">{recommendation.material.description}</div>
        </div>
        {detail && (
          <span
            className={
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium " +
              (detail.status === "Adopted"
                ? "bg-success/15 text-success"
                : detail.status === "Partially adopted"
                  ? "bg-warning/15 text-warning"
                  : detail.status === "Not adopted"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground")
            }
          >
            {detail.status}
          </span>
        )}
      </div>

      {!detail ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Loading reconciliation…</p>
      ) : fieldNames.length === 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{detail.detail}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-1">
          {fieldNames.map((field) => {
            const expectedValue = detail.expected[field]
            const observedValue = detail.observed[field]
            const isMatched = detail.matchedFields.includes(field)
            return (
              <div key={field} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground">{FIELD_LABEL[field] ?? field}</span>
                <span className="flex items-center gap-1.5 tabular-nums">
                  <span className="text-muted-foreground">{expectedValue ?? "—"}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className={isMatched ? "font-medium text-success" : "text-muted-foreground"}>
                    {observedValue || "—"}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** FR-9's adoption rate, from the persisted recommendation ledger
 * (i7_sap_adoption) -- real counts, never a fabricated rate. `null`
 * adoptionRatePercentage (every evaluated row still UNKNOWN, the current
 * state of this data extract) renders as an explicit "Not yet measured"
 * state, never a 0%. totalEvaluated only grows as recommendations are
 * viewed through the adoption endpoints -- this is not a portfolio-wide
 * figure on day one.
 *
 * Below the portfolio-wide rate, a per-material comparison (expected vs
 * observed, field by field) for whichever material(s) the sidebar filter
 * currently narrows to -- capped at MAX_MATERIAL_DETAIL_CARDS so this never
 * silently fires a detail fetch per row of an unfiltered 200-row page. */
function AdoptionRateCard({
  summary,
  recommendations,
}: {
  summary: AdoptionSummaryResult | null
  recommendations: Recommendation[]
}) {
  const detailTargets = recommendations.slice(0, MAX_MATERIAL_DETAIL_CARDS)
  const [details, setDetails] = useState<Record<string, AdoptionDetailResult | null>>({})

  const targetKey = detailTargets.map((r) => r.id).join(",")
  // Reset the stale detail set as soon as the target key changes, during
  // render rather than in the effect below -- the React-endorsed way to
  // derive state from a changed key without the "setState synchronously in
  // an effect" cascading-render smell (see use-live-recommendations.ts's
  // identical pattern).
  const [lastTargetKey, setLastTargetKey] = useState(targetKey)
  if (lastTargetKey !== targetKey) {
    setLastTargetKey(targetKey)
    setDetails({})
  }

  useEffect(() => {
    if (!targetKey) return
    let cancelled = false
    Promise.all(
      targetKey.split(",").map((id) =>
        fetchAdoptionDetail(id)
          .then((detail) => [id, detail] as const)
          .catch(() => [id, null] as const),
      ),
    ).then((entries) => {
      if (cancelled) return
      setDetails(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [targetKey])

  if (!summary || summary.totalEvaluated === 0) {
    return (
      <div className="flex h-[220px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <p>No recommendations have been reconciled against SAP yet.</p>
        <p className="max-w-xs">
          The ledger fills in as recommendations are viewed through the Adoption Tracking screen.
        </p>
      </div>
    )
  }

  const rateKnown = summary.adoptionRatePercentage !== null

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex flex-col justify-center gap-3 lg:w-64 lg:shrink-0">
        <div className="text-center">
          <div className="text-3xl font-semibold text-foreground">
            {rateKnown ? `${summary.adoptionRatePercentage}%` : "Not yet measured"}
          </div>
          <div className="text-xs text-muted-foreground">
            {rateKnown
              ? "adopted or partially adopted, of recommendations with SAP evidence"
              : "no SAP change-document evidence observed for any evaluated recommendation"}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Adopted</span>
            <span className="tabular-nums text-foreground">{summary.adoptedCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Partially adopted</span>
            <span className="tabular-nums text-foreground">{summary.partiallyAdoptedCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Not adopted</span>
            <span className="tabular-nums text-foreground">{summary.notAdoptedCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Unknown</span>
            <span className="tabular-nums text-foreground">{summary.unknownCount}</span>
          </div>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          {summary.totalEvaluated} recommendation(s) reconciled so far.
        </p>
      </div>

      <div className="min-w-0 flex-1 border-t border-border/60 pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          {detailTargets.length === 0
            ? "Filter to a material to see its expected-vs-observed detail."
            : `Expected vs observed — ${detailTargets.length} material(s) in the current filter${recommendations.length > MAX_MATERIAL_DETAIL_CARDS ? ` (showing first ${MAX_MATERIAL_DETAIL_CARDS})` : ""}.`}
        </div>
        {detailTargets.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {detailTargets.map((rec) => (
              <MaterialAdoptionCard key={rec.id} recommendation={rec} detail={details[rec.id] ?? null} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function LiveInventoryOptimizationOverviewWorkspace() {
  const [filters, setFilters] = useState<DashboardFilterState>(EMPTY_DASHBOARD_FILTERS)
  const { data, loading, error, refetch } = useLiveRecommendations({ pageSize: LIVE_OVERVIEW_PAGE_SIZE })
  const { summary } = useLiveRecommendationSummary()
  const { summary: adoptionSummary } = useLiveAdoptionSummary()

  const filtered = useMemo(() => {
    if (!data) return []
    const query = filters.material.trim().toLowerCase()
    return data.filter((r) => {
      if (filters.plant !== ALL_FILTER && r.plantId !== filters.plant) return false
      if (filters.circuit !== ALL_FILTER && r.circuit !== filters.circuit) return false
      if (filters.criticality !== ALL_FILTER && r.criticality !== filters.criticality) return false
      if (filters.demandPattern !== ALL_FILTER && r.demandPattern !== filters.demandPattern) return false
      if (filters.status !== ALL_FILTER && r.status !== filters.status) return false
      if (filters.risk !== ALL_FILTER && r.risk !== filters.risk) return false
      if (query) {
        const haystack = `${r.material.materialId} ${r.material.description}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [data, filters])

  function toggle<K extends "circuit" | "status" | "risk">(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? ALL_FILTER : value }))
  }

  // Merges the backend's raw by_status counts (NOT_EVALUABLE, READY_FOR_
  // REVIEW, PENDING_APPROVAL, ...) through the same STATUS_MAP the rest of
  // the app uses -- several backend statuses collapse into one display
  // value (e.g. NOT_EVALUABLE and READY_FOR_REVIEW both read "Pending
  // Review"), so this must sum those together rather than pass raw counts
  // straight through.
  const statusOverride = useMemo(() => {
    if (!summary) return undefined
    const merged = new Map<RecommendationStatus, number>()
    for (const row of summary.byStatus) {
      const status = mapStatus(row.status)
      merged.set(status, (merged.get(status) ?? 0) + row.count)
    }
    return Array.from(merged.entries()).map(([status, count]) => ({ status, count }))
  }, [summary])

  if (loading) {
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

  const activeRisk = filters.risk !== ALL_FILTER ? (filters.risk as RiskLevel) : null
  const activeCircuit = filters.circuit !== ALL_FILTER ? (filters.circuit as Circuit) : null
  const activeStatus = filters.status !== ALL_FILTER ? (filters.status as RecommendationStatus) : null

  return (
    <div className="flex flex-col gap-4">
      <InventoryPortfolioKpis
        recommendations={filtered}
        pendingApprovalOverride={
          summary ? { count: summary.awaitingApprovalCount, total: summary.total } : undefined
        }
        stockoutRiskOverride={
          summary ? { count: summary.criticalStockoutRiskCount, total: summary.total } : undefined
        }
        excessInventoryOverride={
          summary
            ? {
                count: summary.excessInventoryCandidatesCount,
                total: summary.total,
                opportunity: summary.excessInventoryOpportunity,
              }
            : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <DashboardFilters value={filters} onChange={setFilters} />

        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <ChartCard title="Stockout Risk Distribution" span={4}>
              <InventoryHealthCard
                recommendations={filtered}
                activeRisk={activeRisk}
                onRiskClick={(level) => toggle("risk", level)}
                riskOverride={
                  summary
                    ? {
                        counts: summary.byRisk.map((row) => ({
                          level: row.risk as RiskLevel,
                          count: row.count,
                        })),
                        total: summary.total,
                      }
                    : undefined
                }
              />
            </ChartCard>
            <ChartCard
              title="Critical circuit exposure"
              subtitle="Recommendations per circuit, split by stockout-risk exposure."
              span={8}
            >
              <CircuitExposureChart
                recommendations={filtered}
                activeCircuit={activeCircuit}
                onCircuitClick={(circuit) => toggle("circuit", circuit)}
              />
            </ChartCard>

            <ChartCard title="Recommendation status" span={4}>
              <RecommendationStatusChart
                recommendations={filtered}
                activeStatus={activeStatus}
                onStatusClick={(status) => toggle("status", status)}
                statusOverride={statusOverride}
              />
            </ChartCard>
            <ChartCard title="Stockout risk trend" subtitle="Materials at high/critical risk, by month." span={4}>
              <UnavailableTrendCard label="Stockout risk trend" />
            </ChartCard>
            <ChartCard
              title="Excess inventory opportunity"
              subtitle="Cumulative working-capital opportunity identified, by month."
              span={4}
            >
              <UnavailableTrendCard label="Excess inventory trend" />
            </ChartCard>

            <ChartCard
              title="SAP adoption (FR-9)"
              subtitle="Recommendations reconciled against SAP change history, by ledger status."
              span={12}
            >
              <AdoptionRateCard summary={adoptionSummary} recommendations={filtered} />
            </ChartCard>

            <ChartCard
              title="Forecast vs Actual Demand"
              span={12}
              footnote={`Actual = consumption for the ${filtered.length} material(s) in view. Forecast = one-step-ahead exponential smoothing on that same series, so each point uses only prior months.`}
            >
              <ForecastVsActualChart recommendations={filtered} />
            </ChartCard>
          </div>
        </div>
      </div>
    </div>
  )
}
