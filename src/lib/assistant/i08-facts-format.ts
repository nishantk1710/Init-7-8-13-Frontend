/**
 * Reading the I08 assessment record for display, in one place.
 *
 * The assessment card, the request builder's repairable rows and the session
 * download all show the same facts. On 27-Oct-2026 the backend began sending
 * open repair requests (repair PRs with no PO yet), a usable/damaged stock
 * split and a need-date line. Records are stored word for word and replayed,
 * so an older session lacks every one of those keys -- and must show exactly
 * what it showed before. The rules for "what does this record say" live here so
 * the three screens cannot drift apart.
 *
 * Every function takes `unknown`: the request preview carries its facts as an
 * untyped record, and a malformed value must read as "not sent", never crash.
 */

import type { I08OpenRepairRequest } from "@/lib/api/assistant-facts"

// --- repair requests ----------------------------------------------------------

/** The open repair requests on a record. Empty when absent (an older record) or malformed. */
export function repairRequestsOf(facts: unknown): I08OpenRepairRequest[] {
  if (!isRecord(facts) || !Array.isArray(facts.openRepairRequests)) return []
  return facts.openRepairRequests.filter(
    (r): r is I08OpenRepairRequest => isRecord(r) && typeof r.purchaseRequisition === "string"
  )
}

/**
 * How many open repair requests the verdict counted. The backend's count when
 * sent, else the listed requests (both absent on an older record, giving 0).
 */
export function repairRequestCountOf(facts: unknown): number {
  if (isRecord(facts) && typeof facts.openRepairRequestLines === "number") {
    return facts.openRepairRequestLines
  }
  return repairRequestsOf(facts).length
}

/**
 * The age of a request, from the stored day count (never recomputed: a
 * replayed session shows the age it showed then).
 *
 * A request dated after the assessment's reference date cannot happen in SAP
 * order, but if the data ever says so it reads as "today" rather than a
 * negative age.
 */
export function requestAgePhrase(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return "request date not known"
  if (days <= 0) return "requested today"
  if (days === 1) return "requested 1 day ago"
  return `requested ${days} days ago`
}

/** The requesting department as `code · name`, the code alone when unnamed, null when absent. */
export function requestDepartmentText(request: Pick<I08OpenRepairRequest, "department" | "departmentName">): string | null {
  if (!request.department) return request.departmentName ?? null
  return request.departmentName ? `${request.department} · ${request.departmentName}` : request.department
}

/** `PR {number}/{item}`, the reference a planner types into SAP. */
export function requestReference(request: Pick<I08OpenRepairRequest, "purchaseRequisition" | "item">): string {
  return request.item ? `PR ${request.purchaseRequisition}/${request.item}` : `PR ${request.purchaseRequisition}`
}

// --- stock --------------------------------------------------------------------

/**
 * What the record says about stock.
 *
 * - `known`: the stock record says which units are usable (new or refurbished)
 *   and which are damaged; show usable, and the damaged ones as not counted.
 * - `condition-unknown`: there is stock, but the record does not split it; show
 *   the total and say the condition is unknown.
 * - `no-record`: the plant has no stock record (not an empty shelf).
 * - `legacy`: a record from before the split; show the total as before.
 *
 * `total` is the plant total (`stockOnHand`) whenever a stock record exists.
 * Quantities stay decimal strings, as sent; compare with `isPositiveQuantity`.
 */
export type I08StockView = {
  state: "legacy" | "no-record" | "known" | "condition-unknown"
  usable: string | null
  damaged: string | null
  total: string | null
}

export function stockView(facts: unknown): I08StockView {
  const f = isRecord(facts) ? facts : {}
  const stockOnHand = stringOrNull(f.stockOnHand)
  // Condition rows win: the backend's verdict counts usable units whenever
  // they exist, so the screen must show the same figure the verdict used.
  if (f.stockConditionKnown === true) {
    return {
      state: "known",
      usable: stringOrNull(f.usableStock),
      damaged: stringOrNull(f.damagedStock),
      total: f.stockIsUnknown === true ? null : stockOnHand,
    }
  }
  // "0 in stock" and "no stock record" look identical once rendered as a
  // number, and only one of them means the shelf is empty. A new record says
  // so with stockSource null; every record says so with stockIsUnknown.
  const noRecord = f.stockIsUnknown === true || ("stockSource" in f && f.stockSource === null)
  if (noRecord) return { state: "no-record", usable: null, damaged: null, total: null }
  if (!("stockConditionKnown" in f)) return { state: "legacy", usable: null, damaged: null, total: stockOnHand }
  return { state: "condition-unknown", usable: null, damaged: null, total: stockOnHand }
}

/** True for a quantity string above zero; false for zero, null or anything unparsable. */
export function isPositiveQuantity(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value === "") return false
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0
}

// --- due back -----------------------------------------------------------------

/**
 * What the "Earliest due back" figure says when there is no date.
 *
 * Only repair POs carry a promised date. When the only open repairs are
 * requests with no PO yet, nothing has been ordered, so there is no date to
 * promise -- which is different from a PO that has no date.
 */
export function dueBackNullNote(facts: unknown): string {
  const f = isRecord(facts) ? facts : {}
  const openRepairLines = typeof f.openRepairLines === "number" ? f.openRepairLines : 0
  if (openRepairLines > 0) return "no date promised"
  if (repairRequestCountOf(f) > 0) return "not ordered yet"
  return "no open repair PO"
}

// --- need date ----------------------------------------------------------------

/**
 * The backend's need-date sentence, or null. It is composed server-side (and
 * only when its setting is on) and shown as sent: the FE never builds it.
 */
export function needDateAdviceOf(facts: unknown): string | null {
  if (!isRecord(facts)) return null
  const advice = facts.needDateAdvice
  return typeof advice === "string" && advice.trim() !== "" ? advice : null
}

// --- internals ----------------------------------------------------------------

function stringOrNull(value: unknown): string | null {
  if (typeof value === "string") return value
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
