import type { DeclarationCondition } from "@/features/initiative-8/types/repair"

/**
 * The condition-to-repair attestation form's rules (FR-4), as plain functions.
 *
 * The form lived on the Declaration Queue until 08-Oct-2026 and now sits on
 * the repair detail page; these moved with it, unchanged.
 */

/** The three conclusions, in the order the form offers them. */
export const CONDITIONS: readonly DeclarationCondition[] = [
  "Repairable",
  "Beyond Economical Repair",
  "Scrap",
]

/** The UI's condition wording -> the API's recommendation enum. */
export const RECOMMENDATION: Record<
  DeclarationCondition,
  "REPAIRABLE" | "BEYOND_ECONOMICAL_REPAIR" | "SCRAP"
> = {
  Repairable: "REPAIRABLE",
  "Beyond Economical Repair": "BEYOND_ECONOMICAL_REPAIR",
  Scrap: "SCRAP",
}

/**
 * The form's quantity field as a number the API will accept, or `undefined`.
 *
 * Checked before the round trip so the button can say no; the backend applies
 * its own range check too and its 422 says why, which the form shows as-is.
 */
export function parseAttestationQuantity(input: string): number | undefined {
  const trimmed = input.trim()
  if (trimmed === "") return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

/**
 * The quantity the form starts with: what is still out on the line, or 1 when
 * the unit is already back. Never 0 — the API refuses it, and a form that
 * opens on an invalid value reads as broken.
 */
export function defaultAttestationQuantity(qtyUnderRepair: number): string {
  return String(qtyUnderRepair > 0 ? qtyUnderRepair : 1)
}
