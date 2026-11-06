import { describe, expect, it } from "vitest"

import type { ApiRequest, ApiRequestLine } from "@/lib/api/assistant-requests"

import { exportFilename, toDocx, toPdf, toTxt } from "@/lib/export-document"

import { requestDocument, requestExportModel } from "./request-export"

const line = (over: Partial<ApiRequestLine>): ApiRequestLine => ({
  lineNo: 1,
  reference: "R46WFYXS1R/1",
  sessionId: "S1",
  flow: "i08",
  outcome: "COMPLETED",
  materialId: "8000000002",
  materialDescription: "ACCUMULATOR,HYD,ATLAS",
  plant: "1300",
  department: "10301",
  decision: null,
  plannedQuantity: null,
  suggestedQuantity: null,
  acceptedQuantity: null,
  windowStart: null,
  windowEnd: null,
  purpose: null,
  justification: null,
  linkedReservations: [],
  ...over,
})

const request: ApiRequest = {
  requestId: "R46WFYXS1R",
  plant: "1300",
  requestedFor: "nancy",
  requester: "nancy",
  origin: "web",
  issuedAt: "2026-10-17T10:49:53Z",
  // An older request whose lines named two departments: no single department.
  department: null,
  departments: ["10301", "10101"],
  lines: [
    line({}),
    line({
      lineNo: 2,
      reference: "R46WFYXS1R/2",
      flow: "i13",
      materialId: "5000017773",
      materialDescription: "EXTINGUISHER FIRE 9 KG",
      department: "10101",
      decision: "proceed",
      plannedQuantity: "2.000",
      suggestedQuantity: "0",
      windowStart: "2026-10-17",
      windowEnd: "2027-03-17",
      purpose: "fkewjkjw",
      justification: { kind: "QUANTITY", reasonCategory: "URGENT_BREAKDOWN", freeText: "grgnj" },
      linkedReservations: [
        {
          reservationNumber: "0012345678",
          reservationItem: "0001",
          material: "5000017773",
          plant: "1300",
          source: "SAP",
          sgtxt: "R46WFYXS1R/2",
          firstSeenAt: "2026-10-17T11:00:00Z",
          note: null,
        },
      ],
    }),
  ],
  skipped: [{ materialId: "123", plant: "1300", kind: "NO_DATA", reason: "Not in the I13 data." }],
  replayed: false,
}

describe("requestExportModel", () => {
  const model = requestExportModel(request)
  /** A line's cell under a column, by the column's name. */
  const cell = (m: typeof model, line: number, column: string) => m.lines[line][m.columns.indexOf(column)]

  it("shows a request's one department", () => {
    const single = requestExportModel({ ...request, department: "10301", departments: ["10301"] })
    expect(Object.fromEntries(single.details).Department).toBe("10301")
  })

  it("carries the header facts and counts the screen shows", () => {
    expect(model.title).toBe("Request R46WFYXS1R")
    expect(Object.fromEntries(model.details)).toMatchObject({
      "Requested for": "nancy",
      Plant: "1300",
      Department: "10301, 10101",
      Lines: "2",
      "To reserve": "2",
      "No session": "1",
    })
  })

  it("tells the requester to type the bare request reference into the SAP header", () => {
    expect(Object.fromEntries(model.details)["Type in SAP"]).toBe("R46WFYXS1R")
    expect(model.note).toContain("type R46WFYXS1R into its header text")
    expect(model.note).not.toContain("R46WFYXS1R/")
  })

  it("uses the screen's decision sentence and quantities", () => {
    expect(cell(model, 0, "Decision")).toEqual(["New unit: none exists in stock or on repair."])
    expect(cell(model, 1, "Decision")).toEqual(["2 (suggested 0)", "Procure 2 although stock covers the year, justified."])
    expect(cell(model, 1, "Reason given")).toEqual(["Urgent Breakdown", "grgnj"])
  })

  it("shows not-linked and linked SAP items", () => {
    expect(cell(model, 0, "SAP link")).toEqual(["Not linked yet"])
    expect(cell(model, 1, "SAP link")).toEqual(['0012345678/0001 · SGTXT "R46WFYXS1R/2"'])
    expect(model.linkSummary).toBe("1 SAP reservation item linked so far.")
  })

  it("gives a mixed request both columns, each filled only for its kind of line (4-Nov-2026)", () => {
    expect(model.columns).toEqual([
      "Reference", "Material", "Decision", "Window · purpose", "Declaration", "Reason given", "SAP link",
    ])
    expect(cell(model, 0, "Window · purpose")).toEqual(["—"])
    expect(cell(model, 0, "Declaration")).toEqual(["Not declared"])
    expect(cell(model, 1, "Window · purpose")[1]).toBe("fkewjkjw")
    expect(cell(model, 1, "Declaration")).toEqual(["—"])
  })

  it("gives a repairable-only request no window and purpose, and says what was declared", () => {
    const repairable = requestExportModel({
      ...request,
      lines: [
        line({
          declaration: {
            id: "ATT-1", recommendation: "REPAIRABLE", conditionDescription: "", faultCategory: "SEAL_LEAK",
            quantity: "2.000", attestorName: "J Miller", attestedAt: "2026-11-04T09:00:00Z",
            evidenceReference: null, repairDocument: null, repairItem: null, repairDocumentType: null,
          },
        }),
        line({ lineNo: 2, reference: "R46WFYXS1R/2", declaration: null }),
      ],
    })
    expect(repairable.columns).not.toContain("Window · purpose")
    const [declared] = cell(repairable, 0, "Declaration") as string[]
    expect(declared).toMatch(/^2 units · .+ · Repairable, declared by J Miller$/)
    expect(cell(repairable, 1, "Declaration")).toEqual(["Not declared"])
  })

  it("gives an OAR-only request no declaration column", () => {
    const oar = requestExportModel({ ...request, lines: [request.lines[1]] })
    expect(oar.columns).not.toContain("Declaration")
    expect(oar.columns).toContain("Window · purpose")
  })
})

describe("writers", () => {
  const model = requestExportModel(request)
  const doc = requestDocument(model)

  it("text has every line reference and the skipped material", () => {
    const txt = toTxt(doc)
    expect(txt).toContain("R46WFYXS1R/1")
    expect(txt).toContain("Procure 2 although stock covers the year, justified.")
    expect(txt).toContain("Not in the I13 data.")
  })

  it("Word and PDF produce non-empty files", async () => {
    const docx = await toDocx(doc)
    expect(docx.size).toBeGreaterThan(1000)
    const pdf = await toPdf(doc)
    expect(pdf.size).toBeGreaterThan(1000)
    expect(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 5))).toBe("%PDF-")
  }, 20_000)

  it("names the file after the request and day", () => {
    expect(exportFilename("request", request.requestId, "pdf", new Date(2026, 9, 17))).toBe("request-R46WFYXS1R-2026-10-17.pdf")
  })
})
