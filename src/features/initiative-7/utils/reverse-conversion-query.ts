// What the Min-Max to OAR view asks the backend for, built from its filter bar -- and the plain-language
// text it shows about how the numbers were produced.
//
// Pure functions only, so they are tested without a browser. Nothing here is shared with the OAR / Stock item
// list (utils/recommendation-list-query.ts): a change to one cannot move the other.

import { ALL_FILTER } from "@/features/initiative-7/components/dashboard-filters"
import type { ReverseListParams } from "@/features/initiative-7/services/reverse-conversion-api"
import {
  MIN_MAX_TO_OAR_TYPE,
  REVERSE_CATEGORIES,
  REVERSE_CONFIDENCES,
  type ApiReverseAnchor,
} from "@/features/initiative-7/types/reverse-conversion"

/** Rows per page. 25, the same as every other table on this page. */
export const REVERSE_PAGE_SIZE = 25

/** The Recommendations page's view switch, in display order. "oar" (the OAR list, whose materials may convert to
 * Min-Max) and "stock_item" are the values the page has always used; "min_max_to_oar" is the new view. The shared
 * RECOMMENDATION_TYPE_OPTIONS list (OAR, Stock item), which the Overview and the quarterly report read, is not
 * touched: this switch is the Recommendations page's own. */
export const RECOMMENDATION_TOGGLE_OPTIONS = [
  { value: "oar", label: "OAR to Stock item" },
  { value: MIN_MAX_TO_OAR_TYPE, label: "Stock item to OAR" },
  { value: "stock_item", label: "Stock item" },
] as const

/** True when the Recommendation dropdown is on Min-Max to OAR. */
export function isMinMaxToOarView(filters: { type: string }): boolean {
  return filters.type === MIN_MAX_TO_OAR_TYPE
}

export interface ReverseFilterState {
  /** A category code, or ALL_FILTER. Not offered on screen: the OAR conversion filter decides which rows show. */
  category: string
  /** "eligible", "not_eligible", or ALL_FILTER. */
  eligibility: string
  plant: string
  /** A reason code, or ALL_FILTER. */
  reason: string
  /** A confidence code (high, medium, low), or ALL_FILTER. */
  confidence: string
  /** A criticality tier, "unknown", or ALL_FILTER. */
  criticality: string
  /** A lead-time bucket code, or ALL_FILTER. */
  leadTime: string
  material: string
}

/** The view opens on the Eligible materials (Convert to OAR), as the OAR table opens on Eligible; every other
 * filter is off. "Clear filters" returns here. */
export const REVERSE_DEFAULT_FILTERS: ReverseFilterState = {
  category: ALL_FILTER,
  eligibility: "eligible",
  plant: ALL_FILTER,
  reason: ALL_FILTER,
  confidence: ALL_FILTER,
  criticality: ALL_FILTER,
  leadTime: ALL_FILTER,
  material: "",
}

function chosen(value: string): string | undefined {
  return value !== ALL_FILTER && value.trim() !== "" ? value : undefined
}

/** The filters that decide which rows exist, as one string: when it changes the page number goes back to 1. */
export function reverseFilterKey(filters: ReverseFilterState): string {
  return [filters.category, filters.eligibility, filters.plant, filters.reason, filters.confidence, filters.criticality, filters.leadTime, filters.material.trim()].join("|")
}

/** How many filters differ from the opening view -- what "Clear filters" would undo. */
export function activeReverseFilterCount(filters: ReverseFilterState): number {
  return (Object.keys(REVERSE_DEFAULT_FILTERS) as (keyof ReverseFilterState)[]).filter((key) => {
    const current = filters[key]
    return (typeof current === "string" ? current.trim() : current) !== REVERSE_DEFAULT_FILTERS[key]
  }).length
}

/** The list request for a filter bar and a page. */
export function reverseParamsFromFilters(filters: ReverseFilterState, page: number): ReverseListParams {
  return {
    category: chosen(filters.category),
    eligibility: chosen(filters.eligibility),
    plant: chosen(filters.plant),
    reason: chosen(filters.reason),
    confidence: chosen(filters.confidence),
    criticality: chosen(filters.criticality),
    leadTimeBucket: chosen(filters.leadTime),
    search: filters.material.trim() || undefined,
    page,
    pageSize: REVERSE_PAGE_SIZE,
  }
}

/** What Export Excel asks for: exactly what the table shows, every page, no paging. */
export function reverseExportParams(filters: ReverseFilterState): Omit<ReverseListParams, "page" | "pageSize"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { page, pageSize, ...rest } = reverseParamsFromFilters(filters, 1)
  return rest
}

export function reverseCategoryLabel(code: string): string {
  return REVERSE_CATEGORIES.find((category) => category.code === code)?.label ?? code
}

export function reverseConfidenceLabel(code: string | null | undefined): string {
  return REVERSE_CONFIDENCES.find((level) => level.code === code)?.label ?? "—"
}

/** A sentence for a failed request. The backend's "anchor not available" (no complete month could be fixed
 * safely) is explained in words an operator can act on; anything else keeps its own message. */
export function reverseErrorMessage(error: { message: string; code?: string }): string {
  if (error.code === "REVERSE_ANCHOR_UNAVAILABLE")
    return (
      "The calculation anchor (the latest complete month) is not set, and cannot be worked out safely without it. " +
      "Ask an administrator to set I7_REVERSE_ANCHOR_MONTH. " +
      error.message
    )
  return error.message
}

// --- Dates and numbers ------------------------------------------------------------------------------

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "2026-08" -> "Aug 2026"; anything else is returned as it came; null -> an em dash. */
export function formatYearMonth(value: string | null | undefined): string {
  if (!value) return "—"
  const match = /^(\d{4})-(0[1-9]|1[0-2])/.exec(value)
  return match ? `${MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}` : value
}

