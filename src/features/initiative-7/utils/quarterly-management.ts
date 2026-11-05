// What the Quarterly Report's management view needs from the saved report, as plain values.
//
// The backend sends decimals as strings and "not available" as null. These helpers turn them into what the
// Overview's own components take, and never turn a missing figure into 0.

import { formatSignedAmount } from "@/lib/utils"
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
    adoptionRatePercentage: adoptionRatePercent(adoption, adopted, partially, known),
  }
}

/** The adoption rate as a percentage. The backend works it out with the Overview's own formula (the one on the
 * Calculation page), so a report that carries it is read as sent -- null when nothing is measured. Only a report made
 * before the backend sent it falls back to the default formula's shape. */
function adoptionRatePercent(adoption: ApiAdoptionQuarter, adopted: number, partially: number, known: number): number | null {
  if (adoption.adoption_rate !== undefined) {
    const rate = num(adoption.adoption_rate)
    return rate === null ? null : Math.round(rate * 1000) / 10
  }
  return known > 0 ? Math.round(((adopted + partially) / known) * 1000) / 10 : null
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
  // "materials_assessed" and "recommendations_generated" are deliberately not shown as cards (page and PDF).
  "critical_stockout_risk",
  "excess_inventory_opportunity",
  "approved",
  // The three working capital cards sit together, so on the three-column grid they fill one row of their own.
  // "working_capital_impact" (the combined total) is deliberately not a card: stock items and OAR are shown apart.
  "working_capital_stock",
  "working_capital_oar",
  "working_capital_potential",
  "oar_recommendations",
  "min_max_conversion",
  "pending_approval", // carried only by reports saved before the card became Approved
] as const

export function orderedKpis(cards: ApiKpiCard[]): ApiKpiCard[] {
  const byKey = new Map(cards.map((card) => [card.key, card]))
  return KPI_ORDER.flatMap((key) => {
    const card = byKey.get(key)
    return card ? [card] : []
  })
}

/** The working capital card and its stock-item / OAR split: all money, all signed (+ frees cash, − ties it up). */
export function isWorkingCapitalKey(key: string): boolean {
  return key === "working_capital_impact" || key === "working_capital_stock" || key === "working_capital_oar" || key === "working_capital_potential"
}

/** What a card shows as its big value: the number with its unit, or why it has none. */
export function kpiValueText(card: ApiKpiCard): string {
  const value = num(card.value)
  // Never measured is not the same as measured and nothing there: it is said in its own words, and is never a 0.
  if (card.status === "UNKNOWN" && value === null) return "Not yet measured"
  if (card.status !== "AVAILABLE" || value === null) return "Not available"
  const isMoney = card.key === "excess_inventory_opportunity" || isWorkingCapitalKey(card.key)
  if (!isMoney) return value.toLocaleString("en-US", { maximumFractionDigits: 0 })
  const currency = card.unit.startsWith("amount") ? null : card.unit
  // Shown the way the Recommendations page shows Value change: cash released is a minus (the stock held goes down), cash tied up a plus.
  // The report stores it the other way round (positive releases), so the sign is flipped here, for display only.
  return moneyExact(isWorkingCapitalKey(card.key) && value !== 0 ? -value : value, currency, isWorkingCapitalKey(card.key))
}

// --- How a card reads on the page ---------------------------------------------------------------------

/** The plain one-line wording each card carries on the page, by key. The report's own explanation and notes are longer
 * and stay behind the card's (i); the PDF prints them in full. `title` is set only where a card was renamed: a saved
 * report keeps the title it was generated with, so this is what lets a rename reach the reports saved before it. */
const CARD_WORDING: Record<string, { title?: string; caption: string }> = {
  materials_assessed: { title: "Material-plants with a computed recommendation", caption: "Materials we made a recommendation for" },
  recommendations_generated: { caption: "Recommendations created in this period" },
  critical_stockout_risk: { title: "High Stockout Risk", caption: "Stock below what the lead time needs" },
  excess_inventory_opportunity: { caption: "Stock above the recommended maximum" },
  working_capital_impact: { caption: "Adopted in SAP: cash freed (−) or tied up (+)" },
  working_capital_stock: { caption: "Adopted stock items: cash freed (−) or tied up (+)" },
  working_capital_oar: { caption: "Adopted OAR: cash freed (−) or tied up (+)" },
  working_capital_potential: { title: "Working capital if all eligible OAR adopted", caption: "If every eligible OAR material were adopted" },
  oar_recommendations: { caption: "Eligible OAR materials in this period" },
  min_max_conversion: { caption: "OAR materials moved to Min-Max in SAP" },
  approved: { caption: "Approved, but not yet changed in SAP" },
  pending_approval: { caption: "Waiting for an approver's decision" },
}

/** The report page's own plain words for a card. The PDF and the Excel keep the report's own titles and labels (`cardTitle`,
 * `card.denominator_label`), which are the full record; this is only how the page reads. A card with no entry keeps the report's. */
const PAGE_TITLE: Record<string, string> = {
  materials_assessed: "Materials with a recommendation",
}

const PAGE_DENOMINATOR: Record<string, string> = {
  materials_assessed: "materials looked at",
  recommendations_generated: "recommendations",
  oar_recommendations: "OAR material-plants",
  min_max_conversion: "OAR materials that can move",
  critical_stockout_risk: "materials that could be checked",
  excess_inventory_opportunity: "materials",
  working_capital_impact: "materials included",
  working_capital_stock: "stock items included",
  working_capital_oar: "OAR materials included",
  working_capital_potential: "eligible OAR materials included",
  approved: "recommendations created",
}

export function pageCardTitle(card: ApiKpiCard): string {
  return PAGE_TITLE[card.key] ?? cardTitle(card)
}

export function pageDenominatorLabel(card: ApiKpiCard): string {
  return PAGE_DENOMINATOR[card.key] ?? card.denominator_label ?? ""
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

/** Money as a figure: the exact amount with its sign and currency, in whole units with comma grouping ("−ZAR 103,950",
 * "+ZAR 12,500,000"), or "—" when it was not measured. Never abbreviated to "M" or "K": an abbreviated amount is a rounded one. A
 * currency that is not stated has no prefix. Charts use it too, for their labels and tooltips. */
export function moneyExact(value: number | null, currency: string | null, signed = false): string {
  if (value === null) return "—"
  return formatSignedAmount(value, currency ? `${currency} ` : "", signed)
}

/** What a month's row says about how it was measured, in a few words. */
export function monthBasisLabel(month: ApiTrendMonth): string {
  if (month.state === "MISSING") return "No snapshot"
  if (month.state === "OPEN") return "Rolling reading"
  return month.month_end_valid ? "Month-end snapshot" : "Snapshot, not month-end"
}
