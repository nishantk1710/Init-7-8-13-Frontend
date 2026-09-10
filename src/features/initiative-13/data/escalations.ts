// Requester -> HOD -> Inventory Control escalation timelines for aging
// exception lines where the requester hasn't responded. Keyed by ledger line
// id. Named people are always sourced from `@/lib/shared-data/users`.

import { getUserById } from "@/lib/shared-data/users"
import type { EscalationTimelineEvent } from "@/features/initiative-13/types/oar"

const AMANDA = getUserById("U-008")!
const RIAAN = getUserById("U-007")!
const PIETER_HOD = getUserById("U-005")!
const LINDIWE_IC = getUserById("U-006")!

export const ESCALATION_TIMELINES: Record<string, EscalationTimelineEvent[]> = {
  // OAR-LDG-0002 — recently overdue, first reminder only, not yet escalated.
  "OAR-LDG-0002": [
    {
      id: "e1",
      label: "Consumption date passed",
      timestamp: "12 Aug 2026",
      description: "Planned consumption date reached with no utilization confirmation.",
      tone: "warning",
    },
    {
      id: "e2",
      label: `Reminder sent to ${AMANDA.name}`,
      timestamp: "14 Aug 2026",
      description: `${AMANDA.role} — ${AMANDA.department}. Awaiting response.`,
      tone: "default",
    },
  ],
  // OAR-LDG-0008 — unresponsive requester, fully escalated to Inventory Control.
  "OAR-LDG-0008": [
    {
      id: "e1",
      label: "Consumption date passed",
      timestamp: "18 Aug 2026",
      description: "Planned consumption date reached with no utilization confirmation.",
      tone: "warning",
    },
    {
      id: "e2",
      label: `Reminder sent to ${RIAAN.name}`,
      timestamp: "20 Aug 2026",
      description: `${RIAAN.role} — ${RIAAN.department}. No response after 7 days.`,
      tone: "default",
    },
    {
      id: "e3",
      label: `Escalated to ${PIETER_HOD.name}`,
      timestamp: "27 Aug 2026",
      description: `${PIETER_HOD.role} — ${PIETER_HOD.department}.`,
      tone: "warning",
    },
    {
      id: "e4",
      label: `Escalated to ${LINDIWE_IC.name}`,
      timestamp: "2 Sep 2026",
      description: `${LINDIWE_IC.role} — ${LINDIWE_IC.department}. Flagged for stock write-back review.`,
      tone: "danger",
    },
  ],
}
