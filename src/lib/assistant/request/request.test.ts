import { describe, expect, it } from "vitest"

import type { ApiPreviewLine, ApiRequest } from "@/lib/api/assistant-requests"
import { conflictDetail, isNotEnabled, refusedDetail } from "@/lib/api/assistant-requests"
import { ApiError } from "@/lib/api/client"
import {
  answersOf,
  isDuplicate,
  isReady,
  lineFromPreview,
  lineIssues,
  oarNeedsJustification,
  pendingLine,
  requestSaving,
  savingOf,
  suggestionSavingOf,
  withChoice,
  withDeclarationOpen,
  withRequired,
  withSuggestedWindow,
  withoutDeclarations,
  type OarLine,
  type RepairableLine,
} from "@/lib/assistant/request/lines"
import { matchesDepartment } from "@/components/assistant/department-picker"
import {
  awaitingReservation,
  departmentLabel,
  departmentText,
  departmentsOf,
  isDeclined,
  lineReference,
  outcomeSentence,
} from "@/lib/assistant/request/record"
import { justificationPrompt, needsJustification, suggestWindow, suggestionKind } from "@/lib/assistant/request/suggest"

const TODAY = new Date(2026, 9, 15) // 15 Oct 2026

/** A preview line as the backend sends it. */
function oarPreview(quantity: string | null, overrides: Partial<ApiPreviewLine> = {}): ApiPreviewLine {
  const sized = quantity !== null && Number(quantity) > 0
  return {
    materialId: "1000000123",
    materialDescription: "SEAL KIT, MILL GEARBOX",
    plant: "1300",
    kind: "i13",
    reason: "OAR",
    facts: { stockOnHand: "2.000", openPoQuantity: "0", averageMonthlyConsumption: "0.5", consumptionCount12m: 6 },
    unitExists: null,
    alsoMatched: null,
    suggestion: {
      quantity,
      reason: quantity === null ? "No quantity is suggested: too little history." : `${quantity} suggested.`,
      windowStart: sized ? "2026-10-15" : null,
      windowEnd: sized ? "2027-06-15" : null,
      windowMonths: sized ? 8 : null,
    },
    ...overrides,
  }
}

function repairPreview(unitExists: boolean): ApiPreviewLine {
  return {
    materialId: "8000005632",
    materialDescription: "PUMP, CENTRIFUGAL",
    plant: "1300",
    kind: "i08",
    reason: "80-series",
    facts: { stockOnHand: "0", openRepairs: unitExists ? [{ purchasingDocument: "45", quantity: "1" }] : [] },
    unitExists,
    alsoMatched: null,
    suggestion: null,
  }
}

const oar = (quantity: string | null = "4") => lineFromPreview(oarPreview(quantity)) as OarLine
const repair = (unitExists = true) => lineFromPreview(repairPreview(unitExists)) as RepairableLine

describe("the suggestion the backend served", () => {
  it("is a quantity, nothing needed, or none possible", () => {
    expect([suggestionKind(4), suggestionKind(0), suggestionKind(null)]).toEqual(["suggested", "covered", "none"])
  })

  it("asks for a reason above it, or when there is none to compare with", () => {
    expect(needsJustification(4, 4)).toBe(false)
    expect(needsJustification(4, 2)).toBe(false)
    expect(needsJustification(4, 5)).toBe(true)
    expect(needsJustification(0, 1)).toBe(true)
    expect(needsJustification(null, 1)).toBe(true)
    expect(needsJustification(null, null)).toBe(false)
  })

  it("sizes a window for a changed quantity from the usage rate, 1 to 12 months", () => {
    expect(suggestWindow(4, 0.5, TODAY)).toEqual({ start: "2026-10-15", end: "2027-06-15", months: 8 })
    expect(suggestWindow(100, 1, TODAY)?.months).toBe(12)
    expect(suggestWindow(4, 0, TODAY)).toBeNull()
  })
})

