/**
 * Linking a SAP reservation item to a request line, from its item text (SGTXT).
 *
 * The line is found by **request ID + material + plant**. A request never holds
 * the same material at the same plant twice, so that pair already names one
 * line. The requester types the bare request ID into the reservation header,
 * and SAP copies it to every item, so no `/n` is the normal case. An older
 * `R…/n` still links, with a warning where the `/n` names another line.
 *
 * Read from the text explicitly rather than through the session tokeniser:
 * `R…/2`, `R…-2`, `R… / 2` and a bare `R…` all parse, I/L and O are read as 1
 * and 0, and an ID typed with spaces inside it is found on a second pass.
 */

import { isWellFormed } from "@/lib/assistant/demo/ids"
import { REQUEST_PREFIX, lineReference, type RequestLine, type RequestRecord } from "@/lib/assistant/request/record"

export type RequestReference = {
  /** As read, after normalising. */
  requestId: string
  lineNo: number | null
  valid: boolean
}

const CANDIDATE = new RegExp(
  `(?<![0-9A-Z])(${REQUEST_PREFIX}[0-9A-Z]{9})(?![0-9A-Z])(?:\\s*[/-]\\s*(\\d{1,3})(?!\\d))?`,
  "g"
)

function normaliseId(raw: string): string {
  return raw.toUpperCase().replace(/[IL]/g, "1").replace(/O/g, "0")
}

function wellFormed(id: string): boolean {
  try {
    return isWellFormed(id)
  } catch {
    // A character outside the alphabet (U) -- not an ID.
    return false
  }
}

function scan(text: string): RequestReference[] {
  const found: RequestReference[] = []
  for (const match of text.toUpperCase().matchAll(CANDIDATE)) {
    const requestId = normaliseId(match[1])
    // Only something that looks deliberate: an ID carries at least one digit.
    if (!/\d/.test(requestId.slice(1))) continue
    found.push({
      requestId,
      lineNo: match[2] ? Number(match[2]) : null,
      valid: wellFormed(requestId),
    })
  }
  return found
}

/** Every request reference in an item text, valid ones first. */
export function requestReferencesIn(sgtxt: string): RequestReference[] {
  let refs = scan(sgtxt)
  if (refs.length === 0) refs = scan(sgtxt.replace(/\s+/g, ""))
  return [...refs].sort((a, b) => Number(b.valid) - Number(a.valid))
}

export type LinkStatus =
  /** No request reference in the text at all. */
  | "MISSING"
  /** Shaped like one, but a character is wrong (the check character fails). */
  | "INVALID"
  /** A well-formed reference to a request the platform does not hold. */
  | "UNKNOWN_REQUEST"
  /** The request exists, but this item's material/plant is not one of its lines. */
  | "NOT_ON_REQUEST"
  | "LINKED"
  | "LINKED_WITH_WARNING"

export type LinkResult = {
  status: LinkStatus
  reference: RequestReference | null
  request: RequestRecord | null
  line: RequestLine | null
  notes: string[]
}

function sameMaterial(line: RequestLine, materialId: string, plant: string): boolean {
  return line.materialId === materialId.trim().replace(/^0+/, "") && line.plant === plant.trim()
}

/**
 * Resolve one reservation item. `findRequest` looks a request up by ID --
 * the store in the demo, the request table in the backend.
 */
export function resolveLink(
  item: { materialId: string; plant: string; sgtxt: string },
  findRequest: (requestId: string) => RequestRecord | undefined
): LinkResult {
  const refs = requestReferencesIn(item.sgtxt)
  if (refs.length === 0) {
    return {
      status: "MISSING",
      reference: null,
      request: null,
      line: null,
      notes: ["No request reference in the item text."],
    }
  }

  const valid = refs.filter((ref) => ref.valid)
  if (valid.length === 0) {
    return {
      status: "INVALID",
      reference: refs[0],
      request: null,
      line: null,
      notes: [
        `${refs[0].requestId} looks like a request reference, but its check character does not match -- ` +
          "a character was mistyped.",
      ],
    }
  }

  const known = valid
    .map((ref) => ({ ref, request: findRequest(ref.requestId) }))
    .filter((hit): hit is { ref: RequestReference; request: RequestRecord } => hit.request !== undefined)
  if (known.length === 0) {
    return {
      status: "UNKNOWN_REQUEST",
      reference: valid[0],
      request: null,
      line: null,
      notes: [`${valid[0].requestId} is well formed, but no such request was recorded.`],
    }
  }

  for (const { ref, request } of known) {
    const line = request.lines.find((l) => sameMaterial(l, item.materialId, item.plant))
    if (!line) continue

    const notes: string[] = []
    let warn = false
    const ours = lineReference(request.requestId, line.lineNo)
    if (ref.lineNo === null) {
      notes.push(`Matched to ${ours} by material and plant.`)
    } else if (ref.lineNo === line.lineNo) {
      notes.push(`Matched ${ours}.`)
    } else {
      warn = true
      const typed = request.lines.find((l) => l.lineNo === ref.lineNo)
      notes.push(
        typed
          ? `/${ref.lineNo} is the line for ${typed.materialId}. Linked to ${ours} by material and plant instead.`
          : `The request has no line /${ref.lineNo}. Linked to ${ours} by material and plant instead.`
      )
    }

    if (line.decision === "not_needed") {
      warn = true
      notes.push("The requester said this part was not needed, yet it was reserved.")
    }
    if (line.decision === "use_existing") {
      warn = true
      notes.push("The requester chose to use the existing unit, yet a reservation was made.")
    }

    return { status: warn ? "LINKED_WITH_WARNING" : "LINKED", reference: ref, request, line, notes }
  }

  const { ref, request } = known[0]
  return {
    status: "NOT_ON_REQUEST",
    reference: ref,
    request,
    line: null,
    notes: [
      `Request ${request.requestId} has no line for material ${item.materialId.trim()} at plant ` +
        `${item.plant.trim()}. Not linked -- the assistant never assessed this part.`,
    ],
  }
}
