import type { Tone } from "@/features/initiative-13/utils/status-labels"
import { cn, formatCount } from "@/lib/utils"

const TONE_FILL: Record<Tone, string> = {
  neutral: "bg-muted-foreground/40",
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
}

export type DistributionSegment = {
  key: string
  label: string
  count: number
  tone: Tone
}

/**
 * One stacked bar with a legend underneath -- a share-of-total view.
 *
 * Replaces the per-bucket bar charts on the dashboard. Those coloured bars by
 * position rather than meaning, and with skewed data (every position
 * non-moving, every reservation without a plan) they drew a single tall bar
 * that said less than a percentage does. Server-rendered: no chart library.
 */
export function DistributionBar({
  segments,
  label,
  className,
}: {
  segments: DistributionSegment[]
  /** What is being split, for screen readers, e.g. "OAR positions by aging band". */
  label: string
  className?: string
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0)
  const share = (count: number) => (total === 0 ? 0 : (count / total) * 100)
  const summary = segments
    .map((s) => `${s.label}: ${formatCount(s.count)} (${Math.round(share(s.count))}%)`)
    .join(", ")

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        role="img"
        aria-label={`${label}. ${summary}`}
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
      >
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <div
              key={s.key}
              className={cn("h-full first:rounded-l-full last:rounded-r-full", TONE_FILL[s.tone])}
              style={{ width: `${share(s.count)}%` }}
              title={`${s.label}: ${formatCount(s.count)}`}
            />
          ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        {segments.map((s) => (
          <li key={s.key} className={cn("flex flex-col gap-0.5", s.count === 0 && "opacity-60")}>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", TONE_FILL[s.tone])} />
              {s.label}
            </span>
            <span className="flex items-baseline gap-1.5 pl-3.5">
              <span className="text-base font-semibold tabular-nums text-foreground">
                {formatCount(s.count)}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {total === 0 ? "—" : `${formatShare(share(s.count))}%`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** "0.4" rather than "0" for a real but small share; never "100" for 99.6. */
function formatShare(value: number): string {
  if (value === 0 || value === 100) return String(value)
  if (value < 1) return value.toFixed(1)
  if (value > 99) return Math.min(value, 99.9).toFixed(1)
  return String(Math.round(value))
}
