import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowRight, CircleAlert, Layers, Package, Wrench } from "lucide-react"

import { AREA_ACCENT, type AreaAccent } from "@/components/home/home-areas"
import { StatusPill } from "@/features/initiative-13/components/ui/status-pill"
import type { DisplayTone } from "@/features/initiative-13/utils/oar-display"
import type { InitiativeHealth, InitiativeSummary } from "@/lib/domain/contracts"
import { NOT_AVAILABLE, NOT_LOADED } from "@/lib/domain/live-feed"
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

/** The same icons the sidebar gives each area's Overview. */
const AREA_ICON: Record<InitiativeSummary["id"], ReactNode> = {
  "initiative-7": <Package className="size-3.5" />,
  "initiative-8": <Wrench className="size-3.5" />,
  "initiative-13": <Layers className="size-3.5" />,
}

/** A figure this long would not fit beside another in a narrow card. */
const WIDE_METRIC_LENGTH = 8

/**
 * One figure on an area card: a small bordered tile, the label on top and the
 * value pinned to the bottom, so the numbers in a row line up even when one
 * label wraps to three lines and its neighbour to one. A long figure takes the
 * whole row; a statement ("Not available") is muted so it does not read as a count.
 */
export function MetricTile({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  const statement = value === NOT_AVAILABLE || value === NOT_LOADED
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-muted/30 px-3 py-2.5",
        // A long figure takes the row only in a narrow card (the container query is
        // on the card, `@md` = 28rem); in a wide one every tile is wide enough.
        value.length > WIDE_METRIC_LENGTH && !statement && "col-span-2 @md:col-span-1"
      )}
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-auto leading-tight tabular-nums",
          statement
            ? "text-sm text-muted-foreground"
            : "text-xl font-semibold tracking-tight whitespace-nowrap text-foreground",
          valueClassName
        )}
      >
        {value}
      </dd>
    </div>
  )
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
      accent={AREA_ACCENT[summary.id]}
      icon={AREA_ICON[summary.id]}
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
        <dl className="grid grid-cols-2 gap-2.5">
          {summary.metrics.slice(0, 4).map((m) => (
            <MetricTile key={m.label} label={m.label} value={formatMetric(m.value)} />
          ))}
        </dl>
      ) : (
        <p className="text-xs text-muted-foreground">No metrics reported yet.</p>
      )}
    </AreaCard>
  )
}

/**
 * The frame every Home area card shares, drawn like the Overview KPI cards: a
 * 3px accent bar down the left edge in the area's colour, an icon chip beside
 * the title with an arrow at the far end, a status pill, the body, and an
 * optional footer line. The whole card is the link.
 */
export function AreaCard({
  href,
  label,
  accent,
  icon,
  status,
  footer,
  children,
}: {
  href: string
  label: string
  /** The bar and icon-chip classes from home-areas. */
  accent: AreaAccent
  icon: ReactNode
  status: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group @container relative flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-xs",
        "before:absolute before:inset-y-4 before:-left-px before:w-[3px] before:rounded-r-full",
        accent.bar,
        "transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            "grid size-[30px] shrink-0 place-items-center rounded-lg transition-transform duration-150 group-hover:scale-105 motion-reduce:transition-none",
            accent.chip
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">{label}</span>
        {/* The status sits in the title row, not on a row of its own: a card that is
            now half the page wide has room for it, and it saves a line of height. */}
        <div className="shrink-0">{status}</div>
        <ArrowRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        />
      </div>
      {children}
      {footer && <div className="mt-auto border-t border-border pt-2.5 text-sm text-muted-foreground">{footer}</div>}
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
      className="relative flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-5 py-4 transition-colors before:absolute before:inset-y-4 before:-left-px before:w-[3px] before:rounded-r-full before:bg-destructive hover:border-destructive/60"
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
