import { describe, expect, it } from "vitest"

import { DETAIL_TABS, resolveDetailTab } from "./detail-tabs"

describe("resolveDetailTab", () => {
  it("opens the tab the link names", () => {
    expect(resolveDetailTab("plans")).toBe("plans")
  })

  it("opens Non-movers for the retired exceptions tab", () => {
    // The Exceptions screen owns the queue now; old dashboard links still work.
    expect(resolveDetailTab("exceptions")).toBe("non-movers")
  })

  it("opens Non-movers when no tab is named", () => {
    expect(resolveDetailTab(undefined)).toBe("non-movers")
  })

  it("no longer offers an exceptions tab", () => {
    expect(DETAIL_TABS).not.toContain("exceptions")
  })
})
