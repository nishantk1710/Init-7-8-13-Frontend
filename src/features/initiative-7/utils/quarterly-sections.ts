// What the monthly and quarterly report's sections show, as plain values from the saved report.
//
// Presentation only: every figure here is the backend's, read as sent. Nothing is recalculated, and a figure that was
// not measured stays null -- it is never turned into 0. The sections that mix kinds of figure (what happened in the
// period, a saved month-end reading, how things stand now) say which one they are.

import type { ApiAdoptionQuarter, ApiPerformanceTrends, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import { num } from "@/features/initiative-7/utils/quarterly-management"

// --- Which perspective a section speaks for ----------------------------------------------------------

/** The three kinds of figure the report mixes: what happened in the period, a saved month-end reading, and how things
 * stand now. Each section carries one of these so they are never confused. */
export type Perspective = "monthly" | "snapshot" | "current"

export const PERSPECTIVE_LABEL: Record<Perspective, { label: string; hint: string }> = {
  monthly: {
    label: "This month's activity",
    hint: "Things that happened during the period, counted on the day they happened.",
  },
  snapshot: {
    label: "Saved at month end",
    hint: "Figures saved at the end of the month. They are never rebuilt from today's data.",
  },
  current: {
    label: "As of today",
    hint: "How things stand on the day this report was made, not at the end of the period.",
  },
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
