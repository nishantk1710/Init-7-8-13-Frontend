import type { Metadata } from "next"
import { connection } from "next/server"

import { SessionLogTable } from "@/components/assistant/session-log-table"
import { PageHeader } from "@/components/shared/page-header"
import {
  CompliancePanel,
  type ComplianceCheck,
} from "@/components/assistant/compliance-panel"
import { listJustifications, listSessions } from "@/lib/api/assistant"

export const metadata: Metadata = {
  title: "Assistant sessions — Spares AI",
}

/**
 * Every session the assistant has issued.
 *
 * An async server component reading the backend, matching the Initiative 08
 * screens — this is a plain read and there is nothing for a client to do that
 * a server render cannot. Filtering is client-side inside the table.
 *
 * **Live-only, with no fixture fallback.** A log of invented sessions is worse
 * than an honest failure: the entire purpose of this screen is to show what
 * was actually recorded.
 */
export default async function AssistantSessionsPage() {
  // Not statically prerendered. A build-time snapshot would show a log that
  // never gains the session somebody opened a minute ago, which on a
  // compliance screen reads as "nobody used the assistant".
  await connection()

  let sessions: Awaited<ReturnType<typeof listSessions>> | null = null
  let justifications: Awaited<ReturnType<typeof listJustifications>> | null = null
  let loadError: string | null = null
  try {
    // One round trip each, in parallel. The compliance panel is derived from
    // both, and a sequential pair would double the wait for a screen whose
    // whole job is to be glanced at.
    ;[sessions, justifications] = await Promise.all([
      listSessions({ limit: 200 }),
      listJustifications({ limit: 200 }),
    ])
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  const checks: ComplianceCheck[] = [
    {
      id: "advice-not-taken",
      label: "Went ahead anyway",
      description:
        "Someone was told a repairable unit exists, or offered a smaller quantity, and proceeded regardless. Each one carries a recorded reason.",
      state: "counted",
      count:
        justifications?.items.filter(
          (j) => j.kind === "NEW_ACQUISITION" || j.kind === "QUANTITY_OVERRIDE"
        ).length ?? 0,
      detail: "Recorded at the moment of the decision.",
    },
    {
      id: "abandoned",
      label: "Advice given, not acted on",
      description:
        "Sessions opened and left without an answer. Both FRSs count these, which is why the log lists them rather than hiding unfinished conversations.",
      state: "counted",
      count: sessions?.items.filter((s) => s.outcome === "ABANDONED").length ?? 0,
    },
    {
      // The one that cannot be a number. See the note in CompliancePanel.
      id: "missing-session",
      label: "Reservations with no session",
      description:
        "An 80-series or OAR reservation saved without a valid session reference — I08 FR-8 and I13 FR-4.",
      state: "blocked",
      reason:
        "The platform cannot read a session reference back off a reservation, so it cannot tell which reservations are missing one. A zero here would mean the check never ran, not that everyone complied.",
      dependency: "Bednr on ReservationItemSet (B2)",
    },
  ]

  return (
    <div className="flex flex-col gap-5 p-6">
      <PageHeader
        title="Assistant sessions"
        description="Every time the assistant was opened, whether or not the advice was taken."
      />

      {sessions === null ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm text-foreground">
            The session log could not be loaded.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            This screen has no demo fallback on purpose. A log of invented
            sessions would be worse than no log — the point of it is that it
            shows what was actually recorded.
          </p>
        </div>
      ) : (
        <>
          <CompliancePanel checks={checks} />
          <SessionLogTable
            sessions={sessions.items}
            note={sessions.note}
            total={sessions.total}
          />
        </>
      )}
    </div>
  )
}
