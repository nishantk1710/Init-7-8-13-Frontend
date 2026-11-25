// Min-Max -> OAR recommendations: calls to /api/v1/i7/reverse-conversion/*.
//
// A service of its own, apart from i7-api.ts: the OAR and Stock item lists keep every call, mapper and type
// they have, and nothing here is reachable from them. Read-only (GET), through the same apiFetch /
// apiFetchBlob as every other call, so identity and error handling are the same.

import { apiFetch, apiFetchBlob } from "@/lib/api/client"
import type { ApiDecimalValue, ApiReverseConsumption, ApiReverseRecommendationsResponse } from "@/features/initiative-7/types/reverse-conversion"

const REVERSE_BASE = "/v1/i7/reverse-conversion"

export interface ReverseListParams {
  category?: string
  plant?: string
  reason?: string
  /** "high", "medium" or "low" (Convert to OAR rows only). */
  confidence?: string
  /** "eligible" (Convert to OAR) or "not_eligible". */
  eligibility?: string
  criticality?: string
  leadTimeBucket?: string
  search?: string
  /** Calculate as of this complete month, YYYY-MM. Omitted: the server's own anchor. */
  anchor?: string
  page?: number
  pageSize?: number
}

/** The query string for a request. Unset values are left out; the backend validates the rest. */
export function toReverseQueryString(params: ReverseListParams): string {
  const search = new URLSearchParams()
  if (params.category) search.set("category", params.category)
  if (params.plant) search.set("plant", params.plant)
  if (params.reason) search.set("reason", params.reason)
  if (params.confidence) search.set("confidence", params.confidence)
  if (params.eligibility) search.set("eligibility", params.eligibility)
  if (params.criticality) search.set("criticality", params.criticality)
  if (params.leadTimeBucket) search.set("lead_time_bucket", params.leadTimeBucket)
  if (params.search) search.set("search", params.search)
  if (params.anchor) search.set("anchor", params.anchor)
  if (params.page) search.set("page", String(params.page))
  if (params.pageSize) search.set("page_size", String(params.pageSize))
  const query = search.toString()
  return query ? `?${query}` : ""
}

/** GET /api/v1/i7/reverse-conversion/recommendations. */
export function fetchReverseRecommendations(
  params: ReverseListParams = {},
): Promise<ApiReverseRecommendationsResponse> {
  return apiFetch<ApiReverseRecommendationsResponse>(`${REVERSE_BASE}/recommendations${toReverseQueryString(params)}`)
}

/** GET .../recommendations/{material}/{plant}/consumption -- the last 24 months of one listed material-plant. */
export function fetchReverseConsumption(material: string, plant: string, anchor?: string): Promise<ApiReverseConsumption> {
  const query = anchor ? `?anchor=${encodeURIComponent(anchor)}` : ""
  return apiFetch<ApiReverseConsumption>(
    `${REVERSE_BASE}/recommendations/${encodeURIComponent(material)}/${encodeURIComponent(plant)}/consumption${query}`,
  )
}

/** GET /api/v1/i7/reverse-conversion/recommendations/export -- every row the filters select, as CSV.
 * Same filters as the list; page and page size are ignored. Returns a blob URL and the server's filename
 * (it carries the anchor month) for the caller to trigger the download. */
export async function fetchReverseCsvBlob(
  params: Omit<ReverseListParams, "page" | "pageSize"> = {},
): Promise<{ blobUrl: string; filename: string }> {
  const { blob, filename } = await apiFetchBlob(
    `${REVERSE_BASE}/recommendations/export${toReverseQueryString(params)}`,
    `i7-min-max-to-oar-${new Date().toISOString().slice(0, 10)}.csv`,
  )
  return { blobUrl: URL.createObjectURL(new Blob([blob], { type: "text/csv;charset=utf-8" })), filename }
}

/** A backend Decimal (a JSON string) as a number; null when absent or unparsable. Never 0 for "nothing". */
export function parseDecimal(value: ApiDecimalValue | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
