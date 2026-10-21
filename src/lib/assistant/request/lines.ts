/**
 * The rows of a multi-material request: what each one needs before the
 * request can be submitted, and the answers it sends.
 *
 * Every row is built from the backend's preview (`POST
 * /assistant/requests/preview`): its routing, its assessment and the quantity
 * suggested before any is named. Two kinds of row open a session -- OAR (I13)
 * and repairable (I08) -- and the rest (a consumable, an OAR part with no
 * data, a plant out of scope) are kept on screen so the requester sees why
 * nothing is asked of them. Routing decides which, never the requester.
 */

import type { ApiLineAnswers, ApiPreviewLine, ApiReasonCategory } from "@/lib/api/assistant-requests"
import { needsJustification, suggestWindow } from "@/lib/assistant/request/suggest"

/** Used until the backend's own cap arrives with the first preview. */
export const DEFAULT_MAX_LINES = 20

/**
 * Used only until the first preview answers with the backend's configured
 * list -- the same three placeholders the conversation offers by default.
 */
export const FALLBACK_REASONS: readonly ApiReasonCategory[] = [
  { value: "URGENT_BREAKDOWN", label: "Urgent Breakdown" },
  { value: "NO_SUITABLE_REPAIRABLE", label: "No Suitable Repairable" },
  { value: "OTHER", label: "Other" },
]

export type Justification = { reasonCategory: string; freeText: string }

export const EMPTY_JUSTIFICATION: Justification = { reasonCategory: "", freeText: "" }

type Common = {
  key: string
  materialId: string
  plant: string
  description: string | null
}

export type OarLine = Common & {
  kind: "i13"
  preview: ApiPreviewLine
  /** Picked per line from the plant's codes. Blank until chosen -- never inherited. */
  department: string
  /** The suggestion as served; null when none can be made. */
  suggested: number | null
  /** Average monthly consumption -- what a new quantity's window is sized by. */
  rate: number
  decision: "proceed" | "not_needed"
  /** As typed. Prefilled with the suggestion when there is one above zero. */
  quantity: string
  windowStart: string
  windowEnd: string
  /** Once the requester edits the window it is theirs: a new quantity no longer moves it. */
  windowEdited: boolean
  purpose: string
  justification: Justification
  /** Set when submit found the suggestion had moved: the row was re-checked. */
  changed: boolean
}

export type RepairableLine = Common & {
  kind: "i08"
  preview: ApiPreviewLine
  department: string
  unitExists: boolean
  /** Null until chosen. Fixed to `proceed_new` when no unit exists anywhere. */
  decision: "use_existing" | "proceed_new" | null
  justification: Justification
}

export type NoSessionLine = Common & {
  kind: "out_of_scope" | "data_gap" | "invalid"
  reason: string
}

/** Added, waiting for its preview. */
export type PendingLine = Common & { kind: "pending" }

export type DraftLine = OarLine | RepairableLine | NoSessionLine | PendingLine

export function opensSession(line: DraftLine): line is OarLine | RepairableLine {
  return line.kind === "i13" || line.kind === "i08"
}

let counter = 0
export function nextKey(): string {
  counter += 1
  return `line-${Date.now().toString(36)}-${counter}`
}

export function pendingLine(materialId: string, plant: string, description: string | null): PendingLine {
  return { key: nextKey(), kind: "pending", materialId, plant, description }
}

/** A plain number from a backend quantity string; null for none. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Parse a quantity as typed. Null for blank or anything that is not a positive whole number. */
export function parseQuantity(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return value > 0 ? value : null
}

/** The window that goes with a quantity, unless the requester has set their own. */
export function withSuggestedWindow(line: OarLine, today?: Date): OarLine {
  if (line.windowEdited) return line
  const window = suggestWindow(parseQuantity(line.quantity), line.rate, today)
  return window
    ? { ...line, windowStart: window.start, windowEnd: window.end }
    : { ...line, windowStart: "", windowEnd: "" }
}

/**
 * A row from its preview. `key` is kept when a pending row resolves, and when a
 * row is re-checked after a 409 -- `previous` then keeps what was typed.
 */
