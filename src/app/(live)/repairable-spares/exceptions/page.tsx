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
 * Three of the four FR-8 exception types are computed — missing attestation,
 * unjustified acquisition and, since the FR-9 work, overdue repair.
 * `MISSING_SESSION_ID` is declared in the backend and never raised: I08's
 * extract has no reservation view, so there is no SGTXT to read a session id
 * back from, and the check has no source data rather than a missing
 * implementation. The screen names the checks that ARE running rather than
 * letting a zero read as "nothing found".
 *
 * ## What is stored, and what is not
 *
 * The items are still recomputed from the register on every read — they are
 * never stored, which is what keeps the queue from drifting away from the
 * data. What IS stored, since FR-11 landed, is the work: status, owner, and a
 * history of what people said and did, keyed by the item's own id.
 *
 * The consequence worth knowing is the good one. Record the declaration and
 * the check stops finding the line; the item does not silently vanish from
 * whoever owned it — it resolves itself, and its history says the data moved
 * rather than that a person closed it.
 *
 * Still missing from FR-11: email. There is no notification of any kind, so a
 * queue nobody opens is a queue nobody reads.
 */
/** A query value as one string; a repeated parameter (`?id=a&id=b`) takes the first. */
function single(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  return first?.trim() ? first.trim() : undefined
}

/**
 * `?id=EX-…` opens that item's drawer; `?repair=4500000677-20` narrows the
 * queue to one repair line — the link the register's Exceptions column uses.
 *
 * The page is keyed by both, so following a second link while already here
 * starts from that link rather than from the last one's state.
 */
export default async function I08ExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; repair?: string }>
}) {
  const params = await searchParams
  const id = single(params.id)
  const repair = single(params.repair)

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
          description="Repair lines sent away with no condition declaration, and new units bought while a repair was already open with no justification on record."
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
            key={`${id ?? ""}|${repair ?? ""}`}
            rows={data.rows}
            summary={data.summary}
            truncated={data.truncated}
            initialId={id}
            initialRepair={repair}
          />
        )}
      </div>
    </div>
  )
}
