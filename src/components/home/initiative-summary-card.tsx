import Link from "next/link"
import { ArrowRight, CircleAlert, CircleDot } from "lucide-react"

import type { InitiativeHealth, InitiativeSummary } from "@/lib/domain/contracts"
import { cn } from "@/lib/utils"

const HEALTH_CLASSES: Record<InitiativeHealth, string> = {
  healthy: "text-success",
  attention: "text-warning",
  critical: "text-destructive",
}

/** Counts get thousands separators so 44394 reads as 44,394; text passes through. */
export function formatMetric(value: string | number): string {
  return typeof value === "number" ? value.toLocaleString() : value
}

const HEALTH_LABELS: Record<InitiativeHealth, string> = {
  healthy: "Healthy",
  attention: "Needs attention",
  critical: "Critical",
}

/**
 * Pure rendering of one `InitiativeSummary` — no calculation happens here.
 *
 * `attentionCount` is the real number of items needing attention, which can be
 * larger than any capped list. When it is not given, the length of
 * `summary.actions` is used (the fixture-era behaviour).
 */
export function InitiativeSummaryCard({
  summary,
  attentionCount,
}: {
  summary: InitiativeSummary
  attentionCount?: number | null
}) {
  const attention = attentionCount === undefined ? summary.actions.length : attentionCount
  return (
    <Link
      href={summary.href}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{summary.label}</span>
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className={cn("flex items-center gap-1.5 text-xs font-medium", HEALTH_CLASSES[summary.health])}>
        <CircleDot className="size-3" />
        {HEALTH_LABELS[summary.health]}
      </div>
      {summary.metrics.length > 0 ? (
        <dl className="grid grid-cols-2 gap-2">
          {summary.metrics.slice(0, 4).map((m) => (
            <div key={m.label}>
              <dt className="text-[11px] text-muted-foreground">{m.label}</dt>
              <dd className="text-sm font-medium text-foreground">{formatMetric(m.value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-[11px] text-muted-foreground">No metrics reported yet.</p>
      )}
      {attention !== null && attention > 0 && (
        <div className="mt-auto border-t border-dashed border-border pt-2 text-[11px] text-muted-foreground">
          {attention.toLocaleString()} item{attention === 1 ? "" : "s"} need
          {attention === 1 ? "s" : ""} attention
        </div>
      )}
    </Link>
  )
}

/**
 * What a card shows when its module did not answer. Deliberately not a card of
 * zeros: "0 items need attention" and "we could not ask" are different
 * statements, and only one of them is true here.
 */
export function SummaryCardFailure({
  label,
  href,
  message,
}: {
  label: string
  href: string
  message: string
}) {
  return (
    <Link
      href={href}
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 transition-colors hover:border-destructive/60"
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
        <CircleAlert className="size-3" />
        Could not be loaded
      </div>
      <p className="text-[11px] text-muted-foreground">{message}</p>
    </Link>
  )
}
