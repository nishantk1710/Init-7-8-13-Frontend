// What the Recommendations page asks the backend for, built from its filter bar.
//
// Every filter is a database filter: the backend searches all of the catalogue (tens of
// thousands of rows) and returns one page plus the true total. Filtering the fetched page in
// the browser could only ever find what happened to be on it.

import type { RecommendationListParams } from "@/features/initiative-7/services/i7-api"
import { ALL_FILTER, type DashboardFilterState } from "@/features/initiative-7/components/dashboard-filters"
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

/** Rows per page. */
export const RECOMMENDATIONS_PAGE_SIZE = 50

function chosen(value: string): string | undefined {
  return value !== ALL_FILTER ? value : undefined
}

/** The filters that decide which rows exist, as one string: when it changes the page number
 * goes back to 1. The Circuit filter is not in it -- it narrows the page in view only. */
export function listFilterKey(filters: DashboardFilterState): string {
  return [
    filters.type,
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
    search: search || undefined,
    criticalityLevel: chosen(filters.criticality),
    demandClass: DEMAND_CLASS_FOR_PATTERN[filters.demandPattern as DemandPattern],
    statusGroup: chosen(filters.status),
    risk: chosen(filters.risk),
  }
}
