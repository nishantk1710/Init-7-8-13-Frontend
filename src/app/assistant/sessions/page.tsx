import type { Metadata } from "next"
import { connection } from "next/server"

import { SessionLogTable } from "@/components/assistant/session-log-table"
import { PageHeader } from "@/components/shared/page-header"
import { listSessions } from "@/lib/api/assistant"

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
  let loadError: string | null = null
  try {
    sessions = await listSessions({ limit: 200 })
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

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
        <SessionLogTable
          sessions={sessions.items}
          note={sessions.note}
          total={sessions.total}
        />
      )}
    </div>
  )
}
