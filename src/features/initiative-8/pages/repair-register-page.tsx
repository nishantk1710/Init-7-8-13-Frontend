import { connection } from "next/server"

import { PageHeader } from "@/components/shared/page-header"
import { RepairRegisterTable } from "@/features/initiative-8/components/repair-register-table"
import { loadLiveRegister } from "@/features/initiative-8/data/live-register"
import type { RepairChain } from "@/features/initiative-8/types/repair"

/**
 * The Repair Register (FR-10).
 *
 * A server component, and async only so it can fetch. The split is deliberate:
 *
 *   this page                    fetches, on the server, once
 *   RepairRegisterTable          "use client", filters rows it is handed
 *
 * The table filters the full array with `useMemo`. That is what let this land
 * without React Query, SWR, a loading skeleton or a new dependency: the
 * component boundary already suited it.
 *
 * **This screen is live-only.** It has no fixture fallback: the demo rows it
 * used to fall back to described a material (`800-14201` at `PLANT-GBG`) that
 * does not exist in SAP, and a register that cannot reach its backend must say
 * so rather than quietly showing eight invented repairs.
 */
export async function RepairRegisterPage() {
  // Opt this render out of static prerendering.
  //
  // Without it `next build` fetches the register ONCE, at build time, and bakes
  // those 1,225 rows into static HTML. Two things then go wrong quietly: the
  // page serves whatever the data looked like when it was built, forever -- so
  // an attestation recorded afterwards never shows up -- and a build on a
  // machine that cannot reach the backend fails, or worse, succeeds against a
  // stale cache.
  //
  // Verified, not assumed: before this line the live build marked
  // /repairable-spares/repair-register as (Static). After it, (Dynamic).
  await connection()

  // The try/catch wraps ONLY the fetch. Building JSX inside it would put the
  // render under the same handler as the request, so an error thrown while
  // rendering would be silently reported as a failed load -- which is the
  // opposite of this page's whole point about distinguishing the two.
  let live: Awaited<ReturnType<typeof loadLiveRegister>> | null = null
  let loadError: string | null = null
  try {
    live = await loadLiveRegister()
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  if (live === null) {
    // Shown as a failure, never as an empty table. "No repairs" and "cannot
    // reach the server" are different statements and must not look alike.
    return (
      <Shell
        description="Every repairable material currently in, or eligible for, a repair chain."
        chains={[]}
        loadError={loadError}
      />
    )
  }

  return (
    <Shell
      description={
        `${live.meta.totalLines.toLocaleString()} repair lines from the ` +
        `July extract — ${live.meta.openLines.toLocaleString()} still open, ` +
        `as at ${live.referenceDate}.`
      }
      chains={live.chains}
      plantOptions={live.plantOptions}
      vendorOptions={live.vendorOptions}
      agingBands={live.agingBands}
    />
  )
}

function Shell({
  description,
  chains,
  plantOptions,
  vendorOptions,
  agingBands,
  loadError,
}: {
  description: string
  chains?: RepairChain[]
  plantOptions?: { plantId: string; name: string }[]
  vendorOptions?: string[]
  agingBands?: string[]
  loadError?: string | null
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader title="Repair Register" description={description} />
        <RepairRegisterTable
          chains={chains}
          plantOptions={plantOptions}
          vendorOptions={vendorOptions}
          agingBands={agingBands}
          loadError={loadError}
        />
      </div>
    </div>
  )
}
