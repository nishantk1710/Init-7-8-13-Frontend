// Initiative 8's half of the live cross-initiative feeds.
//
// Calls only I08's own clients (`lib/api/i8`) and adapters. Throws on failure;
// `lib/aggregation.ts` turns that into one failed card.

import { cache } from "react"

import { toRepairChain } from "@/features/initiative-8/data/live-register"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import {
  formatDaysRemaining,
  isRepairOverdue,
  vendorLabel,
} from "@/features/initiative-8/utils/status"
import {
  getAttestations,
  getDeclarations,
  getRegister,
  getSnapshot,
} from "@/lib/api/i8"
import type {
  AuditEvent,
  GlobalAction,
  InitiativeHealth,
  InitiativeSummary,
} from "@/lib/domain/contracts"
import {
  NOT_LOADED,
  type AuditQuery,
  type LiveActions,
  type LiveAuditEvents,
} from "@/lib/domain/live-feed"

const REGISTER_HREF = "/repairable-spares/repair-register"

/**
 * The summary card, from `GET /i8/snapshot` — every headline count, no rows —
 * plus one row-less look at the declaration queue for its two counts.
 *
 * The snapshot is required: without it there is no card. The declaration
 * counts are best-effort and read "Could not be loaded" if they fail, rather
 * than 0, which would say no declaration is outstanding.
 *
 * "Qty under repair" is not on the snapshot (it is a sum over register rows), so
 * the card shows overdue lines instead — a count the register states directly,
 * and the more actionable one on a "what needs attention" card.
 */
export const getInitiative8LiveSummary = cache(async (): Promise<InitiativeSummary> => {
  const [snapshot, declarations] = await Promise.all([
    getSnapshot(),
    getDeclarations({ pageSize: 1 })
      .then((page) => page.meta)
      .catch(() => null),
  ])

  const register = snapshot.repairRegister
  const required = declarations ? (declarations.byStatus["Required"] ?? 0) : null
  const flagged = declarations ? (declarations.byStatus["Flagged"] ?? 0) : null

  // Same rule the fixture selector used; an unknown count can only ever
  // *lower* the verdict, so an unreadable queue never reads as healthy by
  // accident — it falls through to "attention" if anything else is wrong.
  const health: InitiativeHealth =
    (flagged ?? 0) > 0
      ? "critical"
      : register.overdueLines > 0 || (required ?? 0) > 2 || declarations === null
        ? "attention"
        : "healthy"

  return {
    id: "initiative-8",
    label: initiative8Manifest.name,
    href: initiative8Manifest.href,
    health,
    metrics: [
      { label: "Active repair chains", value: register.openLines },
      { label: "Overdue repairs", value: register.overdueLines },
      { label: "Pending declarations", value: required ?? NOT_LOADED },
      { label: "Flagged declarations", value: flagged ?? NOT_LOADED },
    ],
    actions: [],
  }
})

/** Rows per source. The register holds 1,225 lines; a Priority list is not the place for them. */
const PER_SOURCE = 100

/**
 * Open I08 items: declarations that want attention (Required, Flagged) and
 * repairs that are past their promised date.
 *
 * Every declaration is a decision — `DeclarationMeta.outstanding` is, in the
 * backend's own words, "the rows wanting somebody's attention". An overdue
 * repair is *not*: it needs chasing, not deciding, and says so by sitting in
 * `actions` but not `decisions`.
 */
export const getInitiative8LiveActions = cache(async (): Promise<LiveActions> => {
  const [declarations, overdue] = await Promise.all([
    getDeclarations({ outstandingOnly: true, pageSize: PER_SOURCE }),
    // Every register line is open in SAP, so overdue alone is the filter.
    getRegister({ overdueOnly: true, pageSize: PER_SOURCE }),
  ])

  const decisions: GlobalAction[] = declarations.items.map((d) => {
    const flagged = d.status === "Flagged"
    const pr = d.pr ? ` (${d.pr.documentNumber})` : ""
    return {
      id: `i8-decl-${d.id}`,
      initiative: "initiative-8",
      title: `${
        flagged ? "Condition declaration flagged" : "Condition-to-repair declaration required"
      } — ${d.material.materialCode}${pr}`,
      severity: flagged ? "critical" : "warning",
      entityId: d.id,
      materialId: d.material.materialId,
      plantId: d.plant?.plantId,
      href: REGISTER_HREF,
      createdAt: d.createdAt ?? "",
    }
  })

  const overdueActions: GlobalAction[] = overdue.items
    .map((row) => ({ row, chain: toRepairChain(row) }))
    .filter(({ chain }) => isRepairOverdue(chain))
    .map(({ row, chain }) => ({
      id: `i8-overdue-${row.id}`,
      initiative: "initiative-8" as const,
      title: `Repair overdue — ${chain.material.materialCode} at ${vendorLabel(
        chain
      )} (${formatDaysRemaining(chain)})`,
      severity: "critical" as const,
      entityId: row.id,
      materialId: row.material.materialId,
      plantId: row.plant?.plantId,
      href: `${REGISTER_HREF}/${row.id}`,
      createdAt: row.raisedAt ?? "",
    }))

  return {
    actions: [...decisions, ...overdueActions],
    decisions,
    total: declarations.total + overdue.total,
    decisionTotal: declarations.total,
    capped:
      declarations.total > declarations.items.length || overdue.total > overdue.items.length,
  }
})

/**
 * Attestations — the condition-to-repair judgements people recorded *in this
 * system*. They are the I08 audit trail.
 *
 * The register's lifecycle steps (PR raised, PO issued, goods receipt) are
 * deliberately not here: those are SAP document dates read from the extract,
 * not actions anyone took in this platform, and listing them as audit events
 * would claim this system observed them. They stay on the register screen,
 * labelled as SAP document history.
 */
export async function getInitiative8LiveAuditEvents(query: AuditQuery): Promise<LiveAuditEvents> {
  // The attestations route takes no paging or date parameters, and the table is
  // small (a person records each one by hand), so the bounds are applied here.
  const body = await getAttestations()
  const from = query.fromTs ? Date.parse(query.fromTs) : Number.NEGATIVE_INFINITY
  const to = query.toTs ? Date.parse(query.toTs) : Number.POSITIVE_INFINITY
  const inRange = body.items.filter((a) => {
    const at = Date.parse(a.attestedAt)
    return Number.isNaN(at) || (at >= from && at < to)
  })
  const events: AuditEvent[] = inRange.slice(0, query.limit).map((a) => ({
    id: `i8-attestation-${a.id}`,
    initiative: "initiative-8",
    entityId: a.id,
    eventType: a.supersedes ? "Declaration Amended" : "Declaration Recorded",
    description: `${a.material.materialCode} assessed "${a.condition}" (${a.faultCategory}) — not posted to SAP.`,
    actor: a.attestor,
    timestamp: a.attestedAt,
  }))
  return { events, total: inRange.length }
}
