import type { ReactNode } from "react"

import type { DisplayTone } from "@/features/initiative-13/utils/oar-display"
import { cn } from "@/lib/utils"

/** A white card: the one surface every OAR section sits on. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-card border border-line bg-card p-5", className)}>{children}</section>
  )
}

/** A card's heading, with an optional one-line subtitle and actions on the right. */
export function CardHeading({
  title,
  subtitle,
  actions,
  id,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  id?: string
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 id={id} className="text-[15.5px] font-semibold text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** The icon badge's tint and the card's left edge, per tone. Blue (the action colour) stands for "no verdict". */
const BADGE: Record<DisplayTone, string> = {
  healthy: "bg-success/10 text-success",
  caution: "bg-warning/15 text-warning",
  urgent: "bg-destructive/10 text-destructive",
  primary: "bg-action/10 text-action",
  neutral: "bg-action/10 text-action",
}

const EDGE: Record<DisplayTone, string> = {
  healthy: "before:bg-success",
  caution: "before:bg-warning",
  urgent: "before:bg-destructive",
  primary: "before:bg-action",
  neutral: "before:bg-action",
}

/**
 * One figure, in the Initiative 7 Overview's card: an icon badge and the name on top, the number under it, an
 * optional line of explanation below. `accent` tints the badge and draws the coloured left edge -- the card's tone,
 * which its label also says in words. Written out here rather than imported: modules do not import each other.
 */
export function KpiCard({
  label,
  value,
  hint,
  title,
  accent = "primary",
  icon,
  className,
}: {
  label: string
  value: ReactNode
  /** A line under the number. */
  hint?: ReactNode
  /** What the figure counts, on hover, for a card that has no room for a line. */
  title?: string
  accent?: DisplayTone
  /** Drawn inside the badge, which supplies its colour: give it a size, not a colour. */
  icon?: ReactNode
  className?: string
}) {
  return (
    <div
      title={title}
      className={cn(
        "group/card relative flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card px-5 py-4 shadow-xs",
        "before:absolute before:inset-y-4 before:-left-px before:w-[3px] before:rounded-r-full",
        EDGE[accent],
        "transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-muted-foreground">
        {icon && <span className={cn("grid size-[30px] shrink-0 place-items-center rounded-lg", BADGE[accent])}>{icon}</span>}
        <span className="truncate">{label}</span>
      </span>
      <span className="mt-1.5 truncate text-[30px] leading-tight font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </span>
      {hint && <p className="text-[13.5px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
