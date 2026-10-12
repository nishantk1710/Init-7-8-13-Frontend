// Initiative 13's half of the live cross-initiative feeds.
//
// Calls only I13's own clients (`lib/api/i13`). Throws on failure;
// `lib/aggregation.ts` turns that into one failed card.

import { cache } from "react"

import { initiative13Manifest } from "@/features/initiative-13/manifest"
import {
  EXCEPTION_STATUS_LABEL,
  EXCEPTION_TYPE_LABEL,
} from "@/features/initiative-13/utils/status-labels"
import {
  getI13ActEvents,
  getI13ActExceptionsList,
  getI13Summary,
  type ActException,
} from "@/lib/api/i13"
import type {
  ActionSeverity,
  AuditEvent,
  GlobalAction,
  InitiativeHealth,
  InitiativeSummary,
} from "@/lib/domain/contracts"
import {
  NOT_AVAILABLE,
  type AuditQuery,
  type LiveActions,
  type LiveAuditEvents,
} from "@/lib/domain/live-feed"

/**
 * The summary card, from `GET /i13/summary`.
 *
 * Four of the six figures below are served. Two are not, and are said to be
 * not available rather than approximated:
 *
 *  - **Unutilized OAR value** — the backend has no trustworthy valuation
 *    (`valuation_is_mocked` exists for exactly that reason).
 *  - **Plan compliance** — derivable-looking from the breach count, but that
 *    would silently decide that "no plan at all" is non-compliant. That is a
 *    business definition nobody has given; it is not ours to invent.
 *
 * The card shows the first four (all live); the "Utilization signals" panel
 * lists all six, so the gap is visible instead of the metrics quietly
 * differing from the design.
 */
export const getInitiative13LiveSummary = cache(async (): Promise<InitiativeSummary> => {
  const s = await getI13Summary()

  // The summary alone cannot tell "critical" (that needs an escalated item) —
  // so this is attention or healthy, never a guess at critical.
  const health: InitiativeHealth =
    s.planBreachCount > 0 ||
    s.noPlanCount > 0 ||
    s.grNotIssued30DayCount > 0
      ? "attention"
      : "healthy"

  return {
    id: "initiative-13",
    label: initiative13Manifest.name,
    href: initiative13Manifest.href,
    health,
    metrics: [
      { label: "OAR materials", value: s.totalOarPositions },
      { label: "Planned Consumption Overdue", value: s.planBreachCount },
      { label: "Non-AI Reservations", value: s.noPlanCount },
      { label: "GR not issued 30d+", value: s.grNotIssued30DayCount },
      { label: "Unutilized OAR value", value: NOT_AVAILABLE },
      { label: "Plan compliance", value: NOT_AVAILABLE },
    ],
    actions: [],
  }
})

/** Exception states that still need somebody — everything short of confirmed/resolved. */
const OPEN_STATUSES = ["OPEN", "AWAITING_REQUESTER", "ESCALATED"] as const

/** Rows per source; the exception queue alone holds tens of thousands. */
const PER_SOURCE = 100

function typeLabel(type: string): string {
  return (EXCEPTION_TYPE_LABEL as Record<string, string>)[type] ?? words(type)
}

function severityOf(e: ActException, now: number): ActionSeverity {
  if (e.status === "ESCALATED") return "critical"
  const due = e.requesterDueAt ? Date.parse(e.requesterDueAt) : NaN
  return !Number.isNaN(due) && due < now ? "critical" : "warning"
}

/**
 * Open ACT exceptions: each is waiting on a requester to give a reason (or on
 * their HOD, once escalated). A structured status on a real row — not a phrase
 * in a title.
 */
export const getInitiative13LiveActions = cache(async (): Promise<LiveActions> => {
  const exceptionBuckets = await Promise.all(
    OPEN_STATUSES.map((status) => getI13ActExceptionsList({ status, limit: PER_SOURCE }))
  )

  const now = Date.now()
  const seen = new Set<string>()
  const decisions: GlobalAction[] = []

  for (const bucket of exceptionBuckets) {
    for (const e of bucket.items) {
      if (seen.has(e.exceptionId)) continue
      seen.add(e.exceptionId)
      decisions.push({
        id: `i13-exc-${e.exceptionId}`,
        initiative: "initiative-13",
        title: `${typeLabel(e.exceptionType)} — ${e.material} (plant ${e.plant})`,
        severity: severityOf(e, now),
        entityId: e.exceptionId,
        materialId: e.material,
        plantId: e.plant,
        href: "/oar-utilization/aging-exceptions",
        createdAt: e.detectedAt,
        dueAt: e.requesterDueAt ?? undefined,
      })
    }
  }

  const total = exceptionBuckets.reduce((sum, b) => sum + (b.total ?? b.items.length), 0)

  return {
    actions: decisions,
    decisions,
    total,
    decisionTotal: total,
    capped: exceptionBuckets.some((b) => (b.total ?? 0) > b.items.length),
  }
})

const EVENT_LABEL: Record<string, string> = {
  DETECTED: "Exception detected",
  ROUTED_TO_REQUESTER: "Routed to requester",
  REQUESTER_CONFIRMED: "Reason given",
  JUSTIFICATION_ADDED: "Justification added",
  ESCALATED_TO_HOD: "Escalated to HOD",
  ROUTING_FAILED: "Routing failed",
  RESOLVED: "Closed",
  NOTIFICATION_SENT: "Notification sent",
  NOTIFICATION_FAILED: "Notification failed",
}

function words(raw: string): string {
  return raw.replace(/_/g, " ").toLowerCase()
}

function statusLabel(status: string): string {
  return (EXCEPTION_STATUS_LABEL as Record<string, string>)[status] ?? words(status)
}

/**
 * The I13 audit trail: the append-only ACT event table, read from
 * `GET /i13/act/events`. Detection and escalation runs write as SYSTEM; a
 * confirmation is written by the person who gave it.
 */
export async function getInitiative13LiveAuditEvents(query: AuditQuery): Promise<LiveAuditEvents> {
  const page = await getI13ActEvents({ limit: query.limit, fromTs: query.fromTs, toTs: query.toTs })
  const events: AuditEvent[] = page.items.map((e) => {
    const label = EVENT_LABEL[e.eventType] ?? words(e.eventType)
    const move = e.fromStatus && e.toStatus ? ` (${statusLabel(e.fromStatus)} → ${statusLabel(e.toStatus)})` : e.toStatus ? ` (${statusLabel(e.toStatus)})` : ""
    return {
      id: `i13-act-event-${e.eventId ?? `${e.exceptionId}-${e.timestamp}-${e.eventType}`}`,
      initiative: "initiative-13",
      entityId: e.exceptionId,
      eventType: label,
      description: `${label}${move}`,
      // System runs have no actor id; leaving it undefined renders as "System".
      actor: e.actorId ?? undefined,
      timestamp: e.timestamp,
    }
  })
  return { events, total: page.total }
}
