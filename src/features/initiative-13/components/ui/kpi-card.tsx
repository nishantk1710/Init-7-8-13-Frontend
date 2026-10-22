import type { ReactNode } from "react"

import { TONE_BORDER } from "@/features/initiative-13/components/ui/tones"
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
        <h2 id={id} className="text-base font-bold text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/**
 * One number with its label and a one-line explanation. `accent` draws a
 * coloured left edge -- the card's tone, which its label also says in words.
 */
export function KpiCard({
  label,
  value,
  hint,
  accent,
  icon,
  size = "md",
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  accent?: DisplayTone
  icon?: ReactNode
  /** `lg` for a headline number (52px), `md` otherwise (36px). */
  size?: "md" | "lg"
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-card border border-line bg-card p-5",
        accent && cn("border-l-4", TONE_BORDER[accent]),
        className
      )}
    >
      <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "font-extrabold tracking-tight text-ink tabular-nums",
          size === "lg" ? "text-[44px] leading-none sm:text-[52px]" : "text-4xl leading-tight"
        )}
      >
        {value}
      </div>
      {hint && <p className="text-sm text-ink-muted">{hint}</p>}
    </div>
  )
}
