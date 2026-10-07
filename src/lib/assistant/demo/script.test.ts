import { describe, expect, it } from "vitest"

import { ApiError } from "@/lib/api/client"
import type { ApiStep, StartSessionRequest } from "@/lib/api/assistant"
import startI13Fixture from "@/lib/api/__fixtures__/04-start-i13-choice.json"
import traceI13Fixture from "@/lib/api/__fixtures__/16-session-trace-i13.json"
import { DEMO_OAR, DEMO_REPAIRABLE, searchDemoMaterials } from "@/lib/assistant/demo/catalogue"
import {
  FIXTURE_SESSION_IDS,
  answerDemoRun,
  linkDemoReservation,
  outcomeOf,
  seededRuns,
  startDemoRun,
  summaryOf,
  traceOf,
  type DemoRun,
} from "@/lib/assistant/demo/script"

const NOW = "2026-10-05T09:00:00.000Z"
const ID = "D7K2M4P8QW"

function open(material = DEMO_REPAIRABLE, extra: Partial<StartSessionRequest> = {}) {
  return startDemoRun(
    {
      materialId: material.materialId,
      plant: material.plant,
      requestedFor: "T. Mokoena",
      department: "Concentrator",
      ...extra,
    },
    { sessionId: ID, now: NOW }
  )
}

/** Walk a run through a list of answers, returning every step served. */
function walk(run: DemoRun, answers: Record<string, unknown>[]) {
  const steps: ApiStep[] = [run.current]
  let current = run
  for (const answer of answers) {
    const result = answerDemoRun(current, answer, NOW)
    current = result.run
    steps.push(result.response.step)
  }
  return { run: current, steps }
}

/** The sentence a refusal carries -- in `detail`, as a live 422 does. */
function refusal(attempt: () => unknown): string {
  try {
    attempt()
  } catch (caught) {
    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as ApiError).status).toBe(422)
    return (caught as ApiError).detailText()
  }
  throw new Error("expected the answer to be refused")
}

const PLAN = {
  purpose: "Gearbox seal for the August shutdown.",
  planned_quantity: "5",
  window_start: "2026-08-10",
  window_end: "2026-08-21",
}
const REASON = { reason_category: "URGENT_BREAKDOWN", free_text: "Mill 3 is down." }

const PATHS: Record<string, { material: typeof DEMO_REPAIRABLE; answers: Record<string, unknown>[] }> = {
  "I08 use existing": { material: DEMO_REPAIRABLE, answers: [{ choice: "use_existing" }] },
  "I08 proceed and justify": {
    material: DEMO_REPAIRABLE,
    answers: [{ choice: "proceed_new" }, REASON],
  },
  "I13 not needed": { material: DEMO_OAR, answers: [{ choice: "not_needed" }] },
  "I13 accept suggestion": {
    material: DEMO_OAR,
    answers: [{ choice: "proceed" }, PLAN, { choice: "accept_suggested" }],
  },
  "I13 keep and justify": {
    material: DEMO_OAR,
    answers: [{ choice: "proceed" }, PLAN, { choice: "keep_requested" }, REASON],
  },
}

