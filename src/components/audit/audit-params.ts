import type { InitiativeId } from "@/lib/domain/contracts"

/** Rows per page of the audit trail. */
export const AUDIT_PAGE_SIZE = 25

const INITIATIVES: readonly InitiativeId[] = ["initiative-7", "initiative-8", "initiative-13"]

/**
 * The audit trail's filters. They live in the URL, so a filtered trail is a
 * link somebody can send, back and forward work through filter changes, and the
 * server can read them: the page is a server component and the events are
 * filtered and paged in SQL, not in the browser.
 */
export interface AuditFilters {
  initiative?: InitiativeId
  /** `YYYY-MM-DD`, inclusive, read as UTC. */
  from?: string
  /** `YYYY-MM-DD`, inclusive, read as UTC. */
  to?: string
  /** 1-based. */
  page: number
}

export type RawParams = Record<string, string | string[] | undefined>

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** One value, or nothing. A repeated parameter is a malformed link, not a list to guess from. */
function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return undefined
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** A real calendar day, or nothing. `2026-02-31` is rejected rather than rolled into March. */
function validDay(value: string | undefined): string | undefined {
  if (!value || !DAY.test(value)) return undefined
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString().slice(0, 10) === value ? value : undefined
}

export function parseAuditFilters(raw: RawParams): AuditFilters {
  const initiative = INITIATIVES.find((id) => id === single(raw.initiative))
  const page = Number.parseInt(single(raw.page) ?? "", 10)
  return {
    initiative,
    from: validDay(single(raw.from)),
    to: validDay(single(raw.to)),
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  }
}

/**
 * The ISO bounds the backend takes: `fromTs` inclusive, `toTs` exclusive. The
 * "to" day is inclusive in the UI, so the exclusive bound is the start of the
 * day after it.
 */
export function auditBounds(filters: Pick<AuditFilters, "from" | "to">): {
  fromTs?: string
  toTs?: string
} {
  return {
    fromTs: filters.from ? `${filters.from}T00:00:00Z` : undefined,
    toTs: filters.to
      ? new Date(Date.parse(`${filters.to}T00:00:00Z`) + 24 * 60 * 60 * 1000).toISOString()
      : undefined,
  }
}

/** The `/audit` URL for a set of filters; defaults are left out so links stay short. */
export function auditHref(filters: AuditFilters): string {
  const search = new URLSearchParams()
  if (filters.initiative) search.set("initiative", filters.initiative)
  if (filters.from) search.set("from", filters.from)
  if (filters.to) search.set("to", filters.to)
  if (filters.page > 1) search.set("page", String(filters.page))
  const query = search.toString()
  return query ? `/audit?${query}` : "/audit"
}
