import { describe, expect, it } from "vitest"

import { formatIsoDateDMY } from "@/lib/utils"

describe("formatIsoDateDMY", () => {
  it("writes a calendar date as 31 May 2026", () => {
    expect(formatIsoDateDMY("2026-05-31")).toBe("31 May 2026")
    expect(formatIsoDateDMY("2026-01-05")).toBe("5 Jan 2026")
  })

  it("does not move the day with the time zone", () => {
    // new Date("2026-05-31") is midnight UTC, which is still 30 May west of Greenwich.
    expect(formatIsoDateDMY("2026-05-31T00:00:00")).toBe("31 May 2026")
  })

  it("hands back what it cannot read instead of inventing a date", () => {
    expect(formatIsoDateDMY("soon")).toBe("soon")
    expect(formatIsoDateDMY("2026-13-01")).toBe("2026-13-01")
  })
})
