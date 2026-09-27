/**
 * The conversation as a list of things to render.
 *
 * ## There is no cursor, here or anywhere
 *
 * The backend decides what comes next from the answers so far, every time
 * (`app/assistant/script.py::next_step`). It stores no "current step" and
 * neither does this. A cursor would be a mutable pointer into an immutable log
 * — a second source of truth that can disagree with the turns, on a record
 * whose entire value is that it cannot be rewritten.
 *
 * So the transcript is append-only too: a step arrives, the planner answers it,
 * the answer is appended, the next step is appended. Nothing is ever edited in
 * place, which means what is on screen and what is in `assistant_turn` cannot
 * drift apart.
 *
 * ## Why the echo bubble is synthesised rather than fetched
 *
 * After answering, the backend returns only the NEXT step. Re-fetching the
 * whole trace to show "you chose X" would cost a round trip to display
 * something the browser already knows. So the echo is built locally from the
 * choice's own label — optimistic for the echo, never for anything derived
 * from it. The next step is always the server's answer, never a guess.
 */

import type { ApiStep } from "@/lib/api/assistant"

/** One rendered row in the conversation. */
export type TranscriptEntry =
  | {
      kind: "step"
      /** Stable key: the step id plus its position, since a flow can revisit an id. */
      key: string
      step: ApiStep
      /** False once answered — a settled question must not stay clickable. */
      active: boolean
    }
  | {
      kind: "answer"
      key: string
      /** What the planner chose or typed, already in display form. */
      text: string
    }

/**
 * The transcript state. Steps and answers interleaved, in the order they
 * happened.
 */
export type Transcript = {
  entries: TranscriptEntry[]
  /** The step awaiting an answer, or null when the conversation has ended. */
  current: ApiStep | null
}

export function startTranscript(step: ApiStep | null): Transcript {
  if (step === null) return { entries: [], current: null }
  return {
    entries: [{ kind: "step", key: entryKey(step, 0), step, active: true }],
    current: step,
  }
}

/**
 * Record an answer to the current step and append whatever the server said next.
 *
 * `answerText` is what to echo back — a choice's label, or a short summary of a
 * form. `next` is the server's step; pass it exactly as received.
 */
export function appendAnswer(
  transcript: Transcript,
  answerText: string,
  next: ApiStep
): Transcript {
  const position = transcript.entries.length
  return {
    entries: [
      // Settle every open step. In practice only the last one is active, but
      // deriving it rather than assuming means a double-submit that slipped
      // through cannot leave two live questions on screen.
      ...transcript.entries.map((entry) =>
        entry.kind === "step" ? { ...entry, active: false } : entry
      ),
      { kind: "answer" as const, key: `answer-${position}`, text: answerText },
      {
        kind: "step" as const,
        key: entryKey(next, position + 1),
        step: next,
        active: next.kind !== "terminal",
      },
    ],
    current: next.kind === "terminal" ? null : next,
  }
}

/**
 * Rebuild a transcript from a session that was already recorded.
 *
 * Used when reopening a session by reference rather than starting one. The
 * questions and answers come from `assistant_turn`, which is the same data the
 * live path produced — the trace and the conversation are the same object, so
 * a reopened session reads identically to a live one.
 */
export function transcriptFromTurns(
  turns: readonly {
    stepId: string
    stepKind: string
    question: string
    answer: Record<string, unknown> | null
  }[]
): TranscriptEntry[] {
  const entries: TranscriptEntry[] = []
  turns.forEach((turn, index) => {
    entries.push({
      kind: "step",
      key: `${turn.stepId}-${index}`,
      // A recorded turn holds the question text but not the full step, and
      // rebuilding a fake step with empty choices would render a question with
      // no visible options. Carrying it as a message is honest: this one has
      // already been answered, and the answer is the next entry.
      step: {
        id: turn.stepId,
        kind: "message",
        prompt: turn.question,
        choices: [],
        fields: [],
        facts: null,
        footnote: null,
        sessionId: null,
      },
      active: false,
    })
    if (turn.answer !== null) {
      entries.push({
        kind: "answer",
        key: `answer-${turn.stepId}-${index}`,
        text: summariseAnswer(turn.answer),
      })
    }
  })
  return entries
}

/**
 * A recorded answer as one readable line.
 *
 * A choice shows its raw value rather than its label, because the label was not
 * recorded — only the value was, and inventing the wording the planner saw is
 * exactly the kind of plausible reconstruction an audit trail should not do.
 */
export function summariseAnswer(answer: Record<string, unknown>): string {
  if (typeof answer.choice === "string") return answer.choice
  const parts = Object.entries(answer)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}: ${String(value)}`)
  return parts.length > 0 ? parts.join(" · ") : "(no answer)"
}

/** A short echo for a form the planner just submitted. */
export function summariseFormSubmission(
  fields: readonly { name: string; label: string }[],
  values: Record<string, string>
): string {
  const parts = fields
    .map((field) => [field.label, (values[field.name] ?? "").trim()] as const)
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => `${label}: ${value}`)
  return parts.length > 0 ? parts.join(" · ") : "(submitted)"
}

function entryKey(step: ApiStep, position: number): string {
  return `${step.id}-${position}`
}
