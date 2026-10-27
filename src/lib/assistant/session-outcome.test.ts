import { describe, expect, it } from "vitest"

import { sessionOutcome, wentAheadSessionIds } from "./session-outcome"

describe("wentAheadSessionIds", () => {
  it("keeps only new-unit and quantity-override justifications that name a session", () => {
    expect(
      wentAheadSessionIds([
        { sessionId: "S1", kind: "NEW_ACQUISITION" },
        { sessionId: "S2", kind: "QUANTITY_OVERRIDE" },
        { sessionId: null, kind: "NEW_ACQUISITION" },
        { sessionId: "S3", kind: "PLAN_BREACH" },
      ])
    ).toEqual(["S1", "S2"])
  })
})

describe("sessionOutcome", () => {
  const wentAhead = new Set(["S2"])

  it("reads abandoned as not acted on, even with a justification", () => {
    expect(sessionOutcome({ sessionId: "S2", outcome: "ABANDONED" }, wentAhead)).toBe("not-acted")
  })

  it("reads a justified session as went ahead anyway", () => {
    expect(sessionOutcome({ sessionId: "S2", outcome: "COMPLETED" }, wentAhead)).toBe("went-ahead")
  })

  it("reads any other completed session as followed, and an unfinished one as still open", () => {
    expect(sessionOutcome({ sessionId: "S1", outcome: "COMPLETED" }, wentAhead)).toBe("followed")
    expect(sessionOutcome({ sessionId: "S1", outcome: "OPEN" }, wentAhead)).toBe("open")
  })
})
