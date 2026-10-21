import type { ExceptionEvent } from "@demo/features/initiative-8/types/repair"

/**
 * The Exception Queue's stored half (FR-11): who owns each item, what was said
 * about it, and where it stands.
 *
 * The findings themselves are never written here. Each check works them out
 * from the data (`model/snapshot.ts`) — an item exists because a check finds
 * it — and the ids are stable (`EX-<type>-<key>`), so this history attaches
 * to the right item every time. When a check stops finding an item that is
 * still open (a declaration is recorded, a justification names the purchase),
 * the queue resolves it automatically and says why.
 *
 *   EX-OD-<line>         OVERDUE_REPAIR           past EKET.EINDT + 7 days
 *   EX-MA-<line>         MISSING_ATTESTATION      repair PR/PO with no declaration
 *   EX-MS-<reservation>  MISSING_SESSION_ID       80-series reservation, no valid session
 *   EX-UA-<purchase>     UNJUSTIFIED_ACQUISITION  new unit while a repairable one existed
 */

/** People an exception can be assigned to. */
export const EXCEPTION_OWNERS = [
  "Lindiwe Mahlangu",
  "Thabo Nkosi",
  "Pieter Steyn",
  "Johan Botha",
  "Sarah van Wyk",
  "Riaan Kruger",
  "Nomvula Dlamini",
]

const PRE_AUTOMATION_CLOSE: ExceptionEvent = {
  at: "16 Jul 2026, 10:00",
  actor: "Lindiwe Mahlangu",
  kind: "STATUS",
  status: "CLOSED",
  text: "Raised before Spares Automation — nothing could have been recorded at the time. Closed in the cut-over review.",
}

