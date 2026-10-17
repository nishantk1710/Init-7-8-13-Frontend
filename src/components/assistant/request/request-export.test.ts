import { describe, expect, it } from "vitest"

import type { ApiRequest, ApiRequestLine } from "@/lib/api/assistant-requests"

import { requestExportFilename, requestExportModel, toDocx, toPdf, toTxt } from "./request-export"

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

  it("carries the header facts and counts the screen shows", () => {
    expect(model.title).toBe("Request R46WFYXS1R")
    expect(Object.fromEntries(model.details)).toMatchObject({
      "Requested for": "nancy",
      Plant: "1300",
      Departments: "10301, 10101",
      Lines: "2",
      "To reserve": "2",
      "No session": "1",
    })
  })

  it("uses the screen's decision sentence and quantities", () => {
    expect(model.lines[0][3]).toEqual(["New unit -- none exists in stock or on repair."])
    expect(model.lines[1][3]).toEqual(["2 (suggested 0)", "Procure 2 although stock covers the year -- justified."])
    expect(model.lines[1][5]).toEqual(["Urgent Breakdown", "grgnj"])
  })

  it("shows not-linked and linked SAP items", () => {
    expect(model.lines[0][6]).toEqual(["Not linked yet"])
    expect(model.lines[1][6]).toEqual(['0012345678/0001 · SGTXT "R46WFYXS1R/2"'])
    expect(model.linkSummary).toBe("1 SAP reservation item linked so far.")
  })
})

describe("writers", () => {
  const model = requestExportModel(request)

  it("text has every line reference and the skipped material", () => {
    const txt = toTxt(model)
    expect(txt).toContain("R46WFYXS1R/1")
    expect(txt).toContain("Procure 2 although stock covers the year -- justified.")
    expect(txt).toContain("123 (Plant 1300): Not in the I13 data.")
  })

  it("Word and PDF produce non-empty files", async () => {
    const docx = await toDocx(model)
    expect(docx.size).toBeGreaterThan(1000)
    const pdf = await toPdf(model)
    expect(pdf.size).toBeGreaterThan(1000)
    expect(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 5))).toBe("%PDF-")
  }, 20_000)

  it("names the file after the request and day", () => {
    expect(requestExportFilename(request, "pdf", new Date(2026, 9, 17))).toBe("request-R46WFYXS1R-2026-10-17.pdf")
  })
})
