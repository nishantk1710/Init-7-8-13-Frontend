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
  withSuggestedWindow,
  type OarLine,
  type RepairableLine,
} from "@/lib/assistant/request/lines"
import { matchesDepartment } from "@/components/assistant/department-picker"
import {
  departmentLabel,
  departmentText,
  departmentsOf,
  isDeclined,
  lineReference,
  outcomeSentence,
} from "@/lib/assistant/request/record"
import { needsJustification, suggestWindow, suggestionKind } from "@/lib/assistant/request/suggest"

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
  it("prefill the OAR quantity and window from the backend's suggestion", () => {
    const line = oar("4")
    expect([line.suggested, line.quantity, line.windowStart, line.windowEnd, line.rate]).toEqual([
      4,
      "4",
      "2026-10-15",
      "2027-06-15",
      0.5,
    ])
    expect(lineIssues(line)).toEqual(["purpose"])
  })

  it("leave the quantity blank when nothing is suggested, and then ask a reason for any", () => {
    const line = oar(null)
    expect(line.quantity).toBe("")
    const typed = withSuggestedWindow({ ...line, quantity: "3" }, TODAY)
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
    const typed: OarLine = { ...oar("4"), quantity: "6", purpose: "Mill 3" }
    const rechecked = lineFromPreview(oarPreview("3"), typed.key, typed) as OarLine
    expect([rechecked.suggested, rechecked.quantity, rechecked.purpose]).toEqual([3, "6", "Mill 3"])
    expect(rechecked.changed).toBe(true)
  })
})

describe("what submit sends", () => {
  it("sends an OAR line's answers, a reason only when one is needed, and what was shown as suggested", () => {
    const line: OarLine = {
      ...oar("4"),
      quantity: "6",
      purpose: " Mill 3 ",
      justification: { reasonCategory: "OTHER", freeText: " two spares " },
    }
    expect(answersOf(line)).toEqual({
      materialId: "1000000123",
      plant: "1300",
      decision: "proceed",
      quantity: "6",
      windowStart: "2026-10-15",
      windowEnd: "2027-06-15",
      purpose: "Mill 3",
      reasonCategory: "OTHER",
      freeText: "two spares",
      seenSuggestedQuantity: "4",
    })
    expect(answersOf({ ...line, quantity: "4" }).reasonCategory).toBeNull()
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
    expect(outcomeSentence(oarLine)).toBe("Procure 4 -- the suggested quantity.")
    expect(outcomeSentence(pump)).toMatch(/justified/)
    expect(outcomeSentence(motor)).toMatch(/existing unit/)
    expect(isDeclined(motor)).toBe(true)
    expect(departmentsOf(sampleRequest())).toEqual(["10100", "10300"])
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
