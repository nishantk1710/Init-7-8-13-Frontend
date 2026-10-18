import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { connection } from "next/server"

import { PageHeader } from "@/components/shared/page-header"
import { ExceptionsTable } from "@/features/initiative-8/components/exceptions-table"
import {
  exceptionsHref,
  loadExceptionsPage,
  parseExceptionParams,
  toExceptionRow,
  type ExceptionsPage,
} from "@/features/initiative-8/data/live-exceptions"
import type { RawSearchParams } from "@/features/initiative-8/data/url-params"
import { getException } from "@/lib/api/i8"
import { DEFAULT_PAGE_SIZE, pageCountOf } from "@/lib/pagination"

export const metadata: Metadata = {
  title: "Repair Exceptions — Spares AI",
}

/**
 * Initiative 08 FR-8, FR-9 and FR-11 — the exception queue.
 *
 * ## Why this screen is back
 *
 * It was removed on 08-Oct-2026 and this route became a `redirect()`, on the
 * reasoning that declaration and justification are mandatory so there is no
 * separate queue to work. The 09-Oct FRS audit found that this leaves four
 * requirements and two acceptance criteria with nothing behind them:
 *
 * - FR-8 asks for repair lines with no attestation, and purchases made with no
 *   justification, to be RAISED as exceptions.
 * - FR-9 asks for overdue to appear as an explicit exception state.
 * - FR-11 asks for a platform exception queue.
 * - AC 5 asks that every repair with no attestation is raised "within one
 *   refresh cycle"; AC 11 asks for exception items across four types.
 *
 * The backend never stopped computing any of this. `GET /api/i8/exceptions`
 * has been live throughout — the checks ran, and nothing rendered them.
 *
 * ## What is still missing, and is not pretended here
 *
 * Three of the four FR-8 exception types are computed — missing attestation,
 * unjustified acquisition and, since the FR-9 work, overdue repair.
 * `MISSING_SESSION_ID` is declared in the backend and never raised: I08's
 * extract has no reservation view, so there is no SGTXT to read a session id
 * back from, and the check has no source data rather than a missing
 * implementation. The screen names the checks that ARE running rather than
 * letting a zero read as "nothing found".
 *
 * ## What is stored, and what is not
 *
 * The items are still recomputed from the register on every read — they are
 * never stored, which is what keeps the queue from drifting away from the
 * data. What IS stored, since FR-11 landed, is the work: status, owner, and a
 * history of what people said and did, keyed by the item's own id.
 *
 * The consequence worth knowing is the good one. Record the declaration and
 * the check stops finding the line; the item does not silently vanish from
 * whoever owned it — it resolves itself, and its history says the data moved
 * rather than that a person closed it.
 *
 * Still missing from FR-11: email. There is no notification of any kind, so a
 * queue nobody opens is a queue nobody reads.
 *
 * ## Paged on the server
 *
 * `?q=`, `?type=`, `?plant=`, `?open=`, `?status=`, `?repair=` and `?page=`
 * are read here, and the backend searches, filters, counts and pages. The
 * screen used to load all 5,978 items and filter them in the browser: a 17 MB
 * page that took ten seconds to arrive. See `loadExceptionsPage`.
 */
/**
 * `?id=EX-…` opens that item's drawer; `?repair=4500000677-20` narrows the
 * queue to one repair line — the link the register's Exceptions column uses.
 *
 * The table is keyed by `id`, so following a second item link while already
 * here opens that item rather than keeping the last one's state.
 */
export default async function I08ExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  // Recomputed from the register and the attestation table, both of which
  // change under the page. A build-time snapshot would be wrong by lunchtime.
  await connection()

  const { filters, page, id } = parseExceptionParams(await searchParams)

  // The linked item is fetched by id beside the page, not looked for on it:
  // it may be on any page, or filtered off them all. Best-effort -- a failure
  // costs the drawer, never the queue.
  const linked = id
    ? getException(id)
        .then(toExceptionRow)
        .catch(() => undefined)
    : Promise.resolve(undefined)

  let data: ExceptionsPage | null = null
  let loadError: string | null = null
  try {
    data = await loadExceptionsPage(filters, page)
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }
  const initialItem = await linked

  // Past the end -- a stale link, or a filter that now matches fewer: go to
  // the last page there is rather than show an empty one. Outside the try:
  // `redirect` throws, and the catch would swallow it as a load error.
  if (data) {
    const lastPage = pageCountOf(data.total, DEFAULT_PAGE_SIZE)
    if (page > lastPage) redirect(exceptionsHref(filters, lastPage))
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-5">
        {/* Names only the checks this queue shows. Unjustified new purchases
            used to be the second half of this line; that type has been dropped
            from the queue since 14-Oct-2026 (see ALL_CHECKS in the table). */}
        <PageHeader
          title="Repair Exceptions"
          description="Repair lines sent away with no condition declaration, and repairs still at the vendor past their due date."
        />

        {data === null ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"
          >
            <p className="text-sm text-foreground">
              The exception queue could not be loaded.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              This is not &ldquo;no exceptions&rdquo; — it is a failed request,
              and on this screen the two mean opposite things. Check that the
              backend is running and that its I08 data has finished building.
            </p>
          </div>
        ) : (
          <ExceptionsTable
            key={id ?? ""}
            rows={data.rows}
            total={data.total}
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            summary={data.summary}
            facets={data.facets}
            filters={filters}
            initialItem={initialItem}
          />
        )}
      </div>
    </div>
  )
}
