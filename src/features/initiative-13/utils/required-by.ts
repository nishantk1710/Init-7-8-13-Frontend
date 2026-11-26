import { formatApiDate } from "@/lib/api/format"
import type { ReservationLedgerRow } from "@/lib/api/i13"

type RequiredByInput = Pick<
  ReservationLedgerRow,
  "sessionId" | "planRecorded" | "plannedStart" | "plannedEnd" | "requirementDate" | "createdDate"
>

export type RequiredBy =
  | { kind: "sap"; text: string }
  | { kind: "plan"; text: string }
  | { kind: "none"; text: string; hint: string }

/**
 * A requirement date somebody typed in SAP. SAP fills RESB-BDTER from the
 * reservation's created date (RESB-CRDAT, the base date), so one equal to it was
 * never typed -- true of every assistant reservation on prod (25 Nov 2026) and of
 * about half of the rest. With no created date to compare (a reservation SAP made
 * itself, e.g. the copper-concentrate production requirements 219937 / 829147),
 * nobody can be shown to have typed it, so it does not count (user, 26 Nov 2026).
 */
export function sapRequiredTyped(row: RequiredByInput): boolean {
  return Boolean(row.requirementDate && row.createdDate && row.requirementDate !== row.createdDate)
}

/**
 * The Reservations tab's Required by, as the table draws it and the export
 * writes it (agreed with the user, 26 Nov 2026):
 *
 *   1. a requirement date typed in SAP, for any reservation;
 *   2. otherwise, made through the assistant: its planned consumption window
 *      (or that it recorded no plan, or gave no window);
 *   3. otherwise, raised directly in SAP: Not recorded.
 */
export function requiredBy(row: RequiredByInput): RequiredBy {
  if (sapRequiredTyped(row)) return { kind: "sap", text: formatApiDate(row.requirementDate) }
  if (row.sessionId) {
    if (!row.planRecorded) {
      return {
        kind: "none",
        text: "No plan recorded",
        hint: "Made through the assistant, but its session recorded no consumption plan (for example, a line marked not needed).",
      }
    }
    if (!row.plannedStart && !row.plannedEnd) {
      return { kind: "none", text: "No window given", hint: "The assistant's plan was given no window." }
    }
    return { kind: "plan", text: `${formatApiDate(row.plannedStart)} → ${formatApiDate(row.plannedEnd)}` }
  }
  return {
    kind: "none",
    text: "Not recorded",
    hint: "Raised directly in SAP (Non-AI) with no requirement date typed in (SAP's pre-filled one left as it was, or a reservation SAP made itself), so nobody recorded when it is needed.",
  }
}

/** `requiredBy` as plain text, for the export. */
export function requiredByText(row: RequiredByInput): string {
  return requiredBy(row).text
}
