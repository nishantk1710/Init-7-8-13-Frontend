import { describe, expect, it } from "vitest"

import type { ApiSessionDeclaration, ApiTurn } from "@/lib/api/assistant"
import {
  answerRows,
  choiceLabel,
  closingText,
  declarationViews,
  declaredState,
  formatQuantity,
  i08RepairRows,
  i08RequestRows,
  i08ShownFigures,
  personLabel,
  questionText,
  readableText,
  readableTurns,
  reasonCategoryLabel,
  reasonViews,
  recommendationLabel,
  referenceInstruction,
  sessionDecision,
} from "./session-view"
import { formatClock, formatDay, formatInstant, sessionIdentity } from "./trace-format"

/** The turns of nonprod session SJWYMF3H1H (R3D2KEMVAR/1), as served on 28-Oct-2026. */
const turns: ApiTurn[] = [
  {
    sequence: 0,
    stepId: "i08_assessment",
    stepKind: "choice",
    question: "Do you still want to reserve a new one?",
    answer: { choice: "proceed_new" },
    actor: "UNAUTHENTICATED-FRONTEND",
    answeredAt: "2026-10-27T11:04:29.680000Z",
  },
  {
    sequence: 1,
    stepId: "i08_justification",
    stepKind: "form",
    question:
      "Understood -- the platform does not block anything. Please record why a new unit is needed despite the one in stock or on repair.\n\nYour reason is kept on the platform.",
    answer: { free_text: "test1", reason_category: "URGENT_BREAKDOWN" },
    actor: "UNAUTHENTICATED-FRONTEND",
    answeredAt: "2026-10-27T11:04:29.703333Z",
  },
  {
    sequence: 2,
    stepId: "i08_declare_choice",
    stepKind: "choice",
    question: "Are you taking out a faulty unit that should go for repair?",
    answer: { choice: "declare" },
    actor: "UNAUTHENTICATED-FRONTEND",
    answeredAt: "2026-10-27T11:04:29.770000Z",
  },
  {
    sequence: 3,
    stepId: "i08_declaration",
    stepKind: "form",
    question: "Describe the faulty unit you are taking out.",
    answer: {
      attestor_name: "xyz",
      condition_description: "test11",
      evidence_reference: null,
      fault_category: "SEAL_LEAK",
      quantity: "1",
      recommendation: "REPAIRABLE",
    },
    actor: "UNAUTHENTICATED-FRONTEND",
    answeredAt: "2026-10-27T11:04:29.783333Z",
  },
  {
    sequence: 4,
    stepId: "i08_done",
    stepKind: "terminal",
    question:
      "Recorded, with your reason. Nothing is blocked -- the reservation is yours to make.\n\nYour session reference is SJWYMF3H1H. Type it into the reservation's item text in SAP (field SGTXT) so this advice can be linked to what you actually reserve.",
    answer: null,
    actor: "UNAUTHENTICATED-FRONTEND",
    answeredAt: "2026-10-27T11:04:29.830000Z",
  },
]

const justification = {
  id: "JUS-1",
  sessionId: "SJWYMF3H1H",
  exceptionId: null,
  kind: "NEW_ACQUISITION" as const,
  reasonCategory: "URGENT_BREAKDOWN",
  freeText: "test1",
  materialId: "8000000007",
  plant: "1300",
  author: "UNAUTHENTICATED-FRONTEND",
  recordedAt: "2026-10-27T11:04:29.710000Z",
}

describe("dates and quantities", () => {
  it("writes a timestamp as 27 Oct 2026, 13:04 in South African time", () => {
    expect(formatInstant("2026-10-27T11:04:29.620000Z")).toBe("27 Oct 2026, 13:04")
    expect(formatInstant("2026-10-27")).toBe("27 Oct 2026")
    expect(formatInstant(null)).toBe("—")
    expect(formatClock("2026-10-27T11:04:29.620000Z")).toBe("13:04")
    expect(formatClock("2026-10-27")).toBe("")
  })

  it("writes a bare date without moving it", () => {
    expect(formatDay("2026-07-09")).toBe("09 Jul 2026")
    expect(formatDay("2026-10-27T23:30:00Z")).toBe("28 Oct 2026")
  })

  it("drops the decimals SAP pads a quantity with", () => {
    expect(formatQuantity("1.000000")).toBe("1")
    expect(formatQuantity("2.500")).toBe("2.5")
    expect(formatQuantity("1000.000")).toBe("1,000")
    expect(formatQuantity(null)).toBe("—")
    expect(formatQuantity("")).toBe("—")
    expect(formatQuantity("n/a")).toBe("n/a")
  })
})

