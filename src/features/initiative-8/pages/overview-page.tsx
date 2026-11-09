import { connection } from "next/server"

import { I08Page } from "@/features/initiative-8/components/kit/page"
import { OverviewDashboard } from "@/features/initiative-8/components/overview-dashboard"
import {
  loadLiveOverview,
  type LiveOverview,
} from "@/features/initiative-8/data/live-overview"
import { departmentOptions } from "@/features/initiative-8/utils/overview-view"
import { repairRequestsNote } from "@/features/initiative-8/utils/repair-request"

/**
 * The Initiative 8 overview — live.
 *
 * This component fetches; `OverviewDashboard` renders. The split is what lets
 * the plant, vendor and department filters work without a round trip: every
 * register and universe row is fetched once on the server and filtered in the
 * browser, the same way the register table has always worked.
 *
 * Every figure reads the backend: the register (the repair lines SAP still has
 * open) and the repairable universe. See `data/live-overview.ts` for which
 * figure comes from where. Nothing on screen is invented.
 *
 * The figures about repairs that are out count repair PO lines. PRs raised for
 * repair with no PO yet are kept apart by `loadLiveOverview`, and counted on
 * their own card and in their own row of the waiting table.
 *
 * The register is required; the other sources are best-effort, and a figure
 * whose source failed says so instead of showing a number.
 */
export async function RefurbishableSparesOverviewPage() {
  // Not statically prerendered: every figure here moves as declarations are
  // recorded and SAP data is reloaded.
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

  const { register, requests, universe } = live

  return (
    <OverviewDashboard
      chains={register.chains}
      requests={requests}
      agingBands={register.agingBands}
      universe={universe}
      plantOptions={register.plantOptions}
      vendorOptions={register.vendorOptions}
      departmentOptions={departmentOptions([...register.chains, ...requests])}
      referenceDate={register.referenceDate}
      repairRequestsNote={repairRequestsNote(register.repairRequestsEnabled, register.meta.openRepairRequests)}
    />
  )
}
