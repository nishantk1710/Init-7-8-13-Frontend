"use client"

import { useMemo } from "react"
import {
  Activity,
  Boxes,
  Clock,
  Layers,
  ListChecks,
  PackageX,
  TrendingUp,
  TriangleAlert,
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { ChartCard } from "@/components/shared/chart-card"
import { KPIStatCard } from "@/components/shared/kpi-stat-card"
import { AgingBucketsChart } from "@/features/initiative-13/components/aging-buckets-chart"
import { DepartmentValueChart } from "@/features/initiative-13/components/department-value-chart"
import { InflowTrendChart } from "@/features/initiative-13/components/inflow-trend-chart"
import { RedeploymentAvoidanceChart } from "@/features/initiative-13/components/redeployment-avoidance-chart"
import { ErrorState, LoadingState } from "@/features/initiative-13/components/query-states"
import { getI13Summary, getI13Watch } from "@/features/initiative-13/api/client"
import { useI13Query } from "@/features/initiative-13/hooks/use-i13-query"
import {
  NM_SM_INFLOW_TREND,
  REDEPLOYMENT_AVOIDANCE,
  getUnutilizedValueByDepartment,
} from "@/features/initiative-13/data/overview-metrics"
import { formatCount } from "@/lib/utils"

const AGING_BAND_LABELS: Record<string, string> = {
  FAST: "Fast-moving",
  SLOW: "Slow-moving",
  NON_MOVING: "Non-moving",
}

const PLAN_STATUS_LABELS: Record<string, string> = {
  NO_PLAN: "No plan",
  BELOW_PLAN: "Below plan",
  ON_PLAN: "On plan",
  ABOVE_PLAN: "Above plan",
}

export function OARUtilizationOverviewPage() {
  const summary = useI13Query(() => getI13Summary(), [])
  const watch = useI13Query(() => getI13Watch(), [])
  const departmentValue = useMemo(() => getUnutilizedValueByDepartment(), [])

  const agingDistribution = useMemo(() => {
    const counts: Record<string, number> = { FAST: 0, SLOW: 0, NON_MOVING: 0 }
    for (const metric of watch.data ?? []) counts[metric.agingBand] = (counts[metric.agingBand] ?? 0) + 1
    return Object.entries(counts).map(([band, count]) => ({ bucket: AGING_BAND_LABELS[band] ?? band, count }))
  }, [watch.data])

  const planDistribution = useMemo(() => {
    const counts: Record<string, number> = { NO_PLAN: 0, BELOW_PLAN: 0, ON_PLAN: 0, ABOVE_PLAN: 0 }
    for (const metric of watch.data ?? [])
      counts[metric.acquiredVsPlanStatus] = (counts[metric.acquiredVsPlanStatus] ?? 0) + 1
    return Object.entries(counts).map(([status, count]) => ({ bucket: PLAN_STATUS_LABELS[status] ?? status, count }))
  }, [watch.data])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="OAR Utilization"
          description="End-to-end tracking of OAR spares demand from reservation through utilization."
        />

        {summary.loading && <LoadingState label="Loading summary…" />}
        {summary.error && (
          <ErrorState message={summary.error} onRetry={summary.refetch} title="Unable to load utilization summary." />
        )}
        {summary.data && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KPIStatCard
                label="Total OAR positions"
                value={formatCount(summary.data.totalOarPositions)}
                icon={<Boxes className="size-3.5" />}
              />
              <KPIStatCard
                label="Fast-moving"
                value={formatCount(summary.data.fastMovingCount)}
                icon={<TrendingUp className="size-3.5" />}
              />
              <KPIStatCard
                label="Slow-moving"
                value={formatCount(summary.data.slowMovingCount)}
                icon={<Clock className="size-3.5" />}
              />
              <KPIStatCard
                label="Non-moving"
                value={formatCount(summary.data.nonMovingCount)}
                icon={<PackageX className="size-3.5" />}
              />
              <KPIStatCard
                label="GR not issued (30d)"
                value={formatCount(summary.data.grNotIssued30DayCount)}
                icon={<TriangleAlert className="size-3.5" />}
              />
              <KPIStatCard
                label="Plan breaches"
                value={formatCount(summary.data.planBreachCount)}
                icon={<Activity className="size-3.5" />}
              />
              <KPIStatCard
                label="No-plan exceptions"
                value={formatCount(summary.data.noPlanCount)}
                icon={<ListChecks className="size-3.5" />}
              />
              <KPIStatCard
                label="Reclassification candidates"
                value={formatCount(summary.data.reclassificationCandidateCount)}
                icon={<Layers className="size-3.5" />}
              />
            </div>
            {summary.data.valuationIsMocked && (
              <p className="text-[11px] text-muted-foreground">
                Valuation data backing these figures is currently mocked in the backend.
              </p>
            )}
          </>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <ChartCard title="Aging buckets" subtitle="OAR material+plant positions by backend-computed aging band" span={6}>
            {watch.loading && <LoadingState label="Loading watch metrics…" />}
            {watch.error && <ErrorState message={watch.error} onRetry={watch.refetch} />}
            {watch.data && <AgingBucketsChart data={agingDistribution} />}
          </ChartCard>
          <ChartCard
            title="Unutilized value by department"
            subtitle="Requested minus confirmed-used, by cost center — illustrative, mock data"
            span={6}
          >
            <DepartmentValueChart data={departmentValue} />
          </ChartCard>
          <ChartCard title="Acquired vs. plan" subtitle="Positions by backend-computed acquired-vs-plan status" span={6}>
            {watch.loading && <LoadingState label="Loading watch metrics…" />}
            {watch.error && <ErrorState message={watch.error} onRetry={watch.refetch} />}
            {watch.data && <AgingBucketsChart data={planDistribution} />}
          </ChartCard>
          <ChartCard
            title="NM/SM inflow trend"
            subtitle="New non-moving / slow-moving lines entering OAR tracking — illustrative, mock data"
            span={6}
          >
            <InflowTrendChart data={NM_SM_INFLOW_TREND} />
          </ChartCard>
          <ChartCard
            title="Redeployment / purchase avoidance"
            subtitle="Estimated repurchase value avoided by redeploying unused stock — illustrative, mock data"
            span={12}
            footnote="Advisory estimates only — no automatic SAP stock transfer is simulated. Not backed by the FastAPI service; there is no redeployment endpoint yet."
          >
            <RedeploymentAvoidanceChart data={REDEPLOYMENT_AVOIDANCE} />
          </ChartCard>
        </div>
      </div>
    </div>
  )
}
