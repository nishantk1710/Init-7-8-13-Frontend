import { TONE_FILL } from "@/features/initiative-13/components/ui/tones"
import type { DisplayTone } from "@/features/initiative-13/utils/oar-display"
import { cn } from "@/lib/utils"

/**
 * One value against a scale, as a filled track. Decorative alongside the
 * number it sits next to -- the number is the reading, so the bar is hidden
 * from screen readers unless it is given a `label`.
 */
export function ProgressBar({
  value,
  max,
  tone,
  label,
  className,
}: {
  value: number
  max: number
  tone: DisplayTone
  label?: string
  className?: string
}) {
  const fill = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0
  return (
    <div
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className={cn("h-full rounded-full", TONE_FILL[tone])} style={{ width: `${fill * 100}%` }} />
    </div>
  )
}

export type BarSegment = { key: string; label: string; count: number; tone: DisplayTone }

/** Several counts as one stacked bar, each segment its share of the total. */
export function SegmentedBar({
  segments,
  label,
  className,
}: {
  segments: BarSegment[]
  /** What is being split, read out with every segment's count. */
  label: string
  className?: string
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0)
  const summary = segments.map((s) => `${s.label}: ${s.count}`).join(", ")
  return (
    <div
      role="img"
      aria-label={`${label}. ${summary}`}
      className={cn("flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted", className)}
    >
      {total > 0 &&
        segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <div
              key={s.key}
              className={cn("h-full first:rounded-l-full last:rounded-r-full", TONE_FILL[s.tone])}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${s.label}: ${s.count}`}
            />
          ))}
    </div>
  )
}
