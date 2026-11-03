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

import type {
  ApiLineAnswers,
  ApiLineDeclaration,
  ApiPreviewLine,
  ApiReasonCategory,
  QuantityChoice,
} from "@/lib/api/assistant-requests"
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

/**
 * Used only until the first preview answers with the backend's own list: the
 * three recommendations the declaration form has always offered.
 */
export const FALLBACK_RECOMMENDATIONS: readonly ApiReasonCategory[] = [
  { value: "REPAIRABLE", label: "Repairable" },
  { value: "BEYOND_ECONOMICAL_REPAIR", label: "Beyond economical repair" },
  { value: "SCRAP", label: "Scrap" },
]

/**
 * The faulty unit coming out, declared in the same request (option B, 27-Oct).
 * Optional: `open` false sends nothing. Quantity is kept as typed.
 */
export type DeclarationDraft = {
  open: boolean
  quantity: string
  conditionDescription: string
  faultCategory: string
  recommendation: string
  attestorName: string
  evidenceReference: string
}

export const EMPTY_DECLARATION: DeclarationDraft = {
  open: false,
  quantity: "1",
  conditionDescription: "",
  faultCategory: "",
  recommendation: "",
  attestorName: "",
  evidenceReference: "",
}

/**
 * Open or close the declaration. Opening it with no name typed yet fills in the
 * request's Requester, which is usually the person standing at the machine;
 * it stays editable, and a name already typed is never replaced.
 */
export function withDeclarationOpen(d: DeclarationDraft, open: boolean, requester: string): DeclarationDraft {
  const name = requester.trim()
  if (!open || d.attestorName.trim() || !name) return { ...d, open }
  return { ...d, open, attestorName: name }
}

/**
 * What is still missing on an open declaration, in the order the form asks.
 * A line from a draft saved before 27-Oct-2026 has no declaration at all: none made.
 */
export function declarationIssues(d: DeclarationDraft | undefined): string[] {
  if (!d?.open) return []
  const issues: string[] = []
  if (parseQuantity(d.quantity) === null) issues.push("declared quantity")
  if (!d.conditionDescription.trim()) issues.push("condition")
  if (!d.faultCategory) issues.push("fault category")
  if (!d.recommendation) issues.push("recommendation")
  if (!d.attestorName.trim()) issues.push("your name")
  return issues
}

/** The wire form of an open declaration; undefined when none is made (or the line predates them). */
export function declarationOf(d: DeclarationDraft | undefined): ApiLineDeclaration | undefined {
  if (!d?.open) return undefined
  const evidence = d.evidenceReference.trim()
  return {
    quantity: parseQuantity(d.quantity) ?? 0,
    conditionDescription: d.conditionDescription.trim(),
    faultCategory: d.faultCategory,
    recommendation: d.recommendation,
    attestorName: d.attestorName.trim(),
    ...(evidence ? { evidenceReference: evidence } : {}),
  }
}

type Common = {
  key: string
  materialId: string
  plant: string
  description: string | null
}

