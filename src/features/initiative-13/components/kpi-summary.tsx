import { Activity, Boxes, Clock, ListChecks, PackageX, TrendingUp, TriangleAlert } from "lucide-react"

import { DashboardInfo } from "@/features/initiative-13/components/dashboard-info"
import { KpiCard } from "@/features/initiative-13/components/ui/kpi-card"
import type { I13Summary } from "@/lib/api/i13"
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
 * a follow-up. Each card's (i) explains its rule (`data/dashboard-info.ts`).
 */
export function KpiSummary({ summary }: { summary: I13Summary }) {
  return (
    <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Total OAR materials"
        value={formatCount(summary.totalOarPositions)}
        icon={<Boxes className={ICON} aria-hidden />}
        accent="primary"
        info={<DashboardInfo id="totalOar" />}
      />
      <KpiCard
        label="Fast-moving"
        value={formatCount(summary.fastMovingCount)}
        icon={<TrendingUp className={ICON} aria-hidden />}
        accent="healthy"
        info={<DashboardInfo id="fastMoving" />}
      />
      <KpiCard
        label="Slow-moving"
        value={formatCount(summary.slowMovingCount)}
        icon={<Clock className={ICON} aria-hidden />}
        accent="caution"
        info={<DashboardInfo id="slowMoving" />}
      />
      <KpiCard
        label="Non-moving"
        value={formatCount(summary.nonMovingCount)}
        icon={<PackageX className={ICON} aria-hidden />}
        accent="urgent"
        info={<DashboardInfo id="nonMoving" />}
      />
      <KpiCard
        label="GR not issued (30d)"
        value={formatCount(summary.grNotIssued30DayCount)}
        icon={<TriangleAlert className={ICON} aria-hidden />}
        accent="urgent"
        info={<DashboardInfo id="grNotIssued" />}
      />
      <KpiCard
        label="Planned Consumption Overdue"
        value={formatCount(summary.planBreachCount)}
        icon={<Activity className={ICON} aria-hidden />}
        accent="caution"
        info={<DashboardInfo id="planOverdue" />}
      />
      <KpiCard
        label="Non-AI Reservations"
        value={formatCount(summary.noPlanCount)}
        icon={<ListChecks className={ICON} aria-hidden />}
        accent="primary"
        info={<DashboardInfo id="nonAi" />}
      />
    </div>
  )
}
