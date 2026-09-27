import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import { cn, formatCount } from "@/lib/utils"
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

const BAR_HEIGHT_PX = 150
const MIN_SEGMENT_PX = 6
/** True proportional heights (count/total * 150px) for a distribution as
 * skewed as this data's (e.g. Low = 99.9%) round every other tier to
 * sub-pixel, so a real, non-zero Critical/High/Medium tier renders as
 * nothing -- indistinguishable from zero. Every tier with count > 0 gets at
 * least MIN_SEGMENT_PX of visible height; the pixels that costs are taken
 * from the largest segment(s), never fabricated, so the bar's total height
 * is still exactly BAR_HEIGHT_PX and a zero-count tier still renders as
 * zero. */
function segmentHeightsPx(counts: { level: RiskLevel; count: number }[], total: number): Record<RiskLevel, number> {
  const result = {} as Record<RiskLevel, number>
  if (total <= 0) {
    for (const { level } of counts) result[level] = 0
    return result
  }

  const raw = counts.map(({ level, count }) => ({ level, count, px: (count / total) * BAR_HEIGHT_PX }))
  const needsFloor = raw.filter((r) => r.count > 0 && r.px < MIN_SEGMENT_PX)
  const deficit = needsFloor.reduce((sum, r) => sum + (MIN_SEGMENT_PX - r.px), 0)

  const donors = raw.filter((r) => r.px >= MIN_SEGMENT_PX)
  const donorTotalPx = donors.reduce((sum, r) => sum + r.px, 0)

  for (const r of raw) {
    if (r.count > 0 && r.px < MIN_SEGMENT_PX) {
      result[r.level] = MIN_SEGMENT_PX
    } else if (donorTotalPx > 0 && deficit > 0) {
      // Shrink proportionally to each donor's own share of the donor pool,
      // so the single largest segment doesn't absorb 100% of the deficit
      // when more than one tier is large enough to lend space.
      result[r.level] = r.px - (r.px / donorTotalPx) * deficit
    } else {
      result[r.level] = r.px
    }
  }
  return result
}

/** Stockout-risk distribution — a single segmented bar (Critical at top down
 * to Low) alongside a legend giving each tier's count and share of the set.
 * Clicking a tier cross-filters the rest of the dashboard by that risk level. */
export function InventoryHealthCard({
  recommendations = RECOMMENDATIONS,
  activeRisk,
  onRiskClick,
  riskOverride,
}: {
  recommendations?: Recommendation[]
  activeRisk?: RiskLevel | null
  onRiskClick?: (level: RiskLevel) => void
  /** Part 36 -- portfolio-wide { level, count }[] + total, from GET
   * /recommendations/summary's by_risk. In live mode `recommendations` is at
   * most one fetched page, so counting risk tiers from it directly reads as
   * a portfolio distribution when it is really one page's -- with ~2.3M
   * accumulated rows nearly all NOT_EVALUABLE (and, before Part 36's
   * deriveRisk fix, silently unable to reach "high"/"medium" at all), that
   * page can read "200 Low, 0 everything else" (see
   * use-live-recommendation-summary.ts). When provided, this replaces the
   * locally-counted distribution entirely; the click-to-filter behaviour is
   * unchanged either way. */
  riskOverride?: { counts: { level: RiskLevel; count: number }[]; total: number }
}) {
  const total = riskOverride?.total ?? recommendations.length
  const counts = RISK_ORDER.map((level) => ({
    level,
    count: riskOverride
      ? riskOverride.counts.find((c) => c.level === level)?.count ?? 0
      : recommendations.filter((r) => r.risk === level).length,
  }))
  const heightsPx = segmentHeightsPx(counts, total)

  return (
    <div className="flex items-center gap-4">
      {/* One continuous column, most severe tier at the top. Every non-zero
          tier gets at least MIN_SEGMENT_PX so a small-but-real tier (e.g.
          Critical at 96 of 226,930) still shows as a visible colored band,
          not an invisible sliver -- see segmentHeightsPx's own comment. A
          slight corner radius on the clipping container keeps it cylindrical
          rather than the fully-rounded capsule shape. */}
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
            style={{ height: `${heightsPx[level]}px` }}
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
            <span className={cn("flex min-w-0 items-center gap-2 font-medium", RISK_TEXT_CLASS[level])}>
              <span className={cn("size-2.5 shrink-0 rounded-full", RISK_COLOR_CLASS[level])} />
              <span className="truncate">{RISK_LABEL[level]}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatCount(count)} ({pct(count, total)}%)
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
