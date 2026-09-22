import { describe, expect, it } from "vitest"

import { ApiError } from "@/lib/api/client"
import { conformsToWire } from "@/lib/api/wire-shape"
import {
  factsCaveats,
  factsHeadline,
  isI08Facts,
  isI13Facts,
  type I08Facts,
  type I13Facts,
} from "@/lib/api/assistant-facts"
import type {
  AnswerResponse,
  SessionTraceResponse,
  StartSessionResponse,
} from "@/lib/api/assistant"

import startI08 from "./__fixtures__/01-start-i08-choice.json"
import startI08TwoRepairs from "./__fixtures__/02-start-i08-two-open-repairs.json"
import startI08Nothing from "./__fixtures__/03-start-i08-nothing-to-challenge.json"
import startI13 from "./__fixtures__/04-start-i13-choice.json"
import startI08StockOnly from "./__fixtures__/18-start-i08-stock-only-no-due-date.json"
import startOutOfScope from "./__fixtures__/05-start-out-of-scope.json"
import answerI08ProceedNew from "./__fixtures__/07-answer-i08-proceed-new.json"
import answerI13Proceed from "./__fixtures__/10-answer-i13-proceed.json"
import answerI13Keep from "./__fixtures__/13-answer-i13-keep-requested.json"
import traceI13 from "./__fixtures__/16-session-trace-i13.json"
import traceI08 from "./__fixtures__/17-session-trace-i08.json"

/**
 * The contract test for `/api/assistant/*`.
 *
 * Every fixture here was produced by running the backend's own pydantic models
 * (see `__fixtures__/README.md`), so a failure in this file means one of two
 * things and never a third: either the backend contract moved, or the types in
 * `lib/api/assistant.ts` were written wrong. It cannot mean the fixture is
 * unrealistic.
 *
 * `conformsToWire` is the point of half these tests. It is a genuine
 * compile-time assertion: `npx tsc --noEmit` fails if a fixture's shape and
 * the declared type have diverged, whether or not the runtime expectations
 * below still pass. See `lib/api/wire-shape.ts` for why a plain
 * `as unknown as` cast — which is what this file used at first — checks
 * nothing, and for the shipped bug that slipped through because of it.
 */

describe("StartSessionResponse", () => {
  it("types an I08 start against the real payload", () => {
    const response: StartSessionResponse =
      conformsToWire<StartSessionResponse>(startI08)

    expect(response.routing.flow).toBe("i08")
    expect(response.sessionId).toBeTruthy()
    expect(response.step?.kind).toBe("choice")
  })

  it("carries the losing flow on a material that is both", () => {
    // 97.6% of 80-series rows are also OAR, so `alsoMatched` is populated on
    // nearly every I08 session. It is recorded so the tie-break stays
    // reviewable rather than looking arbitrary, and the UI is expected to show
    // it. A test pins it because "nearly always present" is exactly the kind of
    // field that gets dropped as noise.
    const response = conformsToWire<StartSessionResponse>(startI08)
    expect(response.routing.alsoMatched).toBe("i13")
    expect(response.routing.reason).toContain("precedence")
  })

  it("an out-of-scope material is a 200 with everything null, not an error", () => {
    // The single most likely thing for a frontend to get wrong here. Rendering
    // this as a failure tells a planner something broke when in fact the
    // assistant simply has no opinion about a consumable.
    const response = conformsToWire<StartSessionResponse>(startOutOfScope)

    expect(response.routing.flow).toBe("none")
    expect(response.sessionId).toBeNull()
    expect(response.expiresAt).toBeNull()
    expect(response.step).toBeNull()
    // ...and the reason is a sentence fit to show, not a code.
    expect(response.routing.reason.length).toBeGreaterThan(20)
  })

  it("goes straight to terminal when there is nothing to challenge", () => {
    // No repairable unit exists, so asking "are you sure?" would be theatre,
    // and a question with one sensible answer trains people to click through
    // the next one.
    const response = conformsToWire<StartSessionResponse>(startI08Nothing)
    expect(response.step?.kind).toBe("terminal")
    expect(response.step?.sessionId).toBeTruthy()
  })

  it("only a terminal step carries sessionId; the others leave it null", () => {
    const openStep = (conformsToWire<StartSessionResponse>(startI08)).step
    const terminalStep = (conformsToWire<StartSessionResponse>(startI08Nothing)).step

    expect(openStep?.kind).not.toBe("terminal")
    expect(openStep?.sessionId).toBeNull()
    expect(terminalStep?.sessionId).not.toBeNull()
  })
})

