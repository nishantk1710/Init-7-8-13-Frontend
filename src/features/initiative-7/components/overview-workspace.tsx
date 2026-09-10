"use client"

import { useMemo, useState } from "react"

import { ChartCard } from "@/components/shared/chart-card"
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
import { TrendLineChart } from "@/features/initiative-7/components/trend-line-chart"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import { EXCESS_INVENTORY_TREND, STOCKOUT_RISK_TREND } from "@/features/initiative-7/data/monitoring-series"
import type { Circuit, RecommendationStatus } from "@/features/initiative-7/types/inventory"

/** Overview page body — owns the dashboard filter state and derives the
 * filtered recommendation set every KPI/chart below reads from. Chart
 * segments (risk tier, circuit, status) are themselves clickable and cross-
 * filter the same state as the filter rail. The two historical trend charts
 * (stockout risk, excess inventory) stay portfolio-wide: they're authored
 * monthly series, not per-material, so there's nothing to filter them by. */
export function InventoryOptimizationOverviewWorkspace() {
  const [filters, setFilters] = useState<DashboardFilterState>(EMPTY_DASHBOARD_FILTERS)

  const filtered = useMemo(() => {
    const query = filters.material.trim().toLowerCase()
    return RECOMMENDATIONS.filter((r) => {
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
  }, [filters])

  /** Click a filter value again to clear it — the same toggle behaviour
   * whichever chart or control set it. */
  function toggle<K extends "circuit" | "status" | "risk">(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? ALL_FILTER : value }))
  }

  const activeRisk = filters.risk !== ALL_FILTER ? (filters.risk as RiskLevel) : null
  const activeCircuit = filters.circuit !== ALL_FILTER ? (filters.circuit as Circuit) : null
  const activeStatus = filters.status !== ALL_FILTER ? (filters.status as RecommendationStatus) : null

  return (
    <div className="flex flex-col gap-4">
      <InventoryPortfolioKpis recommendations={filtered} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <DashboardFilters value={filters} onChange={setFilters} />

        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <ChartCard title="Stockout Risk Distribution" span={4}>
              <InventoryHealthCard
                recommendations={filtered}
                activeRisk={activeRisk}
                onRiskClick={(level) => toggle("risk", level)}
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
              />
            </ChartCard>
            <ChartCard title="Stockout risk trend" subtitle="Materials at high/critical risk, by month." span={4}>
              <TrendLineChart data={STOCKOUT_RISK_TREND} color="var(--destructive)" />
            </ChartCard>
            <ChartCard
              title="Excess inventory opportunity"
              subtitle="Cumulative working-capital opportunity identified, by month."
              span={4}
            >
              <TrendLineChart data={EXCESS_INVENTORY_TREND} color="var(--chart-3)" format="zar" />
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
