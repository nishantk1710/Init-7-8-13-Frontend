import { connection } from "next/server"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { AlertBanner } from "@/components/shared/alert-banner"
import { ChartCard } from "@/components/shared/chart-card"
import { PageHeader } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import { AgingBucketsChart } from "@/features/initiative-13/components/aging-buckets-chart"
import { DepartmentValueChart } from "@/features/initiative-13/components/department-value-chart"
import { InflowTrendChart } from "@/features/initiative-13/components/inflow-trend-chart"
import { KpiSummary } from "@/features/initiative-13/components/kpi-summary"
import {
  CalculatedAtNote,
  LoadFailure,
} from "@/features/initiative-13/components/load-states"
import { RedeploymentAvoidanceChart } from "@/features/initiative-13/components/redeployment-avoidance-chart"
import {
  NM_SM_INFLOW_TREND,
  REDEPLOYMENT_AVOIDANCE,
  getUnutilizedValueByDepartment,
} from "@/features/initiative-13/data/overview-metrics"
import { loadLiveSummary, loadLiveWatch } from "@/features/initiative-13/data/live-loaders"
import { USING_LIVE_DATA } from "@/lib/dataset-mode"

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

/**
 * The Initiative 13 overview.
 *
 * **Half of this page is demo data, and it now says so.** The KPIs and the two
 * distribution charts are backend-computed; the department-value, NM/SM inflow
 * and redeployment-avoidance charts are hand-written illustrations with no
 * endpoint behind them. That was previously disclosed only in the small grey
 * subtitle under each chart, which is not where somebody reading a number looks.
 *
 * This is the same banner Initiative 8's overview carries for the same reason:
 * a hand-written figure sitting unlabelled beside a real one is exactly the
 * confusion the dataset-mode module exists to prevent.
 */
export async function OARUtilizationOverviewPage() {
  await connection()

  let summary: Awaited<ReturnType<typeof loadLiveSummary>> | null = null
  let watch: Awaited<ReturnType<typeof loadLiveWatch>> | null = null
  let loadError: string | null = null
  try {
    const [summaryResult, watchResult] = await Promise.all([
      loadLiveSummary(),
      loadLiveWatch(),
    ])
    summary = summaryResult
    watch = watchResult
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  const departmentValue = getUnutilizedValueByDepartment()

  // Counted from the rows the backend classified. Nothing here re-derives an
  // aging band or a plan status -- doing so would let this page disagree with
  // the WATCH screen about the same material.
  const agingDistribution = countBy(
    watch?.rows.map((row) => row.agingBand) ?? [],
    ["FAST", "SLOW", "NON_MOVING"],
    AGING_BAND_LABELS
  )
  const planDistribution = countBy(
    watch?.rows.map((row) => row.acquiredVsPlanStatus) ?? [],
    ["NO_PLAN", "BELOW_PLAN", "ON_PLAN", "ABOVE_PLAN"],
    PLAN_STATUS_LABELS
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="OAR Utilization"
          description="End-to-end tracking of OAR spares demand from reservation through utilization."
          actions={
            <div className="flex items-center gap-3">
              <CalculatedAtNote calculatedAt={watch?.calculatedAt ?? null} />
              <Link
                href="/oar-utilization/utilisation-dashboard"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Open Utilisation Dashboard
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          }
        />

        {USING_LIVE_DATA && (
          <AlertBanner tone="warning" title="Three charts on this page are demo data, not SAP">
            Unutilized value by department, the NM/SM inflow trend and
            redeployment avoidance are hand-written illustrations — no endpoint
            serves them, and no valuation source exists in Initiative 13&rsquo;s
            table set. The KPIs, aging buckets and acquired-versus-plan chart are
            computed by the backend from the July extract.
          </AlertBanner>
        )}

        {loadError !== null && <LoadFailure what="utilization summary" message={loadError} />}

        {summary && <KpiSummary summary={summary} />}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <ChartCard
            title="Aging buckets"
            subtitle="OAR material+plant positions by backend-computed aging band"
            span={6}
          >
            <AgingBucketsChart data={agingDistribution} />
          </ChartCard>
          <ChartCard
            title="Unutilized value by department"
            subtitle="Requested minus confirmed-used, by cost center — illustrative, mock data"
            span={6}
          >
            <DepartmentValueChart data={departmentValue} />
          </ChartCard>
          <ChartCard
            title="Acquired vs. plan"
            subtitle="Positions by backend-computed acquired-vs-plan status"
            span={6}
          >
            <AgingBucketsChart data={planDistribution} />
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

/** Count occurrences, keeping every expected bucket so a zero is visible. */
function countBy(
  values: string[],
  buckets: string[],
  labels: Record<string, string>
): { bucket: string; count: number }[] {
  const counts: Record<string, number> = Object.fromEntries(buckets.map((b) => [b, 0]))
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return Object.entries(counts).map(([key, count]) => ({
    bucket: labels[key] ?? key,
    count,
  }))
}
