import type { Metadata } from "next"
import { connection } from "next/server"

import { KPIStatCard } from "@/components/shared/kpi-stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { DeclarationLogTable } from "@/features/initiative-8/components/declaration-log-table"
import { DeclarationsTable } from "@/features/initiative-8/components/declarations-table"
import { DeclarePartButton } from "@/features/initiative-8/components/declare-part-button"
import { loadLiveDeclarations } from "@/features/initiative-8/data/live-declarations"
import { getAttestations } from "@/lib/api/i8"
import { formatCount } from "@/lib/utils"

/** Shown on a tile whose source could not be read -- never a 0. */
const NOT_LOADED = "Could not be loaded"

export const metadata: Metadata = {
  title: "Repair Declarations — Spares AI",
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
 * ## Where the form is
 *
 * Everywhere it is needed, since 12-Oct-2026. It is still on the repair detail
 * page, where the line's own evidence is, but it is also on each row of the
 * queue below — working a queue should not mean a round trip per row — and
 * behind "Declare a part", which needs no repair line at all.
 *
 * That last one matters more than it looks. FR-4 assesses a part when it comes
 * off the machine, and a part judged Scrap or Beyond Economical Repair never
 * gets a repair PO. While the form was reachable only from a repair line,
 * exactly those judgements had nowhere to go.
 */
export default async function I08DeclarationsPage() {
  // Reads a table that changes whenever somebody records a declaration, so a
  // build-time snapshot would be stale the moment it was built.
  await connection()

  let data: Awaited<ReturnType<typeof loadLiveDeclarations>> | null = null
  let loadError: string | null = null
  // Best-effort and fetched in parallel: a failure costs the forms their
  // category list (they then say so and cannot submit), never the screen.
  const faultCategories = getAttestations()
    .then((body) => body.faultCategories ?? [])
    .catch(() => [] as string[])
  try {
    // Only what the table draws. The table is scoped to outstanding rows --
    // with no declaration-status column, a Completed row would look
    // identical to an undeclared one -- so fetching the Completed ones too
    // would be paying to transfer rows nothing renders. The table still
    // filters them again itself, so a backend that ignores the parameter
    // renders exactly the same screen.
    data = await loadLiveDeclarations({ outstandingOnly: true })
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }
  const categories = await faultCategories

  // The plants a declaration can be recorded against, from the rows rather
  // than hard-coded: the plant scope is a backend setting and a list typed
  // here would be a second place to change it.
  const plantOptions = [
    ...new Map(
      (data?.rows ?? [])
        .filter((row) => row.plant)
        .map((row) => [row.plant!.plantId, { plantId: row.plant!.plantId, name: row.plant!.name }]),
    ).values(),
  ].sort((a, b) => a.plantId.localeCompare(b.plantId))

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Repair Declarations"
          description="Every repair line, and whether the part was assessed before it was sent away. Advisory — the platform records and reports this, it cannot block a dispatch."
          actions={
            plantOptions.length > 0 ? (
              <DeclarePartButton plantOptions={plantOptions} faultCategories={categories} />
            ) : undefined
          }
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
          <>
            {/* The four numbers somebody asks for before reading any row.
                "Could not be loaded" rather than a 0 where the source failed:
                a zero here reads as "nothing outstanding", which is the
                opposite of what a failed call means. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KPIStatCard
                label="Repair lines undeclared"
                value={formatCount(data.summary.outstanding)}
                hint={`of ${formatCount(data.summary.total)} repair lines`}
              />
              <KPIStatCard
                label="Declarations recorded"
                value={
                  data.log === null
                    ? NOT_LOADED
                    : formatCount(data.log.filter((r) => !r.supersededBy).length)
                }
                hint={
                  data.log === null
                    ? undefined
                    : `in force · ${formatCount(data.log.filter((r) => r.supersededBy).length)} amended, kept as history`
                }
              />
              <KPIStatCard
                label="Repairable"
                value={
                  data.log === null
                    ? NOT_LOADED
                    : formatCount(
                        data.log.filter((r) => r.condition === "Repairable").length
                      )
                }
                hint="judged worth repairing"
              />
              <KPIStatCard
                label="Not worth repairing"
                value={
                  data.log === null
                    ? NOT_LOADED
                    : formatCount(
                        data.log.filter(
                          (r) =>
                            r.condition === "Scrap" ||
                            r.condition === "Beyond Economical Repair"
                        ).length
                      )
                }
                hint="scrap or beyond economical repair"
              />
            </div>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-foreground">
                Repair lines still owed a declaration
              </h2>
              <DeclarationsTable
                rows={data.rows}
                summary={data.summary}
                truncated={data.truncated}
                faultCategories={categories}
              />
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-foreground">
                Declaration log
              </h2>
              {data.log === null ? (
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm"
                >
                  <p className="text-foreground">
                    The declaration log could not be loaded.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This is not &ldquo;nothing recorded&rdquo;. The queue above
                    is unaffected.
                  </p>
                </div>
              ) : (
                <DeclarationLogTable rows={data.log} />
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
