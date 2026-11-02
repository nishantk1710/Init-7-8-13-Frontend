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
  // From a million up it is "−2,397.30M" as ever; below that, "1.2K" or the plain amount, so a small figure is not "0.00M".
  const currency = card.unit.startsWith("amount") ? null : card.unit
  return compactMoney(value, currency, card.key === "working_capital_impact")
}

// --- How a card reads on the page ---------------------------------------------------------------------

/** The plain one-line wording each card carries on the page, by key. The report's own explanation and notes are longer
 * and stay behind the card's (i); the PDF prints them in full. `title` is set only where a card was renamed: a saved
 * report keeps the title it was generated with, so this is what lets a rename reach the reports saved before it. */
const CARD_WORDING: Record<string, { title?: string; caption: string }> = {
  materials_assessed: { caption: "Materials we made a recommendation for" },
  recommendations_generated: { caption: "Recommendations created in this period" },
  critical_stockout_risk: { title: "High Stockout Risk", caption: "Stock below what the lead time needs" },
  excess_inventory_opportunity: { caption: "Stock above the recommended maximum · estimate" },
  working_capital_impact: { caption: "Cash released (+) or tied up (−) · estimate" },
  pending_approval: { caption: "Waiting for a decision" },
}

/** The card's title as the page and the PDF show it. */
export function cardTitle(card: ApiKpiCard): string {
  return CARD_WORDING[card.key]?.title ?? card.title
}

/** The card's one plain line; a card this file has no wording for falls back to the report's own explanation. */
export function cardCaption(card: ApiKpiCard): string {
  return CARD_WORDING[card.key]?.caption ?? card.explanation
}

// --- Monthly trends and the quarter-end position ------------------------------------------------------

import type { ApiQuarterTrends, ApiTrendMonth } from "@/features/initiative-7/types/api"

/** One point per month for the trend charts. A month with no snapshot, or whose figure was not trusted, is a gap
 * (`null`) -- never 0 -- so the line breaks there instead of drawing a value that was never measured. */
export interface TrendPoint {
  label: string
  state: ApiTrendMonth["state"]
  stockout: number | null
  excessOpportunity: number | null
  workingCapital: number | null
}

export function trendPoints(trends: ApiQuarterTrends): TrendPoint[] {
  return trends.months.map((month) => ({
    label: month.label,
    state: month.state,
    stockout: month.stockout_at_risk,
    excessOpportunity: num(month.excess_opportunity),
    workingCapital: num(month.net_rop_value_impact),
  }))
}

/** Whether a series has anything to draw at all (at least one month with a value). */
export function hasPoints(points: TrendPoint[], key: "stockout" | "excessOpportunity" | "workingCapital"): boolean {
  return points.some((point) => point[key] !== null)
}

/** The months a series has no figure for, in order -- a month with no snapshot, or one whose reading was not trusted. */
export function seriesGaps(points: TrendPoint[], key: "stockout" | "excessOpportunity" | "workingCapital"): string[] {
  return points.filter((point) => point[key] === null).map((point) => point.label)
}

/** "−2,397.30M", "+1.20M": money in millions with its sign, as the Overview's card shows it. */
export function millions(value: number | null, currency: string | null, signed = false): string {
  if (value === null) return "—"
  const sign = value < 0 ? "−" : signed && value > 0 ? "+" : ""
  const prefix = currency ? `${currency} ` : ""
  return `${sign}${prefix}${(Math.abs(value) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`
}

/** Money with its sign in the unit that reads best: "−2,397.30M", "+1.20M" from a million up, then "1.2K", then the plain
 * amount -- so a small figure is not shown as "0.00M". The trends use it; the cards keep `millions`. */
export function compactMoney(value: number | null, currency: string | null, signed = false): string {
  if (value === null) return "—"
  const abs = Math.abs(value)
  const thousands = abs / 1_000
  if (thousands >= 999.95) return millions(value, currency, signed) // 999.96K reads as 1,000K; call it 1.00M
  const sign = value < 0 ? "−" : signed && value > 0 ? "+" : ""
  const prefix = currency ? `${currency} ` : ""
  if (thousands >= 1) return `${sign}${prefix}${thousands.toLocaleString("en-US", { maximumFractionDigits: 1 })}K`
  return `${sign}${prefix}${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

/** A money axis tick: "−2M", "1.5K", "250" -- short, and never "0M" for every tick of a small series. */
export function axisMoney(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? "−" : ""
  if (abs >= 1_000_000) return `${sign}${+(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${+(abs / 1_000).toFixed(1)}K`
  return `${sign}${Math.round(abs)}`
}

/** What a month's row says about how it was measured, in a few words. */
export function monthBasisLabel(month: ApiTrendMonth): string {
  if (month.state === "MISSING") return "No snapshot"
  if (month.state === "OPEN") return "Rolling reading"
  return month.month_end_valid ? "Month-end snapshot" : "Snapshot, not month-end"
}