export type OarLine = Common & {
  kind: "i13"
  preview: ApiPreviewLine
  /** The suggestion as served; null when none can be made. */
  suggested: number | null
  /** Average monthly consumption -- what a new quantity's window is sized by. */
  rate: number
  decision: "proceed" | "not_needed"
  /**
   * The quantity the requester needs, typed first (3 Nov). The suggestion is
   * shown only once this is filled in; a saving is measured from it. Absent on
   * a draft saved before then.
   */
  required?: string
  /** Which number is locked: the suggestion or the requester's own. Null until chosen. */
  choice?: QuantityChoice | null
  /** The locked quantity -- the suggestion or `required` -- what is planned and reserved. */
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
  unitExists: boolean
  /** Null until chosen. Fixed to `proceed_new` when no unit exists anywhere. */
  decision: "use_existing" | "proceed_new" | null
  justification: Justification
  /** The faulty unit coming out; optional, closed by default. */
  declaration: DeclarationDraft
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
        suggested,
        rate: toNumber(facts.averageMonthlyConsumption) ?? 0,
        decision: "proceed",
        // Nothing prefilled: the requester names their own quantity first.
        required: "",
        choice: null,
        quantity: "",
        windowStart: "",
        windowEnd: "",
        windowEdited: false,
        purpose: "",
        justification: EMPTY_JUSTIFICATION,
        changed: false,
      }
      if (previous?.kind !== "i13") return fresh
      // Re-checked: keep everything the requester typed, take the new figures.
      // A locked suggestion is the old figure, so it is unlocked to be chosen again.
      return withRequired(
        { ...previous, preview, suggested, rate: fresh.rate, changed: true },
        previous.required ?? "",
        previous.choice === "own" ? "own" : null
      )
    }
    case "i08":
      return {
        ...common,
        kind: "i08",
        preview,
        unitExists: preview.unitExists === true,
        decision:
          previous?.kind === "i08" ? previous.decision : preview.unitExists === true ? null : "proceed_new",
        justification: previous?.kind === "i08" ? previous.justification : EMPTY_JUSTIFICATION,
        // `?? EMPTY_DECLARATION`: a draft saved before declarations existed has none.
        declaration: (previous?.kind === "i08" ? previous.declaration : undefined) ?? EMPTY_DECLARATION,
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

/** The quantity the requester said they need; null until a positive whole number is typed. */
export function requiredOf(line: OarLine): number | null {
  return parseQuantity(line.required ?? "")
}

/**
 * Which number the row has locked. With no suggestion there is only the
 * requester's own. A row marked not needed without a lock counts as taking
 * the suggestion only when that was 0 -- stock already covered it.
 */
export function choiceOf(line: OarLine): QuantityChoice | null {
  if (line.suggested === null) return "own"
  if (line.choice) return line.choice
  if (line.decision === "not_needed") return line.suggested === 0 ? "suggested" : "own"
  return null
}

/**
 * The row with `required` typed. The lock goes with the number it was made
 * against, so typing a new one unlocks the row -- unless `keep` names a lock
 * that still holds (the requester's own number follows what they type).
 */
export function withRequired(
  line: OarLine,
  required: string,
  keep: QuantityChoice | null = null,
  today?: Date
): OarLine {
  const next = { ...line, required, choice: line.suggested === null ? ("own" as const) : keep }
  return withSuggestedWindow({ ...next, quantity: lockedQuantity(next) }, today)
}

/**
 * Lock the suggestion or the requester's own number. Taking a suggestion of 0
 * means nothing needs reserving: the row is marked not needed.
 */
export function withChoice(line: OarLine, choice: QuantityChoice, today?: Date): OarLine {
  const declined = choice === "suggested" && line.suggested === 0
  const next: OarLine = { ...line, choice, decision: declined ? "not_needed" : "proceed", changed: false }
  return withSuggestedWindow({ ...next, quantity: lockedQuantity(next) }, today)
}

function lockedQuantity(line: OarLine): string {
  const choice = line.suggested === null ? "own" : line.choice
  if (choice === "own") return requiredOf(line) === null ? "" : String(requiredOf(line))
  if (choice === "suggested" && line.suggested !== null && line.suggested > 0) return String(line.suggested)
  return ""
}

export type LineSaving = {
  /** Null: no suggestion could be made, so nothing is counted. */
  units: number | null
  /** Null without a price; `priceNote` says why. */
  value: number | null
  priceNote: string | null
}

/**
 * What the suggestion saves on this row, as the backend will record it:
 * required less what is locked, never below 0, at the plant's I07 price.
 * Null until the row has a required quantity and a lock.
 */
export function savingOf(line: OarLine): LineSaving | null {
  const required = requiredOf(line)
  const choice = choiceOf(line)
  if (required === null || choice === null) return null
  const price = toNumber(line.preview.unitPrice?.price)
  const priceNote = line.preview.unitPrice?.note ?? (line.preview.unitPrice ? null : "No price")
  let units: number | null
  if (line.suggested === null) units = null
  else if (line.decision === "not_needed") units = line.suggested > 0 ? 0 : required
  else units = Math.max(required - (parseQuantity(line.quantity) ?? required), 0)
  return { units, value: units === null || price === null ? null : units * price, priceNote }
}

/**
 * What taking the suggestion would save, shown beside it before anything is
 * locked. Null until a required quantity is typed, or with no suggestion.
 */
export function suggestionSavingOf(line: OarLine): LineSaving | null {
  if (requiredOf(line) === null || line.suggested === null) return null
  return savingOf(withChoice(line, "suggested"))
}

/** The request's savings so far: units and rand over the OAR rows with a lock. */
export function requestSaving(rows: readonly DraftLine[]): { units: number; value: number; unpriced: number } {
  const total = { units: 0, value: 0, unpriced: 0 }
  for (const row of rows) {
    if (row.kind !== "i13") continue
    const saving = savingOf(row)
    if (!saving?.units) continue
    total.units += saving.units
    if (saving.value === null) total.unpriced += 1
    else total.value += saving.value
  }
  return total
}

/** Whether the OAR row's quantity needs a reason, as it stands. */
export function oarNeedsJustification(line: OarLine): boolean {
  if (line.decision !== "proceed") return false
  const quantity = parseQuantity(line.quantity)
  // Your own number under the suggestion needs a reason too (3 Nov), not only one above it.
  if (choiceOf(line) === "own" && line.suggested !== null && quantity !== null && quantity < line.suggested) {
    return true
  }
  return needsJustification(line.suggested, quantity)
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
      if (requiredOf(line) === null) issues.push("required quantity")
      else if (choiceOf(line) === null) issues.push("suggested or your quantity")
      else if (parseQuantity(line.quantity) === null) issues.push("quantity")
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
      if (line.decision === null) issues.push("decision")
      else if (repairableNeedsJustification(line)) issues.push(...justificationIssues(line.justification))
      issues.push(...declarationIssues(line.declaration))
      return issues
    }
    case "pending":
      return ["check"]
    default:
      return []
  }
}

