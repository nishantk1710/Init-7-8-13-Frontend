/**
 * How a declaration status reads, and what a line in that status offers.
 *
 * One module for the queue, the register and the repair page, so "Historical"
 * cannot read as Required on one screen and as nothing on another.
 */

import type { DeclarationStatus } from "@/features/initiative-8/types/repair"

export type DeclarationTone = "warn" | "good" | "crit" | "muted"

export const DECLARATION_DISPLAY: Record<DeclarationStatus, { tone: DeclarationTone; label: string; hint?: string }> = {
  Required: { tone: "warn", label: "Required" },
  Completed: { tone: "good", label: "Declared" },
  Flagged: { tone: "crit", label: "Against assessment" },
  // Raised before declarations began (the attestation cutover, 27-Oct-2026
  // design): nobody could have declared it, so it is labelled, never chased.
  Historical: { tone: "muted", label: "Historical", hint: "Raised before declarations began" },
}

/** The label and tone for any status string, an unknown one shown as itself. */
export function declarationDisplay(status: string | undefined): { tone: DeclarationTone; label: string; hint?: string } {
  if (status && status in DECLARATION_DISPLAY) return DECLARATION_DISPLAY[status as DeclarationStatus]
  return { tone: "warn", label: status ?? "Required" }
}

/**
 * What a line offers: Amend when a declaration covers it (a correction is a
 * new record superseding that one, never a second, competing declaration --
 * the backend refuses that with a 422), Declare when none does, and nothing
 * on a Historical line with no declaration: it was never required.
 */
export function declarationAction(
  status: string | undefined,
  declarationId: string | undefined | null,
): "amend" | "declare" | null {
  if (declarationId) return "amend"
  if (status === "Historical") return null
  return "declare"
}

/** "Waiting for a declaration" means Required only: a Flagged line has one. */
export function isWaitingForDeclaration(status: string | undefined): boolean {
  return status === "Required"
}

/**
 * The waiting count from the queue's counts: the Required bucket when the
 * backend sends it, else its `outstanding` (an older backend counted Flagged
 * in that too).
 */
export function waitingCount(summary: { outstanding: number; byStatus: Record<string, number> }): number {
  return summary.byStatus["Required"] ?? summary.outstanding
}

/**
 * Why the declaration form cannot be submitted yet, or undefined when it can.
 * Mirrors the backend's 422s so the person is told before the round trip.
 */
export function declarationFormProblem(form: {
  description: string
  faultCategory: string
  quantityValid: boolean
  attestorName: string
  amending: boolean
  amendmentReason: string
}): string | undefined {
  if (form.attestorName.trim() === "") return "Type your name."
  if (form.amending && form.amendmentReason.trim() === "") return "Say why this declaration is being amended."
  if (form.description.trim() === "") return "Say what is wrong with it."
  if (form.faultCategory === "") return "Choose a fault."
  if (!form.quantityValid) return "The quantity must be greater than 0."
  return undefined
}

/** Optional text sent only when typed: a blank on an audit record reads as a fact. */
export function optionalText(value: string): string | undefined {
  return value.trim() || undefined
}

/**
 * How the covering declaration was matched to a repair line (contract B3,
 * 27-Oct-2026), in the words the repair page uses. Undefined for a link this
 * build has not heard of, so nothing is claimed about it.
 */
export const DECLARATION_LINK_LABEL: Record<string, string> = {
  BOUND: "Declared",
  REFERENCE: "Linked through the R-reference on the repair order",
  WINDOW: "Matched by part and date",
}

export function declarationLinkLabel(link: string | undefined | null): string | undefined {
  return link ? DECLARATION_LINK_LABEL[link] : undefined
}

/**
 * A register row id as the line a declaration binds to: `{EBELN}-{EBELP}` is
 * a repair PO line, `PR-{BANFN}-{BNFPO}` a repair PR with no PO yet. Cut at
 * the last hyphen, because the item number never holds one.
 */
export function repairLineOfId(repairId: string | undefined): {
  repairDocument?: string
  repairItem?: string
  repairDocumentType?: "PO" | "PR"
} {
  if (!repairId) return {}
  const cut = repairId.lastIndexOf("-")
  if (cut <= 0) return {}
  const document = repairId.slice(0, cut)
  const repairItem = repairId.slice(cut + 1)
  return document.startsWith("PR-")
    ? { repairDocument: document.slice(3), repairItem, repairDocumentType: "PR" }
    : { repairDocument: document, repairItem, repairDocumentType: "PO" }
}

/** The checks whose finding a first declaration clears. */
const CLEARED_BY_DECLARING = new Set(["MISSING_ATTESTATION", "REPAIR_PR_NOT_DECLARED"])
/** The checks about a declaration already recorded: amending it is the fix
 *  when the declaration itself was wrong. */
const ABOUT_A_DECLARATION = new Set(["REPAIRED_AGAINST_ASSESSMENT", "DECLARED_NO_REPAIR_PR"])

/**
 * What the exception drawer offers: Declare, Amend, or nothing. The same rules
 * as the register: nothing on an item raised before declarations began (the
 * drawer's Historical), nothing once the check no longer finds it, and nothing
 * without a plant, because a declaration is per material and plant.
 */
export function exceptionDeclarationAction(item: {
  type: string
  stillDetected: boolean
  preAutomation: boolean
  declarationId?: string
  plant?: { plantId: string }
}): "declare" | "amend" | null {
  if (!item.stillDetected || item.preAutomation || !item.plant?.plantId) return null
  if (CLEARED_BY_DECLARING.has(item.type)) return "declare"
  if (ABOUT_A_DECLARATION.has(item.type) && item.declarationId) return "amend"
  return null
}

/**
 * The line a declaration-queue row binds to: its repair PO line, else (a PR
 * row, `PR-{BANFN}-{BNFPO}`, since 27-Oct-2026) its open repair PR. Nothing
 * for a row that names neither, which then declares on part and plant.
 */
export function queueRowLine(row: {
  relatedRepairId: string
  repairPO?: { documentNumber: string; line?: string }
}): { repairDocument?: string; repairItem?: string; repairDocumentType?: "PO" | "PR" } {
  if (row.repairPO?.documentNumber) {
    return { repairDocument: row.repairPO.documentNumber, repairItem: row.repairPO.line, repairDocumentType: "PO" }
  }
  const line = repairLineOfId(row.relatedRepairId)
  return line.repairDocumentType === "PR" ? line : {}
}