describe("rows built from the preview", () => {
  it("prefill nothing: the requester names the quantity they need first", () => {
    const line = oar("4")
    expect([line.suggested, line.required, line.choice, line.quantity, line.windowStart, line.rate]).toEqual([
      4, "", null, "", "", 0.5,
    ])
    expect(lineIssues(line)).toEqual(["required quantity", "window start", "window end", "purpose"])
  })

  it("then ask which number to lock, and size the window from the locked one", () => {
    const typed = withRequired(oar("4"), "6", null, TODAY)
    expect([typed.choice, typed.quantity]).toEqual([null, ""])
    expect(lineIssues(typed)[0]).toBe("suggested or your quantity")

    const suggested = withChoice(typed, "suggested", TODAY)
    expect([suggested.quantity, suggested.windowStart, suggested.windowEnd]).toEqual(["4", "2026-10-15", "2027-06-15"])
    expect(lineIssues(suggested)).toEqual(["purpose"])

    const own = withChoice(typed, "own", TODAY)
    expect(own.quantity).toBe("6")
    expect(oarNeedsJustification(own)).toBe(true)
  })

  it("unlock when the required quantity changes, but let your own number follow it", () => {
    const suggested = withChoice(withRequired(oar("4"), "6"), "suggested")
    expect(withRequired(suggested, "7").choice).toBeNull()
    const own = withChoice(withRequired(oar("4"), "6"), "own")
    expect(withRequired(own, "7", "own").quantity).toBe("7")
  })

  it("ask a reason for your own number below the suggestion too", () => {
    const below = withChoice(withRequired(oar("4"), "2"), "own")
    expect(oarNeedsJustification(below)).toBe(true)
    expect(justificationPrompt(4, 2)).toBe("2 is below the suggested 4. Why the smaller quantity?")
    expect(oarNeedsJustification(withChoice(withRequired(oar("4"), "4"), "own"))).toBe(false)
  })

  it("mark the row not needed when a suggestion of 0 is taken", () => {
    const taken = withChoice(withRequired(oar("0"), "5"), "suggested")
    expect([taken.decision, isReady(taken)]).toEqual(["not_needed", true])
  })

  it("use your own number when nothing is suggested, and then ask a reason for any", () => {
    const typed = withRequired(oar(null), "3", null, TODAY)
    expect([typed.choice, typed.quantity]).toEqual(["own", "3"])
    expect(oarNeedsJustification(typed)).toBe(true)
    expect(lineIssues(typed)).toEqual(["reason", "explanation", "purpose"])
  })

  it("keep a window the requester edited", () => {
    const edited = { ...oar("4"), windowEnd: "2026-12-31", windowEdited: true }
    expect(withSuggestedWindow({ ...edited, quantity: "1" }, TODAY).windowEnd).toBe("2026-12-31")
  })

  it("need nothing once marked not needed", () => {
    const line = { ...oar("4"), decision: "not_needed" as const }
    expect(isReady(line)).toBe(true)
  })

  it("ask a repairable row to decide only when a unit exists", () => {
    expect(repair(true).decision).toBeNull()
    expect(lineIssues(repair(true))).toEqual(["decision"])
    expect(lineIssues({ ...repair(true), decision: "proceed_new" })).toEqual([
      "reason",
      "explanation",
    ])
    const none = repair(false)
    expect(none.decision).toBe("proceed_new")
    expect(isReady(none)).toBe(true)
  })

  it("keep a material that opens no session, with the backend's reason", () => {
    const row = lineFromPreview({ ...oarPreview(null), kind: "out_of_scope", reason: "A consumable." })
    expect(row).toMatchObject({ kind: "out_of_scope", reason: "A consumable." })
    expect(isReady(row)).toBe(true)
  })

  it("are not ready while their check is still running", () => {
    expect(lineIssues(pendingLine("1000000123", "1300", null))).toEqual(["check"])
  })

  it("refuse the same material at the same plant twice", () => {
    expect(isDuplicate([oar()], "0001000000123", "1300")).toBe(true)
    expect(isDuplicate([oar()], "1000000123", "1500")).toBe(false)
  })

  it("re-checked after a 409 keep what was typed and take the new figures", () => {
    const own: OarLine = { ...withChoice(withRequired(oar("4"), "6"), "own"), purpose: "Mill 3" }
    const rechecked = lineFromPreview(oarPreview("3"), own.key, own) as OarLine
    expect([rechecked.suggested, rechecked.required, rechecked.quantity, rechecked.purpose]).toEqual([3, "6", "6", "Mill 3"])
    expect(rechecked.changed).toBe(true)

    // A locked suggestion was the old figure: chosen again.
    const took = withChoice(withRequired(oar("4"), "6"), "suggested")
    const moved = lineFromPreview(oarPreview("3"), took.key, took) as OarLine
    expect([moved.choice, moved.quantity]).toEqual([null, ""])
  })

  it("take a draft saved before the required quantity existed as needing one", () => {
    const old = { ...oar("4"), quantity: "4" } as OarLine
    delete old.required
    delete old.choice
    expect(lineIssues(old)[0]).toBe("required quantity")
    expect(answersOf(old)).not.toHaveProperty("requiredQuantity")
  })
})

