/**
 * Typed client for multi-material requests -- `/api/assistant/requests/*` --
 * and the UAT stand-in that simulates a request's SAP reservation.
 *
 * Mirrors `app/api/assistant/request_schemas.py`. Same conventions as
 * `lib/api/assistant.ts`: camelCase on the wire, quantities as strings.
 *
 * The routes answer 404 until the backend's `ASSISTANT_REQUESTS_ENABLED` is on;
 * {@link isNotEnabled} tells that apart from a request that does not exist.
 */

import { ApiError, apiFetch, apiFetchBlob, apiPost, apiPostForm } from "@/lib/api/client"
import type { ApiDepartment, ApiLinkedReservation, ApiMaterialMatch, ApiSessionDeclaration } from "@/lib/api/assistant"
import { listDepartments, searchMaterials } from "@/lib/api/assistant"
import { saveBlob } from "@/lib/download-file"

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
  /** OAR only: what a saving is valued at. Absent on a backend older than 3 Nov. */
  unitPrice?: ApiUnitPrice | null
}

/** The plant's replacement price as I07 reads it (MBEW VERPR ÷ PEINH), in ZAR. */
export type ApiUnitPrice = {
  /** Null: no usable price -- `note` says why. */
  price: string | null
  currency: string | null
  missing: string | null
  note: string | null
}

export type ApiReasonCategory = { value: string; label: string }

export type PreviewResponse = {
  lines: ApiPreviewLine[]
  maxLines: number
  /** What submit accepts. Absent from a backend older than #127. */
  reasonCategories?: ApiReasonCategory[]
  /** The configured fault categories for a declaration. Absent on an older backend. */
  faultCategories?: string[]
  /** The recommendations a declaration may make. Absent on an older backend. */
  recommendations?: ApiReasonCategory[]
}

/**
 * The faulty unit coming out, declared with the request (option B, 27-Oct).
 * Recorded server-side as an unbound declaration for the line's session.
 */
/** Three fields since 3-Nov-2026: the backend records who declared from the
 *  requester, and no longer takes a condition text or evidence reference. */
export type ApiLineDeclaration = {
  quantity: number
  faultCategory: string
  recommendation: string
}

// --- create -------------------------------------------------------------------

export type ApiLineAnswers = {
  materialId: string
  plant: string
  decision?: "proceed" | "not_needed" | "use_existing" | "proceed_new" | null
  quantity?: string | null
  windowStart?: string | null
  windowEnd?: string | null
  purpose?: string | null
  reasonCategory?: string | null
  freeText?: string | null
  /** What the screen showed as suggested; null for "none could be made". */
  seenSuggestedQuantity?: string | null
  /** I08 only, and only when the requester declares the unit coming out. */
  declaration?: ApiLineDeclaration
  /** OAR: the quantity needed, typed before the suggestion was shown. */
  requiredQuantity?: string | null
  /** OAR: which number was locked; `quantity` is then that number. */
  quantityChoice?: QuantityChoice | null
}

export type QuantityChoice = "suggested" | "own"

export type CreateRequestBody = {
  idempotencyKey: string
  plant: string
  requestedFor?: string | null
  /** The request's one department code (UAT, 21 Oct): recorded on every line. */
  department: string
  /** Optional free text beside the department code (≤200); never checked. */
  departmentNote?: string | null
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
  departmentName?: string | null
  departmentNote?: string | null
  decision: string | null
  plannedQuantity: string | null
  suggestedQuantity: string | null
  acceptedQuantity: string | null
  windowStart: string | null
  windowEnd: string | null
  purpose: string | null
  justification: { kind: string; reasonCategory: string; freeText: string } | null
  /** OAR lines submitted with a required quantity (from 3 Nov). Absent before. */
  saving?: ApiSaving | null
  linkedReservations: ApiRequestLink[]
  /** Repairable lines: the condition declaration made on the line, as the
   *  session trace shows it (since 4-Nov-2026). Null when none was made and on
   *  OAR lines, which have a window and a purpose instead; absent from an
   *  older backend. */
  declaration?: ApiSessionDeclaration | null
}

