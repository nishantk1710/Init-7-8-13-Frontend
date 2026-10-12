import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { connection } from "next/server"

import { JustificationLog } from "@/features/initiative-13/components/justification-log"
import { KPIStatCard } from "@/components/shared/kpi-stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { listJustifications } from "@/lib/api/assistant"
import { getExceptions } from "@/lib/api/i8"
import { buttonVariants } from "@/components/ui/button"
import { cn, formatCount } from "@/lib/utils"
import { fromAssistant } from "@/lib/assistant/justifications"

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
 */
export default async function I08JustificationsPage() {
  // Reads a table that grows as people use the assistant, so a build-time
  // snapshot would be permanently empty.
  await connection()

  let entries: Awaited<ReturnType<typeof listJustifications>> | null = null
  let loadError: string | null = null
  try {
    entries = await listJustifications({ kind: "NEW_ACQUISITION", limit: 200 })
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  // The other half of the picture: purchases the check FOUND with no
  // justification. Best-effort -- the log is still worth reading without it,
  // and a tile that could not be computed says so rather than showing a 0.
  const exceptionMeta = await getExceptions({ pageSize: 1 })
    .then((body) => body.meta)
    .catch(() => null)

  const recorded = entries?.items.length ?? 0
  const linkedToSession = entries?.items.filter((e) => e.sessionId).length ?? 0
  const stillUnjustified = exceptionMeta?.byType?.UNJUSTIFIED_ACQUISITION ?? null
  // Of the new purchases the check looked at, how many carry a reason.
  const checked = exceptionMeta?.acquisitionsChecked ?? null
  const compliance =
    checked && checked > 0 && stillUnjustified !== null
      ? Math.round(((checked - stillUnjustified) / checked) * 100)
      : null

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-5">
        <PageHeader
          title="New-acquisition justifications"
          description="Why a new unit was bought while a repairable one already existed — captured at the moment of the reservation (FR-7)."
        />

        {/* Counts over the whole log, not the page. "Purchases avoided" is
            deliberately absent: FR-7 wants benefit attributed only where the
            requester chose repair after the assistant's advice, and nothing
            computes that yet (MBEW is pulled and unread). A tile with an
            invented number would be worse than no tile. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPIStatCard
            label="Justifications recorded"
            value={entries === null ? NOT_LOADED : formatCount(recorded)}
            hint="new-acquisition reasons on record"
          />
          <KPIStatCard
            label="Purchases still unjustified"
            value={stillUnjustified === null ? NOT_LOADED : formatCount(stillUnjustified)}
            hint="bought while a repair was open, no reason given"
          />
          <KPIStatCard
            label="Justification compliance"
            value={compliance === null ? NOT_LOADED : `${compliance}%`}
            hint={
              checked === null
                ? undefined
                : `of ${formatCount(checked)} new purchases checked`
            }
          />
          <KPIStatCard
            label="Linked to a session"
            value={entries === null ? NOT_LOADED : formatCount(linkedToSession)}
            hint="captured at the reservation, not after the fact"
          />
        </div>

        {/* The other side of this log. A purchase with no reason recorded is
            raised there; recording the reason is what closes it and adds it
            here, so the two screens are one loop and each says so. */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            A new unit bought while a repair was already open, with no reason
            recorded, is raised on the exception queue as an unjustified
            acquisition.
          </p>
          <Link
            href="/repairable-spares/exceptions?type=UNJUSTIFIED_ACQUISITION"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
          >
            Open exception queue
            <ChevronRight className="size-3.5" />
          </Link>
        </div>

        {entries === null ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
            <p className="text-sm text-foreground">
              The justification log could not be loaded.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
          </div>
        ) : (
          <JustificationLog
            entries={entries.items.map(fromAssistant)}
            csvFilename="i08-new-acquisition-justifications.csv"
            filterable
          />
        )}
      </div>
    </div>
  )
}
