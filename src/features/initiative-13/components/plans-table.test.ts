import { describe, expect, it } from "vitest"

import { capturedParts } from "./plans-table"

describe("capturedParts", () => {
  it("splits the captured timestamp into its day and its time, in South African time", () => {
    expect(capturedParts("2026-11-16T20:53:00Z")).toEqual({ day: "16 Nov 2026", time: "22:53" })
  })

  it("keeps the placeholder whole when there is no timestamp", () => {
    expect(capturedParts(null)).toEqual({ day: "—", time: "" })
  })
})
