import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { connection } from "next/server"

import { I08JustificationLog } from "@/features/initiative-8/components/justification-log"
import { I08Page } from "@/features/initiative-8/components/kit/page"
import {
  justificationsHref,
  loadJustificationsPage,
  loadMaterialDescriptions,
  parseJustificationParams,
  type JustificationsPage,
  type RawSearchParams,
} from "@/features/initiative-8/data/live-justifications"
import { loadCompleteFlowFromSnapshot } from "@/lib/i08-features"
import { DEFAULT_PAGE_SIZE, pageCountOf } from "@/lib/pagination"

export const metadata: Metadata = {
  title: "Justifications — Repairable Spares — Spares AI",
}

/**
 * Initiative 08 FR-7 — the justification log, which this initiative had no
 * screen for at all.
 *
 * FR-7 says the structured justification must be surfaced "on the dashboard
 * and in the exception queue", and retained for benefit attribution. This is
 * the first half.
 *
 * ## Why it filters to NEW_ACQUISITION
 *
 * The `justification` table is shared by both initiatives, and the same four
 * kinds live in it. Only `NEW_ACQUISITION` is I08's: somebody was told a
 * repairable unit already exists and bought new anyway. The quantity
 * overrides and plan breaches belong to Initiative 13 and appear on its
 * dashboard instead. Showing all four here would put I13's records under an
 * I08 heading.
 *
 * ## What this is for
 *
 * Benefit attribution, per the FRS: avoided-purchase benefit is counted only
 * where the requester chose refurbishment following the assistant's advice.
 * These are the cases where they did not — so this log is the denominator,
 * and reading it is how anyone finds out whether the advice is landing.
 *
 * ## Paged on the server
 *
 * `?q=`, `?plant=`, `?reason=` and `?page=` are read here and the backend
 * pages, counts and searches -- see `live-justifications.ts` for why it stopped
 * fetching the newest 200 and filtering them in the browser.
 *
 * ## A table, with descriptions
 *
 * Laid out as a table since the redesign (I08_Live_UI_Redesign_Plan.md, L7).
 * A justification stores only the material number, so the descriptions for
 * the page on screen are looked up here, best-effort, before it renders.
 *
 * No tiles. "Purchases avoided" is absent on purpose: FR-7 attributes benefit
 * only where the requester chose repair after the assistant's advice, and
 * nothing computes that yet. "Purchases still unjustified" and "Justification
 * compliance" came off on 18-Oct-2026: the check behind them dates a purchase
 * by EKPO.ERDAT, which live EKPO does not carry, so their 0 meant "not
 * checked". The count of records is in the summary line.
 */
export default async function I08JustificationsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  // Reads a table that grows as people use the assistant, so a build-time
  // snapshot would be permanently empty.
  await connection()

  const { filters, page } = parseJustificationParams(await searchParams)
  // Best-effort and in parallel: the I08 complete-flow switch (off on any
  // failure), which decides the Purchase column.
  const completeFlowLoad = loadCompleteFlowFromSnapshot()

  let data: JustificationsPage | null = null
  let loadError: string | null = null
  try {
    data = await loadJustificationsPage(filters, page)
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  // Past the end -- a stale link, or a filter that now matches fewer: go to
  // the last page there is rather than show an empty one. Outside the try:
  // `redirect` throws, and the catch would swallow it as a load error.
  if (data) {
    const lastPage = pageCountOf(data.total, DEFAULT_PAGE_SIZE)
    if (page > lastPage) redirect(justificationsHref(filters, lastPage))
  }

  if (data === null) {
    return (
      <I08Page
        crumbs={[{ label: "Repairable Spares", href: "/repairable-spares" }, { label: "Justifications" }]}
        title="Justifications"
      >
        <div role="alert" className="mt-6 rounded-xl border border-i08-crit-border bg-i08-crit-tint p-5">
          <p className="text-sm text-foreground">The justification log could not be loaded.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{loadError}</p>
          <p className="mt-3 text-[13px] text-muted-foreground">
            This is not &ldquo;nothing recorded&rdquo;: it is a failed request. Try again in a minute.
          </p>
        </div>
      </I08Page>
    )
  }

  // Best-effort: a description that does not arrive leaves its number alone.
  const descriptions = await loadMaterialDescriptions(data.items.map((entry) => entry.materialId))
  const completeFlow = await completeFlowLoad

  return (
    <I08JustificationLog
      items={data.items}
      total={data.total}
      overall={data.overall}
      page={page}
      pageSize={DEFAULT_PAGE_SIZE}
      filters={filters}
      facets={data.facets}
      descriptions={descriptions}
      purchasesChecked={data.purchasesChecked}
      completeFlow={completeFlow}
    />
  )
}
