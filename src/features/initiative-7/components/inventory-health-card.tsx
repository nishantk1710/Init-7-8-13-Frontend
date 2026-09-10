import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import { cn } from "@/lib/utils"
import type { RiskLevel } from "@/components/shared/risk-badge"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

const RISK_ORDER: RiskLevel[] = ["critical", "high", "medium", "low"]

const RISK_LABEL: Record<RiskLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
}

const RISK_COLOR_CLASS: Record<RiskLevel, string> = {
  critical: "bg-destructive",
  high: "bg-[color-mix(in_oklch,var(--warning)_40%,var(--destructive)_60%)]",
  medium: "bg-warning",
  low: "bg-success",
}

const RISK_TEXT_CLASS: Record<RiskLevel, string> = {
  critical: "text-destructive",
  high: "text-[color-mix(in_oklch,var(--warning)_40%,var(--destructive)_60%)]",
  medium: "text-warning",
  low: "text-success",
}

function pct(part: number, whole: number): string {
  return whole === 0 ? "0.0" : ((part / whole) * 100).toFixed(1)
}

/** Stockout-risk distribution — a single segmented bar (Critical at top down
 * to Low) alongside a legend giving each tier's count and share of the set.
 * Clicking a tier cross-filters the rest of the dashboard by that risk level. */
export function InventoryHealthCard({
  recommendations = RECOMMENDATIONS,
  activeRisk,
  onRiskClick,
}: {
  recommendations?: Recommendation[]
  activeRisk?: RiskLevel | null
  onRiskClick?: (level: RiskLevel) => void
}) {
  const total = recommendations.length
  const counts = RISK_ORDER.map((level) => ({
    level,
    count: recommendations.filter((r) => r.risk === level).length,
  }))

  return (
    <div className="flex items-center gap-4">
      {/* One continuous column, most severe tier at the top. Segments are
          sized by share and butt up against each other; a slight corner
          radius on the clipping container keeps it cylindrical rather than
          the fully-rounded capsule shape. */}
      <div className="flex h-[150px] w-8 shrink-0 flex-col overflow-hidden rounded-md bg-muted">
        {counts.map(({ level, count }) => (
          <button
            key={level}
            type="button"
            onClick={() => onRiskClick?.(level)}
            disabled={!onRiskClick}
            aria-label={`${RISK_LABEL[level]} — ${count} of ${total}`}
            className={cn(
              "w-full shrink-0 transition-opacity",
              RISK_COLOR_CLASS[level],
              onRiskClick && "cursor-pointer",
              activeRisk && activeRisk !== level && "opacity-30"
            )}
            style={{ height: total ? `${(count / total) * 100}%` : 0 }}
          />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {counts.map(({ level, count }) => (
          <button
            key={level}
            type="button"
            onClick={() => onRiskClick?.(level)}
            disabled={!onRiskClick}
            className={cn(
              "flex items-center justify-between gap-3 rounded-md px-1 py-0.5 text-sm transition-colors",
              onRiskClick && "cursor-pointer hover:bg-muted/50",
              activeRisk && activeRisk !== level && "opacity-40"
            )}
          >
            <span className={cn("flex items-center gap-2 font-medium", RISK_TEXT_CLASS[level])}>
              <span className={cn("size-2.5 shrink-0 rounded-full", RISK_COLOR_CLASS[level])} />
              {RISK_LABEL[level]}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {count} ({pct(count, total)}%)
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