/**
 * Rows with any declaration closed: what a resumed draft holds while the
 * complete-flow switch is off (29-Oct-2026). A draft saved while it was on can
 * carry an open declaration; its section is hidden then, so the declaration
 * could neither be finished nor removed, and the backend refuses it.
 */
export function withoutDeclarations(rows: readonly DraftLine[]): DraftLine[] {
  return rows.map((row) => (row.kind === "i08" && row.declaration?.open ? { ...row, declaration: EMPTY_DECLARATION } : row))
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
    const required = requiredOf(line)
    return {
      ...base,
      decision: line.decision,
      quantity: proceed ? line.quantity.trim() : null,
      windowStart: proceed ? line.windowStart : null,
      windowEnd: proceed ? line.windowEnd : null,
      purpose: proceed ? line.purpose.trim() : null,
      reasonCategory: reason ? line.justification.reasonCategory : null,
      freeText: reason ? line.justification.freeText.trim() : null,
      seenSuggestedQuantity: line.preview.suggestion?.quantity ?? null,
      // Only with a required quantity: a row marked not needed before one was typed saves nothing.
      ...(required !== null ? { requiredQuantity: String(required), quantityChoice: choiceOf(line) } : {}),
    }
  }
  if (line.kind === "i08") {
    const reason = repairableNeedsJustification(line)
    const declaration = declarationOf(line.declaration)
    return {
      ...base,
      decision: line.decision,
      reasonCategory: reason ? line.justification.reasonCategory : null,
      freeText: reason ? line.justification.freeText.trim() : null,
      ...(declaration ? { declaration } : {}),
    }
  }
  return base
}
