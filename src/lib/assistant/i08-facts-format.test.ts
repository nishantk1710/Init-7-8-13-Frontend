import { describe, expect, it } from "vitest"

import {
  dueBackNullNote,
  I08_WANT_NEW_NOTE,
  isPositiveQuantity,
  needDateAdviceOf,
  noUsableUnitText,
  openRepairsSuffix,
  repairRequestCountOf,
  repairRequestsOf,
  requestAgePhrase,
  requestDepartmentText,
  requestReference,
  stockFigure,
  stockView,
  unitsText,
} from "./i08-facts-format"

/** The I08 keys a record from before 27-Oct-2026 carries (none of the new ones). */
const legacy = {
  flow: "i08",
  plant: "1300",
  headline: "There is 1 in stock at plant 1300.",
  caveats: [],
  referenceDate: "2026-06-05",
  materialId: "8000004885",
  stockOnHand: "1",
  stockIsUnknown: false,
  openRepairLines: 0,
  openRepairs: [],
}

const request = {
  purchaseRequisition: "2000029113",
  item: "10",
  quantity: "1",
  requestedAt: "2025-10-09",
  daysSinceRequested: 239,
  department: "10305",
  departmentName: "Engineering",
  repairOrder: "0000123456",
}

describe("repairRequestsOf", () => {
  it("is empty for an older record", () => {
    expect(repairRequestsOf(legacy)).toEqual([])
    expect(repairRequestCountOf(legacy)).toBe(0)
  })

  it("returns the stored requests and drops malformed entries", () => {
    const facts = { ...legacy, openRepairRequests: [request, null, { item: "20" }] }
    expect(repairRequestsOf(facts)).toEqual([request])
  })

  it("is empty for non-records", () => {
    expect(repairRequestsOf(null)).toEqual([])
    expect(repairRequestsOf("x")).toEqual([])
    expect(repairRequestsOf({ openRepairRequests: "nope" })).toEqual([])
  })

  it("prefers the backend's count over the list length", () => {
    expect(repairRequestCountOf({ ...legacy, openRepairRequestLines: 0, openRepairRequests: [] })).toBe(0)
    expect(repairRequestCountOf({ ...legacy, openRepairRequestLines: 3, openRepairRequests: [request] })).toBe(3)
    expect(repairRequestCountOf({ ...legacy, openRepairRequests: [request] })).toBe(1)
  })
})

describe("requestAgePhrase", () => {
  it("words the stored age", () => {
    expect(requestAgePhrase(0)).toBe("requested today")
    expect(requestAgePhrase(1)).toBe("requested 1 day ago")
    expect(requestAgePhrase(239)).toBe("requested 239 days ago")
  })

  it("says the date is not known when there is none", () => {
    expect(requestAgePhrase(null)).toBe("request date not known")
    expect(requestAgePhrase(undefined)).toBe("request date not known")
  })

  it("never shows a negative age", () => {
    expect(requestAgePhrase(-2)).toBe("requested today")
  })
})

describe("request text", () => {
  it("shows the department as code and name, or the code alone", () => {
    expect(requestDepartmentText(request)).toBe("10305 · Engineering")
    expect(requestDepartmentText({ department: "10305", departmentName: null })).toBe("10305")
    expect(requestDepartmentText({ department: null, departmentName: null })).toBeNull()
  })

  it("builds the PR reference", () => {
    expect(requestReference(request)).toBe("PR 2000029113/10")
    expect(requestReference({ purchaseRequisition: "2000029113", item: "" })).toBe("PR 2000029113")
  })
})

describe("stockView", () => {
  it("leaves an older record as it was", () => {
    expect(stockView(legacy)).toEqual({ state: "legacy", usable: null, damaged: null, total: "1" })
  })

  it("keeps 'no stock record' on an older record", () => {
    expect(stockView({ ...legacy, stockOnHand: "0", stockIsUnknown: true }).state).toBe("no-record")
  })

  it("splits usable from damaged when the condition is known", () => {
    const facts = {
      ...legacy,
      stockOnHand: "3",
      usableStock: "2",
      damagedStock: "1",
      stockConditionKnown: true,
      stockSource: "MCHB",
    }
    expect(stockView(facts)).toEqual({ state: "known", usable: "2", damaged: "1", total: "3" })
  })

  it("shows the total with condition unknown on the fallback", () => {
    const facts = {
      ...legacy,
      stockOnHand: "4",
      usableStock: null,
      damagedStock: null,
      stockConditionKnown: false,
      stockSource: "MARD",
    }
    expect(stockView(facts)).toEqual({ state: "condition-unknown", usable: null, damaged: null, total: "4" })
  })

  it("says there is no record when a new record has no stock source", () => {
    const facts = {
      ...legacy,
      stockOnHand: "0",
      stockIsUnknown: true,
      usableStock: null,
      damagedStock: null,
      stockConditionKnown: false,
      stockSource: null,
    }
    expect(stockView(facts)).toEqual({ state: "no-record", usable: null, damaged: null, total: null })
  })

  it("reads a malformed record as an older one with no figure, without crashing", () => {
    expect(stockView(null)).toEqual({ state: "legacy", usable: null, damaged: null, total: null })
  })
})

