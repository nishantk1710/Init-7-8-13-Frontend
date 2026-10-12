import type { Metadata } from "next"
import { connection } from "next/server"

import { PageHeader } from "@/components/shared/page-header"
import { ExceptionsTable } from "@/features/initiative-8/components/exceptions-table"
import { loadLiveExceptions } from "@/features/initiative-8/data/live-exceptions"

export const metadata: Metadata = {
  title: "Exception queue — Spares AI",
}

/**
 * Initiative 08 FR-8, FR-9 and FR-11 — the exception queue.
 *
 * ## Why this screen is back
 *
 * It was removed on 08-Oct-2026 and this route became a `redirect()`, on the
 * reasoning that declaration and justification are mandatory so there is no
 * separate queue to work. The 09-Oct FRS audit found that this leaves four
 * requirements and two acceptance criteria with nothing behind them:
 *
 * - FR-8 asks for repair lines with no attestation, and purchases made with no
 *   justification, to be RAISED as exceptions.
 * - FR-9 asks for overdue to appear as an explicit exception state.
 * - FR-11 asks for a platform exception queue.
 * - AC 5 asks that every repair with no attestation is raised "within one
 *   refresh cycle"; AC 11 asks for exception items across four types.
 *
 * The backend never stopped computing any of this. `GET /api/i8/exceptions`
 * has been live throughout — the checks ran, and nothing rendered them.
 *
 * ## What is still missing, and is not pretended here
 *
 * Two of the four FR-8 exception types are computed. `MISSING_SESSION_ID` is
 * defined in the backend and never raised, so the screen names the checks that
 * ARE running rather than letting a zero read as "nothing found".
 *
 * Nothing here is stored or owned. The items are recomputed from the register
 * each time; there is no owner, no status, no close date and no email, which
 * is the rest of FR-11. A queue that let someone "close" an item it cannot
 * remember closing would be worse than one that does not offer it.
 */
export default async function I08ExceptionsPage() {
  // Recomputed from the register and the attestation table, both of which
  // change under the page. A build-time snapshot would be wrong by lunchtime.
  await connection()

  let data: Awaited<ReturnType<typeof loadLiveExceptions>> | null = null
  let loadError: string | null = null
  try {
    data = await loadLiveExceptions()
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Exception queue"
          description="Repair lines sent away with no condition declaration, and new units bought while a repair was already open with no justification on record (FR-8, FR-11)."
        />

        {data === null ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"
          >
            <p className="text-sm text-foreground">
              The exception queue could not be loaded.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              This is not &ldquo;no exceptions&rdquo; — it is a failed request,
              and on this screen the two mean opposite things. Check that the
              backend is running and that its I08 data has finished building.
            </p>
          </div>
        ) : (
          <ExceptionsTable
            rows={data.rows}
            summary={data.summary}
            truncated={data.truncated}
          />
        )}
      </div>
    </div>
  )
}
