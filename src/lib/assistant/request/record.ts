/**
 * Helpers over a recorded request (`ApiRequest`), live or demo.
 *
 * A request's reference is `R` + eight characters + a check character, in the
 * session ID's alphabet and checksum; each line is quoted on its SAP item as
 * `R…/n`. The backend mints it; {@link mintRequestId} is the demo's stand-in.
 */

import { checkCharacter } from "@/lib/assistant/demo/ids"
import type { ApiRequest, ApiRequestLine } from "@/lib/api/assistant-requests"

export const REQUEST_PREFIX = "R"
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const ID_LENGTH = 10

export type RequestRecord = ApiRequest
export type RequestLine = ApiRequestLine

export function requestIdFrom(payload: string): string {
  const body = REQUEST_PREFIX + payload.toUpperCase()
  return body + checkCharacter(body)
}

/** Demo only -- live, the backend mints the reference. */
export function mintRequestId(random: () => number = Math.random): string {
  let payload = ""
  for (let i = 0; i < ID_LENGTH - REQUEST_PREFIX.length - 1; i += 1) {
    payload += ALPHABET[Math.floor(random() * ALPHABET.length)]
  }
  return requestIdFrom(payload)
}

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
    if (line.decision === "use_existing") return "Use the existing unit -- no new one reserved."
    return line.justification
      ? "New unit, although one exists -- justified."
      : "New unit -- none exists in stock or on repair."
  }
  if (line.decision === "not_needed") return "Not needed after the assessment."
  const quantity = plain(line.plannedQuantity)
  if (line.suggestedQuantity === null) return `Procure ${quantity} -- no suggestion possible, justified.`
  const suggested = Number(line.suggestedQuantity)
  const planned = Number(line.plannedQuantity)
  if (planned === suggested) return `Procure ${quantity} -- the suggested quantity.`
  if (planned < suggested) return `Procure ${quantity} -- below the suggested ${plain(line.suggestedQuantity)}.`
  return suggested === 0
    ? `Procure ${quantity} although stock covers the year -- justified.`
    : `Procure ${quantity} -- above the suggested ${plain(line.suggestedQuantity)}, justified.`
}

/** The distinct departments a request serves, in line order. */
export function departmentsOf(request: Pick<ApiRequest, "lines">): string[] {
  return [...new Set(request.lines.map((l) => l.department).filter((d): d is string => !!d))]
}
