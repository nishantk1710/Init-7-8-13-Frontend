import { redirect } from "next/navigation"
import { connection } from "next/server"
import { ListChecks, UserCheck, UserX } from "lucide-react"

import { TablePagination } from "@/components/shared/table-pagination"
import { ActExceptionsBoard } from "@/features/initiative-13/components/act-exceptions-board"
import { LoadFailure } from "@/features/initiative-13/components/load-states"
import { AttentionBanner } from "@/features/initiative-13/components/ui/attention-banner"
import { KpiCard } from "@/features/initiative-13/components/ui/kpi-card"
import { OarPageHeader, OarScope } from "@/features/initiative-13/components/ui/oar-scope"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import { loadLiveActExceptions } from "@/features/initiative-13/data/live-loaders"
import { pageHref, type I13SearchParams } from "@/features/initiative-13/utils/search-params"
import { listJustifications } from "@/lib/api/assistant"
import { DEFAULT_PAGE_SIZE, pageCountOf } from "@/lib/pagination"
import { formatCount } from "@/lib/utils"

const PATH = "/oar-utilization/aging-exceptions"

/**
 * The ACT exception queue — FR-9, and FRS §9 acceptance criterion 6.
 *
 * ## This screen changed which backend it reads
 *
 * It used to render `GET /i13/exceptions`: W6.3's older, ephemeral queue,
 * recomputed per request, with no owner, no state machine, no audit trail and
 * no session reference. Everything FR-9 specifies — routing to the requester,
 * escalation to the HOD after a configured period, a structured confirmation,
 * every state change logged — exists in W6.6's `/i13/act/exceptions`, which was
 * only visible as a read-only panel inside the dashboard.
 *
 * So the nav item that says "Exceptions" now reaches the queue the FRS
 * describes, and the Acknowledge/Mark Resolved buttons that moved a badge in
 * local state have been replaced by a confirmation that is actually recorded.
 *
 * ## Why the unrouted count is in the header
 *
 * An exception with no owner routes to nobody and escalates to nobody. It sits
 * in the queue looking like work and is inert. That number is the single most
 * useful thing to know about the state of this queue, so it is stated rather
 * than left to be counted off the screen.
 */
export async function ExceptionsPage({
  searchParams,
}: {
  searchParams: I13SearchParams
}) {
  await connection()

  const page = searchParams.page ?? 1
  let live: Awaited<ReturnType<typeof loadLiveActExceptions>> | null = null
  let reasonCategories: string[] = []
  let loadError: string | null = null
  try {
    // The reason categories come from the API rather than this repository:
    // they are VZI's vocabulary, they will change, and the backend validates
    // against the same list it serves. Fetched alongside the queue so the
    // dialog has them before anybody opens it.
    const [queue, justifications] = await Promise.all([
      loadLiveActExceptions(
        {
          plant: searchParams.plant,
          material: searchParams.material,
          type: searchParams.type,
          status: searchParams.status,
        },
        { page, pageSize: DEFAULT_PAGE_SIZE }
      ),
      listJustifications({ limit: 1 }).catch(() => null),
    ])
    live = queue
    reasonCategories = justifications?.reasonCategories ?? []
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  // Past the end (a stale link, or rows confirmed away since): go to the last
  // page rather than show an empty one. Outside the try — redirect() throws.
  if (live?.total && page > pageCountOf(live.total, DEFAULT_PAGE_SIZE)) {
    redirect(pageHref(PATH, searchParams, pageCountOf(live.total, DEFAULT_PAGE_SIZE)))
  }

  // Counted over this page only: the queue is paged, and the backend does not
  // yet report an unrouted total.
  const unrouted = live ? live.count - live.ownedCount : 0

  return (
    <OarScope>
        <OarPageHeader
          title="Procurement Exceptions"
          subtitle="Planned consumption overdue, Non-AI reservations, materials received but not issued for 30+ days, and quantity overridden reservations — with the requester's reason and HOD escalation."
        />

        {live !== null && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              label="Exceptions on this page"
              icon={<ListChecks className="size-3.5" aria-hidden />}
              value={formatCount(live.count)}
              hint={live.total !== null ? `of ${formatCount(live.total)} in the queue` : undefined}
            />
            <KpiCard
              accent="healthy"
              label="Requester identified"
              icon={<UserCheck className="size-3.5" aria-hidden />}
              value={formatCount(live.ownedCount)}
              hint="Routed to the requester for a reason."
            />
            <KpiCard
              accent="urgent"
              label="Requester not identified"
              icon={<UserX className="size-3.5" aria-hidden />}
              value={formatCount(unrouted)}
              hint="Nobody has been asked, so these cannot escalate."
            />
          </div>
        )}

        {live !== null && unrouted > 0 && (
          <AttentionBanner
            title={`Why ${formatCount(unrouted)} of the ${formatCount(live.count)} exceptions on this page are unassigned`}
          >
            We can&rsquo;t tell who raised these reservations, so nobody has been
            asked for a reason and they cannot escalate. The requester is taken
            from the <strong>consumption plan first</strong> and from the reservation&rsquo;s{" "}
            <strong>goods recipient in SAP second</strong>; where neither is available — or the two name
            different people — it is left unassigned rather than guessed.
          </AttentionBanner>
        )}

        <I13UrlFilters
          fields={["plant", "material", "type", "status"]}
          plants={live?.plantOptions}
        />

        {live === null ? (
          <LoadFailure what="exception queue" message={loadError} />
        ) : (
          <>
            <ActExceptionsBoard
              exceptions={live.rows}
              reasonCategories={reasonCategories}
              sessionsByKey={live.sessionsByKey}
            />
            <TablePagination
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={live.total}
              count={live.count}
              noun="exceptions"
              hrefFor={(p) => pageHref(PATH, searchParams, p)}
            />
          </>
        )}
    </OarScope>
  )
}
