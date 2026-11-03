// What the monthly and quarterly report's sections show, as plain values from the saved report.
//
// Presentation only: every figure here is the backend's, read as sent. Nothing is recalculated, and a figure that was
// not measured stays null -- it is never turned into 0. The sections that mix kinds of figure (what happened in the
// period, a saved month-end reading, how things stand now) say which one they are.

import type { ApiAdoptionQuarter, ApiPerformanceTrends, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import { compactMoney, num } from "@/features/initiative-7/utils/quarterly-management"

// --- Which perspective a section speaks for ----------------------------------------------------------

/** The three kinds of figure the report mixes: what happened in the period, a saved month-end reading, and how things
 * stand now. Each section carries one of these so they are never confused. */
export type Perspective = "monthly" | "snapshot" | "current"

export const PERSPECTIVE_LABEL: Record<Perspective, { label: string; hint: string }> = {
  monthly: {
    label: "Monthly activity",
    hint: "Things that happened during the period, counted by the date they happened.",
  },
  snapshot: {
    label: "Month-end snapshot",
    hint: "A reading saved at the end of the month. It is never rebuilt from today's data.",
  },
  current: {
    label: "Current position",
    hint: "How things stand on the day this report was generated, not at the end of the period.",
  },
}

const count = (value: number): string => value.toLocaleString("en-US", { maximumFractionDigits: 0 })

// --- The month-end inventory position ------------------------------------------------------------------

export interface PositionItem {
  key: string
  label: string
  /** The figure as shown, or null when it was not measured. */
  value: string | null
  /** Why there is no value, when there is not one. */
  reason: string | null
  /** What it is over, in a few words. */
  basis: string | null
}

export interface MonthEndPosition {
  available: boolean
  /** Why the whole section is unavailable (no valid snapshot). */
  reason: string | null
  /** When the snapshot was measured. */
  measuredOn: string | null
  /** When the stock on hand behind the stock figures was loaded. */
  stockAsOf: string | null
  items: PositionItem[]
}

const NOT_IN_SNAPSHOT = "This snapshot was saved before stock held was captured, and a past month cannot be rebuilt."

const zar = (value: number | null, currency: string | null, signed = false): string | null =>
  value === null ? null : compactMoney(value, currency, signed)

/** The month-end position, only from a valid saved snapshot. With none, the section is unavailable and says why: the
 * current calculation is never shown in its place. */
export function monthEndPositionOf(management: ApiQuarterManagement): MonthEndPosition {
  const end = management.trends?.quarter_end
  if (management.position_basis !== "snapshot" || !end || end.status !== "AVAILABLE") {
    return {
      available: false,
      reason: end?.reason ?? "No saved month-end snapshot exists for this period.",
      measuredOn: null,
      stockAsOf: null,
      items: [],
    }
  }
  const p = management.position
  // A snapshot saved before the stock figures existed has none of the fields; one with a stale or missing stock load
  // carries the reason.
  const neverCaptured = p.inventory_value === undefined || (num(p.inventory_value) === null && !p.inventory_stock_as_of)
  const stockReason = p.inventory_unavailable_reason ?? (neverCaptured ? NOT_IN_SNAPSHOT : null)
  const held = (value: string | null, basis: string): Pick<PositionItem, "value" | "reason" | "basis"> =>
    value === null
      ? {
          value: null,
          reason: stockReason ?? "Not measured: no material-plant had both a stock figure and a ZAR price.",
          basis: null,
        }
      : { value, reason: null, basis }
  const stockout = p.stockout
  const stockoutUsable = stockout.as_of !== null && !stockout.stale
  const below = p.below_reorder_count
  const items: PositionItem[] = [
    {
      key: "inventory_value",
      label: "Total inventory value",
      ...held(zar(num(p.inventory_value), "ZAR"), `${count(p.inventory_priced_count ?? 0)} material-plants with stock and a ZAR price`),
    },
    {
      key: "excess_value",
      label: "Excess inventory value",
      value: zar(num(p.excess_opportunity), p.currency),
      reason: num(p.excess_opportunity) === null ? "No excess material-plant has a price and both maximum stocks." : null,
      basis: `${count(p.excess_count)} material-plants above their recommended maximum · estimate`,
    },
    {
      key: "working_capital",
      label: "Working capital impact",
      value: zar(num(p.net_rop_value_impact), p.working_capital_currency ?? p.currency, true),
      reason: num(p.net_rop_value_impact) === null ? "No recommendation has a ZAR or NAD price and both reorder points." : null,
      basis: `${count(p.priced_count)} material-plants · cash released (+) or tied up (−) · estimate`,
    },
    {
      key: "safety_stock_value",
      label: "Safety stock value",
      ...held(
        zar(num(p.safety_stock_value), "ZAR"),
        `SAP safety stock · ${count(p.safety_stock_priced_count ?? 0)} material-plants priced`,
      ),
    },
    {
      key: "below_reorder",
      label: "Material-plants below reorder point",
      ...(below === null || below === undefined
        ? {
            value: null,
            reason: stockReason ?? "Not measured: no material-plant had both a stock figure and a reorder point above 0.",
            basis: null,
          }
        : {
            value: count(below),
            reason: null,
            basis: `of ${count(p.below_reorder_judged ?? 0)} that could be judged (a reorder point of 0 is not maintained)`,
          }),
    },
    {
      key: "stockout",
      label: "High stockout risk",
      value: stockoutUsable ? count(stockout.at_risk) : null,
      reason: stockoutUsable ? null : (stockout.stale_note ?? "The stockout usage has not been built, so this is not zero risk."),
      basis: stockoutUsable ? `of ${count(stockout.evaluated)} that could be judged` : null,
    },
  ]
  return {
    available: true,
    reason: null,
    measuredOn: end.measured_on,
    stockAsOf: p.inventory_stock_as_of ?? null,
    items,
  }
}

// --- Excess by plant, in money -------------------------------------------------------------------------

export interface PlantExcessRow {
  plant: string
  count: number
  /** Excess value in the portfolio's price currency; null when no excess material-plant could be valued. */
  value: number | null
  currency: string | null
}

/** Each plant's excess count beside its excess value, so material counts and money are never mixed up. */
export function plantExcessRows(management: ApiQuarterManagement, plantName: (code: string | null) => string): PlantExcessRow[] {
  return management.plant_positions.map((entry) => ({
    plant: plantName(entry.plant),
    count: entry.figures.excess_count,
    value: num(entry.figures.excess_opportunity),
    currency: entry.figures.currency,
  }))
}

// --- Approval stages (separate from SAP adoption) -------------------------------------------------------

export interface StageRow {
  key: string
  label: string
  count: number
  hint: string
}

/** The stages of the period's recommendations, from the backend's exclusive counts; null for a report made before they
 * existed. A stage with 0 is a real 0 here: these are counts of records over a known total. */
export function approvalStageRows(adoption: ApiAdoptionQuarter): StageRow[] | null {
  const s = adoption.stages
  if (!s) return null
  const rows: StageRow[] = [
    {
      key: "not_submitted",
      label: "Not yet submitted",
      count: s.not_submitted,
      hint: "Ready for review, or never computed",
    },
    {
      key: "awaiting_approval",
      label: "Awaiting approval",
      count: s.awaiting_approval,
      hint: "Pending or on hold with an approver",
    },
    {
      key: "adjusted_in_chain",
      label: "Adjusted in the chain",
      count: s.adjusted_in_chain,
      hint: "A reviewer changed a value",
    },
    {
      key: "approved_awaiting_sap",
      label: "Approved, awaiting SAP",
      count: s.approved_awaiting_sap,
      hint: "No SAP execution recorded yet",
    },
    {
      key: "implemented_in_sap",
      label: "Implemented in SAP",
      count: s.implemented_in_sap,
      hint: "Execution recorded, or SAP change checked",
    },
    {
      key: "rejected_or_sent_back",
      label: "Rejected or sent back",
      count: s.rejected_or_sent_back,
      hint: "Turned down, or returned for correction",
    },
  ]
  if (s.other > 0)
    rows.push({
      key: "other",
      label: "Other status",
      count: s.other,
      hint: "A status this report does not map",
    })
  return rows
}

// --- The recommendations table's status filter -----------------------------------------------------------

export interface StatusFilterOption {
  value: string
  label: string
  /** What to send the recommendations list: a display group, or one exact backend status. */
  query: { statusGroup?: string; status?: string }
}

/** The status choices the backend's data model supports: the table's own display groups, and NOT_EVALUABLE on its own
 * (a recommendation that could not be computed), which the groups lump in with "ready for review". */
export const STATUS_FILTER_OPTIONS: StatusFilterOption[] = [
  { value: "all", label: "All statuses", query: {} },
  {
    value: "pending",
    label: "Pending approval",
    query: { statusGroup: "In Approval" },
  },
  { value: "approved", label: "Approved", query: { statusGroup: "Approved" } },
  { value: "rejected", label: "Rejected", query: { statusGroup: "Rejected" } },
  {
    value: "sent_back",
    label: "Sent back",
    query: { statusGroup: "Returned" },
  },
  {
    value: "implemented",
    label: "Implemented",
    query: { statusGroup: "Implemented" },
  },
  {
    value: "insufficient",
    label: "Insufficient data",
    query: { status: "NOT_EVALUABLE" },
  },
]

// --- Data coverage, with a plain status on each line ---------------------------------------------------------

export type CoverageStatus = "Available" | "Stale" | "Not available" | "Not covered" | "Insufficient history"

export interface CoverageItem {
  key: string
  label: string
  value: string | null
  status: CoverageStatus
  detail: string | null
}

/** What each important figure rests on, with a status and the reason. The backend works these out once and saves them with the
 * report, so the page, the PDF and the Excel show the same statuses; null for a report made before it did. */
export function coverageItemsOf(management: ApiQuarterManagement): CoverageItem[] | null {
  const items = management.data_coverage.items
  return items && items.length > 0 ? (items as CoverageItem[]) : null
}

// --- Performance trends ---------------------------------------------------------------------------------------

export interface PerformancePoint {
  label: string
  records: number | null
  materialPlants: number | null
  submitted: number | null
  approved: number | null
  rejected: number | null
  sentBack: number | null
  /** The month-end excess value; null for a month with no valid month-end snapshot (never 0). */
  excess: number | null
}

/** One point per month for the three trend charts. A month with no figure is null, so a chart breaks its line or leaves the bar
 * out instead of drawing 0. */
export function performancePoints(performance: ApiPerformanceTrends): PerformancePoint[] {
  return performance.months.map((m) => ({
    label: m.label,
    records: m.records_generated,
    materialPlants: m.material_plants_generated,
    submitted: m.submitted,
    approved: m.approved,
    rejected: m.rejected,
    sentBack: m.sent_back,
    excess: m.excess_state === "MONTH_END" ? num(m.excess_opportunity) : null,
  }))
}

/** How many months have a figure for any of the given series. */
export function pointCount(points: PerformancePoint[], keys: (keyof Omit<PerformancePoint, "label">)[]): number {
  return points.filter((p) => keys.some((key) => p[key] !== null)).length
}

/** The excess trend needs at least two month-end points to be a trend; one is a single reading. */
export const MIN_EXCESS_POINTS = 2