describe("isPositiveQuantity", () => {
  it("is true only above zero", () => {
    expect(isPositiveQuantity("1")).toBe(true)
    expect(isPositiveQuantity("0.500")).toBe(true)
    expect(isPositiveQuantity("0")).toBe(false)
    expect(isPositiveQuantity("0.000")).toBe(false)
    expect(isPositiveQuantity(null)).toBe(false)
    expect(isPositiveQuantity(undefined)).toBe(false)
    expect(isPositiveQuantity("n/a")).toBe(false)
  })
})

describe("dueBackNullNote", () => {
  it("keeps today's notes on an older record", () => {
    expect(dueBackNullNote(legacy)).toBe("no open repair PO")
    expect(dueBackNullNote({ ...legacy, openRepairLines: 2 })).toBe("no date promised")
  })

  it("says not ordered yet when only repair requests are open", () => {
    expect(dueBackNullNote({ ...legacy, openRepairRequestLines: 1, openRepairRequests: [request] })).toBe(
      "not ordered yet"
    )
  })

  it("prefers the PO note when POs and requests are both open", () => {
    expect(dueBackNullNote({ ...legacy, openRepairLines: 1, openRepairRequestLines: 1 })).toBe("no date promised")
  })

  it("is the no-repair note when the switch is off", () => {
    expect(dueBackNullNote({ ...legacy, openRepairRequestLines: 0, openRepairRequests: [] })).toBe(
      "no open repair PO"
    )
  })
})

describe("needDateAdviceOf", () => {
  const sentence =
    "A repaired unit is due back on 12 Jun 2026. If your job can wait, set the need date after that, and no new unit is bought."

  it("returns the backend's sentence as sent", () => {
    expect(needDateAdviceOf({ ...legacy, needDateAdvice: sentence })).toBe(sentence)
  })

  it("is null when absent, null or blank", () => {
    expect(needDateAdviceOf(legacy)).toBeNull()
    expect(needDateAdviceOf({ ...legacy, needDateAdvice: null })).toBeNull()
    expect(needDateAdviceOf({ ...legacy, needDateAdvice: "  " })).toBeNull()
    expect(needDateAdviceOf(undefined)).toBeNull()
  })
})

describe("stockFigure", () => {
  const split = { ...legacy, stockOnHand: "3", usableStock: "2", damagedStock: "1", stockConditionKnown: true, stockSource: "MCHB" }

  it("shows an older record exactly as before", () => {
    expect(stockFigure(legacy)).toEqual({ label: "Stock available", value: "1", nullNote: "no stock record", suffix: null })
    expect(stockFigure({ ...legacy, stockOnHand: "0", stockIsUnknown: true })).toEqual({
      label: "Stock available",
      value: null,
      nullNote: "no stock record",
      suffix: null,
    })
  })

  it("shows usable stock and names the damaged units as not counted", () => {
    expect(stockFigure(split)).toEqual({
      label: "Usable stock",
      value: "2",
      nullNote: "—",
      suffix: "1 damaged, not counted",
    })
    expect(stockFigure({ ...split, damagedStock: "0" }).suffix).toBeNull()
  })

  it("shows a damaged-only part as zero usable, not as an empty shelf", () => {
    const f = stockFigure({ ...split, stockOnHand: "1", usableStock: "0", damagedStock: "1" })
    expect(f.value).toBe("0")
    expect(f.suffix).toBe("1 damaged, not counted")
  })

  it("marks the total as condition unknown on the fallback, but not an empty shelf", () => {
    const fallback = { ...legacy, stockOnHand: "4", stockConditionKnown: false, stockSource: "MARD" }
    expect(stockFigure(fallback)).toEqual({ label: "Stock available", value: "4", nullNote: "—", suffix: "condition unknown" })
    expect(stockFigure({ ...fallback, stockOnHand: "0" }).suffix).toBeNull()
  })
})

describe("repair request wording", () => {
  it("adds the requested count beside the open repair POs", () => {
    expect(openRepairsSuffix(legacy)).toBeNull()
    expect(openRepairsSuffix({ ...legacy, openRepairRequestLines: 0 })).toBeNull()
    expect(openRepairsSuffix({ ...legacy, openRepairRequestLines: 2 })).toBe("+2 requested, not ordered")
  })

  it("words a quantity as units", () => {
    expect(unitsText("1")).toBe("1 unit")
    expect(unitsText("2")).toBe("2 units")
  })

  it("keeps the old 'nothing exists' text on an older record", () => {
    expect(noUsableUnitText({ ...legacy, stockOnHand: "0" })).toBe("None in stock, none on repair.")
  })

  it("names damaged units and requested repairs instead of an empty shelf", () => {
    const damagedOnly = { ...legacy, stockOnHand: "1", usableStock: "0", damagedStock: "1", stockConditionKnown: true }
    expect(noUsableUnitText(damagedOnly)).toBe("Nothing usable in stock (1 damaged, not usable), none on repair.")
    expect(noUsableUnitText({ ...legacy, stockOnHand: "0", openRepairRequestLines: 2 })).toBe(
      "None in stock, 2 repairs requested, not yet ordered."
    )
  })

  it("carries the 'I want new' note word for word", () => {
    expect(I08_WANT_NEW_NOTE).toBe(
      "Your reason is kept on the platform. It doesn't buy anything: the reservation takes whatever usable stock the plant has, and a new unit is bought only when MRP or an inventory controller raises a purchase request. The desk that raises it won't see your reason."
    )
  })
})
