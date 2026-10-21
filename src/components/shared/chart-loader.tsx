import { cn } from "@/lib/utils"

/**
 * The loader for a chart or a card: a thin ring with a faint track and one bright arc running round it. One colour -- the
 * track and the arc are both `currentColor` (the arc at full strength, the track at a fifth of it), and the colour is one
 * theme colour, `primary`, the same on every chart and card -- so it follows light and dark mode.
 *
 * Give it the height of what it stands in for (`className`) so the layout does not jump when the content arrives. `label` is
 * what a screen reader announces and is not drawn. The turning is in globals.css (`chart-loader-ring`) and slows for reduced
 * motion. A whole page uses the hourglass (`PageLoader`).
 */
export function ChartLoader({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn("flex items-center justify-center", className)}>
      <svg viewBox="0 0 50 50" aria-hidden="true" className="chart-loader-ring size-12 shrink-0 text-primary" fill="none">
        <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="5" opacity="0.2" />
        <circle
          cx="25"
          cy="25"
          r="20"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="31.4 125.7"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  )
}
