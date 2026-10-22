import { Activity, ListChecks, TriangleAlert } from "lucide-react"

import { Card, KpiCard } from "@/features/initiative-13/components/ui/kpi-card"
import { SegmentedBar } from "@/features/initiative-13/components/ui/progress-bar"
import { TONE_INK, TONE_TINT } from "@/features/initiative-13/components/ui/tones"
import type { I13Summary } from "@/lib/api/i13"
import { percentLabel, type DisplayTone } from "@/features/initiative-13/utils/oar-display"
import { EXCEPTION_TYPE_HINT } from "@/features/initiative-13/utils/status-labels"
import { cn, formatCount } from "@/lib/utils"

/**
 * Renders exactly the fields `I13SummaryResponse` returns (§6 of the W6.7
 * task: the FRS requires "utilisation KPIs" without locking the exact
 * card set) — no invented KPI is added here. The reclassification count is
 * deliberately not shown: reclassification is out of the dashboard's scope.
 *
 * Laid out as one movement card (the total, split fast / slow / non-moving)
 * beside the three counts that each ask for a follow-up.
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <MovementCard summary={summary} scope={scope} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-4 lg:grid-cols-1">
          <KpiCard
            accent="urgent"
            icon={<TriangleAlert aria-hidden className="size-4 text-urgent-ink" />}
            label="GR not issued (30d)"
            value={formatCount(summary.grNotIssued30DayCount)}
            hint="Received into stock 30+ days ago and not yet issued."
          />
          <KpiCard
            accent="caution"
            icon={<Activity aria-hidden className="size-4 text-caution-ink" />}
            label="Planned consumption overdue"
            value={formatCount(summary.planBreachCount)}
            hint={`${EXCEPTION_TYPE_HINT.PLAN_BREACH}.`}
          />
          <KpiCard
            accent="primary"
            icon={<ListChecks aria-hidden className="size-4 text-primary-ink" />}
            label="Non-AI reservations"
            value={formatCount(summary.noPlanCount)}
            hint={`${EXCEPTION_TYPE_HINT.NO_PLAN}.`}
          />
        </div>
      </div>
      {summary.valuationIsMocked && (
        <p className="text-xs text-ink-muted">Valuation figures are indicative and not yet sourced from SAP.</p>
      )}
    </div>
  )
}

function MovementCard({ summary, scope }: { summary: I13Summary; scope: string }) {
  const total = summary.totalOarPositions
  const bands: { key: string; label: string; count: number; tone: DisplayTone }[] = [
    { key: "FAST", label: "Fast-moving", count: summary.fastMovingCount, tone: "healthy" },
    { key: "SLOW", label: "Slow-moving", count: summary.slowMovingCount, tone: "caution" },
    { key: "NON_MOVING", label: "Non-moving", count: summary.nonMovingCount, tone: "urgent" },
  ]
  return (
    <Card className="flex flex-col gap-5 lg:col-span-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-ink-muted">Total OAR materials</h2>
        <p className="text-[44px] leading-none font-extrabold tracking-tight text-ink tabular-nums sm:text-[52px]">
          {formatCount(total)}
        </p>
        <p className="text-xs text-ink-muted">Counts for: {scope}</p>
      </div>
      <SegmentedBar segments={bands} label="OAR materials by movement" />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {bands.map((band) => (
          <li key={band.key} className={cn("flex flex-col gap-1 rounded-xl p-4", TONE_TINT[band.tone])}>
            <span className="text-sm font-semibold">{band.label}</span>
            <span className="text-3xl font-extrabold tabular-nums text-ink">{formatCount(band.count)}</span>
            <span className={cn("text-sm font-semibold tabular-nums", TONE_INK[band.tone])}>
              {percentLabel(band.count, total)} of total
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
