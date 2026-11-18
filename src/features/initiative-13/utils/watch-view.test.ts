import { describe, expect, it } from "vitest"

import { parseWatchView, watchViewHref } from "@/features/initiative-13/utils/watch-view"
import { redirectTarget } from "@/features/initiative-13/utils/redirects"

describe("parseWatchView", () => {
  it("accepts each known tab", () => {
    expect(parseWatchView("grni")).toBe("grni")
    expect(parseWatchView("usage")).toBe("usage")
  })

  it("falls back to usage for absent, unknown or retired values", () => {
    expect(parseWatchView(undefined)).toBe("usage")
    expect(parseWatchView("")).toBe("usage")
    expect(parseWatchView("metrics")).toBe("usage")
    expect(parseWatchView("reservations")).toBe("usage")
    expect(parseWatchView("GRNI")).toBe("usage")
  })
})

describe("watchViewHref", () => {
  it("drops view for the default tab", () => {
    expect(watchViewHref("usage")).toBe("/oar-utilization/watch")
  })

  it("sets only view for the other tab, so it opens with no filters", () => {
    expect(watchViewHref("grni")).toBe("/oar-utilization/watch?view=grni")
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