describe("the demo script", () => {
  it.each(Object.entries(PATHS))("%s ends on a terminal step", (_, path) => {
    const { run } = open(path.material)
    const { steps, run: finished } = walk(run!, path.answers)
    expect(steps.at(-1)?.kind).toBe("terminal")
    expect(outcomeOf(finished, NOW)).toBe("COMPLETED")
  })

  it("serves every fixture-backed step at least once", () => {
    const seen = new Set<string>()
    for (const path of Object.values(PATHS)) {
      const { run } = open(path.material)
      for (const step of walk(run!, path.answers).steps) seen.add(step.id)
    }
    expect([...seen].sort()).toEqual(
      [
        "i08_assessment",
        "i08_justification",
        "i08_done",
        "i13_assessment",
        "i13_capture_plan",
        "i13_quantity",
        "i13_quantity_justification",
        "i13_done",
      ].sort()
    )
  })

  it("never shows a fixture's session ID, at any depth", () => {
    for (const path of Object.values(PATHS)) {
      const { run, response } = open(path.material)
      const { run: finished, steps } = walk(run!, path.answers)
      const everything = JSON.stringify([response, steps, traceOf(finished, NOW)])
      for (const fixtureId of FIXTURE_SESSION_IDS) expect(everything).not.toContain(fixtureId)
      expect(everything).toContain(ID)
    }
  })

  it("serves every key the live routes serve", () => {
    const { run, response } = open(DEMO_OAR)
    expect(Object.keys(response).sort()).toEqual(Object.keys(startI13Fixture).sort())
    const { run: finished } = walk(run!, PATHS["I13 keep and justify"].answers)
    const trace = traceOf(finished, NOW)
    for (const key of Object.keys(traceI13Fixture)) expect(trace).toHaveProperty(key)
    for (const key of Object.keys(traceI13Fixture.turns[0])) expect(trace.turns[0]).toHaveProperty(key)
    for (const key of Object.keys(traceI13Fixture.plans[0])) expect(trace.plans[0]).toHaveProperty(key)
  })

  it("treats a material that is not a demo one as out of scope", () => {
    const { run, response } = startDemoRun(
      { materialId: "2000000456", plant: "1300" },
      { sessionId: ID, now: NOW }
    )
    expect(run).toBeNull()
    expect(response.sessionId).toBeNull()
    expect(response.routing.flow).toBe("none")
    expect(response.routing.reason).toBe("Material 2000000456 was not found at plant 1300.")
  })

  it("refuses a bad answer as a 422 with a sentence", () => {
    const { run } = open(DEMO_REPAIRABLE)
    expect(refusal(() => answerDemoRun(run!, { choice: "maybe" }, NOW))).toContain(
      "choice must be one of"
    )
  })

  it("asks how many will be procured on the plan form", () => {
    const { run } = open(DEMO_OAR)
    const { response } = answerDemoRun(run!, { choice: "proceed" }, NOW)
    const quantity = response.step.fields.find((f) => f.name === "planned_quantity")
    expect(quantity?.label).toBe("How many you plan to procure")
  })

  it("refuses an inverted plan window and a non-positive quantity", () => {
    const { run } = open(DEMO_OAR)
    const atPlan = answerDemoRun(run!, { choice: "proceed" }, NOW).run
    expect(
      refusal(() =>
        answerDemoRun(atPlan, { ...PLAN, window_start: "2026-08-21", window_end: "2026-08-10" }, NOW)
      )
    ).toMatch(/ends .* before it starts/)
    expect(refusal(() => answerDemoRun(atPlan, { ...PLAN, planned_quantity: "0" }, NOW))).toMatch(
      /greater than zero/
    )
  })

  it("refuses an answer to a finished session", () => {
    const { run } = open(DEMO_REPAIRABLE)
    const done = walk(run!, [{ choice: "use_existing" }]).run
    expect(refusal(() => answerDemoRun(done, { choice: "use_existing" }, NOW))).toMatch(
      /already finished/
    )
  })
})

