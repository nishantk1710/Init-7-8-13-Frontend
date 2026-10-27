import { describe, expect, it } from "vitest"

import { parseWatchView, watchViewHref } from "@/features/initiative-13/utils/watch-view"
import { redirectTarget } from "@/features/initiative-13/utils/redirects"

describe("parseWatchView", () => {
  it("accepts each known tab", () => {
    expect(parseWatchView("metrics")).toBe("metrics")
    expect(parseWatchView("grni")).toBe("grni")
    expect(parseWatchView("usage")).toBe("usage")
  })

  it("falls back to metrics for absent or unknown values", () => {
    expect(parseWatchView(undefined)).toBe("metrics")
    expect(parseWatchView("")).toBe("metrics")
    expect(parseWatchView("reservations")).toBe("metrics")
    expect(parseWatchView("GRNI")).toBe("metrics")
  })
})

describe("watchViewHref", () => {
  it("drops view for the default tab", () => {
    expect(watchViewHref("metrics")).toBe("/oar-utilization/watch")
  })

  it("sets only view for the other tabs, so a tab opens with no filters", () => {
    expect(watchViewHref("grni")).toBe("/oar-utilization/watch?view=grni")
    expect(watchViewHref("usage")).toBe("/oar-utilization/watch?view=usage")
  })
})

describe("redirectTarget", () => {
  it("keeps the incoming query and lets overrides win", () => {
    expect(
      redirectTarget("/oar-utilization/watch", { plant: "1300", view: "x" }, { view: "grni" })
    ).toBe("/oar-utilization/watch?plant=1300&view=grni")
  })

  it("returns the bare path when there is nothing to carry", () => {
    expect(redirectTarget("/oar-utilization", {})).toBe("/oar-utilization")
  })
})