describe("what the suggestion saves", () => {
  const priced = (quantity: string | null, price: string | null = "250.5") =>
    lineFromPreview(
      oarPreview(quantity, {
        unitPrice: { price, currency: price ? "ZAR" : null, missing: price ? null : "price_not_staged", note: price ? null : "No price: not in the I07 price data for this plant" },
      })
    ) as OarLine

  it("is what was asked for less what was locked, at the plant's price", () => {
    expect(savingOf(withChoice(withRequired(priced("4"), "6"), "suggested"))).toEqual({ units: 2, value: 501, priceNote: null })
    expect(savingOf(withChoice(withRequired(priced("4"), "6"), "own"))?.units).toBe(0)
    expect(savingOf(withChoice(withRequired(priced("4"), "2"), "own"))?.units).toBe(0)
  })

  it("is nothing until a quantity is typed and locked", () => {
    expect(savingOf(priced("4"))).toBeNull()
    expect(savingOf(withRequired(priced("4"), "6"))).toBeNull()
  })

  it("counts no units when nothing could be suggested", () => {
    expect(savingOf(withRequired(priced(null), "3"))?.units).toBeNull()
  })

  it("is the whole quantity when stock already covers it, but not when dropped against a positive suggestion", () => {
    expect(savingOf(withChoice(withRequired(priced("0"), "5"), "suggested"))?.units).toBe(5)
    expect(savingOf({ ...withRequired(priced("4"), "5"), decision: "not_needed" })?.units).toBe(0)
  })

  it("keeps the units and leaves the value out without a price", () => {
    const unpriced = savingOf(withChoice(withRequired(priced("4", null), "6"), "suggested"))
    expect(unpriced).toEqual({ units: 2, value: null, priceNote: "No price: not in the I07 price data for this plant" })
  })

  it("is shown beside the suggestion before anything is locked", () => {
    expect(suggestionSavingOf(priced("4"))).toBeNull()
    expect(suggestionSavingOf(withRequired(priced(null), "6"))).toBeNull()
    expect(suggestionSavingOf(withRequired(priced("4"), "6"))).toEqual({ units: 2, value: 501, priceNote: null })
    expect(suggestionSavingOf(withChoice(withRequired(priced("4"), "6"), "own"))?.units).toBe(2)
    expect(suggestionSavingOf(withRequired(priced("0"), "5"))?.units).toBe(5)
  })

  it("totals over the request", () => {
    const rows = [
      withChoice(withRequired(priced("4"), "6"), "suggested"),
      withChoice(withRequired(priced("4", null), "5"), "suggested"),
      withChoice(withRequired(priced("4"), "9"), "own"),
    ]
    expect(requestSaving(rows)).toEqual({ units: 3, value: 501, unpriced: 1 })
  })

  it("is sent with the lock", () => {
    const answers = answersOf(withChoice(withRequired(priced("4"), "6"), "suggested"))
    expect(answers).toMatchObject({ quantity: "4", requiredQuantity: "6", quantityChoice: "suggested", seenSuggestedQuantity: "4" })
    const declined = answersOf(withChoice(withRequired(priced("0"), "5"), "suggested"))
    expect(declined).toMatchObject({ decision: "not_needed", requiredQuantity: "5", quantityChoice: "suggested" })
  })
})

describe("what submit sends", () => {
  it("sends an OAR line's answers, a reason only when one is needed, and what was shown as suggested", () => {
    const line: OarLine = {
      ...withChoice(withRequired(oar("4"), "6"), "own", TODAY),
      purpose: " Mill 3 ",
      justification: { reasonCategory: "OTHER", freeText: " two spares " },
    }
    expect(answersOf(line)).toEqual({
      materialId: "1000000123",
      plant: "1300",
      decision: "proceed",
      quantity: "6",
      windowStart: "2026-10-15",
      windowEnd: "2027-10-15",
      purpose: "Mill 3",
      reasonCategory: "OTHER",
      freeText: "two spares",
      seenSuggestedQuantity: "4",
      requiredQuantity: "6",
      quantityChoice: "own",
    })
    expect(answersOf(withChoice(line, "suggested")).reasonCategory).toBeNull()
  })

  it("sends a declined OAR line with nothing but the decision", () => {
    const answers = answersOf({ ...oar("4"), decision: "not_needed" })
    expect(answers).toMatchObject({ decision: "not_needed", quantity: null })
    expect(answers).not.toHaveProperty("department")
  })

  it("sends a repairable line's decision and reason", () => {
    const line: RepairableLine = {
      ...repair(true),
      decision: "proceed_new",
      justification: { reasonCategory: "URGENT_BREAKDOWN", freeText: "Down" },
    }
    expect(answersOf(line)).toEqual({
      materialId: "8000005632",
      plant: "1300",
      decision: "proceed_new",
      reasonCategory: "URGENT_BREAKDOWN",
      freeText: "Down",
    })
  })
})