describe("I08 facts", () => {
  const facts = (conformsToWire<StartSessionResponse>(startI08)).step!.facts

  it("narrows on the flow discriminator", () => {
    expect(isI08Facts(facts)).toBe(true)
    expect(isI13Facts(facts)).toBe(false)
  })

  it("sends every decimal as a string, never a number", () => {
    // A Decimal through a JSON number returns 2.1 as 2.0999999999999996, and
    // these values reach an append-only table a compliance engine reads.
    const typed = facts as I08Facts
    expect(typeof typed.stockOnHand).toBe("string")
    expect(typeof typed.quantityUnderRepair).toBe("string")
    expect(typeof typed.openRepairs[0].quantity).toBe("string")
  })

  it("sends counts as real numbers", () => {
    const typed = facts as I08Facts
    expect(typeof typed.openRepairLines).toBe("number")
    expect(typeof typed.overdueLines).toBe("number")
  })

  it("leaves waitingBeatsBuying null on an overdue repair", () => {
    // The worst bug the backend found, and the reason this field is three-state.
    // An overdue repair has a due date in the PAST, so comparing it against a
    // delivery lead time finds it "sooner" and would recommend waiting for a
    // unit that is already 61 days late with no new forecast. 695 of the 788
    // open repair lines in this extract are overdue, so a UI that renders null
    // as "no" is wrong on 88% of them, and one that renders it as "yes" is
    // wrong in the direction that keeps a machine down.
    const typed = facts as I08Facts
    expect(typed.overdueLines).toBeGreaterThan(0)
    expect(typed.repairDueDateIsReliable).toBe(false)
    expect(typed.waitingBeatsBuying).toBeNull()
  })

  it("leaves repairDueDateIsReliable null when there is no date at all", () => {
    // The third state, and the one that shipped wrong. A part sitting on the
    // shelf with no repair on order has no due date to be reliable ABOUT, so
    // the backend sends null rather than false. The field was typed `boolean`,
    // so the card's falsy check rendered a red "no longer a forecast" against
    // a part that had missed no deadline because none was ever set.
    //
    // `conformsToWire` on this fixture is what now catches the type; this
    // expectation is what catches a consumer going back to a falsy check.
    const stockOnly = conformsToWire<StartSessionResponse>(startI08StockOnly)
    const typed = stockOnly.step!.facts as I08Facts

    expect(typed.repairableUnitExists).toBe(true)
    expect(typed.sources).toContain("STOCK")
    expect(typed.openRepairLines).toBe(0)
    expect(typed.soonestDueDate).toBeNull()
    expect(typed.repairDueDateIsReliable).toBeNull()
    // ...and it is a real rendered card, not a terminal step nobody sees.
    expect(stockOnly.step!.kind).toBe("choice")
  })

  it("never claims the vendor physically has the unit", () => {
    // Zero of the open repair lines carry a dispatch movement, so no line can
    // be confirmed as with the vendor. The assistant says "on order and due
    // back", which is true.
    const typed = facts as I08Facts
    expect(typed.openRepairs.every((r) => r.dispatched === false)).toBe(true)
  })

  it("leaves an uncovered vendor unnamed rather than inventing one", () => {
    // 106 vendors against 454 service suppliers. Show the code; do not guess.
    const twoRepairs = (conformsToWire<StartSessionResponse>(startI08TwoRepairs))
      .step!.facts as I08Facts
    const unnamed = twoRepairs.openRepairs.filter((r) => r.vendorName === null)
    expect(unnamed.length).toBeGreaterThan(0)
    expect(unnamed[0].vendor).toBeTruthy()
  })
})

describe("I13 facts", () => {
  const facts = (conformsToWire<StartSessionResponse>(startI13)).step!.facts

  it("narrows on the flow discriminator", () => {
    expect(isI13Facts(facts)).toBe(true)
    expect(isI08Facts(facts)).toBe(false)
  })

  it("names the material `material`, not `materialId` as I08 does", () => {
    // The two flows genuinely differ here. Reading `materialId` off I13 facts
    // yields undefined, and a card rendering an empty material code looks like
    // a data gap rather than a typo.
    const typed = facts as I13Facts
    expect(typed.material).toBeTruthy()
    expect((typed as unknown as Record<string, unknown>).materialId).toBeUndefined()
  })

  it("sends cover and stock figures as strings", () => {
    const typed = facts as I13Facts
    expect(typeof typed.stockOnHand).toBe("string")
    expect(typeof typed.monthsOfCover).toBe("string")
    expect(typeof typed.openPoQuantity).toBe("string")
  })

  it("lists cross-plant stock only where there is some", () => {
    // "Other plants hold 0 at 1500" announces that stock exists elsewhere and
    // then says it does not. Filtered server-side; pinned here so a future
    // change to that filter is visible.
    const typed = facts as I13Facts
    expect(typed.crossPlantStock.length).toBeGreaterThan(0)
    expect(
      typed.crossPlantStock.every((s) => Number(s.stockOnHand) > 0)
    ).toBe(true)
  })
})

