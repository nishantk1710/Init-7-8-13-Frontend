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
import { useLiveRecommendationSummary } from "@/features/initiative-7/hooks/use-live-recommendation-summary"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import { mapStatus } from "@/features/initiative-7/services/i7-api"
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

export function LiveInventoryOptimizationOverviewWorkspace() {
  const [filters, setFilters] = useState<DashboardFilterState>(EMPTY_DASHBOARD_FILTERS)
  const { data, loading, error, refetch } = useLiveRecommendations({ pageSize: LIVE_OVERVIEW_PAGE_SIZE })
  const { summary } = useLiveRecommendationSummary()

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
