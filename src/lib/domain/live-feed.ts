// Shapes shared by the three initiatives' *live* cross-initiative selectors and
// by `lib/aggregation.ts`, which composes them.
//
// This is a separate file from `contracts.ts` on purpose: that file is frozen
// and describes what an initiative may say to the shell. Everything here is
// about *how a live fetch can fail* and *how much of a feed came back* — none
// of which the contract has any business knowing.

import { ApiError } from "@/lib/api/client"
import type { AuditEvent, GlobalAction, InitiativeId } from "@/lib/domain/contracts"

/**
 * One fetch's outcome. A 404 is `unavailable` (the backend in use predates the
 * route — nothing to retry); anything else is `error`. The same rule I13's
 * dashboard applies, lifted here so Home and the other shared pages do not
 * depend on an initiative's internals to use it.
 */
export type Section<T> =
  | { status: "ready"; data: T }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string }

/**
 * Turn a thrown failure into a value.
 *
 * Every live loader **throws** — an empty list and an unreachable backend are
 * different statements and the loader must not blur them. The *aggregation*
 * layer is where a throw becomes one failed card instead of a failed page, and
 * this is the one place that conversion happens. It is deliberately not
 * `.catch(() => [])`, which is how a backend outage ends up rendered as zero.
 */
export async function settle<T>(promise: Promise<T>): Promise<Section<T>> {
  try {
    return { status: "ready", data: await promise }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return {
        status: "unavailable",
        message: "This is not available from the backend currently in use.",
      }
    }
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to load data.",
    }
  }
}

/**
 * What an initiative has for the Action Center and the Approvals page.
 *
 * `actions` is every open item (capped); `decisions` is the subset that is
 * waiting on someone to *decide* — each initiative works that out itself from
 * a structured field, never from the wording of a title. `total` and
 * `decisionTotal` are the real populations, which can exceed what came back.
 */
export interface LiveActions {
  actions: GlobalAction[]
  decisions: GlobalAction[]
  total: number
  decisionTotal: number
  /** More exist than `actions` holds. The page must say so. */
  capped: boolean
}

export interface LiveAuditEvents {
  events: AuditEvent[]
  /** The real population, when the backend reports it. */
  total: number | null
}

/** A failure that names whose it is, so a card can say which module is down. */
export interface InitiativeFailure {
  initiative: InitiativeId
  message: string
}

/** A figure the backend does not serve. Shown as words, never as a number. */
export const NOT_AVAILABLE = "Not available"

/** A figure whose request failed. Distinct from NOT_AVAILABLE: this one can be retried. */
export const NOT_LOADED = "Could not be loaded"

/**
 * How much of the audit trail one module is asked for.
 *
 * `limit` is how many of its newest events to return (the aggregation asks for
 * enough to fill the requested page after merging); `fromTs` is inclusive and
 * `toTs` exclusive, both ISO 8601.
 */
export interface AuditQuery {
  limit: number
  fromTs?: string
  toTs?: string
}
