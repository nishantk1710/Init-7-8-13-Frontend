import type { Metadata } from "next"
import { connection } from "next/server"

import { loadLiveRepairDetail } from "@/features/initiative-8/data/live-repair-detail"
import { RepairDetailPage } from "@/features/initiative-8/pages/repair-detail-page"
import { getAttestations } from "@/lib/api/i8"

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
 * it is the natural place for the await.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Opt out of static prerendering, same as the register: otherwise the build
  // would freeze one fetch per id into HTML, and the attestation shown on the
  // lifecycle timeline could never change afterwards.
  await connection()

  // The try/catch wraps ONLY the fetch, never the render.
  //
  // The fault-category list is fetched alongside, for the attestation form
  // that moved here from the Declaration Queue. Best-effort: a failure costs
  // the form its list (it then says so and cannot submit), not the page.
  let detail: Awaited<ReturnType<typeof loadLiveRepairDetail>> = null
  let faultCategories: string[] = []
  let loadError: string | null = null
  try {
    const [line, attestations] = await Promise.all([
      loadLiveRepairDetail(id),
      getAttestations().catch(() => null),
    ])
    detail = line
    faultCategories = attestations?.faultCategories ?? []
  } catch (error) {
    // A failed request -- the backend down, a timeout, a 500 -- and it must say
    // so rather than masquerading as "not found".
    loadError = error instanceof Error ? error.message : String(error)
  }

  if (loadError !== null) {
    return <RepairDetailPage repairId={id} loadError={loadError} />
  }

  // null means the backend answered and said there is no such repair line.
  // Passing no detail gives the "repair not found" empty state, which is the
  // right answer -- not an error.
  return (
    <RepairDetailPage
      repairId={id}
      detail={detail ?? undefined}
      faultCategories={faultCategories}
    />
  )
}
