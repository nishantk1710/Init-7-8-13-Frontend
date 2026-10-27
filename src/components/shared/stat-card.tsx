import type { ReactNode } from "react"

import { cn, formatCount } from "@/lib/utils"

export type StatTone = "action" | "healthy" | "caution" | "urgent"

/** The same left-edge colours the OAR KPI cards use. */
const EDGE: Record<StatTone, string> = {
  action: "before:bg-action",
  healthy: "before:bg-success",
  caution: "before:bg-warning",
  urgent: "before:bg-destructive",
}

/**
 * Number first, then what it counts in bold, then one line of explanation, on
 * a card with a coloured left edge. Given `onClick` it is a toggle button
 * (`pressed` says whether its filter is on); otherwise a plain card.
 */
export function StatCard({
  value,
  label,
  hint,
  tone = "action",
  onClick,
  pressed,
  className,
}: {
  value: number | string
  label: string
  hint?: ReactNode
  tone?: StatTone
  onClick?: () => void
  pressed?: boolean
  className?: string
}) {
  const body = (
    <>
      <span className="text-[30px] leading-tight font-extrabold tracking-tight text-foreground tabular-nums">
        {typeof value === "number" ? formatCount(value) : value}
      </span>
      <span className="text-sm font-bold text-foreground">{label}</span>
      {hint && <span className="text-[13px] text-muted-foreground">{hint}</span>}
    </>
  )
  const frame = cn(
    "relative flex flex-col items-start gap-0.5 overflow-hidden rounded-card border border-line bg-card py-4 pr-4 pl-5 text-left",
    "before:absolute before:inset-y-0 before:left-0 before:w-1",
    EDGE[tone],
    className
  )
  if (!onClick) return <div className={frame}>{body}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        frame,
        "transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        pressed && "ring-2 ring-action"
      )}
    >
      {body}
    </button>
  )
}
