import { connection } from "next/server"
import type { ReactNode } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { OverviewDashboard } from "@/features/initiative-8/components/overview-dashboard"
import {
  loadLiveOverview,
  type LiveOverview,
} from "@/features/initiative-8/data/live-overview"
import { formatApiDateTime } from "@/lib/api/format"

const DESCRIPTION =
  "Repair register, condition attestation and reservation-time compliance for 80-series spares."

/**
 * The Initiative 8 overview — live.
 *
 * This component fetches; `OverviewDashboard` renders. The split is what lets
 * FR-10's plant, vendor and criticality filters work without a round trip:
 * every register and universe row is fetched once on the server and filtered
 * in the browser, the same way the register table has always worked.
 *
 * Every tile and chart reads the backend: the register (the repair lines SAP
 * still has open), the repairable universe and the declaration check's meta.
 * See `data/live-overview.ts` for which figure comes from where.
 * The eight hand-written fixture chains this page used to total up are gone
 * from it; nothing on screen is invented.
 *
 * The register is required; the other sources are best-effort, and a tile
 * whose source failed says so instead of showing a number.
 *
 * The exception checks do not show here any more. The "Unjustified new
 * purchases" tile came off on 14-Oct-2026 with the check itself -- FR-5b asks
 * for the reason at the reservation, so the Justifications screen reports it
 * -- and this page stopped fetching the exception meta with it. The findings
 * that remain are rendered per line in the register, and on Repair Exceptions.
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
      <Shell description={DESCRIPTION}>
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center text-sm"
        >
          <p className="font-medium text-foreground">The overview could not be loaded.</p>
          <p className="mt-1 text-muted-foreground">{loadError}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            The repair register did not answer, and every figure on this page
            depends on it. Check that the backend is running and that
            NEXT_PUBLIC_API_BASE_URL points at it.
          </p>
        </div>
      </Shell>
    )
  }

  const { register, universe, declarations } = live

  // No source named here either -- see `registerDescription`. The page knows
  // when the figures are measured as of; it has no way to know which SAP load
  // produced them, and said "the July extract" for weeks after that stopped
  // being true.
  const description =
    `${DESCRIPTION} As at ${register.referenceDate}.` +
    (register.sourceLoadedAt
      ? ` SAP data loaded ${formatApiDateTime(register.sourceLoadedAt)}.`
      : "")

  return (
    <Shell description={description}>
      <OverviewDashboard
        description={description}
        chains={register.chains}
        agingBands={register.agingBands}
        universe={universe}
        pendingDeclarations={declarations?.outstanding}
        plantOptions={register.plantOptions}
        vendorOptions={register.vendorOptions}
        criticalityOptions={register.criticalityOptions}
        referenceDate={register.referenceDate}
      />
    </Shell>
  )
}

function Shell({ description, children }: { description: string; children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-5">
        <PageHeader title="Repairable Spares" description={description} />
        {children}
      </div>
    </div>
  )
}