describe("facts helpers survive a shape they do not know", () => {
  it("reads the headline off an unrecognised flow", () => {
    const future = { flow: "i99", headline: "Something new.", caveats: ["a"] }
    expect(isI08Facts(future)).toBe(false)
    expect(isI13Facts(future)).toBe(false)
    expect(factsHeadline(future)).toBe("Something new.")
    expect(factsCaveats(future)).toEqual(["a"])
  })

  it("does not throw on null, a string, or an array", () => {
    for (const bad of [null, undefined, "nope", [1, 2], 7]) {
      expect(factsHeadline(bad)).toBeNull()
      expect(factsCaveats(bad)).toEqual([])
      expect(isI08Facts(bad)).toBe(false)
    }
  })
})

describe("form steps", () => {
  it("names its fields in snake_case inside a camelCase envelope", () => {
    // The envelope is camelCase (`helpText`), but `name` is the key the answer
    // is posted under and it is snake_case, because it is a data key rather
    // than a model field and the alias generator never touches it. Posting
    // `plannedQuantity` silently captures nothing.
    const step = (conformsToWire<AnswerResponse>(answerI13Proceed)).step
    expect(step.kind).toBe("form")

    const names = step.fields.map((f) => f.name)
    expect(names).toContain("planned_quantity")
    expect(names).toContain("window_start")
    expect(names).toContain("window_end")
    expect(names).not.toContain("plannedQuantity")

    // ...while the field model itself is camelCase.
    expect(step.fields[0]).toHaveProperty("helpText")
  })

  it("defaults a quantity as a string", () => {
    const step = (conformsToWire<AnswerResponse>(answerI13Proceed)).step
    const quantity = step.fields.find((f) => f.name === "planned_quantity")!
    expect(quantity.type).toBe("number")
    expect(typeof quantity.default).toBe("string")
  })

  it("marks the optional plan fields optional", () => {
    // "Where known" — never inferred, never required. A required cost centre
    // would be filled with a guess.
    const step = (conformsToWire<AnswerResponse>(answerI13Proceed)).step
    const optional = ["window_start", "window_end", "cost_centre", "order_number"]
    for (const name of optional) {
      expect(step.fields.find((f) => f.name === name)!.required).toBe(false)
    }
    expect(step.fields.find((f) => f.name === "purpose")!.required).toBe(true)
  })

  it("builds the reason picker from configuration, with options attached", () => {
    // Neither FRS lists the categories, so they are configuration rather than
    // an enum. The UI must render `options` and never hold its own list.
    const step = (conformsToWire<AnswerResponse>(answerI08ProceedNew)).step
    expect(step.kind).toBe("form")

    const reason = step.fields.find((f) => f.name === "reason_category")!
    expect(reason.type).toBe("select")
    expect(reason.options.length).toBeGreaterThan(0)
    expect(reason.options[0]).toHaveProperty("value")
    expect(reason.options[0]).toHaveProperty("label")

    expect(step.fields.find((f) => f.name === "free_text")!.type).toBe("textarea")
  })
})

describe("choice steps", () => {
  it("offers a described option per branch", () => {
    const step = (conformsToWire<StartSessionResponse>(startI08)).step!
    expect(step.choices.map((c) => c.value)).toEqual([
      "use_existing",
      "proceed_new",
    ])
    // The description is where "you will be asked why" is said. Dropping it
    // makes the recorded justification a surprise.
    expect(step.choices.every((c) => (c.description ?? "").length > 0)).toBe(true)
  })

  it("puts the caveats in footnote, not folded into the prompt", () => {
    const step = (conformsToWire<StartSessionResponse>(startI08)).step!
    const facts = step.facts as I08Facts
    expect(step.footnote).toBe(facts.caveats.join("\n"))
  })

  it("offers the override branch on a quantity suggestion", () => {
    const step = (conformsToWire<AnswerResponse>(answerI13Keep)).step
    expect(step.kind).toBe("form")
    expect(step.fields.map((f) => f.name)).toContain("reason_category")
  })
})

