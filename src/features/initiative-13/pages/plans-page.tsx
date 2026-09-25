import { connection } from "next/server"

import { AlertBanner } from "@/components/shared/alert-banner"
import { PageHeader } from "@/components/shared/page-header"
import { LoadFailure, RowCapNote } from "@/features/initiative-13/components/load-states"
import { PlansTable } from "@/features/initiative-13/components/plans-table"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import { loadLivePlans } from "@/features/initiative-13/data/live-loaders"
import type { I13SearchParams } from "@/features/initiative-13/utils/search-params"
import { formatCount } from "@/lib/utils"

/**
 * Captured consumption plans — FR-4, and the screen Initiative 13 did not have.
 *
 * ## Why this page exists
 *
 * The FRS calls the reservation-time assistant the **single capture point** for
 * the consumption plan (§3.1, D8), and FR-4 asks for the plan to be stored
 * against a session, a requester, a material, a plant and a date. All of that
 * was built and none of it was visible: the endpoint serving it
 * (`GET /api/i13/consumption-plans`) was not even mounted, so it answered 404
 * while reading as implemented in the source.
 *
 * ## The number this page exists to show
 *
 * How many plans are **real**. The acquired-versus-plan engine on the dashboard
 * is genuine, but 742 of the plans behind it came from a generator with invented
 * `SESS-000001` references. The backend keeps the two apart internally
 * (`PlanSource.CAPTURED` versus `REFERENCE_CSV`) and this endpoint serves only
 * the captured ones — so the row count here is the answer to "how much of that
 * dashboard is standing on real data?".
 *
 * Expect it to be small, and do not soften that. It is the measure of how far
 * the assistant has actually been adopted, which is a number worth reading out
 * at UAT rather than one to be embarrassed by.
 */
export async function ConsumptionPlansPage({
  searchParams,
}: {
  searchParams: I13SearchParams
}) {
  await connection()

  let live: Awaited<ReturnType<typeof loadLivePlans>> | null = null
  let loadError: string | null = null
  try {
    live = await loadLivePlans({
      plant: searchParams.plant,
      material: searchParams.material,
    })
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Consumption plans"
          description="What requesters said each OAR spare was for, captured at the moment of the reservation through the assistant (FR-4)."
        />

        <AlertBanner tone="info" title="These are the real plans">
          Only plans captured through the assistant appear here. The 742
          generated reference rows that most acquired-versus-plan figures still
          rest on are deliberately kept out — a list that blended them would make
          it impossible to tell at a glance which is which, which is the single
          most important thing to know before demonstrating the exception queue.
        </AlertBanner>

        <I13UrlFilters fields={["plant", "material"]} plants={live?.plantOptions} />

        {live === null ? (
          <LoadFailure what="captured consumption plans" message={loadError} />
        ) : (
          <>
            <PlansTable plans={live.rows} />
            <RowCapNote atLimit={live.atLimit} count={live.count} total={live.total} noun="captured plan" />
            <p className="text-[11px] text-muted-foreground">
              {formatCount(live.count)} captured plan
              {live.count === 1 ? "" : "s"}. The reservation does not exist yet
              when a plan is captured, and the field that would carry the session
              identifier back (<code className="font-mono">RESB.BEDNR</code>) is
              not exposed on the SAP entity set. Until it is, a plan covers the
              reservations for its material and plant whose requirement date
              falls inside its window: those clear their{" "}
              <code className="font-mono">NO_PLAN</code> exception, and the plan
              breaches only if nothing is issued by the window&rsquo;s end plus
              the grace period.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
