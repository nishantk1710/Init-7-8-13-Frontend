import type { RepairChain } from "@/features/initiative-8/types/repair"
import { stageLabel } from "@/features/initiative-8/utils/format"
import { OVERDUE_STATUS_LABEL } from "@/features/initiative-8/utils/status"

/**
 * How a repair requested on a purchase requisition with no PO yet reads, on
 * the register, its download, the repair page and the Overview.
 *
 * Since 27-Oct-2026 the backend can list these as register rows (`lineKind:
 * "PR"`, behind its `repairRequestsEnabled` switch). They have no vendor, no
 * agreed return date and nothing to declare against yet, so every screen says
 * "No PO yet" where a PO row says those things. The wording lives here, once,
 * so the screen and the Excel file cannot drift apart.
 */

/** What a PR row says where a PO row names its vendor or due-date state. */
export const NO_PO_YET = OVERDUE_STATUS_LABEL.NOT_ORDERED

/** The stage of a PR row, in words: "Repair requested". */
export const REPAIR_REQUESTED = stageLabel("PR Raised")

/** "requested today", "requested 1 day ago", "requested 12 days ago". */
export function requestedAgo(days: number): string {
  if (days <= 0) return "requested today"
  return `requested ${days.toLocaleString("en-US")} ${days === 1 ? "day" : "days"} ago`
}

/**
 * The requester as a reader can use it: `10305 · Engineering` when the
 * department list knows the code, the bare code when it does not, undefined
 * when there is none. Never an invented name.
 */
export function requesterText(chain: Pick<RepairChain, "requester" | "requesterName">): string | undefined {
  if (!chain.requester) return undefined
  return chain.requesterName ? `${chain.requester} · ${chain.requesterName}` : chain.requester
}

/**
 * The repair page's banner on a PR row:
 * `No PO yet. Repair requested 12 days ago by department 10305 (Engineering).`
 * Split so the page can set the first sentence in bold.
 */
export function repairRequestBanner(
  chain: Pick<RepairChain, "daysOpen" | "requester" | "requesterName">,
): { lead: string; rest: string } {
  const by = chain.requester
    ? ` by department ${chain.requester}${chain.requesterName ? ` (${chain.requesterName})` : ""}`
    : ""
  return { lead: `${NO_PO_YET}.`, rest: `Repair ${requestedAgo(chain.daysOpen)}${by}.` }
}

/**
 * The muted note beside a count of PO lines, saying how many repairs are
 * requested with no PO yet: `+3 repairs requested, no PO yet`.
 *
 * Undefined -- no note -- unless the backend serves PR rows (its
 * `repairRequestsEnabled` switch) AND counted at least one. An older backend
 * sends neither, and a count it never made is not zero.
 */
export function repairRequestsNote(enabled: boolean, openRepairRequests: number | undefined): string | undefined {
  if (!enabled || openRepairRequests === undefined || openRepairRequests <= 0) return undefined
  const noun = openRepairRequests === 1 ? "repair" : "repairs"
  return `+${openRepairRequests.toLocaleString("en-US")} ${noun} requested, no PO yet`
}
