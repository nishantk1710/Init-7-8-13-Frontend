import { connection } from "next/server"
import type { ReactNode } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { OverviewDashboard } from "@/features/initiative-8/components/overview-dashboard"
import {
  loadLiveOverview,
  unjustifiedAcquisitions,
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
 * Every tile and chart reads the backend: the register, the repairable
 * universe, the declaration and exception checks' meta, and the vendor
 * turnaround. See `data/live-overview.ts` for which figure comes from where.
 * The eight hand-written fixture chains this page used to total up are gone
 * from it; nothing on screen is invented.
 *
 * The register is required; the other sources are best-effort, and a tile
 * whose source failed says so instead of showing a number.
 *
 * The exception check's result shows here as the Unjustified new purchases
 * tile and per line in the register. The Exception Queue screen it links to
 * came back on 12-Oct-2026, after the 09-Oct FRS audit found FR-8, FR-9,
 * FR-11 and acceptance criteria 5 and 11 had nothing rendering them.
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

  const { register, universe, declarations, exceptions, vendorTurnaround } = live

  return (
    <Shell
      description={
        // No source named here either -- see `registerDescription`. The page
        // knows when the figures are measured as of; it has no way to know
        // which SAP load produced them, and said "the July extract" for weeks
        // after that stopped being true.
        `${DESCRIPTION} As at ${register.referenceDate}.` +
        (register.sourceLoadedAt
          ? ` SAP data loaded ${formatApiDateTime(register.sourceLoadedAt)}.`
          : "")
      }
    >
      <OverviewDashboard
        chains={register.chains}
        agingBands={register.agingBands}
        universe={universe}
        pendingDeclarations={declarations?.outstanding}
        unjustifiedAcquisitions={exceptions ? unjustifiedAcquisitions(exceptions) : undefined}
        exceptionsLoaded={exceptions !== null}
        vendorTurnaround={vendorTurnaround}
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
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader title="Repairable Spares" description={description} />
        {children}
      </div>
    </div>
  )
}
