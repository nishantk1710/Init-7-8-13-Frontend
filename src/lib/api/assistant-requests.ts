/**
 * Typed client for multi-material requests -- `/api/assistant/requests/*` --
 * and the UAT stand-in that simulates a request's SAP reservation.
 *
 * Mirrors `app/api/assistant/request_schemas.py`. Same conventions as
 * `lib/api/assistant.ts`: camelCase on the wire, quantities as strings.
 *
 * The routes answer 404 until the backend's `ASSISTANT_REQUESTS_ENABLED` is on;
 * {@link isNotEnabled} tells that apart from a request that does not exist.
 *
 * With `NEXT_PUBLIC_ASSISTANT_DEMO` on, every call is answered in the browser
 * by `lib/assistant/request/demo-api.ts` instead, on the mock catalogue.
 */

import { ApiError, apiFetch, apiPost } from "@/lib/api/client"
import type { ApiDepartment, ApiLinkedReservation, ApiMaterialMatch } from "@/lib/api/assistant"
import { listDepartments, searchMaterials } from "@/lib/api/assistant"
import { ASSISTANT_DEMO } from "@/lib/assistant/demo/flag"

const demo = () => import("@/lib/assistant/request/demo-api")

// --- preview ------------------------------------------------------------------

export type ApiPreviewKind = "i13" | "i08" | "out_of_scope" | "data_gap" | "invalid"

export type ApiSuggested = {
  /** Null: no suggestion can be made -- any quantity then needs a reason. */
  quantity: string | null
  reason: string
  windowStart: string | null
  windowEnd: string | null
  windowMonths: number | null
}

export type ApiPreviewLine = {
  materialId: string
  materialDescription: string | null
  plant: string
  kind: ApiPreviewKind
  reason: string
  /** The assessment record, exactly as a conversation would be shown it. */
  facts: Record<string, unknown> | null
  /** I08: a repaired unit in stock or one on repair. */
  unitExists: boolean | null
  suggestion: ApiSuggested | null
  alsoMatched: string | null
}

export type ApiReasonCategory = { value: string; label: string }

export type PreviewResponse = {
  lines: ApiPreviewLine[]
  maxLines: number
  /** What submit accepts. Absent from a backend older than #127. */
  reasonCategories?: ApiReasonCategory[]
}

// --- create -------------------------------------------------------------------

export type ApiLineAnswers = {
  materialId: string
  plant: string
  department?: string | null
  decision?: "proceed" | "not_needed" | "use_existing" | "proceed_new" | null
  quantity?: string | null
  windowStart?: string | null
  windowEnd?: string | null
  purpose?: string | null
  reasonCategory?: string | null
  freeText?: string | null
  /** What the screen showed as suggested; null for "none could be made". */
  seenSuggestedQuantity?: string | null
}

export type CreateRequestBody = {
  idempotencyKey: string
  plant: string
  requestedFor?: string | null
  origin?: "PLATFORM" | "BADI"
  lines: ApiLineAnswers[]
}

// --- reading back -------------------------------------------------------------

export type ApiRequestLink = ApiLinkedReservation & {
  /** A wrong or missing /n, or a declined line reserved anyway. */
  note?: string | null
}

export type ApiRequestLine = {
  lineNo: number
  /** What goes into SGTXT: `<request>/<n>`. */
  reference: string
  sessionId: string
  flow: "i13" | "i08" | string
  outcome: string
  materialId: string
  materialDescription: string | null
  plant: string
  department: string | null
  decision: string | null
  plannedQuantity: string | null
  suggestedQuantity: string | null
  acceptedQuantity: string | null
  windowStart: string | null
  windowEnd: string | null
  purpose: string | null
  justification: { kind: string; reasonCategory: string; freeText: string } | null
  linkedReservations: ApiRequestLink[]
}

export type ApiSkipped = { materialId: string; plant: string; kind: string; reason: string }

