import type { Metadata } from "next"
import { connection } from "next/server"

import { AssistantPageHeader } from "@/components/assistant/ai-visuals"
import { SessionNotFoundNotice } from "@/components/assistant/routing-notice"
import { SessionDownloadMenu } from "@/components/assistant/session-download-menu"
import { BackToSessions, SessionLoadError, SessionTrace } from "@/components/assistant/session-trace"
import { getSession } from "@/lib/api/assistant"
import { ApiError } from "@/lib/api/client"
import { getSessionJob, type ApiSessionJob } from "@/lib/api/i8"
import { sessionJobView, type SessionJobView } from "@/lib/assistant/session-job"

/** No ID in the tab title: a request line's internal session ID is not
 *  something the requester ever sees or types. */
export const metadata: Metadata = { title: "Assistant session — Spares AI" }

/**
 * One session, in full: the reference to type into SAP, what the assistant
 * showed, what was decided and recorded, and what SAP has linked so far.
 *
 * ## A 404 here is not necessarily a failure
 *
 * The backend distinguishes a reference that was never issued from one that
 * was mistyped, and this page passes its message through rather than
 * flattening both into "not found". "No such session" is the exact compliance
 * finding raised against somebody who skipped the assistant, so a typo shown
 * as a missing session would accuse somebody who did everything right.
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
  // reservation text. A 404 (or any failure) reads as "not linked yet": the
  // session page must not fail because the job cannot be read.
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
    <div className="nav-blue-scope min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="flex flex-col gap-2">
          <BackToSessions />
          <AssistantPageHeader
            plain
            title="Assistant session"
            description="What the assistant showed, what was decided, and what was recorded."
            actions={trace !== null ? <SessionDownloadMenu trace={trace} /> : undefined}
          />
        </div>

        {notFound !== null && <SessionNotFoundNotice sessionId={sessionId} message={notFound} />}
        {loadError !== null && <SessionLoadError message={loadError} />}
        {trace !== null && <SessionTrace trace={trace} job={jobView} />}
      </div>
    </div>
  )
}
