import { connection } from "next/server"

import { I08Page } from "@/features/initiative-8/components/kit/page"
import { OverviewDashboard } from "@/features/initiative-8/components/overview-dashboard"
import {
  loadLiveOverview,
  type LiveOverview,
} from "@/features/initiative-8/data/live-overview"
import { repairRequestsNote } from "@/features/initiative-8/utils/repair-request"

/**
 * The Initiative 8 overview — live.
 *
 * This component fetches; `OverviewDashboard` renders. The split is what lets
 * FR-10's plant, vendor and criticality filters work without a round trip:
 * every register and universe row is fetched once on the server and filtered
 * in the browser, the same way the register table has always worked.
 *
 * Every figure reads the backend: the register (the repair lines SAP still has
 * open), the repairable universe, and the open exception items -- the last for
 * the "Open exceptions" card, so it narrows with the filters like the rest.
 * See `data/live-overview.ts` for which figure comes from where. Nothing on
 * screen is invented.
 *
 * Every figure counts repair PO lines. Repairs requested with no PO yet are
 * taken out by `loadLiveOverview` and only counted, in a note beside the
 * total, when the backend serves them.
 *
 * The register is required; the other sources are best-effort, and a figure
 * whose source failed says so instead of showing a number.
 */
export async function RefurbishableSparesOverviewPage() {
  // Not statically prerendered: every figure here moves as attestations and
  // justifications are recorded.
  await connection()

  // The try/catch wraps ONLY the fetch -- see the note on the register page.
  let live: LiveOverview | null = null
  let loadError: string | null = null
  try {
    live = await loadLiveOverview()
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  if (live === null) {
    return (
      <I08Page crumbs={[{ label: "Repairable Spares" }]} title="Overview">
        <div
          role="alert"
          className="mt-6 rounded-xl border border-i08-crit-border bg-i08-crit-tint p-8 text-center text-sm"
        >
          <p className="font-medium text-foreground">The overview could not be loaded.</p>
          <p className="mt-1 text-muted-foreground">{loadError}</p>
          <p className="mt-3 text-[13px] text-muted-foreground">
            The repair register did not answer, and every figure on this page depends on it. This is a
            failed request, not an empty register: try again in a minute.
          </p>
        </div>
      </I08Page>
    )
  }

  const { register, requests, universe, exceptions } = live
  // The I08 complete-flow switch, from the same snapshot the register's
  // settings came from. Off: no repairs requested with no PO yet (neither the
  // header note nor the "Repair requested" stage), no usable/damaged split.
  const completeFlow = register.completeFlowEnabled

  return (
    <OverviewDashboard
      chains={register.chains}
      requests={completeFlow ? requests : []}
      agingBands={register.agingBands}
      universe={universe}
      exceptions={exceptions}
      plantOptions={register.plantOptions}
      vendorOptions={register.vendorOptions}
      criticalityOptions={register.criticalityOptions}
      referenceDate={register.referenceDate}
      sourceLoadedAt={register.sourceLoadedAt}
      repairRequestsNote={repairRequestsNote(
        completeFlow && register.repairRequestsEnabled,
        register.meta.openRepairRequests,
      )}
      completeFlow={completeFlow}
    />
  )
}
