/**
 * One repair line and its lifecycle — `GET /api/i8/register/{ebeln}/{ebelp}`.
 *
 * The companion to `live-register.ts`, for the detail page.
 *
 * ## The timeline is the reason this is worth doing
 *
 * The fixture path builds its timeline in the browser, out of whatever fields
 * the chain happens to carry, and writes "Simulated SAP GR" under each step. The
 * backend builds one **with the evidence for every stage, including the stages
 * it cannot prove** — and those are the interesting ones:
 *
 *   removed     "MSEG 261/201 carries no PO reference at all, so removal cannot
 *                be tied to this line. Modelled at material+plant level or left
 *                out — never linked by a guess."
 *   dispatched  "No 541 movement attributable to this line."
 *   at vendor   "Measured across the extract, NO open repair line has an
 *                attachable 541 — dispatch movements exist only for repairs
 *                that have already come back."
 *
 * A stage rendered as blank looks like a field somebody forgot. A stage that
 * says why it is blank is the product. So the adapter carries `evidence`
 * through as the step's description rather than dropping it.
 */

import type { TimelineEvent } from "@/components/shared/timeline"
import { toRepairChain } from "@/features/initiative-8/data/live-register"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import type { ApiLifecycleStage } from "@/lib/api/i8"
import { formatApiDate, getRepairLine } from "@/lib/api/i8"

export type LiveRepairDetail = {
  chain: RepairChain
  timeline: TimelineEvent[]
}

/** Stages that mean something happened, so a date makes them a success. */
const COMPLETED_TONE: Record<string, TimelineEvent["tone"]> = {
  attested: "success",
  po_raised: "default",
  dispatched: "default",
  at_vendor: "warning",
  received: "success",
}

function toTimelineEvent(stage: ApiLifecycleStage): TimelineEvent {
  const happened = stage.occurredAt !== null

  return {
    id: stage.stage,
    label: stage.label,
    // "Not recorded" rather than a dash: the stage did not merely lack a date,
    // nothing was ever written for it. The evidence line below says why.
    timestamp: happened ? formatApiDate(stage.occurredAt) : "Not recorded",
    description: stage.evidence,
    tone: happened ? COMPLETED_TONE[stage.stage] ?? "default" : "warning",
  }
}

/**
 * Fetch one repair line by the register's `{EBELN}-{EBELP}` id.
 *
 * The id is split on the LAST hyphen. Purchasing documents in this extract
 * carry none, but splitting on the first would quietly send the wrong item
 * number the day one does — and the failure would be a 404 on a line that
 * exists, which is the hardest kind to diagnose.
 *
 * **Returns `null` for a 404, and throws for everything else.** That split is
 * the contract, and it is deliberate: a repair line that is not in the July
 * extract is an ANSWER, and the reader needs "no such repair". A backend that
 * is down, timing out or erroring is a FAILURE, and the reader needs to know
 * the request never completed. Rendering the second as the first sends somebody
 * hunting for a missing purchase order when nothing is listening on port 8000.
 *
 * The 404 is detected by reading `.status` off the error rather than with
 * `instanceof ApiError`. That is not defensiveness: Next bundles the route and
 * this module separately, so the route's `ApiError` and the one thrown here can
 * be different class objects and `instanceof` silently returns false. It did --
 * a missing line rendered as "could not be loaded" until this was changed.
 */
function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: unknown }).status === 404
  )
}

export async function loadLiveRepairDetail(
  repairId: string,
): Promise<LiveRepairDetail | null> {
  const separator = repairId.lastIndexOf("-")
  if (separator <= 0) {
    throw new Error(
      `"${repairId}" is not a repair line id. Expected {purchasingDocument}-{item}.`,
    )
  }

  const document = repairId.slice(0, separator)
  const item = repairId.slice(separator + 1)

  let detail
  try {
    detail = await getRepairLine(document, item)
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }

  return {
    chain: toRepairChain(detail.line),
    timeline: detail.timeline.map(toTimelineEvent),
  }
}
