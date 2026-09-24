// Part 22 — I07 complete frontend live data integration.
//
// Live counterpart to overview-workspace.tsx's InventoryOptimizationOverviewWorkspace.
// Every existing KPI/chart component (InventoryPortfolioKpis, InventoryHealthCard,
// CircuitExposureChart, RecommendationStatusChart, ForecastVsActualChart) is
// reused completely unchanged -- only the data source and the two authored
// trend charts (which have no backend equivalent at all) differ.

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
import { useLiveAdoption, useLiveAdoptionSummary } from "@/features/initiative-7/hooks/use-live-adoption"
import { useLiveRecommendationSummary } from "@/features/initiative-7/hooks/use-live-recommendation-summary"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import { mapStatus, type AdoptionSummaryResult } from "@/features/initiative-7/services/i7-api"
import type { Circuit, RecommendationStatus } from "@/features/initiative-7/types/inventory"

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
// DISMM/OAR-adjacent figure elsewhere in I07 is scoped to Black Mountain and
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
  plant,
  onPlantChange,
}: {
  summary: AdoptionSummaryResult | null
  plant: string
  onPlantChange: (plant: string) => void
}) {
  const plantPicker = (
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

  if (!summary || summary.totalEvaluated === 0) {
    return (
      <div className="flex flex-col">
        {plantPicker}
        <div className="flex h-[220px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
          <p>No recommendations have been reconciled against SAP yet.</p>
          <p className="max-w-xs">
            The ledger fills in as recommendations are viewed through the Adoption Tracking screen.
          </p>
        </div>
      </div>
    )
  }

  const rateKnown = summary.adoptionRatePercentage !== null

  const statusCounts = [
    { status: "Adopted", count: summary.adoptedCount, color: "var(--chart-3)" },
    { status: "Partially adopted", count: summary.partiallyAdoptedCount, color: "var(--chart-4)" },
    { status: "Not adopted", count: summary.notAdoptedCount, color: "var(--destructive)" },
    { status: "Unknown", count: summary.unknownCount, color: "var(--muted-foreground)" },
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
          {rateKnown ? `${summary.adoptionRatePercentage}% adoption rate` : "Not yet measured"}
        </div>
        <div className="text-xs text-muted-foreground">
          {rateKnown
            ? "adopted or partially adopted, of recommendations with SAP evidence"
            : "no SAP change-document evidence observed for any evaluated recommendation"}
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
        {summary.totalEvaluated} recommendation(s) reconciled so far.
      </p>
    </div>
  )
}

export function LiveInventoryOptimizationOverviewWorkspace() {
  const [filters, setFilters] = useState<DashboardFilterState>(EMPTY_DASHBOARD_FILTERS)
  const { data, loading, error, refetch } = useLiveRecommendations({ pageSize: LIVE_OVERVIEW_PAGE_SIZE })
  const { summary } = useLiveRecommendationSummary()
  // Own plant filter, independent of the sidebar's Plant filter -- lets
  // someone compare adoption by plant without changing what the rest of the
  // page shows (see get_adoption_summary's own docstring for why this needs
  // a dedicated backend param rather than reading it off the sidebar
  // selection: the ledger has no plant column of its own).
  const [adoptionPlant, setAdoptionPlant] = useState<string>(ALL_FILTER)
  const { summary: adoptionSummary } = useLiveAdoptionSummary(
    adoptionPlant === ALL_FILTER ? undefined : adoptionPlant,
  )
  // Adoption is a separate reconciliation, keyed by recommendation id, not a
  // field on Recommendation itself (see use-live-adoption.ts) -- fetched at
  // the same page size and joined in below so the "SAP Adoption" filter has
  // something to read. Only covers material-plants with an actual
  // calculated recommendation (the backend's own /recommendations/adoption
  // scope), so a row absent from this map has no adoption status to filter
  // on at all -- treated as "Unknown" below, the same value a genuinely
  // evaluated-but-no-evidence row gets, since neither has anything to show.
  const { items: adoptionItems } = useLiveAdoption({ pageSize: LIVE_OVERVIEW_PAGE_SIZE })
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
      if (filters.circuit !== ALL_FILTER && r.circuit !== filters.circuit) return false
      if (filters.criticality !== ALL_FILTER && r.criticality !== filters.criticality) return false
      if (filters.demandPattern !== ALL_FILTER && r.demandPattern !== filters.demandPattern) return false
      if (filters.status !== ALL_FILTER && r.status !== filters.status) return false
      if (filters.risk !== ALL_FILTER && r.risk !== filters.risk) return false
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
  }, [data, filters, adoptionByRecommendationId])

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
        <DashboardFilters value={filters} onChange={setFilters} showSapAdoptionFilter />

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
              title="SAP adoption"
              subtitle="Recommendations reconciled against SAP change history, by ledger status."
              span={12}
            >
              <AdoptionRateCard
                summary={adoptionSummary}
                plant={adoptionPlant}
                onPlantChange={setAdoptionPlant}
              />
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