/** "last used 2 months before the anchor" in two words for a cell: 0 -> "this month", 1 -> "1 month ago". */
export function formatMonthsAgo(months: number | null | undefined): string {
  if (months === null || months === undefined) return "—"
  if (months === 0) return "in anchor month"
  return months === 1 ? "1 month ago" : `${months} months ago`
}

/** A lead time with its unit: "70 days" ("1 day" for one); null -> an em dash. */
export function formatLeadTime(days: number | null): string {
  if (days === null) return "—"
  const shown = days.toLocaleString("en-US", { maximumFractionDigits: 0 })
  return shown === "1" ? "1 day" : `${shown} days`
}

/** A quantity or money figure with thousands separators; null -> an em dash. Never a currency symbol: the
 * source gives no currency. */
export function formatFigure(value: number | null, maximumFractionDigits = 2): string {
  if (value === null) return "—"
  return value.toLocaleString("en-US", { maximumFractionDigits })
}

/** The date part of an ISO timestamp, for "data loaded". */
export function formatLoadedAt(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "not available"
}

// --- How the numbers were produced -----------------------------------------------------------------------

function num(parameters: Record<string, unknown>, key: string): number | null {
  const value = parameters[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function words(parameters: Record<string, unknown>, key: string): string | null {
  const value = parameters[key]
  if (Array.isArray(value) && value.every((item) => typeof item === "string") && value.length > 0) return value.join(", ")
  return typeof value === "string" && value ? value : null
}

/** One sentence about where the calculation stopped: the anchor, how it was fixed, and any warnings. */
export function describeAnchor(anchor: ApiReverseAnchor): string {
  const how =
    anchor.source === "configured"
      ? "set explicitly"
      : anchor.source === "data_load_timestamp"
        ? "worked out from when the data was loaded"
        : anchor.source
  return `Consumption is measured up to ${formatYearMonth(anchor.month)}, the latest complete month (${how}). Months after it are ignored.`
}

/**
 * The applied thresholds in plain words, built from the policy the backend returned -- never from numbers
 * written into the page, so what is shown is what was applied. A threshold the response does not carry is
 * left out of its sentence rather than guessed.
 */
export function describePolicy(parameters: Record<string, unknown>): string[] {
  const p = parameters
  const lines: string[] = []

  const mrp = words(p, "mrp_types")
  const plants = words(p, "plants")
  if (mrp && plants) lines.push(`In scope: Min-Max materials with MRP type ${mrp} at plants ${plants}. Deletion-flagged materials are left out.`)

  const window = num(p, "window_months")
  if (window !== null)
    lines.push(
      `Consumption is counted over the latest ${window} complete months. A month counts only when its net issued quantity, after reversals, is above zero.`,
    )

  const maxIssues = num(p, "recommended_max_issues")
  const maxMonths = num(p, "recommended_max_months")
  const recency = num(p, "maximum_months_since_last_movement")
  const history = num(p, "minimum_history_span_months")
  const newAge = num(p, "new_material_age_months")
  const newMin = num(p, "new_material_minimum_lifetime_months")
  if (maxIssues !== null && maxMonths !== null && recency !== null) {
    let line = `Convert to OAR, High confidence: at most ${maxIssues} issues and ${maxMonths} months with consumption, last movement within ${recency} months`
    if (history !== null) line += `, and at least ${history} months between first and latest consumption`
    line += "."
    if (newAge !== null && newMin !== null)
      line += ` A new material (first movement within ${newAge} months) also needs at least ${newMin} months with consumption.`
    lines.push(line)
  }

  const frequentIssues = num(p, "frequent_issues_above")
  const frequentMonths = num(p, "frequent_months_above")
  const protectedTiers = words(p, "protected_criticality_tiers")
  if (frequentIssues !== null && frequentMonths !== null) {
    let line = `Not Eligible: more than ${frequentIssues} issues or more than ${frequentMonths} months with consumption (frequent use stays on Min-Max)`
    if (protectedTiers) line += `; criticality ${protectedTiers}`
    if (history !== null) line += `; under ${history} months of history`
    lines.push(line + ".")
  }

  const leadTime = num(p, "maximum_lead_time_days")
  const zeroUse = num(p, "zero_use_window_months")
  lines.push(
    "Convert to OAR, Medium confidence (a planner evaluates it): " +
      (zeroUse !== null ? `no issues in ${zeroUse} months, whether it never moved or moved before; ` : "no recent use; ") +
      "no issues in the latest window but used before (lapsed); borderline frequency; a last movement that is too old; " +
      "or a new material with too few months of use.",
  )
  lines.push(
    "Convert to OAR, Low confidence (a planner evaluates it): unknown criticality; " +
      (leadTime !== null ? `lead time unknown or over ${leadTime} days; ` : "unknown lead time; ") +
      "or movement data that disagrees with itself.",
  )

  const obsolete = words(p, "obsolete_criticality_tier")
  if (obsolete) lines.push(`Convert to OAR, Medium confidence: criticality ${obsolete}, shown with the reason Obsolete; a planner decides whether to keep or dispose of the stock.`)

  lines.push(
    "Stock value only ranks materials inside a category; zero stock and a missing price never remove a material. The source gives no currency. Nothing is written to SAP.",
  )
  return lines
}


// --- ROP and max stock: what staying on Min-Max would do (the Stock item alternative) --------------------

/** "12 → 0": a figure and where it goes. A missing current figure shows an em dash, never a 0 nothing set. */
export function formatChange(current: number | null, next: number | null): string {
  const show = (value: number | null) => (value === null ? "—" : formatFigure(value, 0))
  return `${show(current)} → ${show(next)}`
}