describe("codes as words", () => {
  it("labels reasons, faults and assessments", () => {
    expect(reasonCategoryLabel("URGENT_BREAKDOWN")).toBe("Urgent breakdown")
    expect(reasonCategoryLabel("SUPPLIER_RECALL")).toBe("Supplier recall")
    expect(recommendationLabel("BEYOND_ECONOMICAL_REPAIR")).toBe("Beyond economical repair")
    expect(recommendationLabel("REPAIRABLE")).toBe("Repairable")
  })

  it("shows a placeholder actor as the typed requester, or Not signed in", () => {
    expect(personLabel("UNAUTHENTICATED-FRONTEND", "SSJ")).toBe("SSJ")
    expect(personLabel("unknown-actor", null)).toBe("Not signed in")
    expect(personLabel("UNAUTHENTICATED_LOCAL_USER", "  ")).toBe("Not signed in")
    expect(personLabel("jsmith", "SSJ")).toBe("jsmith")
  })
})

describe("readableText", () => {
  it("replaces a double-dash with a colon, or a comma after a colon", () => {
    expect(readableText("Understood -- the platform does not block anything.")).toBe(
      "Understood: the platform does not block anything."
    )
    expect(readableText("Nothing is blocked -- the reservation is yours. Recorded -- you are using it.")).toBe(
      "Nothing is blocked: the reservation is yours. Recorded: you are using it."
    )
    expect(readableText("No new units are suggested: 99 are on open PO -- that is 0 months of cover.")).toBe(
      "No new units are suggested: 99 are on open PO, that is 0 months of cover."
    )
  })

  it("writes ISO dates in the app's format and keeps paragraphs", () => {
    expect(readableText("The earliest due back 2026-07-09.\n\nChase it.")).toBe("The earliest due back 09 Jul 2026.\n\nChase it.")
  })

  it("leaves material numbers alone", () => {
    expect(readableText("8000005216 is an 80-series repairable material.")).toBe(
      "8000005216 is an 80-series repairable material."
    )
  })
})

describe("the reference instruction", () => {
  it("tells a request line to use the header text, once", () => {
    const r = referenceInstruction(
      sessionIdentity({ sessionId: "SJWYMF3H1H", requestId: "R3D2KEMVAR", lineNo: 1, reference: "R3D2KEMVAR/1" })
    )
    expect(r).toEqual({
      kind: "request",
      title: "Request reference",
      value: "R3D2KEMVAR",
      instruction:
        "Type the request reference R3D2KEMVAR once into the reservation's header text in SAP; SAP copies it to every item.",
      line: "R3D2KEMVAR/1",
    })
  })

  it("tells a single session to use the item text", () => {
    const r = referenceInstruction(sessionIdentity({ sessionId: "SX8DRQF270", reference: "SX8DRQF270" }))
    expect(r.title).toBe("Session reference")
    expect(r.value).toBe("SX8DRQF270")
    expect(r.instruction).toBe("Type the session reference SX8DRQF270 into the reservation's item text in SAP.")
    expect(r.line).toBeNull()
  })
})

describe("the conversation", () => {
  it("shows a choice as the button said it", () => {
    expect(choiceLabel("i08_assessment", "proceed_new")).toBe("Yes, I still need a new one")
    expect(choiceLabel("i08_assessment", "use_existing")).toBe("No, I will use the existing unit")
    expect(choiceLabel("i08_declare_choice", "declare")).toBe("Yes, declare it now")
    expect(choiceLabel("i13_quantity", "keep_requested", { requestedQuantity: "1.000" })).toBe("Keep 1")
    expect(choiceLabel("i13_quantity", "accept_suggested", { suggestedQuantity: "0.000" })).toBe("Take the suggested 0")
    expect(choiceLabel("i99_new", "some_value")).toBe("Some value")
  })

  it("shows a form answer as labelled values, never as keys", () => {
    expect(answerRows(turns[1].answer!)).toEqual([
      { label: "Reason", value: "Urgent breakdown" },
      { label: "In their own words", value: "test1" },
    ])
    expect(answerRows(turns[3].answer!)).toEqual([
      { label: "Assessment", value: "Repairable" },
      { label: "Fault", value: "Seal leak" },
      { label: "Condition", value: "test11" },
      { label: "Quantity", value: "1" },
      { label: "Typed name", value: "xyz" },
    ])
    expect(answerRows({ planned_quantity: "2.000", window_start: "2026-10-26", extra_note: "x" })).toEqual([
      { label: "Planned quantity", value: "2" },
      { label: "Used from", value: "26 Oct 2026" },
      { label: "Extra note", value: "x" },
    ])
  })

  it("asks the short question, and keeps a dynamic one's last paragraph", () => {
    expect(questionText("i08_justification", turns[1].question)).toBe("Why is a new unit needed, although one exists?")
    expect(
      questionText("i13_quantity", "No new units are suggested -- 99 on PO.\n\nYou planned 1. Do you want to take the suggested 0 instead?")
    ).toBe("You planned 1. Do you want to take the suggested 0 instead?")
  })

  it("drops the reference sentences from the closing message", () => {
    expect(closingText(turns[4].question)).toBe("Recorded, with your reason. Nothing is blocked: the reservation is yours to make.")
    expect(
      closingText(
        "Recorded. Type the request reference R3D2KEMVAR once into the reservation's header text in SAP; SAP copies it to every item."
      )
    ).toBe("Recorded.")
  })

  it("pairs every question with its answer", () => {
    const pairs = readableTurns(turns)
    expect(pairs.map((p) => p.question)).toEqual([
      "Do you still want to reserve a new one?",
      "Why is a new unit needed, although one exists?",
      "Are you taking out a faulty unit that should go for repair?",
      "Describe the faulty unit you are taking out.",
      "Recorded, with your reason. Nothing is blocked: the reservation is yours to make.",
    ])
    expect(pairs[0].answer).toEqual({ kind: "choice", text: "Yes, I still need a new one" })
    expect(pairs[4]).toMatchObject({ closing: true, answer: null })
  })
})

