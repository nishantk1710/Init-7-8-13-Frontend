"use client"

import { useCallback, useRef, useState } from "react"

import {
  AnswerBubble,
  StepError,
  StepRenderer,
  ThinkingIndicator,
} from "@/components/assistant/step-renderer"
import { SessionReference } from "@/components/assistant/session-reference"
import { postTurn, type ApiStep, type StartSessionResponse } from "@/lib/api/assistant"
import { ApiError } from "@/lib/api/client"
import {
  choiceAnswer,
  formAnswer,
  type FormValues,
} from "@/lib/assistant/answers"
import {
  appendAnswer,
  startTranscript,
  summariseFormSubmission,
  type Transcript,
} from "@/lib/assistant/transcript"

/**
 * The conversation, driven by the server.
 *
 * ## What this component does NOT hold
 *
 * There is no current-step index, no script, and no branch logic. The backend
 * works out what comes next from the answers so far, every time
 * (`app/assistant/script.py::next_step`), and stores no cursor of its own. A
 * cursor here would be a second source of truth about an append-only log, free
 * to disagree with the turns it claims to describe.
 *
 * So the only state is: the transcript, whether a request is in flight, and
 * the last error. What comes next is always the server's answer.
 *
 * ## Why a client component when the rest of this repo prefers servers
 *
 * The I08 screens are async server components and the I13 screens use
 * `useI13Query`. Neither fits: this is a POST-driven state machine where each
 * answer depends on the previous response, so there is no point at which the
 * server could render a useful snapshot. The read-only session log and trace
 * views do follow the house pattern.
 */
export function AssistantWorkspace({
  start,
}: {
  /** The already-opened session. Routing is resolved before this renders. */
  start: StartSessionResponse & { sessionId: string; step: ApiStep }
}) {
  const [transcript, setTranscript] = useState<Transcript>(() =>
    startTranscript(start.step)
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  /**
   * Guards against a second submission while the first is in flight.
   *
   * A ref rather than the `submitting` state because state updates are
   * batched: two clicks in the same tick both see `submitting === false` and
   * both fire. Every POST here appends to a table where Postgres triggers
   * block DELETE, so a duplicate is a permanent second turn recorded against
   * one decision — not a cosmetic glitch.
   */
  const inFlight = useRef(false)

  const answer = useCallback(
    async (payload: Record<string, unknown>, echo: string) => {
      if (inFlight.current) return
      inFlight.current = true
      setSubmitting(true)
      setError(null)
      setFieldErrors({})

      try {
        const response = await postTurn(start.sessionId, payload)
        setTranscript((previous) => appendAnswer(previous, echo, response.step))
      } catch (caught) {
        if (caught instanceof ApiError) {
          const perField = caught.fieldErrors()
          setFieldErrors(perField)
          // A 422 whose detail is a string is a business rule, not a field
          // problem, and belongs above the form rather than under a box. When
          // the detail did name fields, those messages are already rendered
          // there and repeating them here says everything twice.
          setError(
            Object.keys(perField).length > 0
              ? "Some answers need changing before this can be recorded."
              : caught.detailText()
          )
        } else {
          setError(
            caught instanceof Error
              ? caught.message
              : "The assistant could not be reached."
          )
        }
      } finally {
        inFlight.current = false
        setSubmitting(false)
      }
    },
    [start.sessionId]
  )

  const onChoice = useCallback(
    (value: string, label: string) => {
      void answer(choiceAnswer(value), label)
    },
    [answer]
  )

  const onSubmitForm = useCallback(
    (step: ApiStep, values: FormValues) => {
      void answer(
        formAnswer(step.fields, values),
        summariseFormSubmission(step.fields, values)
      )
    },
    [answer]
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Shown from the moment the session is minted, not at the end. A
          planner who reads the advice and closes the tab has still had a
          session recorded, and "advice given, not acted on" is a thing both
          FRSs count — so the reference has to be available before the
          conversation finishes, or an abandoned session is unreferencable. */}
      <SessionReference
        sessionId={start.sessionId}
        expiresAt={start.expiresAt}
      />

      <div className="flex flex-col gap-5" aria-live="polite">
        {transcript.entries.map((entry) =>
          entry.kind === "answer" ? (
            <AnswerBubble key={entry.key} text={entry.text} />
          ) : (
            <StepRenderer
              key={entry.key}
              step={entry.step}
              active={entry.active && !submitting}
              submitting={submitting}
              fieldErrors={entry.active ? fieldErrors : {}}
              formError={null}
              onChoice={onChoice}
              onSubmitForm={(values) => onSubmitForm(entry.step, values)}
            />
          )
        )}

        {submitting && <ThinkingIndicator />}

        {error && (
          <StepError
            message={error}
            // No retry button. The request may have been recorded before the
            // response was lost, and re-posting would write a second turn.
            // The planner can answer the live step again, which is the same
            // action with the duplicate risk visible rather than hidden
            // behind a button labelled "try again".
          />
        )}
      </div>

      {transcript.current === null && (
        <p className="text-xs text-muted-foreground">
          This conversation is finished. It stays readable at its reference for
          as long as the record exists.
        </p>
      )}
    </div>
  )
}
