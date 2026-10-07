import Link from "next/link"
import type { ReactNode } from "react"
import { ChevronRight, CircleCheck, Layers, ListX, PackageCheck, TriangleAlert } from "lucide-react"

import { DistributionBar } from "@/features/initiative-13/components/distribution-bar"
import {
  AGING_BAND_LABEL,
  AGING_BAND_TONE,
} from "@/features/initiative-13/utils/status-labels"
import type { I13Summary } from "@/lib/api/i13"
import { cn, formatCount } from "@/lib/utils"

/**
 * The dashboard's overview: every field `I13SummaryResponse` returns, and
 * nothing invented.
 *
 * Laid out as two cards rather than eight equal tiles. The aging bands are
 * shares of one total, so they are drawn as one split; the four exception-type
 * counts are things somebody has to act on, so each links to the screen where
 * that happens.
 */
export function KpiSummary({
  summary,
  inView,
}: {
  summary: I13Summary
  /** Figures for the filtered position list, shown under the split. */
  inView?: ReactNode
}) {
  const bands = [
    { key: "FAST", count: summary.fastMovingCount },
    { key: "SLOW", count: summary.slowMovingCount },
    { key: "NON_MOVING", count: summary.nonMovingCount },
  ].map((b) => ({
    ...b,
    label: AGING_BAND_LABEL[b.key],
    tone: AGING_BAND_TONE[b.key],
  }))

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 lg:col-span-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-foreground">Movement profile</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              All OAR material–plant positions by how recently they moved — not
              affected by the filters
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {formatCount(summary.totalOarPositions)}
            </div>
            <div className="text-xs text-muted-foreground">positions</div>
          </div>
        </div>
        <DistributionBar segments={bands} label="OAR positions by aging band" />
        {inView && <div className="mt-auto border-t border-border pt-4">{inView}</div>}
      </section>

      <section className="flex flex-col rounded-xl border border-border bg-card p-5 lg:col-span-5">
        <h2 className="text-sm font-medium text-foreground">Needs attention</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          All plants — open an item to see the positions behind it
        </p>
        <ul className="mt-3 flex flex-col divide-y divide-border">
          <AttentionRow
            href="/oar-utilization/watch?view=grni"
            icon={<TriangleAlert className="size-4" />}
            label="Received, not issued for 30+ days"
            count={summary.grNotIssued30DayCount}
            tone="warning"
          />
          <AttentionRow
            href="/oar-utilization/aging-exceptions"
            icon={<ListX className="size-4" />}
            label="Plan breaches"
            count={summary.planBreachCount}
            tone="danger"
          />
          <AttentionRow
            href="/oar-utilization/plans"
            icon={<PackageCheck className="size-4" />}
            label="Reservations without a plan"
            count={summary.noPlanCount}
            tone="warning"
          />
          <AttentionRow
            href="/oar-utilization/reclassification"
            icon={<Layers className="size-4" />}
            label="Reclassification candidates"
            count={summary.reclassificationCandidateCount}
            tone="info"
          />
        </ul>
      </section>
    </div>
  )
}

const ROW_TONE = {
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-primary/10 text-primary",
} as const

function AttentionRow({
  href,
  icon,
  label,
  count,
  tone,
}: {
  href: string
  icon: ReactNode
  label: string
  count: number
  tone: keyof typeof ROW_TONE
}) {
  const clear = count === 0
  return (
    <li>
      <Link
        href={href}
        className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            clear ? "bg-success/15 text-success" : ROW_TONE[tone]
          )}
        >
          {clear ? <CircleCheck className="size-4" /> : icon}
        </span>
        <span className="min-w-0 flex-1 text-sm text-foreground">{label}</span>
        <span
          className={cn(
            "text-base font-semibold tabular-nums",
            clear ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {clear ? "None" : formatCount(count)}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  )
}