describe("the decision", () => {
  const base = { flow: "i08", outcome: "COMPLETED" as const, turns, justifications: [justification] }

  it("names an I08 decision in words", () => {
    expect(sessionDecision(base)).toEqual({ text: "New unit requested, reason recorded", tone: "caution" })
    expect(
      sessionDecision({ ...base, justifications: [], turns: [{ ...turns[0], answer: { choice: "use_existing" } }] })
    ).toEqual({ text: "Used the existing unit", tone: "healthy" })
    // No challenge asked: nothing existed to use.
    expect(sessionDecision({ ...base, justifications: [], turns: [turns[2], turns[4]] }).text).toBe(
      "New unit, none to use instead"
    )
    expect(sessionDecision({ ...base, outcome: "ABANDONED", justifications: [], turns: [] }).text).toBe(
      "Left before deciding"
    )
  })

  it("names an I13 decision in words", () => {
    const plan = { plannedQuantity: "1.000" } as never
    const i13 = { flow: "i13", outcome: "COMPLETED" as const, justifications: [], plans: [plan] }
    const proceed = { ...turns[0], stepId: "i13_assessment", answer: { choice: "proceed" } }
    expect(sessionDecision({ ...i13, turns: [proceed] })).toEqual({ text: "Plan recorded for 1", tone: "healthy" })
    expect(
      sessionDecision({ ...i13, turns: [proceed], justifications: [{ ...justification, kind: "QUANTITY_OVERRIDE" }] }).text
    ).toBe("Plan recorded for 1, reason recorded")
    expect(sessionDecision({ ...i13, turns: [{ ...proceed, answer: { choice: "not_needed" } }] }).text).toBe(
      "Not needed after the advice"
    )
  })
})

describe("the declaration", () => {
  const record: ApiSessionDeclaration = {
    id: "ATT-1",
    recommendation: "REPAIRABLE",
    conditionDescription: "Seal worn through",
    faultCategory: "SEAL_LEAK",
    quantity: "1.000",
    attestorName: "SSJ",
    attestedAt: "2026-10-27T11:04:30Z",
    evidenceReference: null,
    repairDocument: "4500001719",
    repairItem: "10",
    repairDocumentType: "PO",
  }

  it("reads the declaration records when the backend sends them", () => {
    expect(declarationViews({ turns, declarations: [record] })).toEqual([
      {
        key: "ATT-1",
        assessment: "Repairable",
        fault: "Seal leak",
        condition: "Seal worn through",
        quantity: "1",
        name: "SSJ",
        evidence: null,
        recordedAt: "2026-10-27T11:04:30Z",
        repairLine: "PO 4500001719/10",
      },
    ])
    expect(declaredState({ turns, declarations: [record] })).toEqual({ state: "yes", text: "Yes, repairable" })
  })

  it("reads the declaration answer when an older backend sends no records", () => {
    const [view] = declarationViews({ turns })
    expect(view).toMatchObject({ assessment: "Repairable", fault: "Seal leak", quantity: "1", name: "xyz", evidence: null })
  })

  it("trusts an empty list from a backend that sends the field", () => {
    expect(declarationViews({ turns, declarations: [] })).toEqual([])
  })

  it("says no when the question was skipped, and not asked before it existed", () => {
    const skipped = [{ ...turns[2], answer: { choice: "skip" } }, turns[4]]
    expect(declaredState({ turns: skipped })).toEqual({ state: "no", text: "No" })
    expect(declaredState({ turns: [turns[0], turns[4]] })).toEqual({ state: "not-asked", text: "Not asked" })
  })
})

