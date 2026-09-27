import { describe, expect, it } from "vitest"

import type { ApiJustification } from "@/lib/api/assistant"
import {
  fromActConfirmation,
  fromAssistant,
  kindLabel,
  mergeJustifications,
  sourceLabel,
  type ActConfirmationEntry,
} from "@/lib/assistant/justifications"

import traceI08 from "@/lib/api/__fixtures__/17-session-trace-i08.json"

/** A real assistant justification, lifted from a generated session trace. */
const REAL = (
  traceI08 as unknown as { justifications: ApiJustification[] }
).justifications[0]

function actEntry(
  overrides: Partial<ActConfirmationEntry> = {}
): ActConfirmationEntry {
  return {
    exceptionId: "EXC-0001",
    exceptionType: "PLAN_BREACH",
    material: "1000000123",
    plant: "1300",
    ownerRequesterId: "MILLERJ",
    reasonCategory: "SHUTDOWN_MOVED",
    freeText: "The August shutdown slipped to September.",
    actorId: "MILLERJ",
    submittedAt: "2026-09-02T08:00:00Z",
    ...overrides,
  }
}

describe("fromAssistant", () => {
  it("maps a real justification off the wire", () => {
    const unified = fromAssistant(REAL)
    expect(unified.source).toBe("ASSISTANT")
    expect(unified.kind).toBe("NEW_ACQUISITION")
    expect(unified.material).toBe(REAL.materialId)
    expect(unified.freeText).toBe(REAL.freeText)
    expect(unified.sessionId).toBe(REAL.sessionId)
  })

  it("carries the session id, which is what links it to the advice", () => {
    // Without this the record says somebody gave a reason but not what they
    // were told at the time, which is half the evidence.
    expect(fromAssistant(REAL).sessionId).toBeTruthy()
  })
})

describe("fromActConfirmation", () => {
  it("namespaces the id so it cannot collide with a justification id", () => {
    // The two come from different sequences. An unnamespaced collision would
    // make React reuse one row's DOM for the other.
    expect(fromActConfirmation(actEntry()).id).toBe("act:EXC-0001")
  })

  it("is labelled as the later, chased-up source", () => {
    const unified = fromActConfirmation(actEntry())
    expect(unified.source).toBe("EXCEPTION_QUEUE")
    expect(unified.sessionId).toBeNull()
    expect(unified.exceptionId).toBe("EXC-0001")
  })
})

describe("mergeJustifications", () => {
  it("includes both sources — the bug this module exists to fix", () => {
    // The dashboard read only ACT confirmations, so every reason captured at
    // the moment of the decision was missing from the screen built to show
    // them.
    const merged = mergeJustifications([REAL], [actEntry()])
    expect(merged).toHaveLength(2)
    expect(merged.map((m) => m.source).sort()).toEqual([
      "ASSISTANT",
      "EXCEPTION_QUEUE",
    ])
  })

  it("orders newest first across both sources", () => {
    const older = actEntry({
      exceptionId: "EXC-OLD",
      submittedAt: "2020-01-01T00:00:00Z",
    })
    const newer = actEntry({
      exceptionId: "EXC-NEW",
      submittedAt: "2099-01-01T00:00:00Z",
    })
    const merged = mergeJustifications([REAL], [older, newer])
    expect(merged[0].id).toBe("act:EXC-NEW")
    expect(merged[merged.length - 1].id).toBe("act:EXC-OLD")
  })

  it("does not dedupe, because the two tables are disjoint", () => {
    // Only the assistant writes the shared table; the ACT confirmation route
    // writes nowhere near it. Two entries about the same material are two
    // real events, not one counted twice.
    const merged = mergeJustifications(
      [REAL],
      [actEntry({ material: REAL.materialId, plant: REAL.plant })]
    )
    expect(merged).toHaveLength(2)
  })

  it("handles either side being empty", () => {
    expect(mergeJustifications([], [])).toEqual([])
    expect(mergeJustifications([REAL], [])).toHaveLength(1)
    expect(mergeJustifications([], [actEntry()])).toHaveLength(1)
  })
})

describe("labels", () => {
  it("names each kind in words a planner would use", () => {
    expect(kindLabel("NEW_ACQUISITION")).toBe("Bought new anyway")
    expect(kindLabel("QUANTITY_OVERRIDE")).toBe("Kept a larger quantity")
    expect(kindLabel("PLAN_BREACH")).toBe("Plan breached")
    expect(kindLabel("NO_PLAN")).toBe("No plan given")
  })

  it("renders an unknown kind readably rather than hiding it", () => {
    // A new exception type on the backend should appear as itself, not vanish
    // from a compliance log.
    expect(kindLabel("SOMETHING_NEW")).toBe("something new")
  })

  it("distinguishes when the reason was given", () => {
    expect(sourceLabel("ASSISTANT")).toBe("at reservation time")
    expect(sourceLabel("EXCEPTION_QUEUE")).toBe("chasing an exception")
  })
})
