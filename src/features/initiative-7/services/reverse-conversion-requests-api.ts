// Min-Max -> OAR: asking for a conversion, and approving it. Calls to /api/v1/i7/reverse-conversion/requests.
//
// The only write calls the Min-Max to OAR view makes, kept apart from reverse-conversion-api.ts (which only
// reads). Each one writes a row to a table of its own and calls no SAP API: approval is a recorded decision.
// No retry on a write (see apiPost): a repeat after a timeout that succeeded would raise or decide twice.

import { apiFetch, apiPost } from "@/lib/api/client"
import type { ApiReverseRequest, ApiReverseRequestDetail } from "@/features/initiative-7/types/reverse-conversion"

const REQUESTS_BASE = "/v1/i7/reverse-conversion/requests"

export type ReverseRequestAction = "APPROVE" | "REJECT" | "SEND_BACK" | "HOLD" | "RELEASE_HOLD"

/** GET -- where a material-plant's newest conversion request stands, and its approval history. */
export function fetchReverseRequest(material: string, plant: string): Promise<ApiReverseRequestDetail> {
  return apiFetch<ApiReverseRequestDetail>(
    `${REQUESTS_BASE}?material=${encodeURIComponent(material)}&plant=${encodeURIComponent(plant)}`,
  )
}

/** POST -- ask for the material-plant to be converted to OAR. It enters the approval chain at its first role. */
export function createReverseRequest(material: string, plant: string, comment?: string): Promise<ApiReverseRequest> {
  return apiPost<ApiReverseRequest>(REQUESTS_BASE, { material, plant, comment: comment || null })
}

/** POST -- decline to convert it, straight away, with a reason: it does not go through the approval chain first. */
export function declineReverseRequest(material: string, plant: string, comment: string): Promise<ApiReverseRequest> {
  return apiPost<ApiReverseRequest>(`${REQUESTS_BASE}/decline`, { material, plant, comment })
}

/** POST -- one approval action by the role that holds the pending step. */
export function actOnReverseRequest(
  requestId: number,
  actorRole: string,
  action: ReverseRequestAction,
  comment?: string,
): Promise<ApiReverseRequest> {
  return apiPost<ApiReverseRequest>(`${REQUESTS_BASE}/${requestId}/actions`, {
    actor_role: actorRole,
    action,
    comment: comment || null,
  })
}
