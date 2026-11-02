import { describe, expect, it } from "vitest"

import { blockingReasonText } from "@/features/initiative-7/utils/blocking-reason"

describe("blockingReasonText", () => {
  it("puts the no-neighbours blocker in words", () => {
    expect(blockingReasonText("NO_SIMILAR_MATERIALS_FOUND")).toMatch(/No similar materials were found/)
  })

  it("reads an older row's SUCCESS (the search's status, not a result) the same way", () => {
    expect(blockingReasonText("SUCCESS")).toBe(blockingReasonText("NO_SIMILAR_MATERIALS_FOUND"))
  })

  it("explains too few and none-qualifying neighbours differently", () => {
    expect(blockingReasonText("NOT_EVALUABLE_INSUFFICIENT_NEIGHBOURS")).toMatch(/Too few/)
    expect(blockingReasonText("NO_ELIGIBLE_NEIGHBORS")).toMatch(/None of the similar materials qualified/)
  })

  it("explains an unsigned service level", () => {
    expect(blockingReasonText("SERVICE_LEVEL_UNSET")).toMatch(/service level/)
  })

  it("shows an unknown reason exactly as the backend wrote it, never a guess", () => {
    expect(blockingReasonText("safety stock status=X, rop status=X")).toBe("safety stock status=X, rop status=X")
  })
})
