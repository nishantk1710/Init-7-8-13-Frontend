import { describe, expect, it } from "vitest"

import { issuedUnknownReason, lifecycleView } from "@/features/initiative-13/utils/reservation-lifecycle"

describe("lifecycleView", () => {
  it("never calls a reservation without a PR 'PR created'", () => {
    expect(lifecycleView("RESERVED").label).toBe("Reserved (no PR)")
    expect(lifecycleView("RESERVED").explanation).toMatch(/names no purchase requisition/)
  })

  it("names the two unresolved PR cases", () => {
    expect(lifecycleView("PR_NOT_FOUND").label).toBe("PR not found")
    expect(lifecycleView("PR_SHARED").label).toBe("PR shared")
  })

  it("keeps PR created for a real PR with no PO", () => {
    expect(lifecycleView("PR_CREATED").label).toBe("PR created")
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
