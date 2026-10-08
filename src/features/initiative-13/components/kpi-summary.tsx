import {
  Activity,
  Boxes,
  Clock,
  ListChecks,
  PackageX,
  TrendingUp,
  TriangleAlert,
} from "lucide-react"

import { KPIStatCard } from "@/components/shared/kpi-stat-card"
import type { I13Summary } from "@/lib/api/i13"
import { formatCount } from "@/lib/utils"

/**
 * Renders exactly the fields `I13SummaryResponse` returns (§6 of the W6.7
 * task: the FRS requires "utilisation KPIs" without locking the exact
 * card set) — no invented KPI is added here. `reclassificationCandidateCount`
 * is deliberately not shown: reclassification belongs to Initiative 7.
 */
export function KpiSummary({
  summary,
  plant,
  material,
}: {
  summary: I13Summary
  /** The scope the backend counted for; shown so the cards never read as both plants when they are one. */
  plant?: string
  material?: string
}) {
  const scope = [plant ? `Plant ${plant}` : "Plants 1300 and 1500 combined", material ? `material ${material}` : null]
    .filter(Boolean)
    .join(", ")
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-muted-foreground">Counts for: {scope}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPIStatCard label="Total OAR positions" value={formatCount(summary.totalOarPositions)} icon={<Boxes className="size-3.5" />} />
        <KPIStatCard label="Fast-moving" value={formatCount(summary.fastMovingCount)} icon={<TrendingUp className="size-3.5" />} />
        <KPIStatCard label="Slow-moving" value={formatCount(summary.slowMovingCount)} icon={<Clock className="size-3.5" />} />
        <KPIStatCard label="Non-moving" value={formatCount(summary.nonMovingCount)} icon={<PackageX className="size-3.5" />} />
        <KPIStatCard label="GR not issued (30d)" value={formatCount(summary.grNotIssued30DayCount)} icon={<TriangleAlert className="size-3.5" />} />
        <KPIStatCard label="Plan breaches" value={formatCount(summary.planBreachCount)} icon={<Activity className="size-3.5" />} />
        <KPIStatCard label="No-plan exceptions" value={formatCount(summary.noPlanCount)} icon={<ListChecks className="size-3.5" />} />
      </div>
      {summary.valuationIsMocked && (
        <p className="text-[11px] text-muted-foreground">
          Valuation figures are indicative and not yet sourced from SAP.
        </p>
      )}
    </div>
  )
}
