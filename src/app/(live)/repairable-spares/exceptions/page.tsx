import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { connection } from "next/server"

import { ExceptionsScreen } from "@/features/initiative-8/components/exceptions-screen"
import { I08Page } from "@/features/initiative-8/components/kit/page"
import { NotificationLogScreen } from "@/features/initiative-8/components/notification-log"
import {
  exceptionsHref,
  loadExceptionsPage,
  parseExceptionParams,
  toExceptionRow,
  type ExceptionsPage,
} from "@/features/initiative-8/data/live-exceptions"
import {
  isNotificationView,
  loadNotificationsPage,
  notificationsHref,
  parseNotificationParams,
  type NotificationsPage,
} from "@/features/initiative-8/data/live-notifications"
import type { RawSearchParams } from "@/features/initiative-8/data/url-params"
import { getAttestations, getException } from "@/lib/api/i8"
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
 * Still missing from FR-11: email. Since 27-Oct-2026 the backend logs a
 * notification once per exception, the first time it is found actionable, and
 * `?view=log` shows that log (`NotificationLogScreen`); nothing is emailed yet.
 *
 * ## Paged on the server
 *
 * `?q=`, `?type=`, `?plant=`, `?status=`, `?repair=` and `?page=` are read
 * here, and the backend searches, filters, counts and pages. The screen used
 * to load all 5,978 items and filter them in the browser: a 17 MB page that
 * took ten seconds to arrive. See `loadExceptionsPage`.
 *
 * ## Laid out as tabs
 *
 * `?type=` is a tab and `?status=` the Open / Closed / All switch beside the
 * tabs (I08_Live_UI_Redesign_Plan.md, L5); see `ExceptionsScreen`.
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

  const raw = await searchParams
  if (isNotificationView(raw)) return <NotificationLog raw={raw} />

  const { filters, page, id } = parseExceptionParams(raw)

  // Best-effort and in parallel, for the drawer's Declare button: a failure
  // costs the form its category list (it then says so), never the queue.
  const faultCategories = getAttestations()
    .then((body) => body.faultCategories ?? [])
    .catch(() => [] as string[])

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
  const categories = await faultCategories

  // Past the end -- a stale link, or a filter that now matches fewer: go to
  // the last page there is rather than show an empty one. Outside the try:
  // `redirect` throws, and the catch would swallow it as a load error.
  if (data) {
    const lastPage = pageCountOf(data.total, DEFAULT_PAGE_SIZE)
    if (page > lastPage) redirect(exceptionsHref(filters, lastPage))
  }

  if (data === null) {
    return (
      <I08Page
        crumbs={[{ label: "Repairable Spares", href: "/repairable-spares" }, { label: "Repair Exceptions" }]}
        title="Repair Exceptions"
      >
        <div role="alert" className="mt-6 rounded-xl border border-i08-crit-border bg-i08-crit-tint p-5">
          <p className="text-sm text-foreground">The exception queue could not be loaded.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{loadError}</p>
          <p className="mt-3 text-[13px] text-muted-foreground">
            This is not &ldquo;no exceptions&rdquo;: it is a failed request, and on this screen the two mean opposite
            things. Try again in a minute.
          </p>
        </div>
      </I08Page>
    )
  }

  return (
    <ExceptionsScreen
      rows={data.rows}
      total={data.total}
      page={page}
      pageSize={DEFAULT_PAGE_SIZE}
      summary={data.summary}
      facets={data.facets}
      filters={filters}
      typeCounts={data.typeCounts}
      initialItem={initialItem}
      faultCategories={categories}
    />
  )
}

/**
 * `?view=log`: FR-11's notification log, paged on the server like the queue.
 * A backend without the log answers 404, which the screen names rather than
 * showing a zero; any other failure is shown as a failure.
 */
async function NotificationLog({ raw }: { raw: RawSearchParams }) {
  const { filters, page } = parseNotificationParams(raw)
  let data: NotificationsPage | undefined
  let loadError: string | undefined
  try {
    data = await loadNotificationsPage(filters, page)
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }
  // Past the end: the last page there is. Outside the try, as above.
  if (data?.available) {
    const lastPage = pageCountOf(data.total, DEFAULT_PAGE_SIZE)
    if (page > lastPage) redirect(notificationsHref(filters, lastPage))
  }
  return (
    <NotificationLogScreen
      data={data}
      error={loadError}
      filters={filters}
      page={page}
      pageSize={DEFAULT_PAGE_SIZE}
    />
  )
}