describe("the reason", () => {
  it("shows the reason in words, by the typed requester", () => {
    expect(reasonViews([justification], "SSJ")).toEqual([
      {
        key: "JUS-1",
        heading: "Why a new unit",
        reason: "Urgent breakdown",
        text: "test1",
        by: "SSJ",
        recordedAt: "2026-10-27T11:04:29.710000Z",
      },
    ])
  })
})

describe("what the assistant showed (I08)", () => {
  /** The assessment of nonprod session SK9VQGXP5Z, trimmed to two lines each. */
  const facts = {
    flow: "i08",
    stockConditionKnown: true,
    stockIsUnknown: false,
    stockOnHand: "0.000000",
    stockSource: "MCHB",
    usableStock: "0",
    damagedStock: "0",
    openRepairLines: 8,
    overdueLines: 8,
    soonestDueDate: "2026-07-09",
    newUnitLeadTimeDays: null,
    openRepairRequestLines: 6,
    openRepairs: [
      {
        purchasingDocument: "4500001719",
        item: "10",
        quantity: "1.000000",
        dueDate: "2026-07-09",
        daysOverdue: 110,
        vendor: "400207",
        vendorName: "AMS HADEN INSTRUMENT & MINING",
        status: "PO Issued",
        dispatched: false,
        raisedAt: "2026-04-30",
      },
      { purchasingDocument: "4500001720", item: "20", quantity: "2", dueDate: null, daysOverdue: null, vendor: "400300", vendorName: null },
    ],
    openRepairRequests: [
      {
        purchaseRequisition: "2000029040",
        item: "10",
        quantity: "1.000000",
        requestedAt: "2026-01-13",
        daysSinceRequested: 287,
        department: "40200",
        departmentName: "GAMSBERG OPS - SAFETY DEPARTMENT",
        repairOrder: "940000005274",
      },
    ],
  }

  it("gives the five figures, formatted", () => {
    expect(i08ShownFigures(facts)).toEqual([
      { key: "usable", label: "Usable stock", value: "0", empty: "0", note: null, tone: "default" },
      { key: "damaged", label: "Damaged", value: "0", empty: "0", note: null, tone: "default" },
      { key: "repairs", label: "Open repair POs", value: "8", empty: "0", note: "8 past the promised date", tone: "warning" },
      { key: "requested", label: "Requested, no PO yet", value: "6", empty: "0", note: "oldest requested 287 days ago", tone: "default" },
      { key: "lead", label: "New unit takes", value: null, empty: "Not set in SAP", note: null, tone: "default" },
    ])
  })

  it("names the usable conditions when the record carries them", () => {
    const [usable] = i08ShownFigures({
      ...facts,
      usableStock: "1.000000",
      usableBreakdown: [{ condition: "REFURBISHD", quantity: "1.000000" }],
      newUnitLeadTimeDays: 21,
    })
    expect(usable).toMatchObject({ value: "1", note: "1 refurbished" })
    expect(i08ShownFigures({ ...facts, newUnitLeadTimeDays: 21 })[4].value).toBe("21 days")
  })

  it("keeps one stock figure for a record from before the split", () => {
    const legacy = { flow: "i08", stockOnHand: "2.000", stockIsUnknown: false, openRepairLines: 0, overdueLines: 0 }
    expect(i08ShownFigures(legacy)[0]).toMatchObject({ key: "stock", label: "In stock", value: "2", note: null })
    expect(i08ShownFigures({ ...legacy, stockIsUnknown: true })[0]).toMatchObject({ value: null, empty: "No stock record" })
  })

  it("lists the open repair POs and the requests with no PO", () => {
    expect(i08RepairRows(facts)).toEqual([
      {
        key: "4500001719-10-0",
        reference: "4500001719/10",
        vendor: "AMS HADEN INSTRUMENT & MINING",
        quantity: "1",
        due: "09 Jul 2026",
        late: "110 days late",
      },
      { key: "4500001720-20-1", reference: "4500001720/20", vendor: "Vendor 400300", quantity: "2", due: "No date promised", late: null },
    ])
    expect(i08RequestRows(facts)).toEqual([
      {
        key: "2000029040-10-0",
        reference: "PR 2000029040/10",
        age: "Requested 287 days ago",
        department: "40200 · GAMSBERG OPS - SAFETY DEPARTMENT",
        quantity: "1",
      },
    ])
  })
})
