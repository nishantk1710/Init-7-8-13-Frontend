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

import { KPIStatCard } from "@/components/shared/kpi-stat-card"
import type { I13Summary } from "@/features/initiative-13/api/types"
import { formatCount } from "@/lib/utils"

/**
 * Renders exactly the fields `I13SummaryResponse` returns (§6 of the W6.7
 * task: the FRS requires "utilisation KPIs" without locking the exact
 * card set) — no invented KPI is added here, and none of `I13Summary`'s
 * fields are dropped.
 */
export function KpiSummary({ summary }: { summary: I13Summary }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPIStatCard label="Total OAR positions" value={formatCount(summary.totalOarPositions)} icon={<Boxes className="size-3.5" />} />
        <KPIStatCard label="Fast-moving" value={formatCount(summary.fastMovingCount)} icon={<TrendingUp className="size-3.5" />} />
        <KPIStatCard label="Slow-moving" value={formatCount(summary.slowMovingCount)} icon={<Clock className="size-3.5" />} />
        <KPIStatCard label="Non-moving" value={formatCount(summary.nonMovingCount)} icon={<PackageX className="size-3.5" />} />
        <KPIStatCard label="GR not issued (30d)" value={formatCount(summary.grNotIssued30DayCount)} icon={<TriangleAlert className="size-3.5" />} />
        <KPIStatCard label="Plan breaches" value={formatCount(summary.planBreachCount)} icon={<Activity className="size-3.5" />} />
        <KPIStatCard label="No-plan exceptions" value={formatCount(summary.noPlanCount)} icon={<ListChecks className="size-3.5" />} />
        <KPIStatCard label="Reclassification candidates" value={formatCount(summary.reclassificationCandidateCount)} icon={<Layers className="size-3.5" />} />
      </div>
      {summary.valuationIsMocked && (
        <p className="text-[11px] text-muted-foreground">
          Valuation data backing these figures is currently mocked in the backend.
        </p>
      )}
    </div>
  )
}
