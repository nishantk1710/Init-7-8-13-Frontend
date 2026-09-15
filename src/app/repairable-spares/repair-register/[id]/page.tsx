import type { Metadata } from "next"
import { connection } from "next/server"

import { loadLiveRepairDetail } from "@/features/initiative-8/data/live-repair-detail"
import { RepairDetailPage } from "@/features/initiative-8/pages/repair-detail-page"
import { USING_LIVE_DATA } from "@/lib/dataset-mode"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: `${id} — Repairable Spares — Spares AI` }
}

/**
 * The repair detail route.
 *
 * Fetching happens here rather than in the page component, because
 * `RepairDetailPage` is "use client" — it opens the Material 360 drawer — and a
 * client component cannot be async. The route is already a server component, so
 * it is the natural place for the await, and the page keeps its fixture lookup
 * for every other mode.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  if (!USING_LIVE_DATA) {
    return <RepairDetailPage repairId={id} />
  }

  // Opt out of static prerendering, same as the register: otherwise the build
  // would freeze one fetch per id into HTML, and the attestation shown on the
  // lifecycle timeline could never change afterwards.
  await connection()

  try {
    const detail = await loadLiveRepairDetail(id)

    // null means the backend answered and said there is no such repair line.
    // Rendering with no chain gives the "repair not found" empty state, which
    // is the right answer -- not an error.
    if (detail === null) {
      return <RepairDetailPage repairId={id} />
    }
    return <RepairDetailPage repairId={id} chain={detail.chain} timeline={detail.timeline} />
  } catch (error) {
    // Everything else is a failed request -- the backend down, a timeout, a
    // 500 -- and must say so rather than masquerading as "not found".
    return (
      <RepairDetailPage
        repairId={id}
        loadError={error instanceof Error ? error.message : String(error)}
      />
    )
  }
}