export type ApiRequest = {
  requestId: string
  plant: string
  requestedFor: string | null
  requester: string
  origin: string
  issuedAt: string
  departments: string[]
  lines: ApiRequestLine[]
  skipped: ApiSkipped[]
  replayed: boolean
}

export type ApiRequestSummary = {
  requestId: string
  plant: string
  requestedFor: string | null
  issuedAt: string
  lineCount: number
  skippedCount: number
  departments: string[]
}

// --- errors -------------------------------------------------------------------

/** A 422 from submit: the whole request was refused, and `line` (1-based, in
 * the order submitted) is the row at fault when one is. */
export type RefusedDetail = { message: string; line: number | null }

/** A 409 from submit: suggestions that moved since the preview. Nothing was written. */
export type ConflictDetail = {
  message: string
  changed: { materialId: string; seenSuggestedQuantity: string | null; suggestedQuantity: string | null }[]
}

export function refusedDetail(error: unknown): RefusedDetail | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null
  const raw = error.rawDetail as Partial<RefusedDetail> | null
  return { message: raw?.message ?? error.detailText(), line: typeof raw?.line === "number" ? raw.line : null }
}

export function conflictDetail(error: unknown): ConflictDetail | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null
  const raw = error.rawDetail as Partial<ConflictDetail> | null
  return { message: raw?.message ?? error.detailText(), changed: Array.isArray(raw?.changed) ? raw.changed : [] }
}

/** The routes answer 404 "Not Found" while the backend flag is off. */
export function isNotEnabled(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404 && error.detailText() === "Not Found"
}

// --- calls --------------------------------------------------------------------

export async function previewRequest(
  materials: { materialId: string; plant: string }[]
): Promise<PreviewResponse> {
  if (ASSISTANT_DEMO) return (await demo()).previewRequest(materials)
  return apiPost<PreviewResponse>("/assistant/requests/preview", { materials })
}

/** Record every line, or nothing. **Responds 201.** Throws 422 / 409 -- see above. */
export async function createRequest(body: CreateRequestBody): Promise<ApiRequest> {
  if (ASSISTANT_DEMO) return (await demo()).createRequest(body)
  return apiPost<ApiRequest>("/assistant/requests", body)
}

export async function getRequest(requestId: string): Promise<ApiRequest> {
  if (ASSISTANT_DEMO) return (await demo()).getRequest(requestId)
  return apiFetch<ApiRequest>(`/assistant/requests/${encodeURIComponent(requestId)}`)
}

export async function listRequests(limit = 50): Promise<ApiRequestSummary[]> {
  if (ASSISTANT_DEMO) return (await demo()).listRequests()
  const response = await apiFetch<{ items: ApiRequestSummary[] }>(`/assistant/requests?limit=${limit}`)
  return response.items
}

/** Material+plant pairs for the request's search box -- the opener's search. */
export async function searchRequestMaterials(q: string, signal?: AbortSignal): Promise<ApiMaterialMatch[]> {
  if (ASSISTANT_DEMO) return (await demo()).searchRequestMaterials(q)
  return (await searchMaterials(q, { limit: 15, signal })).items
}

/** One plant's department codes, its own first. Empty while the backend's list loads. */
export async function requestDepartments(plant: string): Promise<{ items: ApiDepartment[]; loaded: boolean }> {
  if (ASSISTANT_DEMO) return (await demo()).requestDepartments(plant)
  const response = await listDepartments(plant)
  return { items: response.items, loaded: response.loaded }
}

// --- UAT ----------------------------------------------------------------------

/** Whether the backend's UAT stand-in for SAP is on (never in production). */
export async function uatEnabled(): Promise<boolean> {
  if (ASSISTANT_DEMO) return false
  try {
    return (await apiFetch<{ enabled: boolean }>("/i13/uat")).enabled
  } catch {
    return false
  }
}

/** One simulated SAP reservation for the whole request, an item per line to be reserved. */
export function simulateRequestReservation(requestId: string): Promise<unknown> {
  return apiPost("/i13/uat/requests/simulate", { request_id: requestId })
}
