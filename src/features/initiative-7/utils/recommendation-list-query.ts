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
 * "Clear filters" returns to this. */
export const RECOMMENDATIONS_PAGE_FILTERS: DashboardFilterState = { ...EMPTY_DASHBOARD_FILTERS, type: "oar" }

/** The filter bar's new state, kept valid for this page: the Recommendation group is always OAR or
 * Stock item (never "All"), and a confidence only goes with OAR -- leaving OAR drops it rather than
 * leaving a hidden filter the table cannot satisfy. */
export function normaliseRecommendationFilters(next: DashboardFilterState): DashboardFilterState {
  const type = next.type === "oar" || next.type === "stock_item" ? next.type : RECOMMENDATIONS_PAGE_FILTERS.type
  const confidence = type === "oar" ? next.confidence : ALL_FILTER
  return type === next.type && confidence === next.confidence ? next : { ...next, type, confidence }
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
    filters.plant,
    filters.criticality,
    filters.demandPattern,
    filters.status,
    filters.risk,
    filters.material.trim(),
  ].join("|")
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
export function listParamsFromFilters(filters: DashboardFilterState, page: number): RecommendationListParams {
  const onlyCalculated = filters.type !== ALL_FILTER
  const statusDecides = filters.status !== ALL_FILTER && filters.status !== "Pending Review"
  const search = filters.material.trim()
  return {
    page,
    pageSize: RECOMMENDATIONS_PAGE_SIZE,
    sort: "generated_at",
    sortDesc: true,
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
