"use client"

import { AssessmentCard } from "@/components/assistant/assessment-card"
import { StepForm } from "@/components/assistant/step-form"
import { Button } from "@/components/ui/button"
import type { ApiStep } from "@/lib/api/assistant"
import type { FormValues } from "@/lib/assistant/answers"
import { cn } from "@/lib/utils"

/**
 * One step from the server, rendered.
 *
 * The four kinds are `message`, `choice`, `form` and `terminal`. The renderer
 * knows nothing about which flow it is in and nothing about what comes next —
 * the backend decides that from the answers so far, every time
 * (`app/assistant/script.py`). This component's entire job is to draw what it
 * was handed and send back an answer.
 *
 * ## The footnote is not part of the prompt
 *
 * `footnote` carries the caveats, and the backend keeps them separate from
 * `prompt` because a sentence that hedges every clause is unreadable. They are
 * rendered under the question, quieter than it. This is where "that repair was
 * due 61 days ago, so its date is no longer a forecast" lives, and it is
 * frequently the most important thing on screen.
 *
 * ## A choice answers on click
 *
 * No confirm button. A two-option question with a confirm step is friction
 * that teaches people to click through the next one, and the next one is
 * sometimes the justification.
 */
export function StepRenderer({
  step,
  active,
  submitting,
  fieldErrors,
  formError,
  onChoice,
  onSubmitForm,
}: {
  step: ApiStep
  /** False once answered. A settled question must not stay clickable. */
  active: boolean
  submitting: boolean
  fieldErrors: Record<string, string>
  formError: string | null
  onChoice: (value: string, label: string) => void
  onSubmitForm: (values: FormValues) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* The assessment sits above the question, because it is what the
          question is about. Not every step carries one — a justification form
          repeats the facts so the planner can see what they are overriding. */}
      {step.facts != null && <AssessmentCard facts={step.facts} />}

      <Prompt text={step.prompt} />

      {step.footnote && <Footnote text={step.footnote} />}

      {step.kind === "choice" && (
        <>
          <Choices
            step={step}
            active={active}
            submitting={submitting}
            onChoice={onChoice}
          />
          {/* A choice has no form to put a rejection in, and a 422 on a choice
              is real — the backend validates the value against the step it
              answers. Without this the click would appear to do nothing. */}
          {formError && (
            <p className="text-xs text-destructive" role="alert">
              {formError}
            </p>
          )}
        </>
      )}

      {step.kind === "message" && formError && (
        <p className="text-xs text-destructive" role="alert">
          {formError}
        </p>
      )}

      {step.kind === "form" && (
        <StepForm
          step={step}
          active={active}
          submitting={submitting}
          fieldErrors={fieldErrors}
          formError={formError}
          onSubmit={onSubmitForm}
        />
      )}

      {/* A terminal step needs nothing back. Its prompt already contains the
          instruction to type the reference into SAP, in the backend's own
          wording — that sentence is the compliance instruction and is served
          so it can be changed in one place. Do not paraphrase it here. */}
    </div>
  )
}

function Prompt({ text }: { text: string }) {
  // Prompts carry real paragraph breaks: the headline, a blank line, then the
  // question. Collapsing them runs the advice into the question.
  return (
    <div className="flex flex-col gap-2">
      {text.split("\n\n").map((paragraph, index) => (
        <p
          key={index}
          className="text-sm whitespace-pre-line text-foreground"
        >
          {paragraph}
        </p>
      ))}
    </div>
  )
}

function Footnote({ text }: { text: string }) {
  const lines = text.split("\n").filter((line) => line.trim().length > 0)
  return (
    <ul className="flex flex-col gap-1 border-l-2 border-border pl-3">
      {lines.map((line) => (
        <li key={line} className="text-xs text-muted-foreground">
          {line}
        </li>
      ))}
    </ul>
  )
}

function Choices({
  step,
  active,
  submitting,
  onChoice,
}: {
  step: ApiStep
  active: boolean
  submitting: boolean
  onChoice: (value: string, label: string) => void
}) {
  return (
    <div
      className="flex flex-col gap-2"
      role="group"
      aria-label="Choose how to continue"
    >
      {step.choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          disabled={!active || submitting}
          onClick={() => onChoice(choice.value, choice.label)}
          className={cn(
            "flex flex-col items-start gap-0.5 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            active && !submitting
              ? "hover:border-ring hover:bg-accent cursor-pointer"
              : "cursor-not-allowed opacity-60"
          )}
        >
          <span className="text-sm font-medium text-foreground">
            {choice.label}
          </span>
          {/* This is where "you will be asked why, and the reason is
              recorded" is said. Dropping it makes the justification step a
              surprise, and a surprise is not consent. */}
          {choice.description && (
            <span className="text-xs text-muted-foreground">
              {choice.description}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/**
 * The planner's own answer, echoed back into the transcript.
 *
 * Synthesised locally rather than re-fetched: the server returns only the next
 * step, and a round trip to redisplay something the browser already knows is
 * latency for nothing. Optimistic for the echo only — never for the next step.
 */
export function AnswerBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[80%] rounded-xl bg-secondary px-3.5 py-2 text-sm text-secondary-foreground">
        {text}
      </p>
    </div>
  )
}

/** The assistant is working. Shown in place of a step, never over one. */
export function ThinkingIndicator() {
  return (
    <p className="text-xs text-muted-foreground" role="status">
      Working…
    </p>
  )
}

/** A failure that is not attributable to a field. */
export function StepError({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div
      className="flex flex-col items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3"
      role="alert"
    >
      <p className="text-sm whitespace-pre-line text-foreground">{message}</p>
      {/* Retry is offered only where the caller says it is safe. A failed POST
          may have been recorded before the response was lost, and every write
          here lands in an append-only table — an unconditional retry button
          invites a duplicate nobody can delete. */}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
