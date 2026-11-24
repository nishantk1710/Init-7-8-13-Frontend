import { describe, expect, it } from "vitest"

import { formatRebuiltAt } from "@/features/initiative-7/utils/rebuilt-at"

describe("formatRebuiltAt", () => {
  const BUILT = "2026-11-23T18:04:13Z"

  it("shows the date and the time, with the viewer's zone named", () => {
    const text = formatRebuiltAt(BUILT, "Asia/Kolkata")
    expect(text?.label).toBe("23 Nov 2026, 23:34 GMT+5:30")
  })

  it("moves to the next day for a zone far enough ahead", () => {
    expect(formatRebuiltAt("2026-11-23T20:00:00Z", "Asia/Kolkata")?.label).toContain("24 Nov 2026, 01:30")
  })

  it("gives the same moment in UTC in the tooltip, whatever the viewer's zone", () => {
    expect(formatRebuiltAt(BUILT, "Asia/Kolkata")?.title).toBe("Rebuilt 23 Nov 2026, 18:04 UTC")
    expect(formatRebuiltAt(BUILT, "America/New_York")?.title).toBe("Rebuilt 23 Nov 2026, 18:04 UTC")
  })

  it("uses a 24-hour clock", () => {
    expect(formatRebuiltAt("2026-11-23T13:05:00Z", "UTC")?.label).toContain("13:05")
  })

  it("is null for nothing or for something that is not a date, so no badge is made up", () => {
    expect(formatRebuiltAt(null)).toBeNull()
    expect(formatRebuiltAt(undefined)).toBeNull()
    expect(formatRebuiltAt("")).toBeNull()
    expect(formatRebuiltAt("not a date")).toBeNull()
  })
})