/** What the quantity suggestion saved on one OAR line -- an estimate at submit. */
export type ApiSaving = {
  requiredQuantity: string
  suggestedQuantity: string | null
  finalQuantity: string
  quantityChoice: QuantityChoice
  /** Null: no suggestion could be made, so nothing is counted. */
  unitsSaved: string | null
  unitPrice: string | null
  currency: string | null
  /** Null without a price; `priceNote` says why. */
  valueSaved: string | null
  priceNote: string | null
}

export type ApiSkipped = { materialId: string; plant: string; kind: string; reason: string }

export type ApiRequest = {
  requestId: string
  plant: string
  requestedFor: string | null
  requester: string
  origin: string
  issuedAt: string
  /** The request's department; null only for an older request whose lines named several. */
  department: string | null
  /** `department`'s name from the department list. Absent on an older backend. */
  departmentName?: string | null
  /** Free text typed beside the department, if any. */
  departmentNote?: string | null
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
  department: string | null
  departmentName?: string | null
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

/**
 * `POST /assistant/requests/upload`: the filled-in template, read and checked
 * by the backend. Nothing is stored; each material is then previewed as one
 * added by hand. The department is not in the file (TL, 20 Nov): it is picked
 * on the request itself.
 */
export type ApiUploadResult = {
  plant: string
  /** In file order, duplicates removed. */
  materials: string[]
  rowCount: number
  duplicates: string[]
  maxLines: number
}

/** A file the backend refused: every problem in it, so it is fixed in one go. */
export function uploadErrors(error: unknown): string[] | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null
  const raw = error.rawDetail as { errors?: unknown } | null
  return Array.isArray(raw?.errors) ? raw.errors.map(String) : [error.detailText()]
}

/** The routes answer 404 "Not Found" while the backend flag is off. */
export function isNotEnabled(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404 && error.detailText() === "Not Found"
}

// --- calls --------------------------------------------------------------------

export async function previewRequest(
  materials: { materialId: string; plant: string }[]
): Promise<PreviewResponse> {
  return apiPost<PreviewResponse>("/assistant/requests/preview", { materials })
}

/** Record every line, or nothing. **Responds 201.** Throws 422 / 409 -- see above. */
export async function createRequest(body: CreateRequestBody): Promise<ApiRequest> {
  return apiPost<ApiRequest>("/assistant/requests", body)
}

export async function getRequest(requestId: string): Promise<ApiRequest> {
  return apiFetch<ApiRequest>(`/assistant/requests/${encodeURIComponent(requestId)}`)
}

export async function listRequests(limit = 50): Promise<ApiRequestSummary[]> {
  const response = await apiFetch<{ items: ApiRequestSummary[] }>(`/assistant/requests?limit=${limit}`)
  return response.items
}

/** Material+plant pairs for the request's search box -- the opener's search. */
export async function searchRequestMaterials(q: string, signal?: AbortSignal): Promise<ApiMaterialMatch[]> {
  return (await searchMaterials(q, { limit: 15, signal })).items
}

/** One plant's department codes, its own first. Empty while the backend's list loads. */
export async function requestDepartments(plant: string): Promise<{ items: ApiDepartment[]; loaded: boolean }> {
  const response = await listDepartments(plant)
  return { items: response.items, loaded: response.loaded }
}

/** Read and check a filled-in template. Throws 422 -- see {@link uploadErrors}. */
export async function uploadRequestFile(file: File): Promise<ApiUploadResult> {
  const form = new FormData()
  form.append("file", file)
  return apiPostForm<ApiUploadResult>("/assistant/requests/upload", form)
}

/** The Excel template a request's materials are uploaded in. */
export async function downloadRequestTemplate(): Promise<void> {
  const { blob, filename } = await apiFetchBlob("/assistant/requests/upload-template", "material-request-template.xlsx")
  saveBlob(blob, filename)
}

// --- UAT ----------------------------------------------------------------------

/** Whether the backend's UAT stand-in for SAP is on (never in production). */
export async function uatEnabled(): Promise<boolean> {
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
