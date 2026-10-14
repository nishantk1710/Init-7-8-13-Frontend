// The Overview's "current position by plant" figures for stockout risk and excess inventory.
//
// Built only from the summary endpoint's counts, once per plant scope. Counts, not money: the
// quantities and prices behind these KPIs are not reliable in absolute terms right now, but "is
// on-hand stock below the reorder point" and "is the current max stock above the recommended one"
// compare quantities that are read the same way, so a count is the safe thing to show.

import type { RecommendationSummaryStats } from "@/features/initiative-7/services/i7-api"

export type PositionScope = "ALL" | "1300" | "1500"

export const POSITION_SCOPES: PositionScope[] = ["ALL", "1300", "1500"]

export interface PlantPosition {
  scope: PositionScope
  /** Material-plants in scope (the newest recommendation of each). */
  total: number
  /** Below their recommended reorder point. */
  stockoutRisk: number
  /** Current max stock above the recommended max stock. */
  excess: number
}

export function toPlantPosition(scope: PositionScope, stats: RecommendationSummaryStats): PlantPosition {
  return {
    scope,
    total: stats.total,
    stockoutRisk: stats.criticalStockoutRiskCount,
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

/** One bar per scope for a metric, in the fixed All / 1300 / 1500 order. */
export function positionBars(positions: PlantPosition[], metric: PositionMetric): PositionBar[] {
  return POSITION_SCOPES.flatMap((scope) => {
    const position = positions.find((candidate) => candidate.scope === scope)
    return position ? [{ scope, value: position[metric], total: position.total }] : []
  })
}
