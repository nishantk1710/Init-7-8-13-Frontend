import { describe, expect, it } from "vitest"

import type { ApiStep } from "@/lib/api/assistant"
import {
  appendAnswer,
  startTranscript,
  summariseAnswer,
  summariseFormSubmission,
  transcriptFromTurns,
} from "@/lib/assistant/transcript"

import traceI13 from "@/lib/api/__fixtures__/16-session-trace-i13.json"

function step(overrides: Partial<ApiStep> = {}): ApiStep {
  return {
    id: "i13_assessment",
    kind: "choice",
    prompt: "Go ahead?",
    choices: [],
    fields: [],
    facts: null,
    footnote: null,
    sessionId: null,
    ...overrides,
  }
}

describe("startTranscript", () => {
  it("opens with the first step active", () => {
    const transcript = startTranscript(step())
    expect(transcript.entries).toHaveLength(1)
    expect(transcript.entries[0]).toMatchObject({ kind: "step", active: true })
    expect(transcript.current).not.toBeNull()
  })

  it("is empty when there is no step, which is the out-of-scope case", () => {
    const transcript = startTranscript(null)
    expect(transcript.entries).toEqual([])
    expect(transcript.current).toBeNull()
  })
})

describe("appendAnswer", () => {
  it("appends the echo and the next step, and settles the old one", () => {
    const first = startTranscript(step())
    const next = appendAnswer(first, "Yes — continue", step({ id: "i13_capture_plan", kind: "form" }))

    expect(next.entries.map((e) => e.kind)).toEqual(["step", "answer", "step"])
    expect(next.entries[0]).toMatchObject({ active: false })
    expect(next.entries[2]).toMatchObject({ active: true })
  })

  it("never mutates the transcript it was given", () => {
    // The transcript is append-only for the same reason the tables behind it
    // are: what is on screen and what is in `assistant_turn` must not be able
    // to drift apart.
    const first = startTranscript(step())
    const snapshot = JSON.stringify(first)
    appendAnswer(first, "x", step({ id: "b" }))
    expect(JSON.stringify(first)).toBe(snapshot)
  })

  it("ends the conversation on a terminal step", () => {
    const first = startTranscript(step())
    const next = appendAnswer(first, "No", step({ id: "i13_done", kind: "terminal" }))

    expect(next.current).toBeNull()
    expect(next.entries[2]).toMatchObject({ active: false })
  })

  it("leaves no two steps active, even after several turns", () => {
    let transcript = startTranscript(step())
    transcript = appendAnswer(transcript, "a", step({ id: "two" }))
    transcript = appendAnswer(transcript, "b", step({ id: "three" }))

    const active = transcript.entries.filter(
      (entry) => entry.kind === "step" && entry.active
    )
    expect(active).toHaveLength(1)
  })

  it("gives every entry a distinct key, even when a step id repeats", () => {
    let transcript = startTranscript(step({ id: "same" }))
    transcript = appendAnswer(transcript, "a", step({ id: "same" }))
    transcript = appendAnswer(transcript, "b", step({ id: "same" }))

    const keys = transcript.entries.map((entry) => entry.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe("transcriptFromTurns", () => {
  it("rebuilds a recorded conversation, question and answer alternating", () => {
    const turns = (traceI13 as unknown as { turns: Parameters<typeof transcriptFromTurns>[0] })
      .turns
    const entries = transcriptFromTurns(turns)

    // Four answered turns plus a terminal with a null answer: five questions,
    // four echoes.
    expect(entries.filter((e) => e.kind === "step")).toHaveLength(5)
    expect(entries.filter((e) => e.kind === "answer")).toHaveLength(4)
  })

  it("marks every rebuilt step settled — a recorded turn cannot be re-answered", () => {
    const turns = (traceI13 as unknown as { turns: Parameters<typeof transcriptFromTurns>[0] })
      .turns
    const entries = transcriptFromTurns(turns)
    expect(
      entries.every((entry) => entry.kind !== "step" || entry.active === false)
    ).toBe(true)
  })

  it("does not invent an echo for a terminal turn, which has no answer", () => {
    const entries = transcriptFromTurns([
      { stepId: "done", stepKind: "terminal", question: "Finished.", answer: null },
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe("step")
  })
})

describe("summariseAnswer", () => {
  it("shows a choice by its recorded value, not an invented label", () => {
    // Only the value was recorded. Reconstructing the wording the planner saw
    // is exactly the kind of plausible fabrication an audit trail must not do.
    expect(summariseAnswer({ choice: "keep_requested" })).toBe("keep_requested")
  })

  it("lists a form's answers as key/value pairs", () => {
    expect(
      summariseAnswer({ reason_category: "URGENT_BREAKDOWN", free_text: "Line down." })
    ).toBe("reason_category: URGENT_BREAKDOWN · free_text: Line down.")
  })

  it("skips empty values rather than printing a dangling key", () => {
    expect(summariseAnswer({ purpose: "x", cost_centre: "" })).toBe("purpose: x")
  })

  it("says so plainly when an answer carried nothing", () => {
    expect(summariseAnswer({})).toBe("(no answer)")
  })
})

describe("summariseFormSubmission", () => {
  const fields = [
    { name: "purpose", label: "What it is for" },
    { name: "cost_centre", label: "Cost centre" },
  ]

  it("echoes labels rather than field names, because a person is reading it", () => {
    expect(
      summariseFormSubmission(fields, { purpose: "Seal job", cost_centre: "1300-MNT" })
    ).toBe("What it is for: Seal job · Cost centre: 1300-MNT")
  })

  it("omits the fields left blank", () => {
    expect(summariseFormSubmission(fields, { purpose: "Seal job", cost_centre: "" })).toBe(
      "What it is for: Seal job"
    )
  })
})
