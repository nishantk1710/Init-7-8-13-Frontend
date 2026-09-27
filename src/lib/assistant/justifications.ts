/**
 * Justifications, from both places they are recorded.
 *
 * ## Why there are two sources, and why the dashboard showed one
 *
 * A reason for going ahead anyway is captured in two different moments, and
 * they are stored in two different tables:
 *
 *   - **At reservation time**, through the assistant, into the shared
 *     `justification` table — `NEW_ACQUISITION` (buying new while a
 *     repairable unit exists, I08 FR-7) and `QUANTITY_OVERRIDE` (keeping more
 *     than the suggestion, I13 FR-3).
 *   - **After the fact**, confirming an ACT exception, into that exception's
 *     own confirmation record — the plan breaches and no-plan cases.
 *
 * They do not overlap: `grep` over the backend shows only
 * `app/api/assistant/router.py` and `app/assistant/turns.py` write the shared
 * table, and the ACT confirmation route writes nowhere near it. So the two
 * populations are disjoint and concatenate cleanly, with no dedupe needed.
 *
 * The I13 dashboard's justification log read only the second source, which
 * meant every reason captured at the moment of the decision — the ones both
 * FRSs ask for by name — was invisible on the screen built to show them.
 *
 * ## Why this is a separate module
 *
 * `/api/justifications` is shared by both initiatives and sits outside both
 * prefixes, exactly like the assistant itself. Putting the adapter under
 * `features/initiative-13` would imply the record belongs to I13; I08's FR-7
 * reads the same table.
 */

import type { ApiJustification, ApiJustificationKind } from "@/lib/api/assistant"

/** Where a justification was captured. Always displayed — see below. */
export type JustificationSource = "ASSISTANT" | "EXCEPTION_QUEUE"

/**
 * One justification, whichever table it came from.
 *
 * `source` is not decoration. "Recorded before the reservation was made" and
 * "recorded weeks later when an exception was chased" are different kinds of
 * evidence about the same person's reasoning, and a log that flattens them
 * invites a reader to treat a retrospective explanation as a prior decision.
 */
export type UnifiedJustification = {
  id: string
  source: JustificationSource
  /** `NEW_ACQUISITION`, `QUANTITY_OVERRIDE`, `PLAN_BREACH`, `NO_PLAN`. */
  kind: string
  material: string
  plant: string
  reasonCategory: string
  freeText: string
  author: string
  recordedAt: string
  /** Set for an assistant justification: links back to the conversation. */
  sessionId: string | null
  /** Set for an exception-queue confirmation: links back to the exception. */
  exceptionId: string | null
}

/** From the shared `/api/justifications` table. */
export function fromAssistant(row: ApiJustification): UnifiedJustification {
  return {
    id: row.id,
    source: "ASSISTANT",
    kind: row.kind,
    material: row.materialId,
    plant: row.plant,
    reasonCategory: row.reasonCategory,
    freeText: row.freeText,
    author: row.author,
    recordedAt: row.recordedAt,
    sessionId: row.sessionId,
    exceptionId: row.exceptionId,
  }
}

/** The shape the I13 ACT adapter already produces. */
export type ActConfirmationEntry = {
  exceptionId: string
  exceptionType: string
  material: string
  plant: string
  ownerRequesterId: string | null
  reasonCategory: string
  freeText: string
  actorId: string
  submittedAt: string
}

/** From an ACT exception's requester confirmation. */
export function fromActConfirmation(
  entry: ActConfirmationEntry
): UnifiedJustification {
  return {
    // Namespaced: an exception id and a justification id are drawn from
    // different sequences and could collide as React keys otherwise.
    id: `act:${entry.exceptionId}`,
    source: "EXCEPTION_QUEUE",
    kind: entry.exceptionType,
    material: entry.material,
    plant: entry.plant,
    reasonCategory: entry.reasonCategory,
    freeText: entry.freeText,
    author: entry.actorId,
    recordedAt: entry.submittedAt,
    sessionId: null,
    exceptionId: entry.exceptionId,
  }
}

/**
 * Both sources, newest first.
 *
 * No dedupe, because there is nothing to dedupe — see the module note. If the
 * backend ever starts writing ACT confirmations into the shared table, this is
 * where that stops being true, and the two ids would need reconciling rather
 * than concatenating.
 */
export function mergeJustifications(
  assistant: readonly ApiJustification[],
  actConfirmations: readonly ActConfirmationEntry[]
): UnifiedJustification[] {
  return [
    ...assistant.map(fromAssistant),
    ...actConfirmations.map(fromActConfirmation),
  ].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
}

/** A readable label for a `kind`, which arrives as a SCREAMING_SNAKE enum. */
export function kindLabel(kind: string): string {
  switch (kind) {
    case "NEW_ACQUISITION":
      return "Bought new anyway"
    case "QUANTITY_OVERRIDE":
      return "Kept a larger quantity"
    case "PLAN_BREACH":
      return "Plan breached"
    case "NO_PLAN":
      return "No plan given"
    default:
      // An unrecognised kind is rendered readably rather than hidden. A new
      // exception type on the backend should show up as itself, not vanish.
      return kind.replace(/_/g, " ").toLowerCase()
  }
}

/** A short phrase for where and when a justification was captured. */
export function sourceLabel(source: JustificationSource): string {
  return source === "ASSISTANT"
    ? "at reservation time"
    : "chasing an exception"
}

/** The kinds the assistant captures, for filtering. */
export const ASSISTANT_KINDS: ApiJustificationKind[] = [
  "NEW_ACQUISITION",
  "QUANTITY_OVERRIDE",
]
