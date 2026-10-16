import { describe, expect, it } from "vitest"

import { REQUEST_CATALOGUE, findDemoMaterial, type OarFacts } from "@/lib/assistant/request/catalogue"
import {
  isDuplicate,
  isReady,
  lineFor,
  lineIssues,
  needsDepartment,
  withSuggestedWindow,
  type OarLine,
  type RepairableLine,
} from "@/lib/assistant/request/lines"
import { requestReferencesIn, resolveLink } from "@/lib/assistant/request/link"
import {
  departmentsOf,
  lineReference,
  mintRequestId,
  outcomeSentence,
  requestIdFrom,
  submitRequest,
  type RequestRecord,
} from "@/lib/assistant/request/record"
import { needsJustification, suggestQuantity, suggestWindow } from "@/lib/assistant/request/suggest"
import { isWellFormed } from "@/lib/assistant/demo/ids"

const TODAY = new Date(2026, 9, 15) // 15 Oct 2026

function facts(over: Partial<OarFacts>): OarFacts {
  return {
    stockOnHand: 0,
    openPoQuantity: 0,
    averageMonthlyConsumption: 1,
    consumptionCount12m: 12,
    daysSinceLastMovement: 10,
    crossPlantStock: [],
    ...over,
  }
}

describe("suggest-first quantity", () => {
  it("is the uncapped headroom over 12 months of cover", () => {
    const s = suggestQuantity(facts({ stockOnHand: 2, averageMonthlyConsumption: 0.5, consumptionCount12m: 6 }))
    expect(s).toMatchObject({ kind: "suggested", quantity: 4 })
  })

  it("counts open POs as available", () => {
    const s = suggestQuantity(facts({ stockOnHand: 1, openPoQuantity: 3, averageMonthlyConsumption: 0.75 }))
    expect(s).toMatchObject({ kind: "suggested", quantity: 5 })
  })

  it("suggests 0 when stock already covers the ceiling", () => {
    const s = suggestQuantity(facts({ stockOnHand: 30, averageMonthlyConsumption: 1.5 }))
    expect(s).toMatchObject({ kind: "covered", quantity: 0, monthsCovered: 20 })
  })

  it("refuses with too little history, and with no consumption at all", () => {
    expect(suggestQuantity(facts({ consumptionCount12m: 2 })).kind).toBe("no_history")
    expect(suggestQuantity(facts({ consumptionCount12m: 0, averageMonthlyConsumption: 0 })).kind).toBe("no_rate")
  })

  it("asks for a reason above the suggestion, or when there is none to compare with", () => {
    const four = suggestQuantity(facts({ stockOnHand: 8 }))
    expect(four.quantity).toBe(4)
    expect(needsJustification(four, 4)).toBe(false)
    expect(needsJustification(four, 2)).toBe(false)
    expect(needsJustification(four, 5)).toBe(true)
    expect(needsJustification(suggestQuantity(facts({ stockOnHand: 99 })), 1)).toBe(true)
    expect(needsJustification(suggestQuantity(facts({ consumptionCount12m: 1 })), 1)).toBe(true)
  })
})

describe("suggested window", () => {
  it("runs until the quantity is used up, 1 to 12 months", () => {
    expect(suggestWindow(4, 0.5, TODAY)).toEqual({ start: "2026-10-15", end: "2027-06-15", months: 8 })
    expect(suggestWindow(1, 5, TODAY)?.months).toBe(1)
    expect(suggestWindow(100, 1, TODAY)?.months).toBe(12)
  })

  it("is not offered without a rate or a quantity", () => {
    expect(suggestWindow(4, 0, TODAY)).toBeNull()
    expect(suggestWindow(null, 1, TODAY)).toBeNull()
  })

  it("clamps a month-end start", () => {
    expect(suggestWindow(1, 1, new Date(2026, 0, 31))?.end).toBe("2026-02-28")
  })
})

