// What the Recommendations page asks the backend for, built from its filter bar.
//
// Every filter is a database filter: the backend searches all of the catalogue (tens of
// thousands of rows) and returns one page plus the true total. Filtering the fetched page in
// the browser could only ever find what happened to be on it.

import type { RecommendationListParams } from "@/features/initiative-7/services/i7-api"
import {
  ALL_FILTER,
  EMPTY_DASHBOARD_FILTERS,
  type DashboardFilterState,
} from "@/features/initiative-7/components/dashboard-filters"
import type { DemandPattern } from "@/features/initiative-7/types/inventory"
import { MIN_MAX_TO_OAR_TYPE } from "@/features/initiative-7/types/reverse-conversion"
import type { ValueChangeSort } from "@/features/initiative-7/utils/value-change"

/** The backend's Value change filter for a header arrow: down = released, up = tied up, none = no filter. */
function valueChangeParam(valueSort: ValueChangeSort): "released" | "tied_up" | undefined {
  return valueSort === "released-first" ? "released" : valueSort === "tied-up-first" ? "tied_up" : undefined
}

/** The demand pattern the table shows -> the backend's stored demand class. The inverse of
 * DEMAND_MAP in services/i7-api.ts. */
export const DEMAND_CLASS_FOR_PATTERN: Partial<Record<DemandPattern, string>> = {
  Smooth: "SMOOTH",
  Erratic: "ERRATIC",
  Lumpy: "LUMPY",
  Intermittent: "INTERMITTENT",
  "Slow-Moving": "SLOW",
  "Cold start": "UNCLASSIFIED",
}

/** The Recommendations page starts on OAR and has no "All": it lists OAR materials or stock items, and
 * "Clear filters" returns to this. OAR opens on the materials that are Eligible for the Min-Max conversion; the
 * Min-Max conversion filter still offers All and Not eligible. */
export const RECOMMENDATIONS_PAGE_FILTERS: DashboardFilterState = {
  ...EMPTY_DASHBOARD_FILTERS,
  type: "oar",
  conversion: "ELIGIBLE",
}

/** What "Clear filters" puts back for the view the page's toggle is on: that view's own starting point. The view
 * itself is chosen with the toggle, not in the filter bar, so clearing the filters never moves to another view. OAR
 * to Min-Max opens on the Eligible conversions; Stock item has no conversion filter. */
export function resetFiltersForView(type: string): DashboardFilterState {
  return {
    ...RECOMMENDATIONS_PAGE_FILTERS,
    type,
    conversion: type === "oar" ? RECOMMENDATIONS_PAGE_FILTERS.conversion : ALL_FILTER,
  }
}

/** The filter bar's new state, kept valid for this page: the Recommendation group is always OAR or
 * Stock item (never "All"), and a confidence and a Min-Max conversion only go with OAR -- leaving OAR drops them
 * rather than leaving a hidden filter the table cannot satisfy. Coming back to OAR from Stock item (``previous``
 * is the state before the change) starts on Eligible again, as the page opens. */
export function normaliseRecommendationFilters(
  next: DashboardFilterState,
  previous?: DashboardFilterState,
): DashboardFilterState {
  // Min-Max to OAR is a third value of the dropdown, handled by its own workspace (it never reaches this
  // module's list or export requests); it is let through so choosing it does not snap back to OAR.
  const type =
    next.type === "oar" || next.type === "stock_item" || next.type === MIN_MAX_TO_OAR_TYPE
      ? next.type
      : RECOMMENDATIONS_PAGE_FILTERS.type
  const enteringOar = type === "oar" && previous !== undefined && previous.type !== "oar"
  const confidence = type === "oar" ? next.confidence : ALL_FILTER
  const conversion =
    type !== "oar" ? ALL_FILTER : enteringOar ? RECOMMENDATIONS_PAGE_FILTERS.conversion : next.conversion
  return type === next.type && confidence === next.confidence && conversion === next.conversion
    ? next
    : { ...next, type, confidence, conversion }
}

/** Rows per page. 25, the same as every I13 table. */
export const RECOMMENDATIONS_PAGE_SIZE = 25

function chosen(value: string): string | undefined {
  return value !== ALL_FILTER ? value : undefined
}

