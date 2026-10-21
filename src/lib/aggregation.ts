// Global aggregation of per-initiative summaries/actions/audit events. This
// is the ONLY place that imports every initiative's live selectors together — used
// by Home, the Action Center, Approvals and the Audit Trail. No business logic
// here, only composition.
//
// ## The rule for the live functions
//
// Every initiative's live selector **throws** when its backend call fails.
// This file is where a throw becomes a value (`settle`), and it is the only
// place that is allowed to. The result is one `Section` per initiative, so one
// module being down yields one failed card — never a blank page (which is what
// `Promise.all` would give) and never a zero (which is what `.catch(() => [])`
// would give, and which reads as "nothing needs attention").
//
// Results are keyed by initiative id, never by position: a list whose length
// depends on which backends answered cannot be destructured by index.

import {
  getInitiative7LiveActions,
  getInitiative7LiveAuditEvents,
  getInitiative7LiveSummary,
} from "@/features/initiative-7/selectors/live"
import {
  getInitiative8LiveActions,
  getInitiative8LiveAuditEvents,
  getInitiative8LiveSummary,
} from "@/features/initiative-8/selectors/live"
import {
  getInitiative13LiveActions,
  getInitiative13LiveAuditEvents,
  getInitiative13LiveSummary,
} from "@/features/initiative-13/selectors/live"
import type {
  AuditEvent,
  GlobalAction,
  InitiativeId,
  InitiativeSummary,
} from "@/lib/domain/contracts"
import {
  settle,
  type AuditQuery,
  type InitiativeFailure,
  type LiveActions,
  type LiveAuditEvents,
  type Section,
} from "@/lib/domain/live-feed"

export const INITIATIVE_IDS: readonly InitiativeId[] = ["initiative-7", "initiative-8", "initiative-13"]

/** One outcome per initiative. */
export type PerInitiative<T> = Record<InitiativeId, Section<T>>

async function fanOut<T>(loaders: Record<InitiativeId, () => Promise<T>>): Promise<PerInitiative<T>> {
  const [i7, i8, i13] = await Promise.all([
    settle(loaders["initiative-7"]()),
    settle(loaders["initiative-8"]()),
    settle(loaders["initiative-13"]()),
  ])
  return { "initiative-7": i7, "initiative-8": i8, "initiative-13": i13 }
}

export function getLiveSummaries(): Promise<PerInitiative<InitiativeSummary>> {
  return fanOut({
    "initiative-7": getInitiative7LiveSummary,
    "initiative-8": getInitiative8LiveSummary,
    "initiative-13": getInitiative13LiveSummary,
  })
}

export function getLiveActions(): Promise<PerInitiative<LiveActions>> {
  return fanOut({
    "initiative-7": getInitiative7LiveActions,
    "initiative-8": getInitiative8LiveActions,
    "initiative-13": getInitiative13LiveActions,
  })
}

/** Which initiatives failed, and why — what a page lists so a gap is never silent. */
export function failuresOf<T>(per: PerInitiative<T>): InitiativeFailure[] {
  return INITIATIVE_IDS.flatMap((initiative) => {
    const section = per[initiative]
    return section.status === "ready" ? [] : [{ initiative, message: section.message }]
  })
}

export interface CombinedActions {
  actions: GlobalAction[]
  decisions: GlobalAction[]
  total: number
  decisionTotal: number
  capped: boolean
  failures: InitiativeFailure[]
}

/**
 * Merge whatever answered. A failed initiative contributes nothing to the lists
 * and **is named in `failures`**, so the page can say "Repairable Spares could
 * not be loaded" next to a list that would otherwise look complete.
 */
export function combineActions(per: PerInitiative<LiveActions>): CombinedActions {
  const combined: CombinedActions = {
    actions: [],
    decisions: [],
    total: 0,
    decisionTotal: 0,
    capped: false,
    failures: failuresOf(per),
  }
  for (const initiative of INITIATIVE_IDS) {
    const section = per[initiative]
    if (section.status !== "ready") continue
    combined.actions.push(...section.data.actions)
    combined.decisions.push(...section.data.decisions)
    combined.total += section.data.total
    combined.decisionTotal += section.data.decisionTotal
    combined.capped ||= section.data.capped
  }
  return combined
}

