import type { Metadata } from "next"
import { connection } from "next/server"

import { JustificationLog } from "@/features/initiative-13/components/justification-log"
import { PageHeader } from "@/components/shared/page-header"
import { listJustifications } from "@/lib/api/assistant"
import { fromAssistant } from "@/lib/assistant/justifications"

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

  return (
    <div className="flex flex-col gap-5 p-6">
      <PageHeader
        title="New-acquisition justifications"
        description="Why a new unit was bought while a repairable one already existed — captured at the moment of the reservation (FR-7)."
      />

      {entries === null ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm text-foreground">
            The justification log could not be loaded.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
        </div>
      ) : (
        <>
          <JustificationLog entries={entries.items.map(fromAssistant)} />
          {/* The backend's own note, served rather than written here. */}
          {entries.note && (
            <p className="text-[11px] text-muted-foreground">{entries.note}</p>
          )}
        </>
      )}
    </div>
  )
}
