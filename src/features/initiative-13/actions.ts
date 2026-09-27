"use server"

import { revalidatePath } from "next/cache"

import { ApiError } from "@/lib/api/client"
import { runI13Detection, submitI13ActConfirmation } from "@/lib/api/i13"

/**
 * Initiative 13's write paths, as Server Actions.
 *
 * ## Why Server Actions rather than a `fetch` from the component
 *
 * Because of `revalidatePath`. The OAR screens are server components now, so
 * the way a screen updates after a write is for the server to re-render it —
 * and only a Server Action can invalidate the cached render. A client `fetch`
 * would write successfully and leave every other tab, and the page underneath,
 * showing the state from before.
 *
 * That is the whole "…and it should get updated accordingly" mechanism, and it
 * is why the data-fetching migration had to come first: against the old client
 * pages there was nothing for a refresh to do, because the rows lived in
 * `useState`.
 *
 * ## No retries, anywhere
 *
 * Every table behind these writes is append-only — Postgres triggers block
 * UPDATE and DELETE. A retry after a timeout that actually succeeded writes a
 * second row that nobody can remove: two confirmations against one decision, or
 * a second detection run creating exceptions the first already created. The
 * caller sees the failure and decides, with the duplicate risk visible rather
 * than hidden behind a button labelled "try again".
 */

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

/**
 * Record a requester's structured confirmation against an ACT exception
 * (FR-7, FR-9).
 *
 * This replaces the local `useState` the exceptions board used to advance a
 * status with. That version moved a badge from OPEN to ACKNOWLEDGED to RESOLVED
 * in the browser and wrote nothing anywhere — while this endpoint, a validated
 * state transition with an append-only audit entry, already existed and was
 * called by nothing.
 *
 * A 422 here is usually not a bug and is passed through verbatim: the state
 * machine refuses a confirmation on an exception that is still `OPEN`, because
 * an exception nobody was ever asked to answer cannot be answered. That is the
 * routing gap talking, and the message says so better than a generic failure.
 */
export async function confirmExceptionAction(
  exceptionId: string,
  formData: FormData
): Promise<ActionResult> {
  const reasonCategory = String(formData.get("reasonCategory") ?? "").trim()
  const freeText = String(formData.get("freeText") ?? "").trim()

  if (!reasonCategory) {
    return { ok: false, message: "Choose a reason category." }
  }
  if (!freeText) {
    return { ok: false, message: "A written explanation is required." }
  }

  try {
    await submitI13ActConfirmation(exceptionId, { reasonCategory, freeText })
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.detailText() }
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "The confirmation could not be recorded.",
    }
  }

  // Every OAR screen that counts or lists exceptions, not just this one. The
  // dashboard's exception panel and justification log both move on a
  // confirmation, and a reader who switches tabs should not find the old
  // numbers waiting.
  revalidatePath("/oar-utilization", "layout")

  return { ok: true, message: "Confirmation recorded against this exception." }
}

/**
 * Re-run detection (`POST /i13/act/run/detect`).
 *
 * **The only thing that moves any number on these screens.** FRS FR-6 asks for a
 * daily refresh and acceptance criterion 5 for breaches raised "within one
 * refresh cycle"; there is no scheduler, so a refresh is this call. A future
 * Azure job invokes the same backend function unchanged.
 *
 * It writes across the whole OAR population unless narrowed, so it is exposed
 * as a deliberate operator action rather than something a page does on load.
 * Detection is idempotent — a second run against the same unresolved condition
 * reuses the existing exception rather than creating a second one — which is
 * what makes it safe to offer at all.
 */
export async function runDetectionAction(params?: {
  material?: string
  plant?: string
}): Promise<ActionResult> {
  try {
    const result = await runI13Detection(params)
    revalidatePath("/oar-utilization", "layout")
    return {
      ok: true,
      message:
        `Detection complete: ${result.created} created, ${result.reused} reused, ` +
        `${result.resolved} resolved, ${result.routed} routed to a requester.`,
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.detailText() }
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Detection could not be run.",
    }
  }
}
