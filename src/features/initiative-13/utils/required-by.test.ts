import { describe, expect, it } from "vitest"

import { requiredBy, requiredByText } from "./required-by"

const row = {
  sessionId: null as string | null,
  planRecorded: false,
  plannedStart: null as string | null,
  plannedEnd: null as string | null,
  requirementDate: "2026-11-03" as string | null,
  createdDate: "2026-11-03" as string | null,
}
const assistant = { ...row, sessionId: "S1", planRecorded: true, plannedStart: "2026-11-04", plannedEnd: "2026-11-17" }

describe("Required by (agreed 26 Nov 2026): a typed SAP date, else the assistant's window, else Not recorded", () => {
  it("an assistant reservation with SAP's pre-filled date reads its planned consumption window", () => {
    expect(requiredBy(assistant)).toEqual({ kind: "plan", text: "04 Nov 2026 → 17 Nov 2026" })
  })

  it("a requirement date typed in SAP wins, for an assistant reservation too", () => {
    expect(requiredBy({ ...assistant, requirementDate: "2026-12-15" })).toEqual({ kind: "sap", text: "15 Dec 2026" })
  })

  it("an assistant reservation with no plan, or a plan with no window, says so", () => {
    expect(requiredByText({ ...row, sessionId: "S1" })).toBe("No plan recorded")
    expect(requiredByText({ ...row, sessionId: "S1", planRecorded: true })).toBe("No window given")
  })

  it("a Non-AI reservation with SAP's pre-filled date is Not recorded", () => {
    expect(requiredByText(row)).toBe("Not recorded")
  })

  it("a Non-AI reservation with a requirement date typed in SAP shows it", () => {
    expect(requiredByText({ ...row, requirementDate: "2026-12-15" })).toBe("15 Dec 2026")
  })

  it("a reservation SAP made itself (no created date) is Not recorded too", () => {
    // 219937 / 829147, copper concentrate: no CRDAT, BDTER 01 Dec 2026 (user, 26 Nov 2026).
    expect(requiredByText({ ...row, createdDate: null, requirementDate: "2026-12-01" })).toBe("Not recorded")
  })
})