describe("declaring the faulty unit with the request", () => {
  const declared = (overrides: Partial<RepairableLine["declaration"]> = {}): RepairableLine => ({
    ...repair(false),
    declaration: {
      open: true,
      quantity: "2",
      conditionDescription: "  Seized bearing ",
      faultCategory: "Mechanical",
      recommendation: "REPAIRABLE",
      attestorName: " A. Planner ",
      evidenceReference: "",
      ...overrides,
    },
  })

  it("is closed by default and sends nothing", () => {
    const line = repair(false)
    expect(line.declaration.open).toBe(false)
    expect(isReady(line)).toBe(true)
    expect(answersOf(line)).not.toHaveProperty("declaration")
  })

  it("treats a line from an older saved draft, with no declaration, as none made", () => {
    const { declaration: _dropped, ...rest } = repair(false)
    const old = rest as unknown as RepairableLine
    expect(lineIssues(old)).toEqual([])
    expect(answersOf(old)).not.toHaveProperty("declaration")
  })

  it("asks for every required field once opened", () => {
    const line = repair(false)
    expect(lineIssues({ ...line, declaration: { ...line.declaration, open: true, quantity: "0" } })).toEqual([
      "declared quantity",
      "condition",
      "fault category",
      "recommendation",
      "your name",
    ])
    expect(isReady(declared())).toBe(true)
  })

  it("sends the declaration trimmed, evidence only when typed", () => {
    expect(answersOf(declared()).declaration).toEqual({
      quantity: 2,
      conditionDescription: "Seized bearing",
      faultCategory: "Mechanical",
      recommendation: "REPAIRABLE",
      attestorName: "A. Planner",
    })
    expect(answersOf(declared({ evidenceReference: " Photo 12 " })).declaration?.evidenceReference).toBe("Photo 12")
  })

  it("fills the typed name from the Requester when opened, and never replaces one", () => {
    const closed = repair(false).declaration
    expect(withDeclarationOpen(closed, true, " SSJ ")).toMatchObject({ open: true, attestorName: "SSJ" })
    expect(withDeclarationOpen({ ...closed, attestorName: "Lynn" }, true, "SSJ").attestorName).toBe("Lynn")
    expect(withDeclarationOpen(closed, true, "  ").attestorName).toBe("")
    expect(withDeclarationOpen({ ...closed, open: true, attestorName: "SSJ" }, false, "SSJ")).toMatchObject({
      open: false,
      attestorName: "SSJ",
    })
  })

  it("is dropped from a resumed draft while the complete flow is off", () => {
    const untouched = repair(true)
    const [cleared, plain] = withoutDeclarations([declared(), untouched])
    expect((cleared as RepairableLine).declaration.open).toBe(false)
    expect(answersOf(cleared)).not.toHaveProperty("declaration")
    expect(isReady(declared({ conditionDescription: "" }))).toBe(false)
    expect(isReady(withoutDeclarations([declared({ conditionDescription: "" })])[0])).toBe(true)
    expect(plain).toBe(untouched)
  })

  it("survives a re-check of the row", () => {
    const typed = declared()
    const rechecked = lineFromPreview(repairPreview(false), typed.key, typed) as RepairableLine
    expect(rechecked.declaration).toEqual(typed.declaration)
  })
})

describe("submit's refusals", () => {
  it("names the refused line from a 422", () => {
    const error = new ApiError("422", 422, undefined, "A reason is needed", { message: "A reason is needed", line: 2 })
    expect(refusedDetail(error)).toEqual({ message: "A reason is needed", line: 2 })
    expect(conflictDetail(error)).toBeNull()
  })

  it("lists the moved suggestions from a 409", () => {
    const changed = [{ materialId: "1000000123", seenSuggestedQuantity: "4", suggestedQuantity: "3" }]
    const error = new ApiError("409", 409, undefined, "moved", { message: "moved", changed })
    expect(conflictDetail(error)?.changed).toEqual(changed)
  })

  it("tells 'not switched on' apart from a missing request", () => {
    expect(isNotEnabled(new ApiError("404", 404, undefined, "Not Found"))).toBe(true)
    expect(isNotEnabled(new ApiError("404", 404, undefined, "No request R123."))).toBe(false)
  })
})