describe("rows", () => {
  it("route every catalogue material to the kind its scenario names", () => {
    for (const m of REQUEST_CATALOGUE) {
      const kind = lineFor(m.materialId, m.plant, TODAY).kind
      const expected = m.routing.kind
      expect(kind).toBe(expected)
    }
    expect(lineFor("999", "1300").kind).toBe("not_found")
  })

  it("prefill the OAR quantity and window from the suggestion", () => {
    const line = lineFor("1000000123", "1300", TODAY) as OarLine
    expect(line.quantity).toBe("4")
    expect(line.windowStart).toBe("2026-10-15")
    expect(line.windowEnd).toBe("2027-06-15")
    expect(lineIssues(line)).toEqual(["department", "purpose"])
  })

  it("leave quantity and window blank when nothing can be suggested", () => {
    const line = lineFor("1000000812", "1300", TODAY) as OarLine
    expect(line.quantity).toBe("")
    expect(lineIssues(line)).toEqual(["department", "quantity", "window start", "window end", "purpose"])
    const typed = withSuggestedWindow({ ...line, department: "10100", quantity: "2" }, TODAY)
    expect(lineIssues(typed)).toEqual(["reason", "explanation", "window start", "window end", "purpose"])
  })

  it("keep a window the requester edited", () => {
    const line = lineFor("1000000123", "1300", TODAY) as OarLine
    const edited = { ...line, windowEnd: "2026-12-31", windowEdited: true }
    expect(withSuggestedWindow({ ...edited, quantity: "1" }, TODAY).windowEnd).toBe("2026-12-31")
  })

  it("need nothing more once marked not needed", () => {
    const line = lineFor("1000000456", "1300", TODAY) as OarLine
    expect(isReady(line)).toBe(false)
    // No department either: a part not needed is reserved for nobody.
    expect(isReady({ ...line, decision: "not_needed" })).toBe(true)
    expect(needsDepartment({ ...line, decision: "not_needed" })).toBe(false)
  })

  it("ask a repairable row to decide only when a unit exists", () => {
    const overdue = { ...(lineFor("8000005632", "1300") as RepairableLine), department: "10300" }
    expect(lineIssues(overdue)).toEqual(["decision"])
    expect(isReady({ ...overdue, decision: "use_existing" })).toBe(true)
    expect(lineIssues({ ...overdue, decision: "proceed_new" })).toEqual(["reason", "explanation"])

    const none = lineFor("8000006590", "1500") as RepairableLine
    expect(none.decision).toBe("proceed_new")
    expect(lineIssues(none)).toEqual(["department"])
    expect(isReady({ ...none, department: "40100" })).toBe(true)
  })

  it("start every line without a department -- nothing is inherited", () => {
    for (const m of REQUEST_CATALOGUE) {
      const line = lineFor(m.materialId, m.plant, TODAY)
      if (line.kind === "i13" || line.kind === "i08") expect(line.department).toBe("")
    }
  })

  it("refuse the same material at the same plant twice", () => {
    const rows = [lineFor("1000000123", "1300")]
    expect(isDuplicate(rows, "0001000000123", "1300")).toBe(true)
    expect(isDuplicate(rows, "1000000123", "1500")).toBe(false)
  })
})

function sampleRequest(): RequestRecord {
  const oar = lineFor("1000000123", "1300", TODAY) as OarLine
  const pump = lineFor("8000005632", "1300") as RepairableLine
  const motor = lineFor("8000006120", "1300") as RepairableLine
  return submitRequest(
    [
      { ...oar, department: "10100", purpose: "Mill 3 reline" },
      lineFor("3000001122", "1300"),
      {
        ...pump,
        department: "10300",
        decision: "proceed_new",
        justification: { reasonCategory: "URGENT_BREAKDOWN", freeText: "Down" },
      },
      { ...motor, department: "10100", decision: "use_existing" },
    ],
    { requester: "J Miller", plant: "1300" },
    { requestId: requestIdFrom("7K2M4P8Q"), now: "2026-10-15T08:00:00.000Z" }
  )
}