describe("SessionTraceResponse", () => {
  it("types an I08 trace, justification included", () => {
    const trace: SessionTraceResponse =
      conformsToWire<SessionTraceResponse>(traceI08)

    expect(trace.outcome).toBe("COMPLETED")
    expect(trace.turns.length).toBeGreaterThan(0)
    expect(trace.justifications[0].kind).toBe("NEW_ACQUISITION")
    expect(trace.justifications[0].author).toBe(trace.requester)
  })

  it("replays the assessment as served, narrowable like a step's facts", () => {
    const trace = conformsToWire<SessionTraceResponse>(traceI08)
    expect(isI08Facts(trace.assessment)).toBe(true)
    expect(factsHeadline(trace.assessment)).toBeTruthy()
  })

  it("keys turns by stepId and orders them by sequence", () => {
    // Keying by id rather than position means a script that gains a step in the
    // middle does not misread conversations recorded before it existed — which
    // matters, because those turns cannot be rewritten.
    const trace = conformsToWire<SessionTraceResponse>(traceI08)
    const sequences = trace.turns.map((t) => t.sequence)
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b))
    expect(trace.turns.every((t) => t.stepId.length > 0)).toBe(true)
  })

  it("carries a plan with no reservation number, and says why in words", () => {
    // The normal state, not a gap: the assistant runs while the reservation is
    // being created. When `Bednr` lands on ReservationItemSet (B2) this
    // expectation flips, and that is the moment to wire the link.
    const trace = conformsToWire<SessionTraceResponse>(traceI13)
    expect(trace.plans.length).toBeGreaterThan(0)
    expect(trace.plans[0].reservationNumber).toBeNull()
    expect(trace.plans[0].status).toBe("OPEN")
    expect(trace.linkageNote.length).toBeGreaterThan(20)
  })

  it("keeps a quantity suggestion arguable by carrying its parameters", () => {
    // Cover ceiling, look-back and minimum history are all ours and all
    // unconfirmed by VZI, so they travel with every suggestion — the number can
    // be argued with rather than just disbelieved.
    const trace = conformsToWire<SessionTraceResponse>(traceI13)
    const suggestion = trace.quantitySuggestions[0]
    expect(typeof suggestion.coverCeilingMonths).toBe("string")
    expect(typeof suggestion.lookbackMonths).toBe("number")
    expect(typeof suggestion.minHistoryConsumptions).toBe("number")
    expect(typeof suggestion.requestedQuantity).toBe("string")
  })
})

describe("ApiError models both arms of FastAPI's detail", () => {
  it("renders a string detail as itself", () => {
    const error = new ApiError(
      "POST /api/assistant/sessions failed with 422",
      422,
      "quantity must be a number, got 'abc'"
    )
    expect(error.detailText()).toBe("quantity must be a number, got 'abc'")
    expect(error.fieldErrors()).toEqual({})
  })

  it("renders an array detail as field-attributed lines", () => {
    // The commonest failure there is — a required field left empty — and the
    // arm that prints "[object Object]" if you assume a string.
    const error = new ApiError("failed with 422", 422, [
      { type: "missing", loc: ["body", "plant"], msg: "Field required" },
    ])
    expect(error.detailText()).toBe("plant: Field required")
    expect(error.fieldErrors()).toEqual({ plant: "Field required" })
  })

  it("attributes a query-parameter failure to the parameter", () => {
    const error = new ApiError("failed with 422", 422, [
      {
        type: "greater_than_equal",
        loc: ["query", "limit"],
        msg: "Input should be greater than or equal to 1",
      },
    ])
    expect(error.fieldErrors()).toEqual({
      limit: "Input should be greater than or equal to 1",
    })
  })

  it("keeps the first issue per field rather than stacking them", () => {
    const error = new ApiError("failed with 422", 422, [
      { type: "missing", loc: ["body", "purpose"], msg: "Field required" },
      { type: "string_type", loc: ["body", "purpose"], msg: "Input should be a valid string" },
    ])
    expect(error.fieldErrors()).toEqual({ purpose: "Field required" })
  })

  it("falls back to the HTTP message when there is no detail at all", () => {
    // A proxy timeout or a CORS rejection has no JSON body. Falling back to a
    // bare status code would tell a planner nothing.
    const error = new ApiError("GET /api/assistant/sessions failed with 503", 503)
    expect(error.detailText()).toBe(
      "GET /api/assistant/sessions failed with 503"
    )
    expect(error.fieldErrors()).toEqual({})
  })

  it("keeps status readable, which existing callers depend on", () => {
    // features/initiative-13/hooks/use-i13-optional-query.ts branches on this.
    const error = new ApiError("not found", 404)
    expect(error.status).toBe(404)
    expect(error).toBeInstanceOf(Error)
  })
})
