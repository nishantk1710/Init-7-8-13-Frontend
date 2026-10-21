// What the Quarterly Report's management view needs from the saved report, as plain values.
//
// The backend sends decimals as strings and "not available" as null. These helpers turn them into what the
// Overview's own components take, and never turn a missing figure into 0.

import type {
  ApiActivityRow,
  ApiAdoptionQuarter,
  ApiKpiCard,
  ApiPlantPosition,
  ApiQuarterManagement,
} from "@/features/initiative-7/types/api"
import type { PlantPosition, PositionScope } from "@/features/initiative-7/utils/plant-position"
import type { AdoptionSummaryResult } from "@/features/initiative-7/services/i7-api"

/** A decimal or count from the API as a number; null when it is not there. */
export function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** The report's per-plant positions as the Overview's plant charts take them: All plants, then each plant. A plant
 * whose stockout measurement is stale is left with no as-of date, so the chart never draws it as a position. */
export function plantPositionsOf(management: ApiQuarterManagement): PlantPosition[] {
  return management.plant_positions.map((entry: ApiPlantPosition) => {
    const stockout = entry.figures.stockout
    return {
      scope: (entry.plant ?? "ALL") as PositionScope,
      total: entry.figures.population,
      stockoutRisk: stockout.at_risk,
      stockoutEvaluated: stockout.evaluated,
      stockoutAsOf: stockout.stale ? null : stockout.as_of,
      excess: entry.figures.excess_count,
    }
  })
}

/** Whether the stockout figures can be shown as the period's position at all. */
export function stockoutUsable(management: ApiQuarterManagement): boolean {
  const stockout = management.position.stockout
  return stockout.as_of !== null && !stockout.stale
}

/** The Overview's SAP adoption card's shape, from the report's adoption counts; null when the backend did not
 * send them (an older backend), so the page says so instead of drawing zeros. */
export function adoptionSummaryOf(adoption: ApiAdoptionQuarter): AdoptionSummaryResult | null {
  if (adoption.tracked === null || adoption.tracked === undefined) return null
  const adopted = adoption.adopted ?? 0
  const partially = adoption.partially_adopted ?? 0
  const notAdopted = adoption.not_adopted ?? 0
  const known = adopted + partially + notAdopted
  return {
    totalEvaluated: adoption.tracked,
    adoptedCount: adopted,
    partiallyAdoptedCount: partially,
    notAdoptedCount: notAdopted,
    unknownCount: adoption.pending ?? 0,
    adoptionRatePercentage: known > 0 ? Math.round(((adopted + partially) / known) * 1000) / 10 : null,
  }
}

/** One activity cell for display: a count, or "—" when it is not available. */
export function activityCell(value: string | number | null): string {
  const n = num(value)
  return n === null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

/** Whether a row's months add up to its quarter total (the backend also checks this against one whole-period query;
 * this is the check a reader can do by eye). Rows with nothing to add return null. */
export function rowAddsUp(row: ApiActivityRow): boolean | null {
  const months = row.months.map(num)
  const total = num(row.quarter_total)
  if (total === null || months.every((m) => m === null)) return null
  return months.reduce<number>((sum, m) => sum + (m ?? 0), 0) === total
}

/** The cards in the order the page shows them, by key, skipping any the report does not carry. */
export const KPI_ORDER = [
  "materials_assessed",
  "recommendations_generated",
  "critical_stockout_risk",
  "excess_inventory_opportunity",
  "working_capital_impact",
  "pending_approval",
] as const

export function orderedKpis(cards: ApiKpiCard[]): ApiKpiCard[] {
  const byKey = new Map(cards.map((card) => [card.key, card]))
  return KPI_ORDER.flatMap((key) => {
    const card = byKey.get(key)
    return card ? [card] : []
  })
}

/** What a card shows as its big value: the number with its unit, or why it has none. */
export function kpiValueText(card: ApiKpiCard): string {
  const value = num(card.value)
  if (card.status !== "AVAILABLE" || value === null) return "Not available"
  const isMoney = card.key === "excess_inventory_opportunity" || card.key === "working_capital_impact"
  if (!isMoney) return value.toLocaleString("en-US", { maximumFractionDigits: 0 })
  const sign = value < 0 ? "−" : value > 0 && card.key === "working_capital_impact" ? "+" : ""
  const millions = Math.abs(value) / 1_000_000
  const prefix = card.unit.startsWith("amount") ? "" : `${card.unit} `
  return `${sign}${prefix}${millions.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`
}
