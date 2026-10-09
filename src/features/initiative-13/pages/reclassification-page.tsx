import { connection } from "next/server"

import { PageHeader } from "@/components/shared/page-header"
import { LoadFailure, RowCapNote } from "@/features/initiative-13/components/load-states"
import { ReclassificationTable } from "@/features/initiative-13/components/reclassification-table"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import { loadLiveReclassification } from "@/features/initiative-13/data/live-loaders"
import type { I13SearchParams } from "@/features/initiative-13/utils/search-params"
import { formatCount } from "@/lib/utils"

/**
 * Reclassification candidates — FR-8, and the SOP's own evidence standard.
 *
 * Advisory only. The SOP's three indicators are consumption more than four
 * times in twelve months, a Critical classification, and an HOD-justified
 * request. Two of those three have no source in the current extract and come
 * back `null`, which the table renders as "Unknown" rather than "No" — the
 * difference between "we checked and it is not critical" and "nothing here can
 * tell us" decides whether this list is trustworthy.
 *
 * The decision, and the SOP sign-off chain behind it, stay with VZI. This
 * screen supplies evidence and nothing else.
 */
export async function ReclassificationPage({
  searchParams,
}: {
  searchParams: I13SearchParams
}) {
  await connection()

  let live: Awaited<ReturnType<typeof loadLiveReclassification>> | null = null
  let loadError: string | null = null
  try {
    live = await loadLiveReclassification({
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
          title="Reclassification Candidates"
          description={
            live
              ? `${formatCount(live.candidateCount)} of ${formatCount(live.positionCount ?? live.count)} OAR material-plant positions meet the SOP threshold for review as a stocked material. Only those candidates are listed. Advisory evidence only — the decision sits with VZI.`
              : "OAR materials consumed frequently enough to warrant review as a stocked material — advisory evidence only, computed by the backend."
          }
        />

        <I13UrlFilters fields={["plant", "material"]} plants={live?.plantOptions} />

        {live === null ? (
          <LoadFailure what="reclassification candidates" message={loadError} />
        ) : (
          <>
            <ReclassificationTable candidates={live.rows} />
            <RowCapNote atLimit={live.atLimit} count={live.count} total={live.total} noun="candidate" />
          </>
        )}
      </div>
    </div>
  )
}
