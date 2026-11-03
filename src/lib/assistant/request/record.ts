/**
 * Helpers over a recorded request (`ApiRequest`).
 *
 * A request's reference is `R` + eight characters + a check character, in the
 * session ID's alphabet and checksum; each line is quoted on its SAP item as
 * `R…/n`. The backend mints it.
 */

import type { ApiRequest, ApiRequestLine } from "@/lib/api/assistant-requests"
import { formatZAR } from "@/lib/utils"

export type RequestRecord = ApiRequest
export type RequestLine = ApiRequestLine

/** What the requester types into SGTXT for one line. */
export function lineReference(requestId: string, lineNo: number): string {
  return `${requestId}/${lineNo}`
}

/** Whether the requester declined this line in the assistant. */
export function isDeclined(line: Pick<ApiRequestLine, "decision">): boolean {
  return line.decision === "not_needed" || line.decision === "use_existing"
}

function plain(value: string | null): string {
  if (value === null) return "—"
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : value
}

/** One sentence per line for the summary: what was decided. */
export function outcomeSentence(line: ApiRequestLine): string {
  if (line.flow === "i08") {
    if (line.decision === "use_existing") return "Use the existing unit: no new one reserved."
    return line.justification
      ? "New unit although one exists, justified."
      : "New unit: none exists in stock or on repair."
  }
  if (line.decision === "not_needed") return "Not needed after the assessment."
  const quantity = plain(line.plannedQuantity)
  if (line.suggestedQuantity === null) return `Procure ${quantity}: no suggestion possible, justified.`
  const suggested = Number(line.suggestedQuantity)
  const planned = Number(line.plannedQuantity)
  if (planned === suggested) return `Procure ${quantity}: the suggested quantity.`
  if (planned < suggested) return `Procure ${quantity}: below the suggested ${plain(line.suggestedQuantity)}.`
  return suggested === 0
    ? `Procure ${quantity} although stock covers the year, justified.`
    : `Procure ${quantity}: above the suggested ${plain(line.suggestedQuantity)}, justified.`
}

/** A department as shown: `10100 · FINANCE-COMMERCIAL DEPARTMENT`, or the code
 * alone when VZI's list gives it no name. */
export function departmentText(code: string, name?: string | null): string {
  return name ? `${code} · ${name}` : code
}

/** The request's department as shown: the one department with its name, or --
 * for a request from before 21 Oct whose lines named several -- all the codes. */
export function departmentLabel(
  request: Pick<ApiRequest, "department" | "departments"> & { departmentName?: string | null }
): string {
  if (request.department) return departmentText(request.department, request.departmentName)
  return request.departments.length > 0 ? request.departments.join(", ") : "—"
}

/** The distinct departments a request serves, in line order. */
export function departmentsOf(request: Pick<ApiRequest, "lines">): string[] {
  return [...new Set(request.lines.map((l) => l.department).filter((d): d is string => !!d))]
}

/**
 * What the suggestion saved on a line, in words: "Asked 12 · saved 4 ·
 * R 1,002". Null for a line recorded without a saving (before 3 Nov, a
 * repairable line, or one marked not needed before a quantity was typed).
 */
export function savingSentence(line: Pick<ApiRequestLine, "saving">): string | null {
  const s = line.saving
  if (!s) return null
  const asked = `Asked ${plainNumber(s.requiredQuantity)}`
  if (s.unitsSaved === null) return `${asked} · no suggestion, nothing counted`
  if (Number(s.unitsSaved) === 0) return `${asked} · no saving`
  const value = s.valueSaved === null ? (s.priceNote ?? "no price") : formatZAR(Number(s.valueSaved))
  return `${asked} · saved ${plainNumber(s.unitsSaved)} · ${value}`
}

/** The request's savings: units and rand over its lines, and how many had no price. */
export function requestSavings(request: Pick<ApiRequest, "lines">): { units: number; value: number; unpriced: number } {
  const total = { units: 0, value: 0, unpriced: 0 }
  for (const line of request.lines) {
    const units = Number(line.saving?.unitsSaved ?? 0)
    if (!(units > 0)) continue
    total.units += units
    if (line.saving?.valueSaved == null) total.unpriced += 1
    else total.value += Number(line.saving.valueSaved)
  }
  return total
}

function plainNumber(value: string): string {
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : value
}
