// The Overview's "current position by plant" figures for stockout risk and excess inventory.
//
// Built only from the summary endpoint's counts, once per plant scope. Counts, not money: the
// quantities and prices behind these KPIs are not reliable in absolute terms right now, but "is
// on-hand stock below what the lead time needs" and "is the current max stock above the recommended
// one" compare quantities that are read the same way, so a count is the safe thing to show.

import type { RecommendationSummaryStats } from "@/features/initiative-7/services/i7-api"

export type PositionScope = "ALL" | "1300" | "1500"

export const POSITION_SCOPES: PositionScope[] = ["ALL", "1300", "1500"]

export interface PlantPosition {
  scope: PositionScope
  /** Material-plants in scope (the newest recommendation of each). */
  total: number
  /** Fast / Slow moving, with stock on hand below average daily consumption x lead time. */
  stockoutRisk: number
  /** Material-plants the stockout figure could judge -- its denominator. Insufficient Data and
   * Non-moving material-plants are not in it. */
  stockoutEvaluated: number
  /** ISO date the stockout figure was read as of; null = the usage has not been built. */
  stockoutAsOf: string | null
  /** Current max stock above the recommended max stock. */
  excess: number
}

export function toPlantPosition(scope: PositionScope, stats: RecommendationSummaryStats): PlantPosition {
  return {
    scope,
    total: stats.total,
    stockoutRisk: stats.criticalStockoutRiskCount,
    stockoutEvaluated: stats.stockoutRiskEvaluatedCount,
    stockoutAsOf: stats.stockoutRiskAsOf,
    excess: stats.excessInventoryCandidatesCount,
  }
}

/** "53%", "0.4%", "0%" -- one decimal below 10%, none above; null when there is nothing to divide by. */
export function formatShare(count: number, total: number): string | null {
  if (total <= 0) return null
  const percent = (count / total) * 100
  if (percent === 0) return "0%"
  return percent < 10 ? `${percent.toFixed(1).replace(/\.0$/, "")}%` : `${Math.round(percent)}%`
}

export type PositionMetric = "stockoutRisk" | "excess"

export interface PositionBar {
  scope: PositionScope
  value: number
  total: number
}

/** One bar per scope for a metric, in the fixed All / 1300 / 1500 order. The stockout bars are out of
 * the material-plants that could be judged; the excess bars, out of all of them. */
export function positionBars(positions: PlantPosition[], metric: PositionMetric): PositionBar[] {
  return POSITION_SCOPES.flatMap((scope) => {
    const position = positions.find((candidate) => candidate.scope === scope)
    if (!position) return []
    const total = metric === "stockoutRisk" ? position.stockoutEvaluated : position.total
    return [{ scope, value: position[metric], total }]
  })
}

/** The date the stockout bars were read as of, or null when none of the scopes has one (the usage
 * has not been built, so every count is "not computed" and not 0). */
export function stockoutAsOf(positions: PlantPosition[]): string | null {
  return positions.find((position) => position.stockoutAsOf !== null)?.stockoutAsOf ?? null
}
