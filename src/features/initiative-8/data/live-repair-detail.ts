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
 *   dispatched  "No 541 movement attributable to this line."
 *   at vendor   "No dispatch movement attributable to this line, so time at the
 *                vendor cannot be measured. Stores post most 541s on the day
 *                of the goods receipt, so few open lines have one."
 *
 * A stage rendered as blank looks like a field somebody forgot. A stage that
 * says why it is blank is the product. So the adapter carries `evidence`
 * through as the step's description rather than dropping it.
 *
 * ## No "Removed from machine" stage
 *
 * Ruled 26-Oct-2026: SAP has no record of a unit coming off the machine (the
 * issue to the maintenance order carries no PO reference, so it cannot be tied
 * to a repair line), and the stage was empty on every line. "Condition
 * declared" and the replacement issue tell that part of the story. The backend
 * stopped sending the stage on 27-Oct-2026; an older backend still does, so
 * the adapter drops it here.
 */

import type { TimelineEvent } from "@/components/shared/timeline"
import { toRepairChain } from "@/features/initiative-8/data/live-register"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import type { ApiLifecycleStage } from "@/lib/api/i8"
import { getRepairLine } from "@/lib/api/i8"
import { i08Date } from "@/features/initiative-8/utils/format"

export type LiveRepairDetail = {
  chain: RepairChain
  timeline: TimelineEvent[]
}

/** Stages that mean something happened, so a date makes them a success. No
 *  "received" stage since 19-Oct-2026: every line served is open in SAP.
 *  `pr_raised` ("Repair requested") arrived on 27-Oct-2026, on PR rows. */
const COMPLETED_TONE: Record<string, TimelineEvent["tone"]> = {
  pr_raised: "default",
  attested: "success",
  po_raised: "default",
  dispatched: "default",
  at_vendor: "warning",
}

/** Stages an older backend may still send but the timeline no longer shows.
 *  `removed` ("Removed from machine"): dropped 27-Oct-2026, see above. */
const DROPPED_STAGES: ReadonlySet<string> = new Set(["removed"])

function toTimelineEvent(stage: ApiLifecycleStage): TimelineEvent {
  const happened = stage.occurredAt !== null

  return {
    id: stage.stage,
    label: stage.label,
    // "Not recorded" rather than a dash: the stage did not merely lack a date,
    // nothing was ever written for it. The evidence line below says why.
    timestamp: happened ? i08Date(stage.occurredAt) : "Not recorded",
    description: stage.evidence,
    tone: happened ? COMPLETED_TONE[stage.stage] ?? "default" : "warning",
  }
}

/** How a register id names a repair requested with no PO yet:
 *  `PR-{BANFN}-{BNFPO}`. */
const REPAIR_REQUEST_PREFIX = "PR-"

/** Is this register id a repair requested on a PR with no PO yet? */
export function isRepairRequestId(repairId: string): boolean {
  return repairId.startsWith(REPAIR_REQUEST_PREFIX)
}

/**
 * The two path segments `GET /api/i8/register/{document}/{item}` takes for a
 * register id, or null when the id is not one.
 *
 * `4500001052-1310` -> `4500001052` / `1310`; a PR row's `PR-2000029113-10`
 * -> `PR-2000029113` / `10`, which the backend reads as the PR (since
 * 27-Oct-2026). Both split on the LAST hyphen, so the PR prefix stays with the
 * document.
 */
export function repairLineKey(repairId: string): { document: string; item: string } | null {
  const separator = repairId.lastIndexOf("-")
  if (separator <= 0 || separator === repairId.length - 1) return null
  const document = repairId.slice(0, separator)
  // "PR-" alone names no requisition.
  if (document === REPAIR_REQUEST_PREFIX.slice(0, -1)) return null
  return { document, item: repairId.slice(separator + 1) }
}

/**
 * Fetch one repair line by the register's `{EBELN}-{EBELP}` id, or a repair
 * requested with no PO yet by its `PR-{BANFN}-{BNFPO}` id.
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
  const key = repairLineKey(repairId)
  if (key === null) {
    throw new Error(
      `"${repairId}" is not a repair line id. Expected {purchasingDocument}-{item} or PR-{requisition}-{item}.`,
    )
  }
  const { document, item } = key

  let detail
  try {
    detail = await getRepairLine(document, item)
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }

  return {
    chain: toRepairChain(detail.line),
    timeline: detail.timeline
      .filter((stage) => !DROPPED_STAGES.has(stage.stage))
      .map(toTimelineEvent),
  }
}
