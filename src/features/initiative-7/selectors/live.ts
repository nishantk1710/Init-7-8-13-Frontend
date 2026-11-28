// Initiative 7's half of the live cross-initiative feeds — what Home, the
// Action Center and Approvals read from this module.
//
// Everything here calls only I07's own service (`services/i7-api.ts`). Nothing
// imports another initiative; `lib/aggregation.ts` is what composes the three.
// Each function **throws** on failure: the aggregation layer turns that into one
// failed card, which is the only place that is allowed to.

import { cache } from "react"

import { initiative7Manifest } from "@/features/initiative-7/manifest"
import {
  fetchApprovalEvents,
  fetchRecommendationSummary,
  fetchRecommendations,
} from "@/features/initiative-7/services/i7-api"
import { fetchReverseRequestList } from "@/features/initiative-7/services/reverse-conversion-requests-api"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import { convertToOarDecisionHref } from "@/features/initiative-7/utils/recommendation-url-state"
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
import { formatMoney } from "@/lib/utils"

/**
 * The summary card. Every figure is read from `GET /recommendations/summary`,
 * which already computes them in SQL — one call, never one per metric.
 *
 * The stockout and excess counts are I07-derived proxies, not Vedanta-confirmed
 * KPIs (the endpoint's own schema says so). The working-capital impact is the
 * Overview's own figure (`netRopValueImpact`, the reorder-point version), so the
 * two pages never show different numbers under one name. It is `null` when no
 * row has a price and both reorder points; that must read as unavailable, never
 * as "R0", which would claim there is no impact.
 */
export const getInitiative7LiveSummary = cache(async (): Promise<InitiativeSummary> => {
  const s = await fetchRecommendationSummary()

  // The backend's figure is price x (current ROP - recommended ROP): positive
  // releases cash. Home states it the way the Recommendations page reads a stock
  // change -- "+" is more money tied up, "−" is money released, because the aim
  // is to bring cost down -- so the sign is flipped here, and the label says
  // which way it went rather than leaving it to the sign.
  const impact = s.netRopValueImpact
  const tiedUp = impact === null || impact === undefined ? null : -impact
  const impactLabel =
    tiedUp === null
      ? NOT_AVAILABLE
      : `${tiedUp > 0 ? "+" : tiedUp < 0 ? "−" : ""}${formatMoney(Math.abs(tiedUp), s.currency)}`
  const impactName =
    tiedUp === null || tiedUp === 0
      ? "Net working-capital impact"
      : tiedUp > 0
        ? "Working capital tied up"
        : "Working capital released"

  const health: InitiativeHealth =
    s.criticalStockoutRiskCount > 0
      ? "critical"
      : s.excessInventoryCandidatesCount > 0 || s.awaitingApprovalCount > 0
        ? "attention"
        : "healthy"

  return {
    id: "initiative-7",
    label: initiative7Manifest.name,
    href: initiative7Manifest.href,
    health,
    metrics: [
      { label: "Materials at stockout risk", value: s.criticalStockoutRiskCount },
      { label: "Excess inventory candidates", value: s.excessInventoryCandidatesCount },
      { label: "Awaiting approval", value: s.awaitingApprovalCount },
      { label: impactName, value: impactLabel },
    ],
    // The card's "N items need attention" comes from `getInitiative7LiveActions`
    // — a capped array's length would understate it.
    actions: [],
  }
})

/**
 * Which recommendation states surface as an action, and which of those are
 * waiting on someone to decide.
 *
 * Read from the backend's own `status` — the list route takes one value at a
 * time, hence one request per bucket (the same shape the Approvals workspace
 * already uses). `HELD` and `ADJUSTED` are open but are not asking anyone for a
 * decision right now; whether they should be is a product call, recorded in the
 * plan rather than guessed at here.
 */
const ACTION_BUCKETS: { status: string; decision: boolean; verb: string }[] = [
  { status: "PENDING_APPROVAL", decision: true, verb: "ROP recommendation awaiting approval" },
  { status: "READY_FOR_REVIEW", decision: true, verb: "Recommendation ready for review" },
  { status: "SENT_BACK", decision: true, verb: "Recommendation returned" },
  { status: "HELD", decision: false, verb: "Recommendation on hold" },
  { status: "ADJUSTED", decision: false, verb: "Recommendation adjusted, awaiting approval" },
]

/**
 * Rows per bucket. A bucket can hold thousands (the table is ~113k rows), and a
 * Priority Actions list is not a place to render them — so the newest 50 of
 * each, with the true totals alongside so the page can say it is a slice.
 */
const PER_BUCKET = 50

/** Statuses where an approver is waiting: their items open in review mode, where they are decided. */
const OPENS_IN_REVIEW = new Set(["PENDING_APPROVAL", "SENT_BACK", "HELD"])

function severityFor(rec: Recommendation): ActionSeverity {
  if (rec.risk === "critical") return "critical"
  if (rec.risk === "high") return "warning"
  return "info"
}

/**
 * Which Stock item to OAR (Convert to OAR) request states surface as an action. A request is raised by a planner and
 * walks the same approval chain as an OAR conversion, so what waits for an approver, or came back to the planner,
 * shows here beside the recommendations. A request on hold is open but is not asking anyone for a decision.
 */
const REVERSE_ACTION_BUCKETS: { status: string; decision: boolean; verb: string }[] = [
  { status: "PENDING_APPROVAL", decision: true, verb: "Convert to OAR awaiting approval" },
  { status: "SENT_BACK", decision: true, verb: "Convert to OAR returned" },
  { status: "HELD", decision: false, verb: "Convert to OAR on hold" },
]

