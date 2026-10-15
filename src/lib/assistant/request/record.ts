/**
 * A submitted multi-material request, as it would be recorded.
 *
 * The parent request carries its own reference -- `R` plus eight characters
 * and a check character, in the session ID's alphabet and checksum -- and each
 * row that opens a session is a line under it, shown as `R…/1`, `R…/2`. Each
 * line also gets a child session ID of its own (demo `D…`), as it would in the
 * backend, where the line is an ordinary `assistant_session` with
 * `request_id` and `line_no`.
 */

import { checkCharacter, mintDemoSessionId } from "@/lib/assistant/demo/ids"
import type { DemoRequestMaterial } from "@/lib/assistant/request/catalogue"
import {
  oarNeedsJustification,
  opensSession,
  parseQuantity,
  repairableNeedsJustification,
  repairableUnitExists,
  type DraftLine,
  type Justification,
  type NoSessionLine,
} from "@/lib/assistant/request/lines"
import type { QuantitySuggestion } from "@/lib/assistant/request/suggest"

export const REQUEST_PREFIX = "R"
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const ID_LENGTH = 10

export function requestIdFrom(payload: string): string {
  const body = REQUEST_PREFIX + payload.toUpperCase()
  return body + checkCharacter(body)
}

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

export type OarOutcome = {
  flow: "i13"
  decision: "proceed" | "not_needed"
  suggestion: QuantitySuggestion
  quantity: number | null
  /** The requester kept the suggested quantity unchanged. */
  acceptedSuggestion: boolean
  windowStart: string | null
  windowEnd: string | null
  purpose: string | null
  justification: Justification | null
}

export type RepairableOutcome = {
  flow: "i08"
  decision: "use_existing" | "proceed_new"
  unitExists: boolean
  alsoMatchedOar: boolean
  justification: Justification | null
}

export type LinkRecord = {
  reservationNumber: string
  reservationItem: string
  sgtxt: string
  /** The resolver's verdict, as shown when it was simulated. */
  status: "LINKED" | "LINKED_WITH_WARNING"
  note: string
  linkedAt: string
}

export type RequestLine = {
  lineNo: number
  sessionId: string
  material: DemoRequestMaterial
  outcome: OarOutcome | RepairableOutcome
  links: LinkRecord[]
}

export type RequestRecord = {
  requestId: string
  requester: string
  department: string
  origin: "PLATFORM" | "BADI"
  issuedAt: string
  lines: RequestLine[]
  /** Rows that opened no session, kept so the request shows what was asked. */
  skipped: Omit<NoSessionLine, "key">[]
}

function justificationOf(j: Justification): Justification {
  return { reasonCategory: j.reasonCategory, freeText: j.freeText.trim() }
}

/**
 * Turn ready rows into a request. Lines are numbered in the order they were
 * added, across both tables, so `/n` is stable however the screen groups them.
 */
export function submitRequest(
  rows: readonly DraftLine[],
  header: { requester: string; department: string; origin?: "PLATFORM" | "BADI" },
  { requestId = mintRequestId(), now = new Date().toISOString() }: { requestId?: string; now?: string } = {}
): RequestRecord {
  const lines: RequestLine[] = []
  const skipped: RequestRecord["skipped"] = []

  for (const row of rows) {
    if (!opensSession(row)) {
      skipped.push({
        kind: row.kind,
        materialId: row.materialId,
        plant: row.plant,
        description: row.description,
        reason: row.reason,
      })
      continue
    }
    const lineNo = lines.length + 1
    if (row.kind === "i13") {
      const proceed = row.decision === "proceed"
      const quantity = proceed ? parseQuantity(row.quantity) : null
      lines.push({
        lineNo,
        sessionId: mintDemoSessionId(),
        material: row.material,
        links: [],
        outcome: {
          flow: "i13",
          decision: row.decision,
          suggestion: row.suggestion,
          quantity,
          acceptedSuggestion: proceed && quantity !== null && quantity === row.suggestion.quantity,
          windowStart: proceed ? row.windowStart : null,
          windowEnd: proceed ? row.windowEnd : null,
          purpose: proceed ? row.purpose.trim() : null,
          justification: oarNeedsJustification(row) ? justificationOf(row.justification) : null,
        },
      })
    } else {
      lines.push({
        lineNo,
        sessionId: mintDemoSessionId(),
        material: row.material,
        links: [],
        outcome: {
          flow: "i08",
          decision: row.decision ?? "proceed_new",
          unitExists: repairableUnitExists(row.facts),
          alsoMatchedOar: row.alsoMatchedOar,
          justification: repairableNeedsJustification(row) ? justificationOf(row.justification) : null,
        },
      })
    }
  }

  return {
    requestId,
    requester: header.requester.trim(),
    department: header.department.trim(),
    origin: header.origin ?? "PLATFORM",
    issuedAt: now,
    lines,
    skipped,
  }
}

/** One sentence per line for the summary: what was decided. */
export function outcomeSentence(outcome: OarOutcome | RepairableOutcome): string {
  if (outcome.flow === "i08") {
    if (outcome.decision === "use_existing") return "Use the existing unit -- no new one reserved."
    return outcome.unitExists
      ? "New unit, although one exists -- justified."
      : "New unit -- none exists in stock or on repair."
  }
  if (outcome.decision === "not_needed") return "Not needed after the assessment."
  const s = outcome.suggestion
  const q = outcome.quantity ?? 0
  if (s.quantity === null) return `Procure ${q} -- no suggestion possible, justified.`
  if (outcome.acceptedSuggestion) return `Procure ${q} -- the suggested quantity.`
  if (q < s.quantity) return `Procure ${q} -- below the suggested ${s.quantity}.`
  return s.kind === "covered"
    ? `Procure ${q} although stock covers the year -- justified.`
    : `Procure ${q} -- above the suggested ${s.quantity}, justified.`
}
