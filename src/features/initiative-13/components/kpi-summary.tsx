import { Activity, Boxes, Clock, ListChecks, PackageX, TrendingUp, TriangleAlert } from "lucide-react"

import { KpiCard } from "@/features/initiative-13/components/ui/kpi-card"
import type { I13Summary } from "@/lib/api/i13"
import { EXCEPTION_TYPE_HINT } from "@/features/initiative-13/utils/status-labels"
import { formatCount } from "@/lib/utils"

const ICON = "size-3.5"

/**
 * Renders exactly the fields `I13SummaryResponse` returns (§6 of the W6.7
 * task: the FRS requires "utilisation KPIs" without locking the exact
 * card set) — no invented KPI is added here. The reclassification count is
 * deliberately not shown: reclassification is out of the dashboard's scope.
 *
 * Seven cards, four to a row like the other modules' KPI rows: the total, its
 * split into fast / slow / non-moving, then the three counts that each ask for
 * a follow-up.
 */
export function KpiSummary({ summary }: { summary: I13Summary }) {
  return (
    <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Total OAR materials" value={formatCount(summary.totalOarPositions)} icon={<Boxes className={ICON} aria-hidden />} accent="primary" />
      <KpiCard label="Fast-moving" value={formatCount(summary.fastMovingCount)} icon={<TrendingUp className={ICON} aria-hidden />} accent="healthy" />
      <KpiCard label="Slow-moving" value={formatCount(summary.slowMovingCount)} icon={<Clock className={ICON} aria-hidden />} accent="caution" />
      <KpiCard label="Non-moving" value={formatCount(summary.nonMovingCount)} icon={<PackageX className={ICON} aria-hidden />} accent="urgent" />
      <KpiCard
        label="GR not issued (30d)"
        value={formatCount(summary.grNotIssued30DayCount)}
        icon={<TriangleAlert className={ICON} aria-hidden />}
        accent="urgent"
        title="Received into stock 30+ days ago and not yet issued."
      />
      <KpiCard
        label="Planned Consumption Overdue"
        value={formatCount(summary.planBreachCount)}
        icon={<Activity className={ICON} aria-hidden />}
        accent="caution"
        title={`${EXCEPTION_TYPE_HINT.PLAN_BREACH}.`}
      />
      <KpiCard
        label="Non-AI Reservations"
        value={formatCount(summary.noPlanCount)}
        icon={<ListChecks className={ICON} aria-hidden />}
        accent="primary"
        title={`${EXCEPTION_TYPE_HINT.NO_PLAN}.`}
      />
    </div>
  )
}
