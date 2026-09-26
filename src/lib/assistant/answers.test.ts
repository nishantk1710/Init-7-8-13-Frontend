import { describe, expect, it } from "vitest"

import type { ApiField, ApiStep } from "@/lib/api/assistant"
import {
  choiceAnswer,
  fieldLabel,
  formAnswer,
  initialFormValues,
  missingRequired,
  stepIsTerminal,
  stepNeedsSubmit,
  windowIsInverted,
} from "@/lib/assistant/answers"

import answerI13Proceed from "@/lib/api/__fixtures__/10-answer-i13-proceed.json"
import traceI13 from "@/lib/api/__fixtures__/16-session-trace-i13.json"

/**
 * The plan-capture form, taken from a real payload rather than described here.
 * If the backend changes the field list, these tests move with it instead of
 * passing against a shape that no longer exists.
 */
const PLAN_FIELDS = (answerI13Proceed as unknown as { step: ApiStep }).step
  .fields

function field(overrides: Partial<ApiField> = {}): ApiField {
  return {
    name: "purpose",
    label: "What it is for",
    type: "textarea",
    required: true,
    options: [],
    helpText: null,
    default: null,
    ...overrides,
  }
}

describe("choiceAnswer", () => {
  it("matches the shape the backend recorded", () => {
    expect(choiceAnswer("proceed_new")).toEqual({ choice: "proceed_new" })
  })
})

describe("formAnswer", () => {
  it("keys by field.name verbatim, which is snake_case", () => {
    // The envelope is camelCase but these are data keys, so the alias
    // generator never touches them. `plannedQuantity` is accepted as an
    // unknown key and captures nothing — silently.
    const answer = formAnswer(PLAN_FIELDS, {
      purpose: "Seal replacement on mill 3.",
      planned_quantity: "5",
      window_start: "2026-08-10",
      window_end: "2026-08-21",
      cost_centre: "1300-MNT",
      order_number: "4001234567",
    })

    expect(answer).toEqual({
      purpose: "Seal replacement on mill 3.",
      planned_quantity: "5",
      window_start: "2026-08-10",
      window_end: "2026-08-21",
      cost_centre: "1300-MNT",
      order_number: "4001234567",
    })
  })

  it("reproduces a turn the backend actually stored", () => {
    // The strongest available check: feed the values from a recorded turn back
    // through the builder and require the same payload out.
    const recorded = (
      traceI13 as unknown as {
        turns: { stepKind: string; answer: Record<string, unknown> | null }[]
      }
    ).turns.find((turn) => turn.stepKind === "form")!.answer!

    const rebuilt = formAnswer(
      PLAN_FIELDS,
      Object.fromEntries(
        Object.entries(recorded).map(([key, value]) => [key, String(value)])
      )
    )
    expect(rebuilt).toEqual(recorded)
  })

  it("sends every value as a string, including the quantity", () => {
    // A Decimal through a JSON number returns 2.1 as 2.0999999999999996, and
    // this value reaches an append-only record a compliance engine reads.
    const answer = formAnswer(PLAN_FIELDS, {
      purpose: "x",
      planned_quantity: "2.1",
    })
    expect(answer.planned_quantity).toBe("2.1")
    expect(typeof answer.planned_quantity).toBe("string")
  })

  it("drops an empty optional field rather than sending an empty string", () => {
    // "The cost centre is the empty string" and "the requester did not know
    // the cost centre" are different statements, and the form says out loud
    // that blank means the second one.
    const answer = formAnswer(PLAN_FIELDS, {
      purpose: "x",
      planned_quantity: "1",
      cost_centre: "   ",
      order_number: "",
    })
    expect(answer).not.toHaveProperty("cost_centre")
    expect(answer).not.toHaveProperty("order_number")
  })

  it("still sends an empty required field, so the server rejects it", () => {
    // The UI must not be the only thing enforcing a rule the server owns.
    const answer = formAnswer([field({ name: "free_text", required: true })], {
      free_text: "",
    })
    expect(answer).toEqual({ free_text: "" })
  })

  it("trims, because trailing whitespace in an audit record is noise", () => {
    const answer = formAnswer([field()], { purpose: "  a reason  " })
    expect(answer.purpose).toBe("a reason")
  })
})

describe("initialFormValues", () => {
  it("honours a default and keeps it a string", () => {
    const values = initialFormValues(PLAN_FIELDS)
    expect(values.planned_quantity).toBe("5")
  })

  it("turns a null default into an empty box, not the text 'null'", () => {
    const values = initialFormValues([field({ default: null })])
    expect(values.purpose).toBe("")
  })

  it("gives every field a key so no input starts uncontrolled", () => {
    const values = initialFormValues(PLAN_FIELDS)
    for (const f of PLAN_FIELDS) expect(values).toHaveProperty(f.name)
  })
})

describe("missingRequired", () => {
  it("names the required fields that are empty, in declaration order", () => {
    const missing = missingRequired(PLAN_FIELDS, {
      purpose: "",
      planned_quantity: "",
    })
    expect(missing).toEqual(["purpose", "planned_quantity"])
  })

  it("ignores blank optional fields", () => {
    const missing = missingRequired(PLAN_FIELDS, {
      purpose: "x",
      planned_quantity: "1",
      cost_centre: "",
      window_start: "",
    })
    expect(missing).toEqual([])
  })

  it("treats whitespace as empty", () => {
    expect(missingRequired([field()], { purpose: "   " })).toEqual(["purpose"])
  })
})

describe("windowIsInverted", () => {
  it("catches an end before a start", () => {
    // The backend does not check this, and FR-7 breaches on "window end plus
    // grace" — so an inverted window raises an exception nobody caused, on
    // the day the plan is captured.
    expect(
      windowIsInverted({ window_start: "2026-08-21", window_end: "2026-08-10" })
    ).toBe(true)
  })

  it("accepts a same-day window", () => {
    expect(
      windowIsInverted({ window_start: "2026-08-10", window_end: "2026-08-10" })
    ).toBe(false)
  })

  it("says nothing when either end is blank, because both are optional", () => {
    expect(windowIsInverted({ window_start: "2026-08-10" })).toBe(false)
    expect(windowIsInverted({ window_end: "2026-08-10" })).toBe(false)
    expect(windowIsInverted({})).toBe(false)
  })
})

describe("step helpers", () => {
  const step = (kind: ApiStep["kind"]): ApiStep => ({
    id: "x",
    kind,
    prompt: "",
    choices: [],
    fields: [],
    facts: null,
    footnote: null,
    sessionId: null,
  })

  it("only a form needs a submit button", () => {
    // A choice answers on click: a confirm step on a two-option question is
    // friction that teaches people to click through the next one.
    expect(stepNeedsSubmit(step("form"))).toBe(true)
    expect(stepNeedsSubmit(step("choice"))).toBe(false)
    expect(stepNeedsSubmit(step("terminal"))).toBe(false)
  })

  it("recognises the end of the conversation", () => {
    expect(stepIsTerminal(step("terminal"))).toBe(true)
    expect(stepIsTerminal(step("choice"))).toBe(false)
  })

  it("falls back to the field name when there is no label", () => {
    expect(fieldLabel(PLAN_FIELDS, "planned_quantity")).toBe(
      "How many you plan to use"
    )
    expect(fieldLabel(PLAN_FIELDS, "nope")).toBe("nope")
  })
})
