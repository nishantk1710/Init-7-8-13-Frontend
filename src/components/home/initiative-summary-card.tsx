import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowRight, CircleAlert } from "lucide-react"

import { AREA_BORDER } from "@/components/home/home-areas"
import { StatusPill } from "@/features/initiative-13/components/ui/status-pill"
import type { DisplayTone } from "@/features/initiative-13/utils/oar-display"
import type { InitiativeHealth, InitiativeSummary } from "@/lib/domain/contracts"
import { cn } from "@/lib/utils"

const HEALTH_TONE: Record<InitiativeHealth, DisplayTone> = {
  healthy: "healthy",
  attention: "caution",
  critical: "urgent",
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
    <AreaCard
      href={summary.href}
      label={summary.label}
      edge={AREA_BORDER[summary.id]}
      status={<StatusPill tone={HEALTH_TONE[summary.health]}>{HEALTH_LABELS[summary.health]}</StatusPill>}
      footer={
        attention !== null && attention > 0 ? (
          <>
            <span className="font-semibold text-foreground">{attention.toLocaleString()}</span> item
            {attention === 1 ? "" : "s"} need{attention === 1 ? "s" : ""} attention
          </>
        ) : null
      }
    >
      {summary.metrics.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {summary.metrics.slice(0, 4).map((m) => (
            <div key={m.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{m.label}</dt>
              <dd className="text-xl font-semibold tracking-tight [overflow-wrap:anywhere] text-foreground tabular-nums 2xl:text-2xl">{formatMetric(m.value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-muted-foreground">No metrics reported yet.</p>
      )}
    </AreaCard>
  )
}

/**
 * The frame every Home area card shares: a coloured top edge in the area's
 * colour, the title with an arrow, a status pill, the body, and an optional
 * footer line. The whole card is the link.
 */
export function AreaCard({
  href,
  label,
  edge,
  status,
  footer,
  children,
}: {
  href: string
  label: string
  /** A `border-t-*` class from home-areas. */
  edge: string
  status: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-4 rounded-xl border border-t-4 border-border bg-card p-5 transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        edge
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold text-foreground">{label}</span>
        <ArrowRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        />
      </div>
      <div>{status}</div>
      {children}
      {footer && <div className="mt-auto border-t border-border pt-3 text-sm text-muted-foreground">{footer}</div>}
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
      className="flex flex-col gap-3 rounded-xl border border-t-4 border-destructive/40 bg-destructive/5 p-5 transition-colors hover:border-destructive/60"
    >
      <span className="text-base font-semibold text-foreground">{label}</span>
      <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
        <CircleAlert className="size-3" />
        Could not be loaded
      </div>
      <p className="text-[11px] text-muted-foreground">{message}</p>
    </Link>
  )
}
