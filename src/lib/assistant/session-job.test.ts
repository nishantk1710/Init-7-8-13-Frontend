import { describe, expect, it } from "vitest"

import { formatApiDate } from "@/lib/api/format"
import type { ApiSessionJob } from "@/lib/api/i8"
import { NOT_LINKED_TEXT, repairRowHref, sessionJobView } from "@/lib/assistant/session-job"

const job = (overrides: Partial<ApiSessionJob> = {}): ApiSessionJob => ({
  sessionId: "R-ABC",
  reservations: [],
  repairs: [],
  ...overrides,
})

describe("the job behind a repairable session", () => {
  it("reads a 404 or an empty answer as not linked yet", () => {
    expect(sessionJobView(null)).toEqual({ kind: "not-linked", text: NOT_LINKED_TEXT })
    expect(sessionJobView(job())).toEqual({ kind: "not-linked", text: NOT_LINKED_TEXT })
  })

  it("shows the reservation with its 261 and 262 movements", () => {
    const view = sessionJobView(
      job({
        reservations: [
          {
            reservation: "0000123",
            item: "0001",
            order: "",
            material: "8000005632",
            plant: "1300",
            quantity: "2.000",
            requirementDate: "2026-05-04",
            issued: [{ postedOn: "2026-05-05", quantity: "1.000" }],
            returned: [{ postedOn: "2026-06-01", quantity: "1" }],
          },
        ],
      })
    )
    expect(view.kind).toBe("linked")
    if (view.kind !== "linked") return
    expect(view.reservations[0]).toEqual({
      key: "0000123-0001",
      reference: "0000123/0001",
      order: null,
      quantity: "2",
      requirementDate: formatApiDate("2026-05-04"),
      issued: [{ date: formatApiDate("2026-05-05"), quantity: "1" }],
      returned: [{ date: formatApiDate("2026-06-01"), quantity: "1" }],
    })
    expect(view.repairs).toEqual([])
  })

  it("links each repair row to its register page", () => {
    const view = sessionJobView(
      job({
        repairs: [
          { rowId: "PR-0010001-00010", type: "PR", document: "0010001", item: "00010", status: "Requested" },
          { rowId: "4500001-00010", type: "PO", document: "4500001", item: "00010", status: "At vendor" },
        ],
      })
    )
    if (view.kind !== "linked") throw new Error("expected linked")
    expect(view.repairs.map((r) => [r.label, r.href])).toEqual([
      ["Repair request 0010001/00010", "/repairable-spares/repair-register/PR-0010001-00010"],
      ["Repair order 4500001/00010", "/repairable-spares/repair-register/4500001-00010"],
    ])
    expect(repairRowHref("a/b")).toBe("/repairable-spares/repair-register/a%2Fb")
  })
})
