import { describe, expect, it } from "vitest"

import type { SessionTraceResponse } from "@/lib/api/assistant"
import { toDocx, toPdf, toTxt, type ExportBlock } from "@/lib/export-document"

import { exportId, sessionDocument } from "./session-export"

const i13: SessionTraceResponse = {
  materialDescription: "EXTINGUISHER FIRE 9 KG",
  sessionId: "S8K2M4P6Q9",
  flow: "i13",
  outcome: "COMPLETED",
  materialId: "5000017773",
  plant: "1300",
  department: "10101",
  requestedFor: "nancy",
  requestedQuantity: null,
  requester: "coordinator",
  origin: "PLATFORM",
  issuedAt: "2026-10-17T10:49:53Z",
  expiresAt: "2026-11-17T10:49:53Z",
  expired: false,
  routingReason: "OAR material at plant 1300.",
  assessment: {
    flow: "i13",
    plant: "1300",
    headline: "Stock covers 14 months at the current rate.",
    caveats: ["Consumption is from the last 12 months only."],
    referenceDate: "2026-10-16",
    material: "5000017773",
    requestedQuantity: null,
    stockOnHand: "12",
    openPoQuantity: "0",
    averageMonthlyConsumption: "0.85",
    monthsOfCover: null,
    monthsOfCoverReason: "INSUFFICIENT_HISTORY",
    projectedMonthsOfCover: null,
    daysSinceLastMovement: 40,
    daysSinceLastIssue: 40,
    lastMovementDate: "2026-09-06",
    consumptionCount12m: 2,
    consumedQty12m: "10",
    agingBand: "FAST",
    inventoryTurns: null,
    grNotIssuedFlag: true,
    grNotIssuedDaysSinceGr: 45,
    acquiredVsPlanStatus: "ON_PLAN",
    materialScope: "OAR",
    crossPlantStock: [{ plant: "1400", stockOnHand: "3" }],
  },
  narrative: null,
  turns: [
    {
      sequence: 1,
      stepId: "q",
      stepKind: "choice",
      question: "Still needed?",
      answer: { choice: "yes" },
      actor: "nancy",
      answeredAt: "2026-10-17T10:50:00Z",
    },
  ],
  plans: [
    {
      id: "p1",
      material: "5000017773",
      plant: "1300",
      purpose: "fkewjkjw",
      plannedQuantity: "2",
      windowStart: "2026-10-17",
      windowEnd: "2027-03-17",
      costCentre: null,
      orderNumber: null,
      status: "OPEN",
      reservationNumber: null,
      reservationItem: null,
      capturedBy: "nancy",
      capturedAt: "2026-10-17T10:51:00Z",
    },
  ],
  quantitySuggestions: [
    {
      id: "q1",
      material: "5000017773",
      plant: "1300",
      requestedQuantity: "2",
      suggestedQuantity: "0",
      acceptedQuantity: "2",
      suggestionReason: "Stock covers the year.",
      monthsOfCover: "14",
      coverCeilingMonths: "12",
      lookbackMonths: 12,
      minHistoryConsumptions: 3,
      consumptionCount: 2,
      isOverride: true,
      suggestedAt: "2026-10-17T10:51:00Z",
    },
  ],
  justifications: [
    {
      id: "j1",
      sessionId: "S8K2M4P6Q9",
      exceptionId: null,
      kind: "QUANTITY_OVERRIDE",
      reasonCategory: "URGENT_BREAKDOWN",
      freeText: "grgnj",
      materialId: "5000017773",
      plant: "1300",
      author: "nancy",
      recordedAt: "2026-10-17T10:52:00Z",
    },
  ],
  linkedReservations: [],
  linkageNote: "No reservation carries this session's ID yet.",
}

const i08: SessionTraceResponse = {
  ...i13,
  flow: "i08",
  materialId: "8000000002",
  materialDescription: null,
  requestedFor: null,
  department: null,
  assessment: {
    flow: "i08",
    plant: "1300",
    headline: "A unit is on repair.",
    caveats: [],
    referenceDate: "2026-10-16",
    materialId: "8000000002",
    description: "ACCUMULATOR",
    criticality: "A",
    repairableUnitExists: true,
    sources: ["ON_REPAIR_ORDER"],
    stockOnHand: "0",
    stockIsUnknown: true,
    openRepairLines: 1,
    quantityUnderRepair: "1",
    soonestDueDate: "2026-05-01",
    overdueLines: 1,
    repairDueDateIsReliable: false,
    newUnitLeadTimeDays: 90,
    waitingBeatsBuying: null,
    openRepairs: [
      {
        purchasingDocument: "4500000001",
        item: "10",
        quantity: "1",
        raisedAt: null,
        dueDate: "2026-05-01",
        daysOverdue: 169,
        vendor: "V1",
        vendorName: null,
        status: "OPEN",
        dispatched: false,
      },
    ],
  },
  plans: [],
  quantitySuggestions: [],
  justifications: [],
  linkedReservations: [
    {
      reservationNumber: "0012345678",
      reservationItem: "0001",
      material: "8000000002",
      plant: "1300",
      source: "SGTXT",
      sgtxt: "S8K2M4P6Q9",
      firstSeenAt: "2026-10-17T11:00:00Z",
    },
  ],
}

/** The I08 record as stored (the trace types it `unknown`), for variants. */
const i08Assessment = i08.assessment as Record<string, unknown>

const fields = (blocks: ExportBlock[]) =>
  Object.fromEntries(blocks.flatMap((b) => (b.kind === "fields" ? b.rows : [])))
const text = (blocks: ExportBlock[]) => toTxt({ title: "", generatedAt: "", blocks })

