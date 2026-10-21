"use client"

import { useEffect, useState } from "react"

import { SessionNotFoundNotice } from "@/components/assistant/routing-notice"
import { SessionTrace } from "@/components/assistant/session-trace"
import type { SessionTraceResponse } from "@/lib/api/assistant"
import { getSession } from "@/lib/assistant/demo"
import { subscribe } from "@/lib/assistant/demo/store"

/**
 * The trace page's body in demo mode.
 *
 * A client component because the run lives in this browser's storage, which
 * the server render cannot see. Renders the same `SessionTrace` live uses, and
 * re-reads when the demo store changes (a simulated reservation, say).
 */
export function DemoSessionTrace({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "found"; trace: SessionTraceResponse }
    | { status: "missing"; message: string }
  >({ status: "loading" })

  useEffect(() => {
    const read = () => {
      try {
        setState({ status: "found", trace: getSession(sessionId) })
      } catch (caught) {
        setState({
          status: "missing",
          message:
            caught && typeof caught === "object" && "detailText" in caught
              ? (caught as { detailText: () => string }).detailText()
              : String(caught),
        })
      }
    }
    read()
    return subscribe(read)
  }, [sessionId])

  if (state.status === "loading") {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading {sessionId}…
      </p>
    )
  }
  if (state.status === "missing") {
    return <SessionNotFoundNotice sessionId={sessionId} message={state.message} />
  }
  return <SessionTrace trace={state.trace} />
}