export function getLiveAuditEvents(query: AuditQuery): Promise<PerInitiative<LiveAuditEvents>> {
  return fanOut({
    "initiative-7": () => getInitiative7LiveAuditEvents(query),
    "initiative-8": () => getInitiative8LiveAuditEvents(query),
    "initiative-13": () => getInitiative13LiveAuditEvents(query),
  })
}

export interface CombinedAuditEvents {
  /** Newest first. */
  events: AuditEvent[]
  /** Sum of each module's real population; `null` if any module could not say. */
  total: number | null
  failures: InitiativeFailure[]
}

/** Epoch millis for sorting; an unparseable value sorts last rather than first. */
function epoch(timestamp: string): number {
  const parsed = Date.parse(timestamp)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

/**
 * Merge the modules' audit feeds, newest first.
 *
 * Sorted on the *parsed* instant, not the string: two ISO strings with different
 * UTC offsets do not order correctly as text. A module that did not answer is
 * named in `failures` and contributes nothing — the trail must not look complete
 * when part of it is missing.
 */
export function combineAuditEvents(per: PerInitiative<LiveAuditEvents>): CombinedAuditEvents {
  const events: AuditEvent[] = []
  let total: number | null = 0
  for (const initiative of INITIATIVE_IDS) {
    const section = per[initiative]
    if (section.status !== "ready") {
      total = null
      continue
    }
    events.push(...section.data.events)
    total = total === null || section.data.total === null ? null : total + section.data.total
  }
  events.sort((a, b) => epoch(b.timestamp) - epoch(a.timestamp))
  return { events, total, failures: failuresOf(per) }
}

/**
 * The deepest page the audit trail can reach. Each module is asked for its
 * newest `page * pageSize` events and the merge is sliced, because paging a
 * merge of three independently paged feeds by offset is not sound: page 2 of
 * the merge is not "offset 25" on each source. 500 is the per-request maximum
 * the backend routes allow; beyond it, narrow the date range instead.
 */
export const AUDIT_DEPTH_CAP = 500

export interface AuditPageQuery {
  /** 1-based. */
  page: number
  pageSize: number
  fromTs?: string
  toTs?: string
  /** Only this module's events. The others are not asked, so cannot fail. */
  initiative?: InitiativeId
}

export interface AuditPage extends CombinedAuditEvents {
  page: number
  pageSize: number
  /** Highest page reachable: the population, bounded by `AUDIT_DEPTH_CAP`. */
  lastPage: number
  /** The population has more pages than the depth cap lets anyone reach. */
  truncated: boolean
}

export async function getLiveAuditPage(query: AuditPageQuery): Promise<AuditPage> {
  const maxPage = Math.max(1, Math.floor(AUDIT_DEPTH_CAP / query.pageSize))
  const page = Math.min(Math.max(1, query.page), maxPage)
  const limit = Math.min(page * query.pageSize, AUDIT_DEPTH_CAP)
  const feed: AuditQuery = { limit, fromTs: query.fromTs, toTs: query.toTs }

  const asked = (id: InitiativeId, load: () => Promise<LiveAuditEvents>) =>
    !query.initiative || query.initiative === id
      ? load
      : () => Promise.resolve<LiveAuditEvents>({ events: [], total: 0 })

  const per = await fanOut<LiveAuditEvents>({
    "initiative-7": asked("initiative-7", () => getInitiative7LiveAuditEvents(feed)),
    "initiative-8": asked("initiative-8", () => getInitiative8LiveAuditEvents(feed)),
    "initiative-13": asked("initiative-13", () => getInitiative13LiveAuditEvents(feed)),
  })

  const combined = combineAuditEvents(per)
  const start = (page - 1) * query.pageSize
  const pageCount =
    combined.total === null ? page : Math.max(1, Math.ceil(combined.total / query.pageSize))
  return {
    ...combined,
    events: combined.events.slice(start, start + query.pageSize),
    page,
    pageSize: query.pageSize,
    lastPage: Math.min(pageCount, maxPage),
    truncated: pageCount > maxPage,
  }
}