describe("request record", () => {
  it("mints well-formed R references", () => {
    for (let i = 0; i < 100; i += 1) {
      const id = mintRequestId()
      expect(id).toMatch(/^R[0-9A-HJKMNP-TV-Z]{9}$/)
      expect(isWellFormed(id)).toBe(true)
    }
  })

  it("numbers only the rows that open a session, in the order added", () => {
    const request = sampleRequest()
    expect(request.lines.map((l) => [l.lineNo, l.material.materialId])).toEqual([
      [1, "1000000123"],
      [2, "8000005632"],
      [3, "8000006120"],
    ])
    expect(request.skipped.map((s) => s.materialId)).toEqual(["3000001122"])
    expect(lineReference(request.requestId, 2)).toBe(`${request.requestId}/2`)
  })

  it("keeps each line's department, and lists the request's departments once each", () => {
    const request = sampleRequest()
    expect(request.plant).toBe("1300")
    expect(request.lines.map((l) => l.department)).toEqual(["10100", "10300", "10100"])
    expect(departmentsOf(request)).toEqual(["10100", "10300"])
  })

  it("records whether the suggestion was kept", () => {
    const [oar, pump, valve] = sampleRequest().lines
    expect(outcomeSentence(oar.outcome)).toBe("Procure 4 -- the suggested quantity.")
    expect(outcomeSentence(pump.outcome)).toMatch(/justified/)
    expect(outcomeSentence(valve.outcome)).toMatch(/existing unit/)
  })
})

describe("linking an item text to a line", () => {
  const request = sampleRequest()
  const id = request.requestId
  const find = (rid: string) => (rid === id ? request : undefined)
  const pump = { materialId: "8000005632", plant: "1300" }

  it("reads every way of writing the suffix", () => {
    expect(requestReferencesIn(`${id}/2`)[0]).toMatchObject({ requestId: id, lineNo: 2, valid: true })
    expect(requestReferencesIn(`${id}-2`)[0].lineNo).toBe(2)
    expect(requestReferencesIn(`for mill 3 ${id} / 2 urgent`)[0].lineNo).toBe(2)
    expect(requestReferencesIn(`${id}`)[0].lineNo).toBeNull()
    expect(requestReferencesIn(`${id.slice(0, 4)} ${id.slice(4)}/2`)[0]).toMatchObject({ requestId: id, valid: true })
    expect(requestReferencesIn(id.toLowerCase())[0].valid).toBe(true)
  })

  it("links the right line with or without /n", () => {
    expect(resolveLink({ ...pump, sgtxt: `${id}/2` }, find)).toMatchObject({ status: "LINKED", line: { lineNo: 2 } })
    expect(resolveLink({ ...pump, sgtxt: id }, find)).toMatchObject({ status: "LINKED", line: { lineNo: 2 } })
  })

  it("still links a wrong /n by material, with a warning", () => {
    const result = resolveLink({ ...pump, sgtxt: `${id}/1` }, find)
    expect(result).toMatchObject({ status: "LINKED_WITH_WARNING", line: { lineNo: 2 } })
    expect(resolveLink({ ...pump, sgtxt: `${id}/9` }, find).notes[0]).toMatch(/no line \/9/)
  })

  it("flags a reservation for a line the requester declined", () => {
    const result = resolveLink({ materialId: "8000006120", plant: "1300", sgtxt: `${id}/3` }, find)
    expect(result.status).toBe("LINKED_WITH_WARNING")
    expect(result.notes.join(" ")).toMatch(/existing unit/)
  })

  it("does not link a material the request never assessed", () => {
    expect(resolveLink({ materialId: "3000001122", plant: "1300", sgtxt: `${id}/2` }, find).status).toBe(
      "NOT_ON_REQUEST"
    )
  })

  it("tells a typo, an unknown request and a missing reference apart", () => {
    const typo = id.slice(0, 5) + (id[5] === "A" ? "B" : "A") + id.slice(6)
    expect(resolveLink({ ...pump, sgtxt: `${typo}/2` }, find).status).toBe("INVALID")
    expect(resolveLink({ ...pump, sgtxt: requestIdFrom("ZZZZ9999") }, find).status).toBe("UNKNOWN_REQUEST")
    expect(resolveLink({ ...pump, sgtxt: "for mill 3" }, find).status).toBe("MISSING")
  })

  it("knows every catalogue material", () => {
    expect(findDemoMaterial("0008000005632", "1300")?.description).toBe("Pump, centrifugal")
  })
})
