import { Activity, ArrowRightLeft, Clock, PackageCheck, RefreshCcw, TrendingDown, TriangleAlert, Wallet } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { ChartCard } from "@/components/shared/chart-card"
import { KPIStatCard } from "@/components/shared/kpi-stat-card"
import { AgingBucketsChart } from "@/features/initiative-13/components/aging-buckets-chart"
import { DepartmentValueChart } from "@/features/initiative-13/components/department-value-chart"
import { PlanVsActualChart } from "@/features/initiative-13/components/plan-vs-actual-chart"
import { InflowTrendChart } from "@/features/initiative-13/components/inflow-trend-chart"
import { RedeploymentAvoidanceChart } from "@/features/initiative-13/components/redeployment-avoidance-chart"
import {
  AGING_BUCKETS,
  NM_SM_INFLOW_TREND,
  PLAN_VS_ACTUAL,
  REDEPLOYMENT_AVOIDANCE,
  getOverviewKpis,
  getUnutilizedValueByDepartment,
} from "@/features/initiative-13/data/overview-metrics"
import { formatCount, formatZARCompact } from "@/lib/utils"

export function OARUtilizationOverviewPage() {
  const kpis = getOverviewKpis()
  const departmentValue = getUnutilizedValueByDepartment()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="OAR Utilization"
          description="End-to-end tracking of OAR spares demand from reservation through utilization."
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPIStatCard
            label="Unutilized OAR value"
            value={formatZARCompact(kpis.unutilizedValue)}
            hint="across open lines"
            icon={<Wallet className="size-3.5" />}
          />
          <KPIStatCard
            label="Unutilized OAR qty"
            value={formatCount(kpis.unutilizedQty)}
            hint="units not yet confirmed used"
            icon={<PackageCheck className="size-3.5" />}
          />
          <KPIStatCard
            label="Plan compliance"
            value={`${kpis.complianceRate}%`}
            hint="on-plan consumption"
            icon={<Activity className="size-3.5" />}
          />
          <KPIStatCard
            label="Aged OAR lines"
            value={kpis.agedLines}
            hint="overdue or no longer required"
            icon={<TriangleAlert className="size-3.5" />}
          />
          <KPIStatCard
            label="Re-planned lines"
            value={kpis.replannedLines}
            hint="consumption date moved"
            icon={<RefreshCcw className="size-3.5" />}
          />
          <KPIStatCard
            label="Released quantity"
            value={formatCount(kpis.releasedQty)}
            hint="marked available for redeployment"
            icon={<TrendingDown className="size-3.5" />}
          />
          <KPIStatCard
            label="Redeployment opportunities"
            value={kpis.redeploymentOpportunities}
            hint="cross-plant matches open"
            icon={<ArrowRightLeft className="size-3.5" />}
          />
          <KPIStatCard
            label="NM/SM inflow"
            value={kpis.nmSmInflow}
            hint="new lines this month"
            icon={<Clock className="size-3.5" />}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <ChartCard title="Aging buckets" subtitle="Open OAR lines by days since planned consumption" span={6}>
            <AgingBucketsChart data={AGING_BUCKETS} />
          </ChartCard>
          <ChartCard title="Unutilized value by department" subtitle="Requested minus confirmed-used, by cost center" span={6}>
            <DepartmentValueChart data={departmentValue} />
          </ChartCard>
          <ChartCard title="Plan vs. actual consumption" subtitle="Lines planned to consume vs. confirmed consumed, by month" span={6}>
            <PlanVsActualChart data={PLAN_VS_ACTUAL} />
          </ChartCard>
          <ChartCard title="NM/SM inflow trend" subtitle="New non-moving / slow-moving lines entering OAR tracking" span={6}>
            <InflowTrendChart data={NM_SM_INFLOW_TREND} />
          </ChartCard>
          <ChartCard
            title="Redeployment / purchase avoidance"
            subtitle="Estimated repurchase value avoided by redeploying unused stock"
            span={12}
            footnote="Advisory estimates only — no automatic SAP stock transfer is simulated."
          >
            <RedeploymentAvoidanceChart data={REDEPLOYMENT_AVOIDANCE} />
          </ChartCard>
        </div>
      </div>
    </div>
  )
}