/**
 * The Convert to OAR requests as Action Center entries. They are read from their own endpoint and kept apart from the
 * recommendations (a material can have a recommendation and a request; neither hides the other). A failure here
 * leaves the recommendations' actions as they were: it is reported as nothing waiting, never as a failed page.
 */
async function loadReverseRequestActions(): Promise<{
  actions: GlobalAction[]
  decisions: GlobalAction[]
  total: number
  decisionTotal: number
  capped: boolean
}> {
  const empty = { actions: [], decisions: [], total: 0, decisionTotal: 0, capped: false }
  try {
    const buckets = await Promise.all(
      REVERSE_ACTION_BUCKETS.map(async (bucket) => ({
        bucket,
        result: await fetchReverseRequestList({ status: bucket.status, pageSize: PER_BUCKET }),
      })),
    )
    const actions: GlobalAction[] = []
    const decisions: GlobalAction[] = []
    for (const { bucket, result } of buckets) {
      for (const request of result.items) {
        const action: GlobalAction = {
          id: `i7-reverse-${request.id}`,
          initiative: "initiative-7",
          title: `${bucket.verb} — ${request.description ?? request.material}`,
          severity: "info",
          entityId: String(request.id),
          materialId: request.material,
          plantId: request.plant,
          href: convertToOarDecisionHref(request.material, request.plant),
          createdAt: request.updated_at,
        }
        actions.push(action)
        if (bucket.decision) decisions.push(action)
      }
    }
    return {
      actions,
      decisions,
      total: buckets.reduce((sum, b) => sum + b.result.total, 0),
      decisionTotal: buckets.filter((b) => b.bucket.decision).reduce((sum, b) => sum + b.result.total, 0),
      capped: buckets.some((b) => b.result.total > b.result.items.length),
    }
  } catch {
    return empty
  }
}

export const getInitiative7LiveActions = cache(async (): Promise<LiveActions> => {
  const [buckets, reverse] = await Promise.all([
    Promise.all(
      ACTION_BUCKETS.map(async (bucket) => ({
        bucket,
        result: await fetchRecommendations({
          status: bucket.status,
          pageSize: PER_BUCKET,
          sort: "generated_at",
          sortDesc: true,
        }),
      }))
    ),
    loadReverseRequestActions(),
  ])

  // Repeated pipeline runs can leave more than one row per material-plant, so
  // the same material would otherwise appear twice. First seen wins, and the
  // buckets are ordered most-urgent first.
  const seen = new Set<string>()
  const actions: GlobalAction[] = []
  const decisions: GlobalAction[] = []

  for (const { bucket, result } of buckets) {
    for (const rec of result.recommendations) {
      const key = `${rec.material.materialId}|${rec.plantId}`
      if (seen.has(key)) continue
      seen.add(key)
      const action: GlobalAction = {
        id: `i7-${rec.id}`,
        initiative: "initiative-7",
        title: `${bucket.verb} — ${rec.material.description}`,
        severity: severityFor(rec),
        entityId: rec.id,
        materialId: rec.material.materialId,
        plantId: rec.plantId,
        href: `/inventory-planning/recommendations/${rec.id}${OPENS_IN_REVIEW.has(bucket.status) ? "?review=1" : ""}`,
        createdAt: rec.generatedAt,
      }
      actions.push(action)
      if (bucket.decision) decisions.push(action)
    }
  }

  const total = buckets.reduce((sum, b) => sum + b.result.total, 0) + reverse.total
  const decisionTotal =
    buckets.filter((b) => b.bucket.decision).reduce((sum, b) => sum + b.result.total, 0) + reverse.decisionTotal

  return {
    actions: [...actions, ...reverse.actions],
    decisions: [...decisions, ...reverse.decisions],
    total,
    decisionTotal,
    capped: buckets.some((b) => b.result.total > b.result.recommendations.length) || reverse.capped,
  }
})

const APPROVAL_LABEL: Record<string, string> = {
  SUBMIT: "Submitted for approval",
  RESUBMIT: "Resubmitted for approval",
  APPROVE: "Approved",
  REJECT: "Rejected",
  SEND_BACK: "Sent back",
  ADJUST: "Adjusted",
  HOLD: "Placed on hold",
  RELEASE_HOLD: "Hold released",
}

function statusWords(raw: string): string {
  return raw.replace(/_/g, " ").toLowerCase()
}

/**
 * The I07 audit trail: the append-only approval ledger, read from
 * `GET /approval-events`. Every row is a decision a person took in this system.
 *
 * The role is the one the actor acted *as*, which is what the ledger records;
 * `actor` carries the id they were identified by.
 */
export async function getInitiative7LiveAuditEvents(query: AuditQuery): Promise<LiveAuditEvents> {
  const page = await fetchApprovalEvents({ limit: query.limit, fromTs: query.fromTs, toTs: query.toTs })
  const events: AuditEvent[] = page.items.map((row) => {
    const label = APPROVAL_LABEL[row.action] ?? statusWords(row.action)
    const move =
      row.previous_status === row.new_status
        ? ""
        : ` (${statusWords(row.previous_status)} → ${statusWords(row.new_status)})`
    return {
      id: `i7-approval-${row.recommendation_id}-v${row.recommendation_version}-${row.action}-${row.timestamp}`,
      initiative: "initiative-7",
      entityId: row.recommendation_id,
      eventType: label,
      description: `${label} as ${row.actor_role}${move}${row.comment ? ` — "${row.comment}"` : ""}`,
      actor: row.actor_id,
      timestamp: row.timestamp,
    }
  })
  return { events, total: page.total }
}
