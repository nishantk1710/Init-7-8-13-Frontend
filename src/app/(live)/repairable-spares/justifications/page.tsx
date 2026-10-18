import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { connection } from "next/server"

import { I08JustificationLog } from "@/features/initiative-8/components/justification-log"
import {
  justificationsHref,
  loadJustificationsPage,
  parseJustificationParams,
  type JustificationsPage,
  type RawSearchParams,
} from "@/features/initiative-8/data/live-justifications"
import { KPIStatCard } from "@/components/shared/kpi-stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { DEFAULT_PAGE_SIZE, pageCountOf } from "@/lib/pagination"
import { formatCount } from "@/lib/utils"

/** Shown on a tile whose source could not be read -- never a 0. */
const NOT_LOADED = "Could not be loaded"

export const metadata: Metadata = {
  title: "New-acquisition justifications — Spares AI",
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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-5">
        <PageHeader
          title="New-acquisition justifications"
          description="Why a new unit was bought while a repairable one already existed — captured at the moment of the reservation."
        />

        {/* One tile. "Purchases avoided" is deliberately absent: FR-7 wants
            benefit attributed only where the requester chose repair after the
            assistant's advice, and nothing computes that yet. A tile with an
            invented number would be worse than no tile.

            Three more tiles came off on 18-Oct-2026, with the explanatory box
            that sat under them:
              - "Purchases still unjustified" and "Justification compliance"
                were read from the backend's UNJUSTIFIED_ACQUISITION check. It
                dates a new purchase by EKPO.ERDAT, which the live EKPO extract
                does not carry, so its 0 (and so the 100%) meant "not checked",
                not "none found".
              - "Linked to a session" always equalled the count: the assistant
                writes every justification inside a session.
            The grid keeps four columns so the one tile stays the width tiles
            are on every other screen, rather than stretching across.

            The count is every justification on record, whatever the filters
            below are set to -- the line above the list says how many match. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPIStatCard
            label="Justifications recorded"
            value={data === null ? NOT_LOADED : formatCount(data.overall)}
            hint="new-acquisition reasons on record"
          />
        </div>

        {data === null ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
            <p className="text-sm text-foreground">
              The justification log could not be loaded.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
          </div>
        ) : (
          <I08JustificationLog
            items={data.items}
            total={data.total}
            overall={data.overall}
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            filters={filters}
            facets={data.facets}
          />
        )}
      </div>
    </div>
  )
}
