/**
 * Opening the request screen with a material already on it.
 *
 * The SAP BAdI pop-up and the assistant's landing page both arrive with one
 * material: `/assistant/new?material={MATNR}&plant={WERKS}&department={AFNAM}
 * &requestedFor={NAME}&origin=BADI`. That contract is the SAP team's and does
 * not change -- the page forwards the same parameters to
 * `/assistant/requests/new`, which starts the request with that material as
 * line 1. The requester can submit it alone or add more.
 */

export type RequestOrigin = "PLATFORM" | "BADI"

export type RequestEntry = {
  materialId: string
  plant: string
  /** Pre-selects the request's department; empty when none was sent. */
  department: string
  requestedFor: string
  origin: RequestOrigin
}

type Params = Record<string, string | string[] | undefined>

/** A repeated query parameter is a malformed link, not a list to guess from. */
function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? "" : (value ?? "").trim()
}

/** The material to start with, or null when the link names no material and plant. */
export function entryFromParams(params: Params): RequestEntry | null {
  const materialId = single(params.material)
  const plant = single(params.plant)
  if (!materialId || !plant) return null
  return {
    materialId,
    plant,
    department: single(params.department),
    requestedFor: single(params.requestedFor),
    origin: single(params.origin) === "BADI" ? "BADI" : "PLATFORM",
  }
}

/** The request screen, starting with `entry` as line 1. */
export function requestHref(entry: RequestEntry | null): string {
  if (!entry) return "/assistant/requests/new"
  const query = new URLSearchParams({ material: entry.materialId, plant: entry.plant })
  if (entry.department) query.set("department", entry.department)
  if (entry.requestedFor) query.set("requestedFor", entry.requestedFor)
  if (entry.origin === "BADI") query.set("origin", "BADI")
  return `/assistant/requests/new?${query.toString()}`
}