/** What has happened to each item since its check raised it. */
export const EXCEPTION_HISTORY: Record<string, ExceptionEvent[]> = {
  "EX-OD-8006": [
    { at: "28 Aug 2026, 09:00", actor: "Lindiwe Mahlangu", kind: "ASSIGNED", owner: "Lindiwe Mahlangu", text: "Taken by Lindiwe Mahlangu" },
    { at: "28 Aug 2026, 09:02", actor: "Lindiwe Mahlangu", kind: "STATUS", status: "IN_PROGRESS", text: "Chasing Bosch Rexroth for a return date." },
    { at: "1 Sep 2026, 14:30", actor: "Lindiwe Mahlangu", kind: "COMMENT", text: "Bosch: impeller castings on back-order. Revised return 12 Sep — not yet updated on the PO schedule line." },
  ],
  "EX-OD-8012": [
    { at: "8 Aug 2026, 08:15", actor: "Lindiwe Mahlangu", kind: "ASSIGNED", owner: "Johan Botha", text: "Assigned to Johan Botha" },
    { at: "10 Aug 2026, 11:00", actor: "Johan Botha", kind: "STATUS", status: "IN_PROGRESS", text: "Escalated to Bosch's regional service manager." },
    { at: "20 Aug 2026, 16:40", actor: "Johan Botha", kind: "COMMENT", text: "The drive is waiting on an IGBT stack from Germany. No date offered." },
    { at: "1 Sep 2026, 12:05", actor: "Johan Botha", kind: "COMMENT", text: "A replacement drive was bought (PO-94812) — see the justification. The repair is still being chased for credit." },
  ],
  "EX-MA-8003": [
    { at: "28 Aug 2026, 15:10", actor: "Lindiwe Mahlangu", kind: "ASSIGNED", owner: "Thabo Nkosi", text: "Assigned to Thabo Nkosi" },
    { at: "1 Sep 2026, 08:30", actor: "Thabo Nkosi", kind: "COMMENT", text: "Engineer sign-off booked for 4 Sep, before the liner set ships." },
  ],
  "EX-MA-8006": [
    { at: "16 Jul 2026, 10:00", actor: "Lindiwe Mahlangu", kind: "COMMENT", text: "Raised before the declaration control went live (15 Jul). Left open while the impellers are still out — declare them when they come back." },
  ],
  "EX-MA-8009": [PRE_AUTOMATION_CLOSE],
  "EX-MA-8016": [PRE_AUTOMATION_CLOSE],
  "EX-MA-8017": [PRE_AUTOMATION_CLOSE],
  "EX-MS-41318": [
    { at: "31 Aug 2026, 07:45", actor: "Lindiwe Mahlangu", kind: "ASSIGNED", owner: "Riaan Kruger", text: "Assigned to Riaan Kruger, who raised the reservation" },
  ],
  "EX-MS-41292": [
    { at: "29 Aug 2026, 08:20", actor: "Lindiwe Mahlangu", kind: "ASSIGNED", owner: "Pieter Steyn", text: "Assigned to Pieter Steyn" },
    { at: "29 Aug 2026, 09:05", actor: "Pieter Steyn", kind: "STATUS", status: "IN_PROGRESS", text: "Looking into it." },
    { at: "29 Aug 2026, 09:12", actor: "Pieter Steyn", kind: "COMMENT", text: "The item text carries the old pilot format. Session SE7R3VY8JN for this part was opened the same morning — asked stores to correct the item text." },
  ],
  "EX-MS-41098": [
    { ...PRE_AUTOMATION_CLOSE, text: "Reserved before the Spares Assistant went live (1 Jul) — nobody could have had a session id. Closed in the cut-over review." },
  ],
  "EX-UA-90112": [
    { at: "2 Sep 2026, 07:30", actor: "Lindiwe Mahlangu", kind: "ASSIGNED", owner: "Pieter Steyn", text: "Assigned to Pieter Steyn" },
    { at: "2 Sep 2026, 07:34", actor: "Lindiwe Mahlangu", kind: "COMMENT", text: "MRP raised this against three impellers at Bosch and one on the shelf. MRP cannot record a reason — hold the release until the repair date is confirmed." },
  ],
  "EX-UA-93120": [
    { ...PRE_AUTOMATION_CLOSE, text: "Bought before the justification control existed (1 Jul) — nobody was asked. Closed in the cut-over review." },
  ],

  // Raised and dealt with before the reference date. The checks no longer find
  // these, so they are listed in EARLIER_FINDINGS to stay on the record.
  "EX-UA-94655": [
    { at: "21 Aug 2026, 08:00", actor: "Lindiwe Mahlangu", kind: "ASSIGNED", owner: "Jacques Louw", text: "Assigned to Jacques Louw, who raised the order" },
    { at: "29 Aug 2026, 16:33", actor: "Jacques Louw", kind: "STATUS", status: "RESOLVED", text: "Justification J-7005 recorded for this purchase." },
    { at: "30 Aug 2026, 09:15", actor: "Lindiwe Mahlangu", kind: "STATUS", status: "CLOSED", text: "Reviewed — BER confirmed by the Voith strip-down report." },
  ],
  "EX-UA-94812": [
    { at: "1 Sep 2026, 13:00", actor: "Lindiwe Mahlangu", kind: "ASSIGNED", owner: "Thabo Nkosi", text: "Assigned to Thabo Nkosi, who raised the order" },
    { at: "2 Sep 2026, 08:20", actor: "Thabo Nkosi", kind: "STATUS", status: "RESOLVED", text: "Justification J-7003 recorded for this purchase." },
  ],
  "EX-OD-8015": [
    { at: "24 Aug 2026, 08:00", actor: "Lindiwe Mahlangu", kind: "ASSIGNED", owner: "Lindiwe Mahlangu", text: "Taken by Lindiwe Mahlangu" },
    { at: "28 Aug 2026, 14:00", actor: "System", kind: "AUTO_RESOLVED", status: "RESOLVED", text: "Goods receipt posted — both load cells are back." },
    { at: "29 Aug 2026, 09:00", actor: "Lindiwe Mahlangu", kind: "STATUS", status: "CLOSED", text: "Back in stock." },
  ],
  "EX-OD-8017": [
    { at: "22 Jul 2026, 11:00", actor: "System", kind: "AUTO_RESOLVED", status: "RESOLVED", text: "Goods receipt posted — the motor is back." },
    { at: "23 Jul 2026, 08:30", actor: "Lindiwe Mahlangu", kind: "STATUS", status: "CLOSED", text: "Back in stock, 12 days late. Noted against Bosch's turnaround." },
  ],
}

/** Items raised earlier that the checks no longer find, kept as the record. */
export const EARLIER_FINDINGS = ["EX-UA-94655", "EX-UA-94812", "EX-OD-8015", "EX-OD-8017"]
