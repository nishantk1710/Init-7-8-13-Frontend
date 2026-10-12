import { describe, expect, it } from "vitest"

import { auditBounds, auditHref, parseAuditFilters } from "@/components/audit/audit-params"

describe("parseAuditFilters", () => {
  it("defaults to the first page with no filters", () => {
    expect(parseAuditFilters({})).toEqual({
      initiative: undefined,
      from: undefined,
      to: undefined,
      page: 1,
    })
  })

  it("reads valid filters", () => {
    expect(
      parseAuditFilters({ initiative: "initiative-8", from: "2026-09-01", to: "2026-09-30", page: "3" })
    ).toEqual({ initiative: "initiative-8", from: "2026-09-01", to: "2026-09-30", page: 3 })
  })

  it("ignores an initiative it does not know", () => {
    expect(parseAuditFilters({ initiative: "initiative-99" }).initiative).toBeUndefined()
  })

  it("rejects a date that is not a real calendar day instead of rolling it over", () => {
    expect(parseAuditFilters({ from: "2026-02-31" }).from).toBeUndefined()
    expect(parseAuditFilters({ from: "2026-13-01" }).from).toBeUndefined()
    expect(parseAuditFilters({ from: "yesterday" }).from).toBeUndefined()
  })

  it("treats a repeated parameter as malformed rather than guessing", () => {
    expect(parseAuditFilters({ initiative: ["initiative-7", "initiative-8"] }).initiative).toBeUndefined()
    expect(parseAuditFilters({ page: ["2", "3"] }).page).toBe(1)
  })

  it("falls back to page 1 for anything that is not a positive integer", () => {
    expect(parseAuditFilters({ page: "0" }).page).toBe(1)
    expect(parseAuditFilters({ page: "-4" }).page).toBe(1)
    expect(parseAuditFilters({ page: "abc" }).page).toBe(1)
  })
})

describe("auditBounds", () => {
  it("has no bounds when no dates are chosen", () => {
    expect(auditBounds({})).toEqual({ fromTs: undefined, toTs: undefined })
  })

  it("starts at the beginning of the from day (inclusive)", () => {
    expect(auditBounds({ from: "2026-09-10" }).fromTs).toBe("2026-09-10T00:00:00Z")
  })

  it("ends at the START of the day after the to day, so the to day itself is included", () => {
    expect(auditBounds({ to: "2026-09-10" }).toTs).toBe("2026-09-11T00:00:00.000Z")
  })

  it("rolls over a month end correctly", () => {
    expect(auditBounds({ to: "2026-09-30" }).toTs).toBe("2026-10-01T00:00:00.000Z")
  })
})

describe("auditHref", () => {
  it("is plain /audit with no filters", () => {
    expect(auditHref({ page: 1 })).toBe("/audit")
  })

  it("omits the default page and keeps every filter", () => {
    expect(auditHref({ initiative: "initiative-13", from: "2026-09-01", page: 1 })).toBe(
      "/audit?initiative=initiative-13&from=2026-09-01"
    )
    expect(auditHref({ page: 2 })).toBe("/audit?page=2")
  })

  it("round-trips through the parser", () => {
    const filters = { initiative: "initiative-7" as const, from: "2026-09-01", to: "2026-09-20", page: 4 }
    const url = new URL(auditHref(filters), "http://x")
    expect(parseAuditFilters(Object.fromEntries(url.searchParams))).toEqual(filters)
  })
})
