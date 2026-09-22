import type { Metadata } from "next"
import { connection } from "next/server"

import { SessionNotFoundNotice } from "@/components/assistant/routing-notice"
import {
  BackToSessions,
  SessionTrace,
} from "@/components/assistant/session-trace"
import { PageHeader } from "@/components/shared/page-header"
import { getSession } from "@/lib/api/assistant"
import { ApiError } from "@/lib/api/client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sessionId: string }>
}): Promise<Metadata> {
  const { sessionId } = await params
  return { title: `Session ${sessionId} — Spares AI` }
}

/**
 * One session, in full — the FR-8 demo.
 *
 * This is where somebody holding a reference off a reservation finds out what
 * the planner was told and what they decided. It is also the honest place to
 * show the one link that cannot be made yet: `Bednr` is not exposed on
 * `ReservationItemSet`, so no session is tied to a reservation number, and the
 * trace says so rather than leaving it to be inferred.
 *
 * ## A 404 here is not necessarily a failure
 *
 * The backend distinguishes a reference that was never issued from one that
 * was mistyped, and this page passes its message through rather than
 * flattening both into "not found". That distinction matters more than it
 * sounds: "no such session" is the exact compliance finding raised against
 * somebody who skipped the assistant, so a typo rendered as a missing session
 * is an accusation against somebody who did everything right.
 */
export default async function AssistantSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  await connection()
  const { sessionId } = await params

  let trace: Awaited<ReturnType<typeof getSession>> | null = null
  let notFound: string | null = null
  let loadError: string | null = null

  try {
    trace = await getSession(sessionId)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound = error.detailText()
    } else {
      loadError = error instanceof Error ? error.message : String(error)
    }
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <BackToSessions />
      <PageHeader
        title="Assistant session"
        description="What the assistant said, what the requester decided, and what was recorded."
      />

      {notFound !== null && (
        <SessionNotFoundNotice sessionId={sessionId} message={notFound} />
      )}

      {loadError !== null && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm text-foreground">
            This session could not be loaded.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
        </div>
      )}

      {trace !== null && <SessionTrace trace={trace} />}
    </div>
  )
}
