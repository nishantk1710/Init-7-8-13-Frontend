/**
 * How a declaration status reads, and how its declaration was matched.
 *
 * One module for the register and the repair page, so "Historical" cannot
 * read as Required on one and as nothing on the other. What a line offered
 * (Declare, Amend) went on 3-Nov-2026: a part is declared in the reservation
 * assistant only.
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
