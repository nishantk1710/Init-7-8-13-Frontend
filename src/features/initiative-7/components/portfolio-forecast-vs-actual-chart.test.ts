import { describe, expect, it } from "vitest"

import { monthLabel } from "./portfolio-forecast-vs-actual-chart"

describe("monthLabel", () => {
  it("turns a first-of-month date into a readable month", () => {
    expect(monthLabel("2026-03-01")).toBe("Mar 2026")
    expect(monthLabel("2025-12-01")).toBe("Dec 2025")
  })

  it("leaves something that is not a date as it is", () => {
    expect(monthLabel("not-a-date")).toBe("not-a-date")
  })
})
