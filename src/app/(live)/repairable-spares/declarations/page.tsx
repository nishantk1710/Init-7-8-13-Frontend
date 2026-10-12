import type { Metadata } from "next"
import { connection } from "next/server"

import { PageHeader } from "@/components/shared/page-header"
import { DeclarationsTable } from "@/features/initiative-8/components/declarations-table"
import { loadLiveDeclarations } from "@/features/initiative-8/data/live-declarations"

export const metadata: Metadata = {
  title: "Condition declarations — Spares AI",
}

/**
 * Initiative 08 FR-4 — the condition-to-repair declaration queue.
 *
 * ## Why this screen is back
 *
 * It was folded into the Repair Register on 08-Oct-2026 and this route became
 * a `redirect()`. The 09-Oct FRS audit found that the register's Declaration
 * Status column answers a different question: it tells you the state of ONE
 * repair line you are already looking at, and FR-4 asks who has not declared
 * anything yet. You cannot work a queue you have to go looking for, and the
 * register sorts by repair line rather than by what is outstanding.
 *
 * So the queue is a screen again, reading the same backend check the register
 * reads — `GET /api/i8/declarations`, which has been live throughout.
 *
 * ## What it does not do
 *
 * It does not enforce anything. The platform never writes to SAP, so a missing
 * declaration cannot block a dispatch; recording the declaration is half the
 * control and detecting its absence is the other half, and this screen is the
 * second half. Saying otherwise on screen would be a lie about what the
 * platform can do.
 *
 * The form itself stays on the repair detail page, where the line's own
 * context is. This screen navigates to it.
 */
export default async function I08DeclarationsPage() {
  // Reads a table that changes whenever somebody records a declaration, so a
  // build-time snapshot would be stale the moment it was built.
  await connection()

  let data: Awaited<ReturnType<typeof loadLiveDeclarations>> | null = null
  let loadError: string | null = null
  try {
    data = await loadLiveDeclarations()
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Condition declarations"
          description="Every repair line, and whether the part was assessed before it was sent away (FR-4). Advisory — the platform records and reports this, it cannot block a dispatch."
        />

        {data === null ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"
          >
            <p className="text-sm text-foreground">
              The declaration queue could not be loaded.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              This is not &ldquo;nothing outstanding&rdquo; — it is a failed
              request. Check that the backend is running and that its I08 data
              has finished building.
            </p>
          </div>
        ) : (
          <DeclarationsTable
            rows={data.rows}
            summary={data.summary}
            truncated={data.truncated}
          />
        )}
      </div>
    </div>
  )
}
