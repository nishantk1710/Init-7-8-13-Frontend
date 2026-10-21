/**
 * Session ⇄ reservation links, the FR-4 compliance count, and the UAT stand-in
 * for SAP — `/api/i13/session-links`, `/session-compliance`, `/uat/*`.
 *
 * The requester types the assistant's session ID into the reservation's item
 * text (RESB.SGTXT). The backend reads it back from the loaded extract
 * (`raw_resb.text`) and records which session each reservation carries. In UAT,
 * where nobody can type into SAP, `/uat/*` simulates a reservation or stamps an
 * ID onto an existing one — only when the backend has
 * `I13_UAT_SIMULATION_ENABLED` on; otherwise those routes answer 404.
 *
 * These routes are snake_case on the wire, like the rest of `/api/i13`.
 */

import { apiFetch, apiFetchList, apiPost, type ApiList } from "@/lib/api/client"

type RawRecord = Record<string, unknown>

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ""
}

export type SessionLink = {
  sessionId: string
  reservationNumber: string
  reservationItem: string
  material: string
  plant: string
  /** `SGTXT` from the loaded extract, or `UAT_SGTXT` from the UAT overlay. */
  source: string
  sgtxt: string | null
  firstSeenAt: string
}

function toSessionLink(raw: RawRecord): SessionLink {
  return {
    sessionId: String(raw.session_id ?? ""),
    reservationNumber: String(raw.reservation_number ?? ""),
    reservationItem: String(raw.reservation_item ?? ""),
    material: String(raw.material ?? ""),
    plant: String(raw.plant ?? ""),
    source: String(raw.source ?? ""),
    sgtxt: str(raw.sgtxt),
    firstSeenAt: String(raw.first_seen_at ?? ""),
  }
}

export function getSessionLinks(params: {
  sessionId?: string
  material?: string
  plant?: string
}): Promise<SessionLink[]> {
  return apiFetch<RawRecord[]>(
    `/i13/session-links${query({ session_id: params.sessionId, material: params.material, plant: params.plant })}`
  ).then((rows) => rows.map(toSessionLink))
}

export type SessionCompliance = {
  goLiveDate: string
  reservations: number
  covered: number
  sessionWithoutPlan: number
  invalidSession: number
  missingSession: number
}

/** OAR reservations required since go-live, by what their item text says. */
export function getSessionCompliance(): Promise<SessionCompliance> {
  return apiFetch<RawRecord>("/i13/session-compliance").then((raw) => ({
    goLiveDate: String(raw.go_live_date ?? ""),
    reservations: num(raw.reservations) ?? 0,
    covered: num(raw.covered) ?? 0,
    sessionWithoutPlan: num(raw.session_without_plan) ?? 0,
    invalidSession: num(raw.invalid_session) ?? 0,
    missingSession: num(raw.missing_session) ?? 0,
  }))
}

// --- UAT --------------------------------------------------------------------

export type UatStatus = { enabled: boolean; goLiveDate: string }

export function getUatStatus(): Promise<UatStatus> {
  return apiFetch<RawRecord>("/i13/uat").then((raw) => ({
    enabled: Boolean(raw.enabled),
    goLiveDate: String(raw.go_live_date ?? ""),
  }))
}

export type UatReservation = {
  id: number
  reservationNumber: string
  reservationItem: string
  material: string
  plant: string
  /** True: a reservation that exists only in UAT. False: an ID stamped onto a real one. */
  simulated: boolean
  requirementDate: string | null
  requirementQuantity: number | null
  sgtxt: string
  originalSgtxt: string | null
  sessionId: string | null
  createdBy: string
  createdAt: string
}

function toUatReservation(raw: RawRecord): UatReservation {
  return {
    id: num(raw.id) ?? 0,
    reservationNumber: String(raw.reservation_number ?? ""),
    reservationItem: String(raw.reservation_item ?? ""),
    material: String(raw.material ?? ""),
    plant: String(raw.plant ?? ""),
    simulated: Boolean(raw.simulated),
    requirementDate: str(raw.requirement_date),
    requirementQuantity: num(raw.requirement_quantity),
    sgtxt: String(raw.sgtxt ?? ""),
    originalSgtxt: str(raw.original_sgtxt),
    sessionId: str(raw.session_id),
    createdBy: String(raw.created_by ?? ""),
    createdAt: String(raw.created_at ?? ""),
  }
}

export function listUatReservations(sessionId: string): Promise<UatReservation[]> {
  return apiFetch<RawRecord[]>(`/i13/uat/reservations${query({ session_id: sessionId })}`).then((rows) =>
    rows.map(toUatReservation)
  )
}

export type UatCandidate = {
  reservationNumber: string
  reservationItem: string
  requirementDate: string | null
  reservationQuantity: number | null
  sgtxt: string | null
  sessionId: string | null
  lifecycleStatus: string
}

export function listUatCandidates(sessionId: string, limit = 50): Promise<ApiList<UatCandidate>> {
  return apiFetchList<RawRecord>(`/i13/uat/candidates${query({ session_id: sessionId, limit })}`).then((list) => ({
    ...list,
    items: list.items.map((raw) => ({
      reservationNumber: String(raw.reservation_number ?? ""),
      reservationItem: String(raw.reservation_item ?? ""),
      requirementDate: str(raw.requirement_date),
      reservationQuantity: num(raw.reservation_quantity),
      sgtxt: str(raw.sgtxt),
      sessionId: str(raw.session_id),
      lifecycleStatus: String(raw.lifecycle_status ?? ""),
    })),
  }))
}

/** Stand in for the requester creating the reservation in SAP with the ID in SGTXT. */
export function simulateUatReservation(sessionId: string): Promise<UatReservation> {
  return apiPost<RawRecord>("/i13/uat/reservations/simulate", { session_id: sessionId }).then(toUatReservation)
}

/** Stand in for the requester typing the ID into an existing reservation's SGTXT. */
export function stampUatReservation(body: {
  sessionId: string
  reservationNumber: string
  reservationItem: string
}): Promise<UatReservation> {
  return apiPost<RawRecord>("/i13/uat/reservations/stamp", {
    session_id: body.sessionId,
    reservation_number: body.reservationNumber,
    reservation_item: body.reservationItem,
  }).then(toUatReservation)
}

export function removeUatReservation(id: number): Promise<void> {
  return apiPost<void>(`/i13/uat/reservations/${id}/remove`)
}
