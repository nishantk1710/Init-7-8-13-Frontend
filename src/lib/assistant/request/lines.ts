/**
 * The rows of a multi-material request: what each one needs before the
 * request can be submitted, and what it records once it is.
 *
 * One request holds two kinds of row that open a session -- OAR (I13) and
 * repairable (I08) -- plus rows that open none (a consumable, an OAR part with
 * no data, a number not found), which are kept on screen so the requester sees
 * why nothing is asked of them. Routing decides which, never the requester.
 */

import {
  findDemoMaterial,
  type DemoRequestMaterial,
  type OarFacts,
  type RepairableFacts,
} from "@/lib/assistant/request/catalogue"
import {
  needsJustification,
  suggestQuantity,
  suggestWindow,
  type QuantitySuggestion,
} from "@/lib/assistant/request/suggest"

export const MAX_LINES = 20

/** Placeholder categories -- the same ones the single-material chat offers. */
export const REASON_OPTIONS = [
  { value: "URGENT_BREAKDOWN", label: "Urgent breakdown" },
  { value: "NO_SUITABLE_REPAIRABLE", label: "No suitable repairable" },
  { value: "PLANNED_SHUTDOWN", label: "Planned shutdown" },
  { value: "OTHER", label: "Other" },
] as const

export type Justification = { reasonCategory: string; freeText: string }

export const EMPTY_JUSTIFICATION: Justification = { reasonCategory: "", freeText: "" }

export type OarLine = {
  key: string
  kind: "i13"
  material: DemoRequestMaterial
  facts: OarFacts
  suggestion: QuantitySuggestion
  decision: "proceed" | "not_needed"
  /** As typed. Prefilled with the suggestion when there is one above zero. */
  quantity: string
  windowStart: string
  windowEnd: string
  /** Once the requester edits the window it is theirs: a new quantity no longer moves it. */
  windowEdited: boolean
  purpose: string
  justification: Justification
}

export type RepairableLine = {
  key: string
  kind: "i08"
  material: DemoRequestMaterial
  facts: RepairableFacts
  alsoMatchedOar: boolean
  /** Null until chosen. Fixed to `proceed_new` when no unit exists anywhere. */
  decision: "use_existing" | "proceed_new" | null
  justification: Justification
}

export type NoSessionLine = {
  key: string
  kind: "out_of_scope" | "data_gap" | "not_found"
  materialId: string
  plant: string
  description: string | null
  reason: string
}

export type DraftLine = OarLine | RepairableLine | NoSessionLine

export function opensSession(line: DraftLine): line is OarLine | RepairableLine {
  return line.kind === "i13" || line.kind === "i08"
}

export function repairableUnitExists(facts: RepairableFacts): boolean {
  return facts.stockOnHand > 0 || facts.openRepairs.length > 0
}

let counter = 0
function nextKey(): string {
  counter += 1
  return `line-${Date.now().toString(36)}-${counter}`
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
  const window = suggestWindow(parseQuantity(line.quantity), line.facts.averageMonthlyConsumption, today)
  return window
    ? { ...line, windowStart: window.start, windowEnd: window.end }
    : { ...line, windowStart: "", windowEnd: "" }
}

/** Route a material+plant into a row, as the backend's router would. */
export function lineFor(materialId: string, plant: string, today?: Date): DraftLine {
  const material = findDemoMaterial(materialId, plant)
  const key = nextKey()
  if (!material) {
    return {
      key,
      kind: "not_found",
      materialId: materialId.trim(),
      plant: plant.trim(),
      description: null,
      reason: `Material ${materialId.trim()} was not found at plant ${plant.trim()}.`,
    }
  }

  const routing = material.routing
  switch (routing.kind) {
    case "i13": {
      const suggestion = suggestQuantity(routing.facts)
      const line: OarLine = {
        key,
        kind: "i13",
        material,
        facts: routing.facts,
        suggestion,
        decision: "proceed",
        quantity: suggestion.quantity !== null && suggestion.quantity > 0 ? String(suggestion.quantity) : "",
        windowStart: "",
        windowEnd: "",
        windowEdited: false,
        purpose: "",
        justification: EMPTY_JUSTIFICATION,
      }
      return withSuggestedWindow(line, today)
    }
    case "i08":
      return {
        key,
        kind: "i08",
        material,
        facts: routing.facts,
        alsoMatchedOar: routing.alsoMatchedOar,
        decision: repairableUnitExists(routing.facts) ? null : "proceed_new",
        justification: EMPTY_JUSTIFICATION,
      }
    case "out_of_scope":
    case "data_gap":
      return {
        key,
        kind: routing.kind,
        materialId: material.materialId,
        plant: material.plant,
        description: material.description,
        reason: routing.reason,
      }
  }
}

/** Same material at the same plant twice in one request is refused: merge the quantities instead. */
export function isDuplicate(lines: readonly DraftLine[], materialId: string, plant: string): boolean {
  const id = materialId.trim().replace(/^0+/, "")
  return lines.some((line) => {
    const lineId = opensSession(line) ? line.material.materialId : line.materialId
    const linePlant = opensSession(line) ? line.material.plant : line.plant
    return lineId.replace(/^0+/, "") === id && linePlant === plant.trim()
  })
}

/** Whether the OAR row's quantity needs a reason, as it stands. */
export function oarNeedsJustification(line: OarLine): boolean {
  return line.decision === "proceed" && needsJustification(line.suggestion, parseQuantity(line.quantity))
}

/** Whether the repairable row needs a reason, as it stands. */
export function repairableNeedsJustification(line: RepairableLine): boolean {
  return line.decision === "proceed_new" && repairableUnitExists(line.facts)
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
      if (line.decision === null) return ["decision"]
      return repairableNeedsJustification(line) ? justificationIssues(line.justification) : []
    }
    default:
      return []
  }
}

export function isReady(line: DraftLine): boolean {
  return lineIssues(line).length === 0
}
