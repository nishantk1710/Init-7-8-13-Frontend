import { connection } from "next/server"

import { PageHeader } from "@/components/shared/page-header"
import {
  CalculatedAtNote,
  LoadFailure,
  RowCapNote,
} from "@/features/initiative-13/components/load-states"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import { WatchTable } from "@/features/initiative-13/components/watch-table"
import { loadLiveWatch } from "@/features/initiative-13/data/live-loaders"
import type { I13SearchParams } from "@/features/initiative-13/utils/search-params"
import { listSessions, type ApiSessionSummary } from "@/lib/api/assistant"

/**
 * WATCH — FR-1 and FR-6's metrics, per material and plant.
 *
 * Reads the **persisted** W6.3 mart through `/i13/act/utilisation` rather than
 * `/i13/watch`, which recomputes the whole population on every request to answer
 * a filtered question.
 *
 * Every number here is backend-computed. Nothing on this page reclassifies an
 * aging band, recalculates months of cover or re-derives GRNI — if it did, this
 * screen and the exception queue would disagree about the same part, in front
 * of a user, within a release.
 */
export async function WatchPage({ searchParams }: { searchParams: I13SearchParams }) {
  await connection()

  let live: Awaited<ReturnType<typeof loadLiveWatch>> | null = null
  let sessions: ApiSessionSummary[] = []
  let loadError: string | null = null
  try {
    // The mart is the primary fetch; the session log is a link and must not be
    // able to take the screen down, so its failure is swallowed.
    const [watch, sessionList] = await Promise.all([
      loadLiveWatch({
        plant: searchParams.plant,
        material: searchParams.material,
        agingBand: searchParams.agingBand,
        acquiredVsPlanStatus: searchParams.acquiredVsPlanStatus,
      }),
      listSessions({ flow: "i13", limit: 200 }).catch(() => null),
    ])
    live = watch
    sessions = sessionList?.items ?? []
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  const sessionsByKey = new Map<string, ApiSessionSummary[]>()
  for (const session of sessions) {
    const key = `${session.materialId}::${session.plant}`
    const existing = sessionsByKey.get(key)
    if (existing) existing.push(session)
    else sessionsByKey.set(key, [session])
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="WATCH"
          description="Backend-computed utilisation health per material and plant — months of cover, aging band, GR-not-issued, and acquired-vs-plan status."
          actions={<CalculatedAtNote calculatedAt={live?.calculatedAt ?? null} />}
        />

        <I13UrlFilters
          fields={["plant", "material", "agingBand", "acquiredVsPlanStatus"]}
          plants={live?.plantOptions}
          agingBands={live?.agingBandOptions}
        />

        {live === null ? (
          <LoadFailure what="WATCH data" message={loadError} />
        ) : (
          <>
            <WatchTable metrics={live.rows} sessionsByKey={sessionsByKey} />
            <RowCapNote atLimit={live.atLimit} count={live.count} total={live.total} noun="WATCH position" />
          </>
        )}
      </div>
    </div>
  )
}
