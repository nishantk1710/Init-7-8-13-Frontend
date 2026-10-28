import { describe, expect, it } from "vitest"

import type { ApiLinkedReservation } from "@/lib/api/assistant"
import type { ApiSessionJob } from "@/lib/api/i8"
import { linkedInSapView, NOT_LINKED_TEXT, repairRowHref, sessionJobView } from "@/lib/assistant/session-job"

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
      requirementDate: "04 May 2026",
      issued: [{ date: "05 May 2026", quantity: "1" }],
      returned: [{ date: "01 Jun 2026", quantity: "1" }],
    })
    expect(view.repairs).toEqual([])
  })

  it("links each repair row to its register page", () => {
    const view = sessionJobView(
      job({
        repairs: [
          { rowId: "PR-0010001-00010", type: "PR", document: "0010001", item: "00010", status: "Requested" },
          { rowId: "4500001-00010", type: "PO", document: "4500001", item: "00010", status: "PO Issued" },
        ],
      })
    )
    if (view.kind !== "linked") throw new Error("expected linked")
    expect(view.repairs.map((r) => [r.label, r.href, r.status])).toEqual([
      ["Repair request PR 0010001/00010", "/repairable-spares/repair-register/PR-0010001-00010", "Requested"],
      ["Repair PO 4500001/00010", "/repairable-spares/repair-register/4500001-00010", "PO issued"],
    ])
    expect(repairRowHref("a/b")).toBe("/repairable-spares/repair-register/a%2Fb")
  })
})

describe("Linked in SAP: one panel", () => {
  const link = (overrides: Partial<ApiLinkedReservation> = {}): ApiLinkedReservation => ({
    reservationNumber: "0000123",
    reservationItem: "0001",
    material: "8000005632",
    plant: "1300",
    source: "SGTXT",
    sgtxt: "R3D2KEMVAR",
    firstSeenAt: "2026-10-28T08:00:00Z",
    ...overrides,
  })
  const withJob = sessionJobView(
    job({
      reservations: [
        {
          reservation: "0000123",
          item: "0001",
          order: "940000005274",
          material: "8000005632",
          plant: "1300",
          quantity: "2.000",
          requirementDate: "2026-05-04",
          issued: [{ postedOn: "2026-05-05", quantity: "1.000" }],
          returned: [],
        },
      ],
      repairs: [{ rowId: "4500001-00010", type: "PO", document: "4500001", item: "00010", status: "PO Issued" }],
    })
  )

  it("says not linked when neither the trace nor the job names a reservation", () => {
    expect(linkedInSapView({ flow: "i08", sessionId: "S1", linked: [], job: sessionJobView(null) })).toEqual({
      linked: false,
      reservations: [],
      repairs: [],
    })
    // An older backend sends no links at all; still one plain answer.
    expect(linkedInSapView({ flow: "i13", sessionId: "S1", linked: undefined, job: null }).linked).toBe(false)
  })

  it("merges the trace's link into the job's reservation, once", () => {
    const view = linkedInSapView({ flow: "i08", sessionId: "S1", linked: [link({ reservationNumber: "123", reservationItem: "1" })], job: withJob })
    expect(view.linked).toBe(true)
    expect(view.reservations).toEqual([
      {
        key: "0000123-0001",
        reference: "0000123/0001",
        href: null,
        fromUat: false,
        order: "940000005274",
        needed: "2 needed by 04 May 2026",
        issued: [{ date: "05 May 2026", quantity: "1" }],
        returned: [],
      },
    ])
    expect(view.repairs.map((r) => r.label)).toEqual(["Repair PO 4500001/00010"])
  })

  it("lists an OAR link on its own, opening the ledger, and marks a UAT link", () => {
    const view = linkedInSapView({ flow: "i13", sessionId: "S1", linked: [link({ source: "UAT_SGTXT" })], job: null })
    expect(view.reservations).toEqual([
      {
        key: "linked-0000123-0001",
        reference: "0000123/0001",
        href: "/oar-utilization/ledger?view=reservations&session=S1",
        fromUat: true,
        order: null,
        needed: null,
        issued: null,
        returned: null,
      },
    ])
  })
})
