import type { Metadata } from "next"
import { connection } from "next/server"

import { SessionNotFoundNotice } from "@/components/assistant/routing-notice"
import {
  BackToSessions,
  SessionTrace,
} from "@/components/assistant/session-trace"
import { AssistantPageHeader } from "@/components/assistant/ai-visuals"
import { SessionJob } from "@/components/assistant/session-job"
import { getSession } from "@/lib/api/assistant"
import { ApiError } from "@/lib/api/client"
import { getSessionJob, type ApiSessionJob } from "@/lib/api/i8"
import { sessionJobView, type SessionJobView } from "@/lib/assistant/session-job"

/** No ID in the tab title: a request line's internal session ID is not
 *  something the requester ever sees or types. */
export const metadata: Metadata = { title: "Assistant session — Spares AI" }

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

  // Repairable sessions only: the job behind the session, read from the
  // reservation text. A 404 (or any failure) reads as "not linked yet" --
  // the session page must not fail because the job cannot be read.
  let jobView: SessionJobView | null = null
  if (trace?.flow === "i08") {
    let job: ApiSessionJob | null = null
    try {
      job = await getSessionJob(trace.sessionId)
    } catch {
      job = null
    }
    jobView = sessionJobView(job)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-5">
        <BackToSessions />
        <AssistantPageHeader
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

        {jobView !== null && <SessionJob view={jobView} />}
      </div>
    </div>
  )
}
