import { describe, expect, it } from "vitest"

import {
  issuedUnknownReason,
  lifecycleView,
  reservationStatusOption,
  reservationStatusQuery,
} from "@/features/initiative-13/utils/reservation-lifecycle"

describe("lifecycleView", () => {
  it("reads as five stages in the order things happen", () => {
    expect(
      ["RESERVED", "PR_CREATED", "ORDERED", "RECEIVED", "ISSUED"].map((s) => lifecycleView(s).label)
    ).toEqual(["Reserved", "PR raised", "PO raised", "Received", "Issued"])
    expect(lifecycleView("PARTIALLY_RECEIVED").label).toBe("Partly received")
    expect(lifecycleView("PARTIALLY_ISSUED").label).toBe("Partly issued")
  })

  it("never says a requisition exists when the reservation names none", () => {
    expect(lifecycleView("RESERVED").label).toBe("Reserved")
    expect(lifecycleView("RESERVED").explanation).toMatch(/no purchase requisition is linked/)
  })

  it("never says 'PR raised' when the PR's progress cannot be seen", () => {
    for (const status of ["PR_NOT_FOUND", "PR_SHARED"]) {
      expect(lifecycleView(status).label).toBe("PR – status unknown")
      expect(lifecycleView(status).explanation).toMatch(/may already be ordered or received/)
    }
    expect(lifecycleView("PR_NOT_FOUND").explanation).toMatch(/not in the data the platform holds/)
    expect(lifecycleView("PR_SHARED").explanation).toMatch(/other reservations name the same PR/)
  })

  it("says a PR SAP deleted is deleted, not raised", () => {
    expect(lifecycleView("PR_DELETED").label).toBe("PR deleted in SAP")
    expect(lifecycleView("PR_DELETED").explanation).toMatch(/EBAN-LOEKZ/)
  })

  it("marks partial stages amber and issued green", () => {
    expect(lifecycleView("PARTIALLY_RECEIVED").tone).toBe("warning")
    expect(lifecycleView("PARTIALLY_ISSUED").tone).toBe("warning")
    expect(lifecycleView("ISSUED").tone).toBe("success")
    expect(lifecycleView("RESERVED").tone).toBe("default")
  })

  it("falls back to a readable form of a value it does not know", () => {
    expect(lifecycleView("SOMETHING_NEW")).toEqual({ label: "something new", explanation: "", tone: "default" })
  })
})

describe("issuedUnknownReason", () => {
  it("is null when the issued quantity is known", () => {
    expect(issuedUnknownReason({ issuedBeforeHistory: false, movementHistoryStart: "2023-11-01" })).toBeNull()
    expect(issuedUnknownReason({})).toBeNull()
  })

  it("explains why, with the history start when there is one", () => {
    expect(issuedUnknownReason({ issuedBeforeHistory: true, movementHistoryStart: "2023-11-01" })).toMatch(
      /^Not known: .*before the goods-movement history .*2023/
    )
    expect(issuedUnknownReason({ issuedBeforeHistory: true, movementHistoryStart: null })).toMatch(/^Not known: /)
  })
})

describe("reservationStatusOption", () => {
  it("tells the two unknown-PR statuses apart, where the pills cannot", () => {
    expect(reservationStatusOption("PR_NOT_FOUND")).not.toBe(reservationStatusOption("PR_SHARED"))
    expect(reservationStatusOption("RESERVED")).toBe("Reserved")
  })
})

describe("reservationStatusQuery", () => {
  it("asks for nothing when neither filter is set", () => {
    expect(reservationStatusQuery()).toBeUndefined()
    expect(reservationStatusQuery("bogus", "bogus")).toBeUndefined()
  })

  it("sends one status as it is", () => {
    expect(reservationStatusQuery("ORDERED")).toBe("ORDERED")
    expect(reservationStatusQuery(undefined, "FULLY_ISSUED")).toBe("ISSUED")
  })

  it("reads Not issued as every status before an issue", () => {
    const sent = reservationStatusQuery(undefined, "NOT_ISSUED")!.split(",")
    expect(sent).toContain("RESERVED")
    expect(sent).toContain("RECEIVED")
    expect(sent).not.toContain("PARTIALLY_ISSUED")
    expect(sent).not.toContain("ISSUED")
  })

  it("keeps what both filters allow, and matches nothing when they disagree", () => {
    expect(reservationStatusQuery("RESERVED", "NOT_ISSUED")).toBe("RESERVED")
    expect(reservationStatusQuery("RESERVED", "FULLY_ISSUED")).toBe("NONE")
  })
})