export function lineFromPreview(preview: ApiPreviewLine, key: string = nextKey(), previous?: DraftLine): DraftLine {
  const common = {
    key,
    materialId: preview.materialId,
    plant: preview.plant,
    description: preview.materialDescription,
  }
  switch (preview.kind) {
    case "i13": {
      const suggested = toNumber(preview.suggestion?.quantity)
      const facts = preview.facts ?? {}
      const fresh: OarLine = {
        ...common,
        kind: "i13",
        preview,
        department: "",
        suggested,
        rate: toNumber(facts.averageMonthlyConsumption) ?? 0,
        decision: "proceed",
        quantity: suggested !== null && suggested > 0 ? String(suggested) : "",
        windowStart: preview.suggestion?.windowStart ?? "",
        windowEnd: preview.suggestion?.windowEnd ?? "",
        windowEdited: false,
        purpose: "",
        justification: EMPTY_JUSTIFICATION,
        changed: false,
      }
      if (previous?.kind !== "i13") return fresh
      // Re-checked: keep everything the requester typed, take the new figures.
      return withSuggestedWindow({
        ...previous,
        preview,
        suggested,
        rate: fresh.rate,
        changed: true,
      })
    }
    case "i08":
      return {
        ...common,
        kind: "i08",
        preview,
        department: previous?.kind === "i08" ? previous.department : "",
        unitExists: preview.unitExists === true,
        decision:
          previous?.kind === "i08" ? previous.decision : preview.unitExists === true ? null : "proceed_new",
        justification: previous?.kind === "i08" ? previous.justification : EMPTY_JUSTIFICATION,
      }
    default:
      return { ...common, kind: preview.kind, reason: preview.reason }
  }
}

/** Same material at the same plant twice in one request is refused: merge the quantities instead. */
export function isDuplicate(lines: readonly DraftLine[], materialId: string, plant: string): boolean {
  const id = materialId.trim().replace(/^0+/, "")
  return lines.some((line) => line.materialId.replace(/^0+/, "") === id && line.plant === plant.trim())
}

/** Whether the OAR row's quantity needs a reason, as it stands. */
export function oarNeedsJustification(line: OarLine): boolean {
  return line.decision === "proceed" && needsJustification(line.suggested, parseQuantity(line.quantity))
}

/** Whether the repairable row needs a reason, as it stands. */
export function repairableNeedsJustification(line: RepairableLine): boolean {
  return line.decision === "proceed_new" && line.unitExists
}

function justificationIssues(j: Justification): string[] {
  const issues: string[] = []
  if (!j.reasonCategory) issues.push("reason")
  if (!j.freeText.trim()) issues.push("explanation")
  return issues
}

/** What is still missing on a row, in the order the row asks for it. Empty when ready. */
export function lineIssues(line: DraftLine): string[] {
  switch (line.kind) {
    case "i13": {
      if (line.decision === "not_needed") return []
      const issues: string[] = []
      if (!line.department) issues.push("department")
      if (parseQuantity(line.quantity) === null) issues.push("quantity")
      if (oarNeedsJustification(line)) issues.push(...justificationIssues(line.justification))
      if (!line.windowStart) issues.push("window start")
      if (!line.windowEnd) issues.push("window end")
      if (line.windowStart && line.windowEnd && line.windowEnd < line.windowStart) {
        issues.push("window ends before it starts")
      }
      if (!line.purpose.trim()) issues.push("purpose")
      return issues
    }
    case "i08": {
      const issues: string[] = []
      if (!line.department) issues.push("department")
      if (line.decision === null) issues.push("decision")
      else if (repairableNeedsJustification(line)) issues.push(...justificationIssues(line.justification))
      return issues
    }
    case "pending":
      return ["check"]
    default:
      return []
  }
}

/** Lines that still need a department. A line marked not needed takes none. */
export function needsDepartment(line: DraftLine): boolean {
  if (line.kind === "i13") return line.decision === "proceed"
  return line.kind === "i08"
}

export function isReady(line: DraftLine): boolean {
  return lineIssues(line).length === 0
}

/** The answers submit sends for one row, exactly what its flow asks. */
export function answersOf(line: DraftLine): ApiLineAnswers {
  const base: ApiLineAnswers = { materialId: line.materialId, plant: line.plant }
  if (line.kind === "i13") {
    const proceed = line.decision === "proceed"
    const reason = oarNeedsJustification(line)
    return {
      ...base,
      department: proceed ? line.department : null,
      decision: line.decision,
      quantity: proceed ? line.quantity.trim() : null,
      windowStart: proceed ? line.windowStart : null,
      windowEnd: proceed ? line.windowEnd : null,
      purpose: proceed ? line.purpose.trim() : null,
      reasonCategory: reason ? line.justification.reasonCategory : null,
      freeText: reason ? line.justification.freeText.trim() : null,
      seenSuggestedQuantity: line.preview.suggestion?.quantity ?? null,
    }
  }
  if (line.kind === "i08") {
    const reason = repairableNeedsJustification(line)
    return {
      ...base,
      department: line.department,
      decision: line.decision,
      reasonCategory: reason ? line.justification.reasonCategory : null,
      freeText: reason ? line.justification.freeText.trim() : null,
    }
  }
  return base
}