// --- a recorded request ------------------------------------------------------------

function sampleRequest(): ApiRequest {
  const id = "R7K2M4P8QX"
  const line = (lineNo: number, overrides: Partial<ApiRequest["lines"][number]>): ApiRequest["lines"][number] => ({
    lineNo,
    reference: lineReference(id, lineNo),
    sessionId: `S${lineNo}`,
    flow: "i13",
    outcome: "COMPLETED",
    materialId: "1000000123",
    materialDescription: null,
    plant: "1300",
    department: "10100",
    decision: "proceed",
    plannedQuantity: "4.000",
    suggestedQuantity: "4.000",
    acceptedQuantity: "4.000",
    windowStart: "2026-10-15",
    windowEnd: "2027-06-15",
    purpose: "Mill 3",
    justification: null,
    linkedReservations: [],
    ...overrides,
  })
  return {
    requestId: id,
    plant: "1300",
    requestedFor: "J Miller",
    requester: "op",
    origin: "PLATFORM",
    issuedAt: "2026-10-15T08:00:00Z",
    department: null,
    departments: ["10100", "10300"],
    lines: [
      line(1, {}),
      line(2, {
        flow: "i08",
        materialId: "8000005632",
        department: "10300",
        decision: "proceed_new",
        plannedQuantity: null,
        suggestedQuantity: null,
        acceptedQuantity: null,
        justification: { kind: "NEW_ACQUISITION", reasonCategory: "URGENT_BREAKDOWN", freeText: "Down" },
      }),
      line(3, { flow: "i08", materialId: "8000006120", decision: "use_existing", plannedQuantity: null }),
    ],
    skipped: [{ materialId: "3000001122", plant: "1300", kind: "out_of_scope", reason: "Consumable" }],
    replayed: false,
  }
}

describe("a recorded request", () => {
  it("says what each line decided", () => {
    const [oarLine, pump, motor] = sampleRequest().lines
    expect(outcomeSentence(oarLine)).toBe("Procure 4: the suggested quantity.")
    expect(outcomeSentence(pump)).toMatch(/justified/)
    expect(outcomeSentence(motor)).toMatch(/existing unit/)
    expect(isDeclined(motor)).toBe(true)
    expect(departmentsOf(sampleRequest())).toEqual(["10100", "10300"])
  })

  it("waits for a reservation only on lines that will be reserved and are not linked", () => {
    const request = sampleRequest()
    expect(awaitingReservation(request).map((l) => l.lineNo)).toEqual([1, 2])
    request.lines[0].linkedReservations = [
      {
        reservationNumber: "12345678",
        reservationItem: "0001",
        material: request.lines[0].materialId,
        plant: "1300",
        source: "SGTXT",
        sgtxt: request.requestId,
        firstSeenAt: "2026-10-15T09:00:00Z",
        note: null,
      },
    ]
    expect(awaitingReservation(request).map((l) => l.lineNo)).toEqual([2])
  })
})

describe("department names", () => {
  it("shows the code with its name, or the code alone when the list has none", () => {
    expect(departmentText("10100", "FINANCE-COMMERCIAL DEPARTMENT")).toBe("10100 · FINANCE-COMMERCIAL DEPARTMENT")
    expect(departmentText("10107", null)).toBe("10107")
    expect(departmentText("10107")).toBe("10107")
  })

  it("labels a request by its one department, named", () => {
    expect(
      departmentLabel({ department: "10100", departmentName: "FINANCE-COMMERCIAL DEPARTMENT", departments: ["10100"] })
    ).toBe("10100 · FINANCE-COMMERCIAL DEPARTMENT")
    // Before 21 Oct a request's lines could name several: codes only.
    expect(departmentLabel({ department: null, departments: ["10100", "10300"] })).toBe("10100, 10300")
    expect(departmentLabel({ department: null, departments: [] })).toBe("—")
  })

  it("finds a department by the start of its code or anywhere in its name", () => {
    const finance = { code: "10100", name: "FINANCE-COMMERCIAL DEPARTMENT", plants: ["1300"], primary: true }
    const unnamed = { code: "10107", name: null, plants: ["1300"], primary: true }
    expect(matchesDepartment(finance, "101")).toBe(true)
    expect(matchesDepartment(finance, "commercial")).toBe(true)
    expect(matchesDepartment(finance, "100")).toBe(false)
    expect(matchesDepartment(unnamed, "1010")).toBe(true)
    expect(matchesDepartment(unnamed, "finance")).toBe(false)
  })
})