/** The filters that decide which rows exist, as one string: when it changes the page number
 * goes back to 1. The Circuit filter is not in it -- it narrows the page in view only. */
export function listFilterKey(filters: DashboardFilterState): string {
  return [
    filters.type,
    filters.confidence,
    filters.conversion,
    filters.plant,
    filters.criticality,
    filters.demandPattern,
    filters.status,
    filters.risk,
    filters.material.trim(),
  ].join("|")
}

/** True when the filter bar is exactly as the page opens (or "Clear filters" leaves it): nothing narrowed. */
export function isDefaultView(filters: DashboardFilterState): boolean {
  return (Object.keys(RECOMMENDATIONS_PAGE_FILTERS) as (keyof DashboardFilterState)[]).every((key) => {
    const current = filters[key]
    return (typeof current === "string" ? current.trim() : current) === RECOMMENDATIONS_PAGE_FILTERS[key]
  })
}

/**
 * What the Export Excel button asks for: exactly what the table shows -- the same filters it sends, every page
 * of it, with no paging or sort. That includes the page's default view (OAR, Eligible for the Min-Max
 * conversion), so the file and the screen cannot disagree.
 */
export function exportParamsFromFilters(
  filters: DashboardFilterState,
  valueSort: ValueChangeSort = null,
): Omit<RecommendationListParams, "page" | "pageSize" | "sort" | "sortDesc"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { page, pageSize, sort, sortDesc, ...filterParams } = listParamsFromFilters(filters, 1, valueSort)
  return filterParams
}

/**
 * The list request for a filter bar and a page. Newest first, so the latest pipeline run is
 * on page 1.
 *
 * Picking OAR, Declining or Normal lists only recommendations that have been calculated
 * (backend status READY_FOR_REVIEW) -- unless the Status filter already says which
 * recommendations to show, in which case it decides: Approved with OAR means the approved OAR
 * ones, and "Pending Review" keeps the calculated restriction.
 */
export function listParamsFromFilters(
  filters: DashboardFilterState,
  page: number,
  valueSort: ValueChangeSort = null,
): RecommendationListParams {
  const onlyCalculated = filters.type !== ALL_FILTER
  const statusDecides = filters.status !== ALL_FILTER && filters.status !== "Pending Review"
  const search = filters.material.trim()
  // Stock items are ordered by Value change across every page -- released first, the largest release at the top,
  // then tied-up, unchanged and rows with no figure -- and so is any list with a Value change arrow on. Other lists
  // stay newest first, so the latest pipeline run is on page 1.
  const byValueChange = filters.type === "stock_item" || valueSort !== null
  return {
    page,
    pageSize: RECOMMENDATIONS_PAGE_SIZE,
    sort: byValueChange ? "value_change" : "generated_at",
    sortDesc: true,
    valueChange: valueChangeParam(valueSort),
    status: onlyCalculated && !statusDecides ? "READY_FOR_REVIEW" : undefined,
    plant: chosen(filters.plant),
    type: chosen(filters.type) as RecommendationListParams["type"],
    // Only OAR recommendations carry a confidence, so it narrows nothing else.
    confidence: filters.type === "oar" ? chosen(filters.confidence) : undefined,
    // Only OAR recommendations carry a Min-Max conversion decision, likewise.
    conversionEligibility: filters.type === "oar" ? chosen(filters.conversion) : undefined,
    // The OAR list is not narrowed by consumption or by conversion verdict: Not-eligible OAR
    // recommendations (too little use, no qualifying criticality) still carry a similarity-based
    // estimate and are listed beside the Eligible ones; the Min-Max conversion filter splits them.
    //
    // Everywhere else the list shows only what has something to adopt in SAP: a stock item with a
    // changed ROP / safety stock / max stock -- the set the Overview's SAP adoption counts.
    actionable: onlyCalculated && filters.type !== "oar" ? true : undefined,
    search: search || undefined,
    criticalityLevel: chosen(filters.criticality),
    demandClass: DEMAND_CLASS_FOR_PATTERN[filters.demandPattern as DemandPattern],
    statusGroup: chosen(filters.status),
    risk: chosen(filters.risk),
  }
}
