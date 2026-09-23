import { connection } from "next/server"

import { AlertBanner } from "@/components/shared/alert-banner"
import { PageHeader } from "@/components/shared/page-header"
import { ActExceptionsBoard } from "@/features/initiative-13/components/act-exceptions-board"
import { LoadFailure, RowCapNote } from "@/features/initiative-13/components/load-states"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import { loadLiveActExceptions } from "@/features/initiative-13/data/live-loaders"
import type { I13SearchParams } from "@/features/initiative-13/utils/search-params"
import { listJustifications } from "@/lib/api/assistant"
import { formatCount } from "@/lib/utils"

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

  let live: Awaited<ReturnType<typeof loadLiveActExceptions>> | null = null
  let reasonCategories: string[] = []
  let loadError: string | null = null
  try {
    // The reason categories come from the API rather than this repository:
    // they are VZI's vocabulary, they will change, and the backend validates
    // against the same list it serves. Fetched alongside the queue so the
    // dialog has them before anybody opens it.
    const [queue, justifications] = await Promise.all([
      loadLiveActExceptions({
        plant: searchParams.plant,
        material: searchParams.material,
        type: searchParams.type,
        status: searchParams.status,
      }),
      listJustifications({ limit: 1 }).catch(() => null),
    ])
    live = queue
    reasonCategories = justifications?.reasonCategories ?? []
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  const unrouted = live ? live.count - live.ownedCount : 0

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Exceptions"
          description="Plan breaches, no-plan reservations, 30-day GR-not-issued positions and quantity overrides — the persisted ACT queue, with requester confirmation and HOD escalation (FR-9)."
        />

        {live !== null && unrouted > 0 && (
          <AlertBanner
            tone="warning"
            title={`${formatCount(unrouted)} of ${formatCount(live.count)} exceptions have no owner`}
          >
            An exception with no requester has never been routed and cannot
            escalate, so it cannot be confirmed either. Detection resolves an
            owner from the consumption plan first and from the reservation&rsquo;s
            goods recipient second; where neither is available — or where the two
            name different people — it is left unowned rather than assigned to a
            guess.
          </AlertBanner>
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
            <RowCapNote atLimit={live.atLimit} count={live.count} noun="exception" />
          </>
        )}
      </div>
    </div>
  )
}
