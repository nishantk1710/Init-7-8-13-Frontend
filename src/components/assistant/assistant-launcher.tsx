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

  /**
   * The in-flight (or settled) request, held across mounts.
   *
   * ## Why this is a cached promise and not a boolean
   *
   * The obvious guard — a `hasOpened` ref checked at the top of the effect —
   * is broken under React Strict Mode, which deliberately mounts, unmounts and
   * remounts every effect in development. The sequence is:
   *
   *   1. mount    → ref is false, set it true, fire the POST, `cancelled=false`
   *   2. cleanup  → `cancelled=true`, disarming the only request's handlers
   *   3. remount  → ref is true, so the effect returns early and never
   *                 re-attaches
   *
   * The POST succeeds, the session row is written, and nothing ever reads the
   * response: the page sits on "Checking…" forever while an orphaned session
   * exists in an append-only table. Production does not double-mount, so this
   * would have been a development-only trap — which is worse, because
   * development is where it gets demonstrated.
   *
   * Caching the promise fixes both halves at once. The request is created once
   * per distinct set of parameters, and each mount attaches its own handlers
   * to the same promise, so the second mount receives the result the first one
   * dropped.
   */
  const request = useRef<{
    key: string
    promise: Promise<StartSessionResponse>
  } | null>(null)

  /**
   * A quantity that is not a number never reaches the backend.
   *
   * It would return a 422 whose detail is a plain string — "quantity must be
   * a number, got 'abc'" — which is the same shape as the genuine "no read
   * model for this material" gap. Reporting a bad URL as missing platform
   * data sends somebody to look in entirely the wrong place. Caught here, the
   * message can name the real problem.
   *
   * An absent or empty quantity is fine: it means "not stated", which the
   * backend deliberately keeps distinct from zero.
   */
  const badQuantity =
    quantity !== undefined &&
    quantity !== "" &&
    !Number.isFinite(Number(quantity))

  useEffect(() => {
    // Recomputed here rather than closing over the outer `badQuantity`, which
    // would put a derived value in the dependency array to no purpose: it is
    // a pure function of `quantity`, which is already a dependency.
    if (quantity !== undefined && quantity !== "" && !Number.isFinite(Number(quantity))) {
      return
    }

    // A genuinely different material or plant is a different question and
    // deserves its own session; only an identical repeat is deduplicated.
    const key = JSON.stringify([materialId, plant, quantity, origin])
    if (request.current?.key !== key) {
      request.current = {
        key,
        promise: startSession({ materialId, plant, quantity, origin }),
      }
    }

    let active = true

    request.current.promise
      .then((response) => {
        if (!active) return
        setState({ status: "open", response })
        // Swap the minting URL for the session's own permalink.
        //
        // `/assistant/new?material=…` MEANS "open a session", so reloading it
        // mints a second one — a duplicate row in an append-only table, and a
        // new reference replacing the one the planner may already have
        // written down. Since there is no endpoint that resumes a
        // conversation (ask O-8), the best available outcome for a reload is
        // the trace: the conversation is lost either way, but this way the
        // record is shown instead of a duplicate being created.
        //
        // replaceState rather than router.replace: this must not re-render
        // the tree or unmount the live conversation, only relabel it.
        if (response.sessionId) {
          window.history.replaceState(
            null,
            "",
            `/assistant/sessions/${response.sessionId}`
          )
        }
      })
      .catch((caught: unknown) => {
        if (!active) return
        // A 422 is NOT always a coverage gap. The route raises one for a
        // malformed request too — a non-numeric `quantity` on the deep link
        // returns 422 "quantity must be a number, got 'abc'", and pydantic
        // returns 422 with an array detail for a missing field. Reporting
        // either as "the platform has no read model for this material" blames
        // our own data for a bad URL, and sends somebody looking in the wrong
        // place.
        //
        // The array arm is unambiguously a malformed request. The string arm
        // is the genuine data gap, and the quantity case is caught before the
        // request is ever sent (see `badQuantity` below), so it cannot reach
        // here.
        if (
          caught instanceof ApiError &&
          caught.status === 422 &&
          typeof caught.detail === "string"
        ) {
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
      active = false
    }
  }, [materialId, plant, quantity, origin])

  if (badQuantity) {
    return (
      <StepError
        message={`This link carries a quantity of "${quantity}", which is not a number. No session has been opened. Open the assistant without a quantity, or correct the link — the assessment does not need one.`}
      />
    )
  }

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
