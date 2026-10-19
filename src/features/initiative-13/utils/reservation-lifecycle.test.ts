import { describe, expect, it } from "vitest"

import { issuedUnknownReason, lifecycleView } from "@/features/initiative-13/utils/reservation-lifecycle"

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

  it("keeps an untraceable or shared PR as 'PR raised', and says why on hover", () => {
    expect(lifecycleView("PR_NOT_FOUND").label).toBe("PR raised")
    expect(lifecycleView("PR_NOT_FOUND").explanation).toMatch(/not in the data the platform holds/)
    expect(lifecycleView("PR_SHARED").label).toBe("PR raised")
    expect(lifecycleView("PR_SHARED").explanation).toMatch(/other reservations also name/)
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
