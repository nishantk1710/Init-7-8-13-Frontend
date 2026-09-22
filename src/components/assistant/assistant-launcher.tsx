"use client"

import { useEffect, useRef, useState } from "react"

import { AssistantWorkspace } from "@/components/assistant/assistant-workspace"
import {
  AssessmentUnavailableNotice,
  OutOfScopeNotice,
} from "@/components/assistant/routing-notice"
import { StepError } from "@/components/assistant/step-renderer"
import { startSession, type StartSessionResponse } from "@/lib/api/assistant"
import { ApiError } from "@/lib/api/client"

/**
 * Opens a session and hands off to the conversation.
 *
 * Client-side rather than in the route's server component, for one reason that
 * matters: opening a session **writes a row**. A server component would run
 * the POST during render, and React re-renders — a Next.js retry, a refresh, a
 * back-navigation — would each mint another session against the same planner
 * for the same material. `assistant_session` is append-only, so those rows
 * cannot be cleaned up afterwards.
 *
 * Here the POST is fired exactly once per mount, guarded by a ref that
 * survives Strict Mode's deliberate double-invocation in development.
 *
 * ## Three outcomes, three renderings
 *
 * The plan called this out because they are easy to collapse into one error
 * state, and they mean different things:
 *
 *   - **200 with a session** — the normal path.
 *   - **200 with `flow: "none"`** — the material is out of scope. Not an
 *     error: the assistant has no opinion about a consumable.
 *   - **422** — the material is in scope but the platform has no read model
 *     for it. That is a gap in our coverage and is worth reporting as one.
 */
export function AssistantLauncher({
  materialId,
  plant,
  quantity,
  origin,
}: {
  materialId: string
  plant: string
  quantity?: string
  origin: "BADI" | "PLATFORM"
}) {
  const [state, setState] = useState<
    | { status: "opening" }
    | { status: "open"; response: StartSessionResponse }
    | { status: "unavailable"; message: string }
    | { status: "failed"; message: string }
  >({ status: "opening" })

  const opened = useRef(false)

  useEffect(() => {
    // Strict Mode mounts effects twice in development on purpose. Without this
    // guard that is two sessions for one conversation, in a table that cannot
    // be corrected.
    if (opened.current) return
    opened.current = true

    let cancelled = false

    startSession({ materialId, plant, quantity, origin })
      .then((response) => {
        if (!cancelled) setState({ status: "open", response })
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        if (caught instanceof ApiError && caught.status === 422) {
          setState({ status: "unavailable", message: caught.detailText() })
          return
        }
        setState({
          status: "failed",
          message:
            caught instanceof ApiError
              ? caught.detailText()
              : caught instanceof Error
                ? caught.message
                : "The assistant could not be reached.",
        })
      })

    return () => {
      cancelled = true
    }
  }, [materialId, plant, quantity, origin])

  if (state.status === "opening") {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Checking {materialId} at plant {plant}…
      </p>
    )
  }

  if (state.status === "unavailable") {
    return (
      <AssessmentUnavailableNotice
        message={state.message}
        materialId={materialId}
        plant={plant}
      />
    )
  }

  if (state.status === "failed") {
    // No retry button here either: a failure whose response was lost may still
    // have minted a session. Reloading is the planner's call, and it is an
    // action they understand the cost of.
    return <StepError message={state.message} />
  }

  const { response } = state

  // A 200 with no session. `routing.reason` is written for this screen.
  if (response.sessionId === null || response.step === null) {
    return <OutOfScopeNotice routing={response.routing} />
  }

  return (
    <AssistantWorkspace
      start={{
        ...response,
        sessionId: response.sessionId,
        step: response.step,
      }}
    />
  )
}