describe("sessionDocument", () => {
  it("carries the header and the I13 figures as the card shows them", () => {
    const doc = sessionDocument(i13)
    expect(doc.title).toBe("Assistant session S8K2M4P6Q9")
    expect(fields(doc.blocks)).toMatchObject({
      "Session reference": "S8K2M4P6Q9",
      Outcome: "Completed",
      Material: "EXTINGUISHER FIRE 9 KG (5000017773)",
      Requester: "nancy",
      "Months of cover": "not enough consumption history",
      "Stock type": "Fast-moving · 40 days since last movement",
    })
    const txt = text(doc.blocks)
    expect(txt).toContain("Stock received 45 days ago has still not been issued")
    expect(txt).toContain("Held at other plants: 3 at 1400.")
    expect(txt).toContain("Consumption is from the last 12 months only.")
    expect(txt).toContain("The requester kept their own quantity.")
    expect(txt).toContain("quantity override")
  })

  it("names the request for a line of a multi-material request", () => {
    const doc = sessionDocument({ ...i13, requestId: "R5B61EQBGQ", lineNo: 2, reference: "R5B61EQBGQ/2" })
    expect(doc.title).toBe("Assistant session R5B61EQBGQ/2")
    const rows = fields(doc.blocks)
    expect(rows).toMatchObject({
      "Request line": "R5B61EQBGQ/2",
      "Type in SAP": "R5B61EQBGQ",
    })
    expect(rows).not.toHaveProperty("Session reference")
    expect(text(doc.blocks)).not.toContain("S8K2M4P6Q9")
    expect(exportId({ ...i13, requestId: "R5B61EQBGQ", lineNo: 2 })).toBe("R5B61EQBGQ-2")
    expect(exportId(i13)).toBe("S8K2M4P6Q9")
    expect(text(doc.blocks)).toContain("request R5B61EQBGQ for this material")
  })

  it("leaves the conversation turns out", () => {
    expect(text(sessionDocument(i13).blocks)).not.toContain("Still needed?")
  })

  it("says 'not stated' and renders the I08 repair lines", () => {
    const doc = sessionDocument(i08)
    expect(fields(doc.blocks)).toMatchObject({
      Requester: "not stated",
      Department: "not stated",
      "Stock available": "no stock record",
      "Earliest due back": "2026-05-01 (no longer a forecast)",
    })
    const txt = text(doc.blocks)
    expect(txt).toContain("4500000001/10")
    expect(txt).toContain("169 days")
    expect(txt).toContain("0012345678/0001")
    expect(txt).not.toContain("CONSUMPTION PLAN")
  })

  it("downloads an older I08 record exactly as before", () => {
    const doc = sessionDocument({
      ...i08,
      assessment: { ...i08Assessment, stockIsUnknown: false, stockOnHand: "2", openRepairLines: 0, soonestDueDate: null },
    })
    expect(fields(doc.blocks)).toMatchObject({
      "Stock available": "2",
      "Open repairs": "0",
      "Earliest due back": "no open repair PO",
    })
    expect(doc.blocks.some((b) => b.kind === "table" && b.columns[0] === "Requested, not yet ordered")).toBe(false)
    expect(text(doc.blocks)).not.toContain("Usable stock")
  })

  it("renders requested repairs, the usable/damaged split and the need-date line", () => {
    const advice =
      "A repaired unit is due back on 12 Nov 2026. If your job can wait, set the need date after that, and no new unit is bought."
    const doc = sessionDocument({
      ...i08,
      assessment: {
        ...i08Assessment,
        stockOnHand: "3",
        stockIsUnknown: false,
        usableStock: "2",
        damagedStock: "1",
        stockConditionKnown: true,
        stockSource: "MCHB",
        openRepairLines: 0,
        openRepairs: [],
        overdueLines: 0,
        soonestDueDate: null,
        openRepairRequestLines: 2,
        openRepairRequests: [
          {
            purchaseRequisition: "2000029113",
            item: "10",
            quantity: "1",
            requestedAt: "2026-02-19",
            daysSinceRequested: 239,
            department: "10305",
            departmentName: "Engineering",
            repairOrder: "0000123456",
          },
          {
            purchaseRequisition: "2000029200",
            item: "20",
            quantity: "2",
            requestedAt: null,
            daysSinceRequested: null,
            department: null,
            departmentName: null,
            repairOrder: null,
          },
        ],
        needDateAdvice: advice,
      },
    })
    const rows = fields(doc.blocks)
    expect(rows).toMatchObject({
      "Usable stock": "2 (1 damaged, not counted)",
      "Open repairs": "0 (+2 requested, not ordered)",
      "Earliest due back": "not ordered yet",
    })
    expect(rows).not.toHaveProperty("Stock available")
    const table = doc.blocks.find((b) => b.kind === "table" && b.columns[0] === "Requested, not yet ordered")
    expect(table).toMatchObject({
      rows: [
        [["PR 2000029113/10"], ["1"], ["requested 239 days ago"], ["10305 · Engineering"]],
        [["PR 2000029200/20"], ["2"], ["request date not known"], ["not stated"]],
      ],
    })
    expect(text(doc.blocks)).toContain(advice)
  })

  it("marks the stock total as condition unknown on the fallback", () => {
    const doc = sessionDocument({
      ...i08,
      assessment: {
        ...i08Assessment,
        stockOnHand: "4",
        stockIsUnknown: false,
        usableStock: null,
        damagedStock: null,
        stockConditionKnown: false,
        stockSource: "MARD",
      },
    })
    expect(fields(doc.blocks)).toMatchObject({ "Stock available": "4 (condition unknown)" })
  })

  it("Word and PDF produce files", async () => {
    const doc = sessionDocument(i13)
    expect((await toDocx(doc)).size).toBeGreaterThan(1000)
    expect((await toPdf(doc)).size).toBeGreaterThan(1000)
  }, 20_000)
})
