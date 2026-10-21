"use client"

import { useEffect, useState } from "react"
import { ChevronRight, CircleAlert, Info, UserRound } from "lucide-react"

import { AiOrb } from "@/components/assistant/ai-visuals"
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
    <article
      className="animate-ai-message-in flex gap-3"
      aria-current={active || undefined}
    >
      <AiOrb size="md" className="mt-0.5 hidden sm:inline-flex" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* The assessment sits above the question, because it is what the
            question is about. Not every step carries one — a justification form
            repeats the facts so the planner can see what they are overriding. */}
        {step.facts != null && <AssessmentCard facts={step.facts} />}

        <Prompt text={step.prompt} terminal={step.kind === "terminal"} />

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
            {formError && <InlineError message={formError} />}
          </>
        )}

        {step.kind === "message" && formError && <InlineError message={formError} />}

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
    </article>
  )
}

function Prompt({ text, terminal }: { text: string; terminal: boolean }) {
  // Prompts carry real paragraph breaks: the headline, a blank line, then the
  // question. Collapsing them runs the advice into the question.
  return (
    <div
      className={cn(
        "flex w-fit max-w-full flex-col gap-2 rounded-2xl rounded-tl-md border px-4 py-3 shadow-sm",
        terminal
          ? "border-success/30 bg-success/10"
          : "border-border bg-card"
      )}
    >
      {text.split("\n\n").map((paragraph, index) => (
        <p
          key={index}
          className={cn(
            "text-sm leading-relaxed whitespace-pre-line text-foreground",
            index === 0 && "font-medium"
          )}
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
    <div className="relative flex gap-2.5 overflow-hidden rounded-xl bg-muted/50 py-2.5 pr-3 pl-4">
      <span aria-hidden className="ai-gradient absolute inset-y-0 left-0 w-0.5" />
      <Info className="mt-0.5 size-3.5 shrink-0 text-ai-2" aria-hidden />
      <ul className="flex flex-col gap-1">
        {lines.map((line) => (
          <li key={line} className="text-xs leading-relaxed text-muted-foreground">
            {line}
          </li>
        ))}
      </ul>
    </div>
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
      {step.choices.map((choice, index) => (
        <button
          key={choice.value}
          type="button"
          disabled={!active || submitting}
          // Out of the tab order once settled. Otherwise a keyboard user tabs
          // through every question they have already answered before reaching
          // the one waiting for them.
          tabIndex={active && !submitting ? undefined : -1}
          onClick={() => onChoice(choice.value, choice.label)}
          style={{ animationDelay: `${index * 70}ms` }}
          className={cn(
            "group animate-ai-message-in flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-all duration-200",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            active && !submitting
              ? "cursor-pointer hover:-translate-y-0.5 hover:border-ai-2/50 hover:bg-gradient-to-r hover:from-ai-1/5 hover:to-ai-3/5 hover:shadow-lg hover:shadow-ai-2/10"
              : "cursor-not-allowed opacity-55"
          )}
        >
          <span
            aria-hidden
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-colors",
              active && !submitting
                ? "bg-ai-2/10 text-ai-2 group-hover:ai-gradient group-hover:text-white"
                : "bg-muted text-muted-foreground"
            )}
          >
            {String.fromCharCode(65 + index)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
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
          </span>
          {active && !submitting && (
            <ChevronRight
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-ai-2"
            />
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
    <div className="animate-ai-message-in flex items-end justify-end gap-2">
      <p className="ai-gradient max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-line text-white shadow-md shadow-ai-2/20">
        {text}
      </p>
      <span
        aria-hidden
        className="hidden size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border sm:inline-flex"
      >
        <UserRound className="size-3.5" />
      </span>
    </div>
  )
}

const THINKING_LINES = [
  "Checking stock on hand…",
  "Looking at open repairs…",
  "Working out months of cover…",
  "Checking other plants…",
]

/** The assistant is working. Shown in place of a step, never over one. */
export function ThinkingIndicator() {
  const [line, setLine] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setLine((n) => (n + 1) % THINKING_LINES.length), 1600)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="animate-ai-message-in flex items-center gap-3" role="status">
      <AiOrb size="md" thinking className="hidden sm:inline-flex" />
      <div className="flex items-center gap-3 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-sm">
        <span aria-hidden className="flex items-center gap-1">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="ai-gradient animate-ai-typing size-1.5 rounded-full"
              style={{ animationDelay: `${dot * 160}ms` }}
            />
          ))}
        </span>
        {/* Announced once as "Working…"; the rotating line is visual only, so
            a screen reader is not read a new sentence every 1.6 seconds. */}
        <span className="sr-only">Working…</span>
        <span
          key={line}
          aria-hidden
          className="animate-ai-fade text-xs text-muted-foreground"
        >
          {THINKING_LINES[line]}
        </span>
      </div>
    </div>
  )
}

function InlineError({ message }: { message: string }) {
  return (
    <p
      className="animate-ai-pop flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
      role="alert"
    >
      <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      {message}
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
      className="animate-ai-message-in flex flex-col items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3"
      role="alert"
    >
      <p className="flex items-start gap-2 text-sm whitespace-pre-line text-foreground">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        {message}
      </p>
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