describe("what the trace replays", () => {
  it("is what the presenter typed, not the fixture's text", () => {
    const { run } = open(DEMO_REPAIRABLE)
    const typed = { reason_category: "OTHER", free_text: "Typed during the demo." }
    const trace = traceOf(walk(run!, [{ choice: "proceed_new" }, typed]).run, NOW)
    expect(trace.turns.map((t) => t.stepId)).toEqual([
      "i08_assessment",
      "i08_justification",
      "i08_done",
    ])
    expect(trace.turns[1].answer).toEqual(typed)
    expect(trace.justifications).toHaveLength(1)
    expect(trace.justifications[0]).toMatchObject({
      kind: "NEW_ACQUISITION",
      freeText: "Typed during the demo.",
      author: "T. Mokoena",
    })
    expect(trace.requestedFor).toBe("T. Mokoena")
    expect(trace.department).toBe("Concentrator")
  })

  it("quotes the planned quantity the presenter typed", () => {
    const { run } = open(DEMO_OAR)
    const { steps, run: finished } = walk(run!, [
      { choice: "proceed" },
      { ...PLAN, planned_quantity: "7" },
      { choice: "keep_requested" },
      REASON,
    ])
    const quantityStep = steps[2]
    expect(quantityStep.prompt).toContain("You planned 7.")
    expect(quantityStep.choices.find((c) => c.value === "keep_requested")?.label).toBe("Keep 7")
    expect(steps[3].prompt).toContain("why 7 is needed")
    expect(steps[4].prompt).toContain("Plan recorded at 7,")

    const trace = traceOf(finished, NOW)
    expect(trace.plans[0].plannedQuantity).toBe("7")
    expect(trace.quantitySuggestions[0]).toMatchObject({
      requestedQuantity: "7",
      acceptedQuantity: "7",
      isOverride: true,
    })
    expect(trace.justifications[0].kind).toBe("QUANTITY_OVERRIDE")
  })

  it("records the suggestion when it is accepted", () => {
    const { run } = open(DEMO_OAR)
    const trace = traceOf(
      walk(run!, [{ choice: "proceed" }, PLAN, { choice: "accept_suggested" }]).run,
      NOW
    )
    expect(trace.plans[0].plannedQuantity).toBe("1")
    expect(trace.quantitySuggestions[0]).toMatchObject({ acceptedQuantity: "1", isOverride: false })
    expect(trace.justifications).toHaveLength(0)
  })

  it("skips the quantity question for a plan at or under the suggestion", () => {
    const { run } = open(DEMO_OAR)
    const { steps } = walk(run!, [{ choice: "proceed" }, { ...PLAN, planned_quantity: "1" }])
    expect(steps.at(-1)).toMatchObject({ kind: "terminal", id: "i13_done" })
    expect(steps.at(-1)?.prompt).toContain(ID)
  })

  it("shows a simulated reservation as linked", () => {
    const { run } = open(DEMO_OAR)
    const done = walk(run!, [{ choice: "proceed" }, PLAN, { choice: "accept_suggested" }]).run
    const trace = traceOf(linkDemoReservation(done, "99000001", NOW), NOW)
    expect(trace.linkedReservations?.[0]).toMatchObject({ reservationNumber: "99000001", sgtxt: ID })
    expect(trace.plans[0].reservationNumber).toBe("99000001")
    expect(trace.linkageNote).toContain("Linked through")
  })

  it("is open until the window closes, then abandoned", () => {
    const { run } = open(DEMO_REPAIRABLE)
    expect(outcomeOf(run!, NOW)).toBe("OPEN")
    expect(outcomeOf(run!, "2026-10-07T09:00:00.000Z")).toBe("ABANDONED")
  })
})

describe("the seeded sessions", () => {
  it("are one finished session per flow, under demo IDs", () => {
    const runs = seededRuns()
    expect(runs.map((r) => r.flow).sort()).toEqual(["i08", "i13"])
    for (const run of runs) {
      expect(run.sessionId.startsWith("D")).toBe(true)
      expect(summaryOf(run, NOW).outcome).toBe("COMPLETED")
      const everything = JSON.stringify(traceOf(run, NOW))
      for (const fixtureId of FIXTURE_SESSION_IDS) expect(everything).not.toContain(fixtureId)
    }
  })
})

describe("the demo catalogue search", () => {
  it.each([
    ["pump", [DEMO_REPAIRABLE.materialId]],
    ["seal", [DEMO_OAR.materialId]],
    ["800000", [DEMO_REPAIRABLE.materialId]],
    ["0001000000123", [DEMO_OAR.materialId]],
    ["p", []],
    ["valve", []],
  ])("%s finds %j", (query, expected) => {
    expect(searchDemoMaterials(query).items.map((m) => m.materialId)).toEqual(expected)
  })
})
